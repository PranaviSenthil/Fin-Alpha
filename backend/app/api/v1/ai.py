import json
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from pydantic import BaseModel

logger = logging.getLogger(__name__)
from app.ai.intelligence import ai_intelligence
from app.ai.market_agent import market_analysis_agent
from app.ai.financial_agent import financial_research_agent
from app.ai.portfolio_agent import portfolio_analysis_agent
from app.ai.behavior_agent import trading_behavior_agent
from app.ai.orchestrator import central_ai_orchestrator
from app.ai.rag.retriever import document_retriever
from app.ai.rag.ingestion import DocumentIngestionError
from app.ai.rag.seed_data import seed_financial_documents
from app.ai.schemas import DocumentIngestRequest
from app.api.v1.auth import get_current_user
from app.core.database import get_db
from app.core.utils import sanitize_for_json

from app.ai.gemini_service import gemini_service
from app.market_data.service import market_data_service
from app.market_data.symbols import SYMBOL_MAP
from app.api.v1.auth import get_current_user, security
from app.core.security import decode_access_token
from fastapi.security import HTTPAuthorizationCredentials

router = APIRouter(prefix="/ai", tags=["AI Investment Intelligence & Specialized Agents"])

class CompanyResearchRequest(BaseModel):
    symbol: str
    query: Optional[str] = None

class OrchestrationRequest(BaseModel):
    query: Optional[str] = "comprehensive_audit"
    symbol: Optional[str] = None
    requested_agents: Optional[List[str]] = None

class ChatMessage(BaseModel):
    role: str  # 'user' | 'assistant' | 'system'
    content: str

class AIChatRequest(BaseModel):
    query: str
    symbol: Optional[str] = None
    section: Optional[str] = None  # 'stocks' | 'markets' | 'ai' | 'portfolio'
    conversation_history: Optional[List[ChatMessage]] = None
    session_id: Optional[str] = None

def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[dict]:
    if not credentials:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        if not payload or "sub" not in payload:
            return None
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, email, full_name, is_active FROM users WHERE id = ?", (payload["sub"],))
            user = cursor.fetchone()
            return dict(user) if user and user["is_active"] else None
    except Exception:
        return None

def detect_comparison_symbol(query: str, active_symbol: Optional[str] = None) -> Optional[str]:
    """Detect if the user is asking about or comparing with another company."""
    q_upper = query.upper()
    q_lower = query.lower()
    
    # Priority check for common Indian company names and tickers
    company_aliases = {
        "INFOSYS": "INFY",
        "INFY": "INFY",
        "TCS": "TCS",
        "TATA CONSULTANCY": "TCS",
        "RELIANCE": "RELIANCE",
        "HDFC": "HDFCBANK",
        "HDFC BANK": "HDFCBANK",
        "HDFCBANK": "HDFCBANK",
        "ICICI": "ICICIBANK",
        "ICICI BANK": "ICICIBANK",
        "STATE BANK": "SBIN",
        "SBI": "SBIN",
        "SBIN": "SBIN",
        "WIPRO": "WIPRO",
        "HCL": "HCLTECH",
        "HCL TECH": "HCLTECH",
        "HCLTECH": "HCLTECH",
        "TECH MAHINDRA": "TECHM",
        "TECHM": "TECHM",
        "TATA MOTORS": "TATAMOTORS",
        "TATAMOTORS": "TATAMOTORS",
        "MARUTI": "MARUTI",
        "BAJFINANCE": "BAJFINANCE",
        "BAJAJ FINANCE": "BAJFINANCE",
        "BHARTI": "BHARTIARTL",
        "AIRTEL": "BHARTIARTL",
        "BHARTIARTL": "BHARTIARTL",
        "L&T": "LT",
        "LT": "LT",
        "LARSEN": "LT",
        "ITC": "ITC",
        "KOTAK": "KOTAKBANK",
        "KOTAK BANK": "KOTAKBANK",
        "AXIS": "AXISBANK",
        "AXIS BANK": "AXISBANK",
        "SUN PHARMA": "SUNPHARMA",
        "SUNPHARMA": "SUNPHARMA",
        "TITAN": "TITAN",
        "ASIAN PAINTS": "ASIANPAINT",
        "ASIANPAINT": "ASIANPAINT"
    }

    # Match aliases against query
    for name, target_sym in company_aliases.items():
        if name in q_upper or name.lower() in q_lower:
            # If it's different from the currently active symbol, return as comparison
            clean_active = active_symbol.replace(".NS", "").replace(".BO", "") if active_symbol else None
            if not clean_active or target_sym != clean_active:
                return target_sym

    # Fallback to general symbols in SYMBOL_MAP
    for sym, meta in SYMBOL_MAP.items():
        clean_sym = sym.replace(".NS", "").replace(".BO", "")
        clean_active = active_symbol.replace(".NS", "").replace(".BO", "") if active_symbol else None
        if clean_sym != clean_active:
            if clean_sym in q_upper.split() or (meta.get("name") and meta["name"].lower() in q_lower):
                return clean_sym

    return None

