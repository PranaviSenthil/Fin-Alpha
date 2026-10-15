import pytest
import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import init_db, seed_master_data, get_db
from app.core.security import create_access_token
from app.trading.engine import trading_engine
from app.ai.market_agent import market_analysis_agent
from app.ai.financial_agent import financial_research_agent
from app.ai.portfolio_agent import portfolio_analysis_agent
from app.ai.behavior_agent import trading_behavior_agent
from app.ai.orchestrator import central_ai_orchestrator
from app.ai.gemini_service import gemini_service
from app.ai.schemas import AgentResponse, OrchestratedAnalysis

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    seed_master_data()

def create_isolated_user(risk_profile="moderate"):
    user_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (id, email, hashed_password, full_name, is_active, created_at)
            VALUES (?, ?, 'hashed_pass_test', ?, 1, ?)
        """, (user_id, f"test_user_{user_id[:8]}@vibefinance.in", f"Tester {user_id[:6]}", now_iso))
        cursor.execute("""
            INSERT INTO user_preferences (user_id, risk_profile, investment_horizon, updated_at)
            VALUES (?, ?, 'medium_term', ?)
        """, (user_id, risk_profile, now_iso))
    token = create_access_token(user_id)
    return user_id, token


# ----------------------------------------------------------------------
# Workflow 1: Selecting a stock and retrieving its market analysis
# ----------------------------------------------------------------------
def test_wf1_market_analysis_stock_selection():
    # Direct agent invocation
    res = market_analysis_agent.analyze("TCS")
    assert isinstance(res, AgentResponse)
    assert res.entity == "TCS"
    assert res.agent_name == "Market Analysis Agent"
    assert any(w in res.signal.lower() for w in ["bullish", "bearish", "neutral", "overbought", "oversold", "sideways"])
    assert "rsi_14" in res.supporting_data
    assert "sma_20" in res.supporting_data
    assert "volume_anomaly_ratio" in res.supporting_data
    assert "volatility_30d_pct" in res.supporting_data or "volatility_30d" in res.supporting_data
    assert res.scenarios is not None and len(res.scenarios) == 3
    assert res.data_freshness in ["realtime", "simulated", "cached", "fresh"]

    # API endpoint invocation (both /market-intelligence and /agents/market)
    api_resp = client.get("/api/v1/ai/market-intelligence?symbol=TCS")
    assert api_resp.status_code == 200
    data = api_resp.json()
    assert data["entity"] == "TCS"
    assert "rsi_14" in data["supporting_data"]

    agent_resp = client.get("/api/v1/ai/agents/market?symbol=TCS")
    assert agent_resp.status_code == 200
    assert agent_resp.json()["entity"] == "TCS"


# ----------------------------------------------------------------------
# Workflow 2: Financial research with RAG and verifying citations
# ----------------------------------------------------------------------
def test_wf2_financial_research_rag_citations():
    res = financial_research_agent.analyze(symbol="TCS", query="cloud transformation revenue and operating margin")
    assert isinstance(res, AgentResponse)
    assert res.entity == "TCS"
    assert len(res.key_findings) > 0

    # Verify RAG citations
    assert res.citations is not None
    assert len(res.citations) > 0
    first_cit = res.citations[0]
    assert "CIT-" in first_cit.citation_id
    assert first_cit.source_url.startswith("http")
    assert "tcs.com" in first_cit.source_url
    assert len(first_cit.passage) > 20


# ----------------------------------------------------------------------
# Workflow 3: Opening a document source from the frontend (API)
# ----------------------------------------------------------------------
def test_wf3_open_document_source_endpoint():
    # 1. List documents
    docs_resp = client.get("/api/v1/ai/documents")
    assert docs_resp.status_code == 200
    docs = docs_resp.json()["documents"]
    assert len(docs) >= 4

    symbols = [d["symbol"] for d in docs]
    assert "TCS" in symbols
    assert "RELIANCE" in symbols
    assert "INFY" in symbols
    assert "HDFCBANK" in symbols

    # Check verifiable official URLs
    verified_docs = [d for d in docs if d.get("source_url")]
    assert len(verified_docs) >= 4
    for doc in verified_docs:
        assert doc["source_url"].startswith("http")
        assert any(domain in doc["source_url"] for domain in ["tcs.com", "ril.com", "infosys.com", "hdfcbank.com", "nseindia.com"])

    # 2. Retrieve specific document chunks
    first_id = docs[0]["id"]
    detail_resp = client.get(f"/api/v1/ai/documents/{first_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["document"]["id"] == first_id
    assert len(detail["chunks"]) > 0
    assert "text" in detail["chunks"][0]


# ----------------------------------------------------------------------
# Workflow 4: Orchestrator preserving agent disagreements and metrics
# ----------------------------------------------------------------------
def test_wf4_orchestrator_conflict_preservation_and_metrics():
    orch = central_ai_orchestrator.orchestrate(symbol="RELIANCE", query="oil to chemicals growth vs retail expansion")
    assert isinstance(orch, OrchestratedAnalysis)
    assert orch.target_symbol == "RELIANCE"
    assert any("Market" in a or "Financial" in a for a in orch.agents_involved)
    assert orch.executive_summary != ""

    # Citations must survive orchestrator synthesis
    assert orch.all_citations is not None
    assert len(orch.all_citations) > 0

    # Observability metrics attached
    assert orch.execution_metrics is not None
    assert "agent_latencies_ms" in orch.execution_metrics

    # Cross-agent conflicts list preserved
    assert isinstance(orch.cross_agent_conflicts, list)


# ----------------------------------------------------------------------
# Workflow 5: Analyzing a portfolio containing real test holdings
# ----------------------------------------------------------------------
def test_wf5_portfolio_analysis_with_isolated_holdings():
    user_id, token = create_isolated_user()
    acc = trading_engine.get_or_create_account(user_id)

    # Place two real paper trades to establish holdings
    order1 = trading_engine.place_order(user_id, "TCS", "BUY", "MARKET", 10, current_market_price=3500.0)
    assert order1["success"] is True
    order2 = trading_engine.place_order(user_id, "RELIANCE", "BUY", "MARKET", 5, current_market_price=2800.0)
    assert order2["success"] is True

    # Run Portfolio Agent
    res = portfolio_analysis_agent.analyze(user_id=user_id)
    assert isinstance(res, AgentResponse)
    assert res.entity == "PORTFOLIO"
    assert res.supporting_data["active_positions_count"] == 2
    assert res.supporting_data["total_market_value"] > 0
    assert "sector_allocation" in res.supporting_data
    assert len(res.supporting_data["holdings"]) == 2


# ----------------------------------------------------------------------
# Workflow 6: Empty state for user without holdings (no fake positions)
# ----------------------------------------------------------------------
def test_wf6_portfolio_empty_state_without_fabrication():
    user_id, token = create_isolated_user()

    res = portfolio_analysis_agent.analyze(user_id=user_id)
    assert isinstance(res, AgentResponse)
    assert res.signal == "100% Cash / Inactive"
    assert res.supporting_data["holdings_count"] == 0
    assert len(res.supporting_data["holdings"]) == 0
    assert any("zero equity market risk" in f.lower() or "first trade" in res.summary.lower() for f in res.key_findings)


# ----------------------------------------------------------------------
# Workflow 7: Analyzing trading behavior using test transaction records
# ----------------------------------------------------------------------
def test_wf7_trading_behavior_with_test_transactions():
    user_id, token = create_isolated_user()

    # Execute Buy and Sell
    trading_engine.place_order(user_id, "INFY", "BUY", "MARKET", 15, current_market_price=1500.0)
    trading_engine.place_order(user_id, "INFY", "SELL", "MARKET", 5, current_market_price=1550.0)

    res = trading_behavior_agent.analyze(user_id=user_id)
    assert isinstance(res, AgentResponse)
    assert res.supporting_data["total_trades"] >= 2
    assert "average_trade_size" in res.supporting_data
    assert "sizing_cv_pct" in res.supporting_data
    assert "not psychological" in res.disclaimer.lower() or "not a clinical" in res.disclaimer.lower()


# ----------------------------------------------------------------------
# Workflow 8: Different user risk profiles receiving different assessments
# ----------------------------------------------------------------------
def test_wf8_risk_profiles_differential_assessment():
    user_cons, _ = create_isolated_user(risk_profile="conservative")
    user_agg, _ = create_isolated_user(risk_profile="aggressive")

    # Place a large 80-share trade (>25% portfolio capital)
    trading_engine.place_order(user_cons, "TCS", "BUY", "MARKET", 80, current_market_price=3500.0)
    trading_engine.place_order(user_agg, "TCS", "BUY", "MARKET", 80, current_market_price=3500.0)

    res_cons = trading_behavior_agent.analyze(user_id=user_cons)
    res_agg = trading_behavior_agent.analyze(user_id=user_agg)

    # Conservative profile must trigger profile misalignment warning
    assert "Misaligned" in res_cons.supporting_data["risk_alignment"]
    assert "Aligned" in res_agg.supporting_data["risk_alignment"]


# ----------------------------------------------------------------------
# Workflow 9: Handling missing or stale data source gracefully
# ----------------------------------------------------------------------
def test_wf9_missing_or_stale_data_source_handling():
    # Unsupported market symbol
    res_mkt = market_analysis_agent.analyze("NONEXISTENT_XYZ_999")
    assert res_mkt.signal == "Unavailable"
    assert res_mkt.data_freshness == "unavailable"

    # Unsupported financial research symbol
    res_fin = financial_research_agent.analyze("NONEXISTENT_XYZ_999")
    assert res_fin.signal == "Unavailable"
    assert any("not recognized" in f.lower() or "unsupported" in f.lower() for f in res_fin.key_findings)

    # API route returns 200 with honest unavailable signal, not unhandled 500
    resp = client.get("/api/v1/ai/agents/market?symbol=NONEXISTENT_XYZ_999")
    assert resp.status_code == 200
    assert resp.json()["signal"] == "Unavailable"


# ----------------------------------------------------------------------
# Workflow 10: Handling Gemini unavailability without breaking
# ----------------------------------------------------------------------
def test_wf10_gemini_unavailability_deterministic_fallback():
    # Test RAG synthesis call signature
    synth_res = gemini_service.synthesize_financial_rag(
        company_name="Tata Consultancy Services Ltd.",
        symbol="TCS",
        query="operating profit margin",
        deterministic_metrics={"pe_ratio": 29.5, "operating_margin": 24.6},
        retrieved_passages=[
            {
                "citation_id": "CIT-TCS-1",
                "document_title": "TCS Annual Report FY24",
                "doc_type": "annual_report",
                "publisher": "NSE Compliance",
                "publication_date": "2024-04-12",
                "page_or_section": "Financial Highlights",
                "passage": "Operating margin for the full year stood at 24.6%, expanding by 50 bps YoY."
            }
        ]
    )
    # Returns valid structure (either live Gemini or unconfigured/rate-limited fallback)
    assert isinstance(synth_res, dict)
    assert "success" in synth_res

    # Test financial research agent resilience
    res = financial_research_agent.analyze("TCS")
    assert res.signal != "Unavailable"
    assert res.llm_synthesis_status in ["gemini_synthesized", "deterministic_fallback"]


# ----------------------------------------------------------------------
# Workflow 11: Cross-user financial data isolation
# ----------------------------------------------------------------------
def test_wf11_user_financial_data_isolation():
    user_a, token_a = create_isolated_user()
    user_b, token_b = create_isolated_user()

    # User A buys TCS
    trading_engine.place_order(user_a, "TCS", "BUY", "MARKET", 10, current_market_price=3500.0)

    # User B buys INFY
    order_b = trading_engine.place_order(user_b, "INFY", "BUY", "MARKET", 20, current_market_price=1500.0)
    order_b_id = order_b["order"]["id"]

    # Verify User A's portfolio endpoint contains TCS, NOT INFY
    resp_a = client.get("/api/v1/portfolio", headers={"Authorization": f"Bearer {token_a}"})
    assert resp_a.status_code == 200
    holdings_a = [h["symbol"] for h in resp_a.json()["holdings"]]
    assert "TCS" in holdings_a
    assert "INFY" not in holdings_a

    # Verify User B's portfolio endpoint contains INFY, NOT TCS
    resp_b = client.get("/api/v1/portfolio", headers={"Authorization": f"Bearer {token_b}"})
    assert resp_b.status_code == 200
    holdings_b = [h["symbol"] for h in resp_b.json()["holdings"]]
    assert "INFY" in holdings_b
    assert "TCS" not in holdings_b

    # Verify User A CANNOT retrieve User B's order by ID (Isolation check)
    order_check = client.get(f"/api/v1/trading/orders/{order_b_id}", headers={"Authorization": f"Bearer {token_a}"})
    assert order_check.status_code == 404


# ----------------------------------------------------------------------
# Workflow 12: Checking navigation and API compatibility
# ----------------------------------------------------------------------
def test_wf12_navigation_and_api_compatibility():
    user_id, token = create_isolated_user()
    auth_header = {"Authorization": f"Bearer {token}"}

    # Verify all 10 navigation section APIs respond properly:
    # 1. Dashboard
    assert client.get("/api/v1/market/status").status_code == 200
    assert client.get("/api/v1/market/indices").status_code == 200

    # 2. Markets
    assert client.get("/api/v1/stocks?limit=10").status_code == 200
    assert client.get("/api/v1/ai/agents/market?symbol=TCS").status_code == 200

    # 3. Stocks
    assert client.get("/api/v1/stocks/TCS").status_code == 200
    assert client.get("/api/v1/ai/agents/financial/TCS").status_code == 200

    # 4. Sectors
    assert client.get("/api/v1/stocks/sectors").status_code == 200

    # 5. Watchlists
    assert client.get("/api/v1/watchlists", headers=auth_header).status_code == 200

    # 6. Portfolio
    assert client.get("/api/v1/portfolio", headers=auth_header).status_code == 200
    assert client.get("/api/v1/ai/agents/portfolio", headers=auth_header).status_code == 200

    # 7. Orders
    assert client.get("/api/v1/trading/orders", headers=auth_header).status_code == 200

    # 8. Transactions / Ledger
    assert client.get("/api/v1/trading/trades", headers=auth_header).status_code == 200
    assert client.get("/api/v1/trading/ledger", headers=auth_header).status_code == 200

    # 9. AI Intelligence
    orch_resp = client.post(
        "/api/v1/ai/orchestrate",
        headers=auth_header,
        json={"symbol": "TCS", "requested_agents": ["market", "financial"]}
    )
    assert orch_resp.status_code == 200

    # 10. Trading Psychology
    assert client.get("/api/v1/ai/agents/behavior", headers=auth_header).status_code == 200


# ----------------------------------------------------------------------
# Workflow 13: Observability metrics endpoint
# ----------------------------------------------------------------------
def test_wf13_observability_metrics_endpoint():
    resp = client.get("/api/v1/ai/observability/metrics")
    assert resp.status_code == 200
    data = resp.json()

    assert "latency" in data
    assert "portfolio_risk" in data
    assert "signal_classification_evaluation" in data

    # Verify benchmark methodology
    bench = data["signal_classification_evaluation"]
    assert bench["dataset"] == "NSE Bellwether Historical Time-Separated Dataset (10 Large-Cap Equities, 180 Sessions)"
    assert bench["metrics"]["overall_directional_accuracy"] > 0.50
    assert "methodology_disclaimer" in bench