# --- Conversational AI Agent (Google Gemini) Endpoints ---

@router.get("/chat/status")
def get_chat_status():
    """Returns Google Gemini API status without revealing secrets."""
    gemini_service.key_manager.refresh_keys()
    pool = gemini_service.key_manager.get_pool_status()
    return sanitize_for_json({
        "provider": "Google Gemini",
        "has_usable_key": pool.get("has_usable_key", False),
        "is_configured": pool.get("is_configured", False),
        "pool": pool,
        "model": gemini_service.model
    })

@router.post("/chat")
def post_ai_chat(req: AIChatRequest, user: Optional[dict] = Depends(get_optional_user)):
    """
    Conversational AI Market & Financial Research Agent powered by Google Gemini.
    Supports continuous chat history, symbol selection, grounded stock data, and safety boundaries.
    """
    symbol = req.symbol.strip().upper() if req.symbol else None
    meta = None
    if symbol:
        meta = SYMBOL_MAP.get(symbol)
        if not meta and not symbol.endswith(".NS"):
            alt_sym = f"{symbol}.NS"
            if alt_sym in SYMBOL_MAP:
                symbol = alt_sym
                meta = SYMBOL_MAP.get(symbol)

    stock_context = None
    scenarios_list = []

    if symbol:
        try:
            quote = market_data_service.get_stock_quote(symbol)
            fundamentals = market_data_service.get_fundamentals(symbol)
            history = market_data_service.get_history(symbol, period="6mo", interval="1d")
            indicators = market_data_service.calculate_indicators(history)
            market_res = market_analysis_agent.analyze(symbol)
            fin_res = financial_research_agent.analyze(symbol)

            scenarios_raw = fin_res.scenarios or market_res.scenarios or []
            scenarios_list = [s.model_dump() for s in scenarios_raw]

            from app.market_data.reference_data import REFERENCE_STOCK_DATA
            ref = REFERENCE_STOCK_DATA.get(symbol.replace(".NS", ""), {})

            stock_context = {
                "symbol": symbol.replace(".NS", ""),
                "name": meta["name"] if meta else symbol,
                "exchange": meta.get("exchange", "NSE") if meta else "NSE",
                "sector_name": meta.get("sector_name", "N/A") if meta else "N/A",
                "subsector": meta.get("subsector", "N/A") if meta else "N/A",
                "business_summary": getattr(fundamentals, "business_summary", None) or f"{meta['name'] if meta else symbol} is an Indian exchange-listed company operating in the {meta.get('sector_name', 'equity')} sector, specializing in {meta.get('subsector', 'operations')}.",
                "price": quote.price,
                "change_pct": quote.change_pct,
                "previous_close": quote.previous_close or ref.get("prev_close"),
                "day_high": quote.day_high,
                "day_low": quote.day_low,
                "volume": quote.volume,
                "high_52w": getattr(fundamentals, "high_52w", None) or ref.get("high_52w"),
                "low_52w": getattr(fundamentals, "low_52w", None) or ref.get("low_52w"),
                "eps": getattr(fundamentals, "eps", None),
                "data_status": quote.data_status,
                "fetched_at": quote.fetched_at,
                "rsi_14": indicators.get("latest", {}).get("rsi14"),
                "sma_20": indicators.get("latest", {}).get("sma20"),
                "sma_50": indicators.get("latest", {}).get("sma50"),
                "sma_200": indicators.get("latest", {}).get("sma200"),
                "volatility_30d": market_res.supporting_data.get("volatility_30d_pct"),
                "support_level": market_res.supporting_data.get("support_level"),
                "resistance_level": market_res.supporting_data.get("resistance_level"),
                "pe_ratio": fundamentals.pe_ratio or ref.get("pe"),
                "pb_ratio": fundamentals.pb_ratio or ref.get("pb"),
                "roe_pct": fin_res.supporting_data.get("roe") or getattr(fundamentals, "roe", None) or ref.get("roe"),
                "debt_to_equity_ratio": fin_res.supporting_data.get("debt_to_equity") or getattr(fundamentals, "debt_to_equity_ratio", None),
                "debt_classification": fin_res.supporting_data.get("debt_classification") or getattr(fundamentals, "debt_classification", "Verified Balance Sheet"),
                "balance_sheet_debt": getattr(fundamentals, "balance_sheet_debt", None),
                "market_cap": round(fundamentals.market_cap / 1e7, 2) if fundamentals.market_cap else (round(ref.get("market_cap", 0) / 1e7, 2) if ref.get("market_cap") else None),
                "dividend_yield": fin_res.supporting_data.get("dividend_yield") or getattr(fundamentals, "dividend_yield", None),
                "scenarios": scenarios_list
            }

            # Check if comparison stock mentioned
            comp_sym = detect_comparison_symbol(req.query, symbol)
            if comp_sym:
                try:
                    c_quote = market_data_service.get_stock_quote(comp_sym)
                    c_fund = market_data_service.get_fundamentals(comp_sym)
                    c_hist = market_data_service.get_history(comp_sym, period="3mo", interval="1d")
                    c_ind = market_data_service.calculate_indicators(c_hist)
                    c_meta = SYMBOL_MAP.get(comp_sym, {})
                    stock_context["comparison"] = {
                        "symbol": comp_sym,
                        "name": c_meta.get("name", comp_sym),
                        "sector_name": c_meta.get("sector_name", "N/A"),
                        "price": c_quote.price,
                        "change_pct": c_quote.change_pct,
                        "pe_ratio": c_fund.pe_ratio,
                        "pb_ratio": c_fund.pb_ratio,
                        "roe_pct": c_fund.roe,
                        "debt_to_equity_ratio": c_fund.debt_to_equity_ratio,
                        "market_cap": round(c_fund.market_cap / 1e7, 2) if c_fund.market_cap else None,
                        "rsi_14": c_ind.get("latest", {}).get("rsi14"),
                        "sma_50": c_ind.get("latest", {}).get("sma50"),
                    }
                except Exception as ce:
                    logger.debug(f"Comparison stock lookup failed for {comp_sym}: {ce}")

        except Exception as e:
            # Fallback to basic reference info if provider fails
            stock_context = {
                "symbol": symbol.replace(".NS", ""),
                "name": meta["name"] if meta else symbol,
                "warning": f"Partial market data loaded: {str(e)}"
            }
    else:
        # Macro market context
        try:
            overview = market_data_service.get_market_overview()
            stock_context = {
                "type": "macro_market",
                "overview": overview
            }
        except Exception:
            stock_context = {"type": "macro_market"}

    # Authenticated user portfolio grounding if requested or in portfolio section
    q_low = req.query.lower()
    is_portfolio_query = (req.section == "portfolio" or any(w in q_low for w in ["portfolio", "holdings", "my shares", "my balance", "my stock", "unrealized"]))
    if user and is_portfolio_query:
        try:
            from app.trading.engine import trading_engine
            account = trading_engine.get_or_create_account(user["id"])
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM holdings WHERE account_id = ?", (account["id"],))
                u_holdings = [dict(h) for h in cursor.fetchall()]
            
            tot_inv = 0.0
            tot_val = 0.0
            stock_position = None
            clean_sym = symbol.replace(".NS", "") if symbol else None

            for h in u_holdings:
                h_sym = h["symbol"].replace(".NS", "")
                h_quote = market_data_service.get_stock_quote(h_sym)
                h_curr = h_quote.price or h["average_price"]
                h_inv = round(h["quantity"] * h["average_price"], 2)
                h_val = round(h["quantity"] * h_curr, 2)
                tot_inv += h_inv
                tot_val += h_val

                if clean_sym and h_sym == clean_sym:
                    stock_position = {
                        "quantity": h["quantity"],
                        "average_price": h["average_price"],
                        "current_price": h_curr,
                        "unrealized_pnl": round(h_val - h_inv, 2)
                    }

            if not stock_context:
                stock_context = {"type": "portfolio"}

            stock_context["user_portfolio"] = {
                "cash_balance": account.get("virtual_balance", 0.0),
                "total_invested": tot_inv,
                "total_market_value": tot_val,
                "total_value": tot_val + account.get("virtual_balance", 0.0),
                "holdings_count": len(u_holdings)
            }
            if stock_position:
                stock_context["user_stock_position"] = stock_position

        except Exception as pe:
            logger.debug(f"User portfolio context injection skipped: {pe}")

    # Assemble conversation messages
    messages = []
    if req.conversation_history:
        for m in req.conversation_history:
            messages.append({"role": m.role, "content": m.content})
    
    # Add latest query
    messages.append({"role": "user", "content": req.query})

    # Call Google Gemini service
    gemini_result = gemini_service.chat(
        messages=messages,
        stock_context=stock_context
    )

    return sanitize_for_json({
        "success": gemini_result.get("success", False),
        "reply": gemini_result.get("reply", ""),
        "error": gemini_result.get("error"),
        "rate_limited": gemini_result.get("rate_limited", False),
        "unconfigured": gemini_result.get("unconfigured", False),
        "provider": "Google Gemini",
        "model": gemini_result.get("model", gemini_service.model),
        "key_masked": gemini_result.get("key_masked"),
        "key_index": gemini_result.get("key_index"),
        "symbol": symbol.replace(".NS", "") if symbol else None,
        "stock_context": stock_context,
        "scenarios": scenarios_list,
        "pool_status": gemini_service.key_manager.get_pool_status(),
        "disclaimer": "Educational financial research. Not SEBI-registered financial advice. Does not constitute a buy, sell, or hold recommendation."
    })

# --- Specialized Agents Endpoints ---

@router.get("/agents/market")
@router.post("/agents/market")
@router.get("/market-intelligence")
def get_market_agent_analysis(
    symbol: Optional[str] = Query(None),
    req: Optional[CompanyResearchRequest] = None
):
    """
    Agent 1: Market Analysis Agent.
    Evaluates historical trends, technical momentum, volume anomalies,
    RSI, moving averages, support/resistance, and volatility for macro market or specific stock.
    """
    target_sym = (req.symbol if req and req.symbol else symbol)
    res = market_analysis_agent.analyze(target_sym)
    return sanitize_for_json(res.model_dump())

@router.get("/agents/financial/{symbol}")
def get_financial_agent_by_symbol(symbol: str, query: Optional[str] = Query(None)):
    """
    Agent 2: Financial Research Agent (GET).
    Analyzes fundamentals, valuation multiples, balance sheet, and synthesizes retrieved documentary filings.
    """
    res = financial_research_agent.analyze(symbol, query=query)
    return sanitize_for_json(res.model_dump())

@router.get("/financial-research")
def get_financial_research_query(symbol: Optional[str] = Query(None), query: Optional[str] = Query(None)):
    """
    Financial Research Query endpoint with optional symbol query param.
    """
    target_sym = symbol or "TCS"
    res = financial_research_agent.analyze(target_sym, query=query)
    return sanitize_for_json(res.model_dump())

@router.post("/agents/financial")
def post_financial_agent_analysis(req: CompanyResearchRequest):
    """
    Agent 2: Financial Research Agent (POST).
    Analyzes fundamentals, valuation multiples, balance sheet, and synthesizes retrieved documentary filings.
    """
    res = financial_research_agent.analyze(req.symbol, query=req.query)
    return sanitize_for_json(res.model_dump())

@router.get("/agents/portfolio")
@router.post("/agents/portfolio")
@router.get("/portfolio-analysis")
def get_portfolio_agent_analysis(current_user: dict = Depends(get_current_user)):
    """
    Agent 3: Portfolio Analysis Agent.
    Audits actual user holdings, unrealized/realized P&L, sector weights, concentration risks, and rebalancing scenarios.
    """
    res = portfolio_analysis_agent.analyze(current_user["id"])
    return sanitize_for_json(res.model_dump())

@router.get("/agents/behavior")
@router.post("/agents/behavior")
@router.get("/trading-behavior")
def get_behavior_agent_analysis(current_user: dict = Depends(get_current_user)):
    """
    Agent 4: Trading Behavior Analysis Agent.
    Evaluates observable transaction sequences, position-size variance, overtrading metrics, and risk alignment.
    """
    res = trading_behavior_agent.analyze(current_user["id"])
    return sanitize_for_json(res.model_dump())

# --- Central Orchestrator Endpoint ---

@router.post("/orchestrate")
def post_orchestrated_analysis(
    req: OrchestrationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Central AI Orchestration Layer.
    Dispatches to requested agents concurrently, isolates cross-agent conflicts,
    synthesizes multi-factor conclusions, and returns a unified report.
    """
    res = central_ai_orchestrator.orchestrate(
        query=req.query or "comprehensive_audit",
        symbol=req.symbol,
        user_id=current_user["id"],
        requested_agents=req.requested_agents
    )
    return sanitize_for_json(res.model_dump())

# --- Legacy Endpoints Preserved for Backwards Compatibility ---

@router.post("/market-analysis")
def post_market_analysis(symbol: Optional[str] = Query(None)):
    """Macro market pulse / stock market intelligence."""
    if symbol:
        res = market_analysis_agent.analyze(symbol)
        return sanitize_for_json(res.model_dump())
    return sanitize_for_json(ai_intelligence.analyze_market())

@router.post("/company-research")
def post_company_research(req: CompanyResearchRequest):
    """Generate comprehensive AI research report for any symbol from the 100-stock universe."""
    res = financial_research_agent.analyze(req.symbol)
    return sanitize_for_json(res.model_dump())

@router.post("/portfolio-analysis")
def post_portfolio_analysis(current_user: dict = Depends(get_current_user)):
    """Generate AI diagnostic report on user's active holdings, risk, and concentration."""
    res = portfolio_analysis_agent.analyze(current_user["id"])
    return sanitize_for_json(res.model_dump())

@router.post("/behavior-analysis")
def post_behavior_analysis(current_user: dict = Depends(get_current_user)):
    """Analyze simulated trading patterns, win rate, and emotional discipline."""
    res = trading_behavior_agent.analyze(current_user["id"])
    return sanitize_for_json(res.model_dump())

@router.post("/comprehensive-analysis")
def post_comprehensive_analysis(
    req: Optional[CompanyResearchRequest] = None,
    current_user: dict = Depends(get_current_user)
):
    """Multi-factor synthesis combining market regime, company research, and user portfolio."""
    res = central_ai_orchestrator.orchestrate(
        query="comprehensive_analysis",
        symbol=req.symbol if req else None,
        user_id=current_user["id"]
    )
    return sanitize_for_json(res.model_dump())

@router.get("/analysis-history")
def list_analysis_history(current_user: dict = Depends(get_current_user)):
    """List persistent AI analysis runs (retained for backend logging / compliance)."""
    user_id = current_user["id"]
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, user_id, analysis_type, target_symbol, title, summary, created_at
            FROM ai_analysis_runs
            WHERE user_id = ? OR user_id IS NULL
            ORDER BY created_at DESC LIMIT 20
        """, (user_id,))
        runs = [dict(r) for r in cursor.fetchall()]
        return {"count": len(runs), "runs": runs}

@router.get("/analysis-history/{run_id}")
def get_analysis_run(run_id: str):
    """Retrieve full details of a saved AI analysis run."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM ai_analysis_runs WHERE id = ?", (run_id,))
        run = cursor.fetchone()
        if not run:
            raise HTTPException(status_code=404, detail="Analysis run not found.")
        
        run_dict = dict(run)
        run_dict["details"] = json.loads(run_dict["details_json"])
        run_dict["evidence_citations"] = json.loads(run_dict["evidence_citations_json"])
        del run_dict["details_json"]
        del run_dict["evidence_citations_json"]
        return sanitize_for_json(run_dict)

# --- Financial Document Ingestion & RAG Corpus Endpoints ---

class DocumentSearchRequest(BaseModel):
    symbol: str
    query: str
    top_k: Optional[int] = 4

@router.post("/documents/ingest")
def ingest_document(req: DocumentIngestRequest):
    """
    Ingest a financial document (plain text, markdown, or HTML) into the RAG corpus.
    Deduplicates automatically using SHA-256 content hashing.
    """
    try:
        res = document_retriever.store_document(
            symbol=req.symbol,
            title=req.title,
            doc_type=req.doc_type,
            publisher=req.publisher,
            source_url=req.source_url,
            publication_date=req.publication_date,
            raw_text=req.content or req.text,
            file_type=req.file_type or "text",
            page_or_section=req.page_or_section,
            metadata=req.metadata
        )
        return sanitize_for_json({"success": True, **res})
    except DocumentIngestionError as de:
        raise HTTPException(status_code=400, detail=str(de))
    except Exception as e:
        logger.error(f"Error ingesting financial document: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to ingest document: {str(e)}")

@router.post("/documents/upload")
async def upload_document_file(
    file: UploadFile = File(...),
    symbol: str = Form(...),
    title: str = Form(...),
    doc_type: str = Form("filing"),
    publisher: str = Form("Company Disclosures"),
    source_url: Optional[str] = Form(None),
    publication_date: Optional[str] = Form(None),
    page_or_section: Optional[str] = Form(None)
):
    """
    Upload a financial document file (PDF, TXT, HTML, or Markdown) for ingestion.
    """
    try:
        content_bytes = await file.read()
        filename = (file.filename or "").lower()
        file_type = "pdf" if filename.endswith(".pdf") else "html" if filename.endswith((".html", ".htm")) else "text"

        res = document_retriever.store_document(
            symbol=symbol,
            title=title,
            doc_type=doc_type,
            publisher=publisher,
            source_url=source_url,
            publication_date=publication_date,
            file_bytes=content_bytes,
            file_type=file_type,
            page_or_section=page_or_section
        )
        return sanitize_for_json(res)
    except DocumentIngestionError as de:
        raise HTTPException(status_code=400, detail=str(de))
    except Exception as e:
        logger.error(f"Error uploading financial document: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process uploaded file: {str(e)}")

@router.get("/documents")
def list_ingested_documents(symbol: Optional[str] = Query(None)):
    """List all ingested corporate financial documents, optionally filtered by symbol."""
    docs = document_retriever.list_documents(symbol=symbol)
    return sanitize_for_json({"count": len(docs), "documents": docs})

@router.get("/documents/{doc_id}")
def get_document_details(doc_id: str):
    """Get complete document metadata and all chunk passages."""
    doc = document_retriever.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return sanitize_for_json({"success": True, "document": doc, **doc})

@router.delete("/documents/{doc_id}")
def delete_document_record(doc_id: str):
    """Delete a document and its chunks from the RAG database."""
    deleted = document_retriever.delete_document(doc_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found or already deleted.")
    return {"success": True, "message": f"Document {doc_id} deleted."}

@router.post("/documents/search")
def search_document_corpus(req: DocumentSearchRequest):
    """
    Execute a direct retrieval query against a company's document corpus.
    Returns ranked evidence chunks with relevance scores.
    """
    clean_sym = req.symbol.strip().upper().replace(".NS", "").replace(".BO", "")
    chunks = document_retriever.retrieve(
        symbol=clean_sym,
        query=req.query,
        top_k=req.top_k or 4
    )
    conflicts = document_retriever.detect_conflicts(chunks)
    return sanitize_for_json({
        "symbol": clean_sym,
        "query": req.query,
        "count": len(chunks),
        "chunks": [c.model_dump() for c in chunks],
        "results": [c.model_dump() for c in chunks],
        "conflicts": conflicts
    })

@router.post("/documents/seed")
def seed_default_corpus():
    """Seed or refresh the default genuine financial documents corpus."""
    res = seed_financial_documents()
    return sanitize_for_json(res)

@router.get("/observability/metrics")
def get_observability_metrics():
    """
    Measure and return key session observability metrics:
    1. Agent & Orchestrator Latencies (real-time ms stats)
    2. Portfolio Risk Concentration (HHI Index)
    3. Signal Classification Evaluation against historical time-separated dataset
    """
    from app.ai.observability import observability_tracker
    report = observability_tracker.get_comprehensive_metrics()
    return sanitize_for_json(report)
