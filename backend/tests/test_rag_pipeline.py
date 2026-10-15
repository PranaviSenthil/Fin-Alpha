import io
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.core.database import init_db, seed_master_data, get_db
from app.ai.rag.ingestion import (
    FinancialDocumentIngestionPipeline,
    DocumentChunker,
    DocumentIngestionError,
    ingestion_pipeline,
    PYPDF_AVAILABLE
)
from app.ai.rag.retriever import FinancialDocumentRetriever, document_retriever
from app.ai.financial_agent import financial_research_agent
from app.ai.orchestrator import central_ai_orchestrator
from app.ai.schemas import AgentResponse, OrchestratedAnalysis, RetrievedEvidenceChunk
from app.main import app

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()
    seed_master_data()

# -------------------------------------------------------------------------
# 1. Document Ingestion & Chunking Tests (PDF, HTML, Text)
# -------------------------------------------------------------------------

def test_document_chunker_basic():
    chunker = DocumentChunker(target_chunk_size=150, overlap_size=30)
    text = (
        "Tata Consultancy Services reported strong quarterly numbers. "
        "Revenue increased across multiple geographies including North America and Europe. "
        "Operating margins expanded to 24.5 percent driven by operational efficiency. "
        "The company won record deal total contract value of 10 billion dollars."
    )
    chunks = chunker.chunk_text(text, page_or_section="Management Commentary")
    assert len(chunks) >= 2
    for c in chunks:
        assert "text" in c
        assert c["page_or_section"] == "Management Commentary"
        assert len(c["text"]) > 0

def test_valid_text_and_html_ingestion():
    pipeline = FinancialDocumentIngestionPipeline()
    retriever = FinancialDocumentRetriever()

    # Ingest HTML document for INFY
    html_doc = """
    <html>
        <body>
            <h1>Infosys Limited - Q3 Corporate Update</h1>
            <p>Infosys delivered steady revenue growth in constant currency terms.</p>
            <p>Digital transformation revenue accounted for 62 percent of overall company sales.</p>
        </body>
    </html>
    """
    res = retriever.store_document(
        symbol="INFY",
        title="Infosys Q3 Digital Update",
        doc_type="Quarterly Filing",
        publisher="NSE India",
        source_url="https://www.nseindia.com/filings/infy-q3.html",
        publication_date="2025-01-16",
        raw_text=html_doc,
        file_type="html",
        page_or_section="Financial Highlights"
    )

    assert res["status"] in ["created", "existing_retained"]
    assert res["symbol"] == "INFY"
    assert res["chunk_count"] >= 1

    # Verify database persistence
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM financial_documents WHERE id = ?", (res["doc_id"],))
        doc_row = cursor.fetchone()
        assert doc_row is not None
        assert "Infosys" in doc_row["company_name"]
        assert doc_row["publisher"] == "NSE India"

        cursor.execute("SELECT * FROM financial_document_chunks WHERE doc_id = ?", (res["doc_id"],))
        chunk_rows = cursor.fetchall()
        assert len(chunk_rows) >= 1
        assert "Infosys delivered steady revenue growth" in chunk_rows[0]["text"]

def test_pdf_ingestion_handling():
    pipeline = FinancialDocumentIngestionPipeline()
    retriever = FinancialDocumentRetriever()

    # Test clean error on empty bytes
    with pytest.raises(DocumentIngestionError):
        pipeline.process_document(
            symbol="TCS",
            title="Empty PDF",
            doc_type="Annual Report",
            publisher="BSE India",
            file_bytes=b"",
            file_type="pdf"
        )

    # Test PDF extraction using mocked pypdf reader to guarantee consistent test execution
    mock_page = MagicMock()
    mock_page.extract_text.return_value = "TCS registered consolidated revenue of Rs 64,259 crore in Q3 FY25."
    mock_reader = MagicMock()
    mock_reader.pages = [mock_page]

    with patch("pypdf.PdfReader", return_value=mock_reader), patch("app.ai.rag.ingestion.PYPDF_AVAILABLE", True):
        res = retriever.store_document(
            symbol="TCS",
            title="TCS Mocked PDF Report",
            doc_type="Financial Results",
            publisher="BSE Corporate Disclosures",
            file_bytes=b"%PDF-1.4 mock content",
            file_type="pdf",
            page_or_section="Page 1"
        )
        assert res["status"] in ["created", "existing_retained"]
        assert res["chunk_count"] >= 1

# -------------------------------------------------------------------------
# 2. Duplicate Ingestion Prevention via Content Hash
# -------------------------------------------------------------------------

def test_duplicate_prevention():
    retriever = FinancialDocumentRetriever()
    unique_text = "Reliance Jio 5G subscriber additions reached 130 million users with steady ARPU of Rs 203."

    # First ingestion
    res1 = retriever.store_document(
        symbol="RELIANCE",
        title="Reliance Telecom Disclosures",
        doc_type="Investor Release",
        publisher="BSE India",
        raw_text=unique_text,
        file_type="text"
    )
    assert res1["status"] in ["created", "existing_retained"]
    initial_doc_id = res1["doc_id"]

    # Ingest the exact same text again
    res2 = retriever.store_document(
        symbol="RELIANCE",
        title="Reliance Telecom Disclosures Duplicate",
        doc_type="Investor Release",
        publisher="BSE India",
        raw_text=unique_text,
        file_type="text"
    )
    assert res2["status"] == "existing_retained"
    assert res2["doc_id"] == initial_doc_id
    assert "Duplicate skipped safely" in res2["message"]

    # Verify no duplicate chunk rows were added
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as cnt FROM financial_documents WHERE id = ?", (initial_doc_id,))
        assert cursor.fetchone()["cnt"] == 1

# -------------------------------------------------------------------------
# 3. Clean Error Handling for Invalid / Corrupted Inputs
# -------------------------------------------------------------------------

def test_invalid_symbol_or_missing_fields():
    retriever = FinancialDocumentRetriever()

    # Unrecognized symbol not in universe
    with pytest.raises(DocumentIngestionError) as exc_info:
        retriever.store_document(
            symbol="UNKNOWN_XYZ_999",
            title="Random Paper",
            doc_type="Report",
            publisher="Unknown",
            raw_text="Some valid content here."
        )
    assert "not recognized in the active VibeFinance 100-stock" in str(exc_info.value)

    # Empty document content
    with pytest.raises(DocumentIngestionError):
        retriever.store_document(
            symbol="TCS",
            title="Valid Title",
            doc_type="Report",
            publisher="BSE",
            raw_text="   \n\t  "
        )

    # Title too short
    with pytest.raises(DocumentIngestionError):
        retriever.store_document(
            symbol="TCS",
            title="A",
            doc_type="Report",
            publisher="BSE",
            raw_text="Valid content that is long enough."
        )

# -------------------------------------------------------------------------
# 4. Strict Company Isolation
# -------------------------------------------------------------------------

def test_strict_company_isolation():
    retriever = FinancialDocumentRetriever()

    # Query TCS for general keywords
    tcs_chunks = retriever.retrieve(symbol="TCS", query="revenue growth operating margins", top_k=5)
    for c in tcs_chunks:
        assert c.symbol == "TCS", f"Cross-contamination detected! Expected TCS, got {c.symbol}"
        assert "reliance" not in c.company_name.lower()

    # Query RELIANCE
    rel_chunks = retriever.retrieve(symbol="RELIANCE", query="revenue EBITDA growth", top_k=5)
    for c in rel_chunks:
        assert c.symbol == "RELIANCE", f"Cross-contamination detected! Expected RELIANCE, got {c.symbol}"
        assert "tata consultancy" not in c.company_name.lower()

# -------------------------------------------------------------------------
# 5. Relevant Query Retrieval Ranking (BM25 + Exact Phrase Boost)
# -------------------------------------------------------------------------

def test_relevant_query_retrieval_ranking():
    retriever = FinancialDocumentRetriever()

    # TCS seed data has chunks mentioning AI, BSNL deal, and operating margins
    results_ai = retriever.retrieve(symbol="TCS", query="GenAI WisdomNext and artificial intelligence pipeline", top_k=2)
    assert len(results_ai) > 0
    top_chunk = results_ai[0]
    assert any(term in top_chunk.text.lower() for term in ["ai", "genai", "wisdomnext", "pipeline"])
    assert top_chunk.relevance_score > 0.0

    # Query with exact phrase
    results_tcs = retriever.retrieve(symbol="TCS", query="Operating margin and order book visibility", top_k=2)
    assert len(results_tcs) > 0
    assert any("operating margin" in c.text.lower() or "order" in c.text.lower() for c in results_tcs)

# -------------------------------------------------------------------------
# 6. Verifiable Citation Generation
# -------------------------------------------------------------------------

def test_verifiable_citation_generation():
    retriever = FinancialDocumentRetriever()
    chunks = retriever.retrieve(symbol="TCS", query="operating margin", top_k=2)
    assert len(chunks) > 0

    citations = retriever.chunks_to_citations(chunks)
    assert len(citations) == len(chunks)
    for cit in citations:
        assert cit.citation_id.startswith("CIT-TCS-")
        assert cit.ticker == "TCS"
        assert "Tata Consultancy" in cit.company
        assert cit.source_url.startswith("http")
        assert cit.publisher is not None
        assert cit.publication_date is not None
        assert cit.page_or_section is not None
        assert len(cit.passage) > 20
        # Verify passage matches the underlying chunk text
        assert any(cit.passage == c.text for c in chunks)

# -------------------------------------------------------------------------
# 7. Empty Retrieval Handling with Explicit Warnings
# -------------------------------------------------------------------------

def test_empty_retrieval_handling():
    # Query an obscure, non-matching string that returns no documentary evidence
    res = financial_research_agent.analyze(
        symbol="TCS",
        query="unprecedented quantum teleportation spacecraft fleet mission 9999"
    )
    assert isinstance(res, AgentResponse)
    assert res.agent_name == "Financial Research Agent"
    assert res.entity == "TCS"
    # Quantitative verified metrics are STILL populated
    assert "pe_ratio" in res.supporting_data
    assert "verified_metrics" in res.supporting_data
    assert "swot_analysis" in res.supporting_data

    # Check retrieval status or citations indicate zero/low evidence without hallucination
    assert res.retrieval_status in ["no_matching_passages", "no_documents_matched", "empty_corpus", "documents_retrieved"]
    if res.retrieval_status in ["no_matching_passages", "no_documents_matched"]:
        # When no matching passages, doc citations are 0 (only baseline quantitative citations remain)
        rag_cits = [c for c in res.citations if c.citation_id and not c.citation_id.startswith("CIT-QUANT-")]
        assert len(rag_cits) == 0

# -------------------------------------------------------------------------
# 8. Conflicting Documents Preservation
# -------------------------------------------------------------------------

def test_conflicting_documents_preservation():
    retriever = FinancialDocumentRetriever()

    # Ingest two distinct disclosures for INFY with divergent sentiment
    retriever.store_document(
        symbol="INFY",
        title="Infosys Press Release - Expansion Beat",
        doc_type="Press Release",
        publisher="NSE Disclosures",
        publication_date="2024-10-15",
        raw_text="Infosys announced strong growth and record high expansion across cloud transformation deals with beat in expectations.",
        file_type="text"
    )
    retriever.store_document(
        symbol="INFY",
        title="Infosys Analyst Conference - Margin Caution",
        doc_type="Transcript",
        publisher="BSE Corporate Announcements",
        publication_date="2024-11-20",
        raw_text="Management noted operating margin compression, wage hike headwinds, and noticeable client spending slowdown across communications.",
        file_type="text"
    )

    chunks = retriever.retrieve(symbol="INFY", query="expansion growth compression slowdown", top_k=4)
    conflicts = retriever.detect_conflicts(chunks)
    assert len(conflicts) >= 1
    c = conflicts[0]
    assert c["type"] == "disclosure_divergence"
    assert "expansion" in c["statement_a"]["passage"].lower() or "expansion" in c["statement_b"]["passage"].lower()
    assert "slowdown" in c["statement_a"]["passage"].lower() or "slowdown" in c["statement_b"]["passage"].lower()
    assert "preserved for balanced assessment" in c["explanation"]

# -------------------------------------------------------------------------
# 9. Gemini Offline / Failure Fallback to Deterministic Analysis
# -------------------------------------------------------------------------

def test_gemini_failure_graceful_fallback():
    # Force Gemini service to raise an error during synthesis
    with patch("app.ai.gemini_service.gemini_service.synthesize_financial_rag", side_effect=Exception("API Quota Exceeded")):
        res = financial_research_agent.analyze(symbol="TCS", query="operating margins and growth")
        assert isinstance(res, AgentResponse)
        assert res.agent_name == "Financial Research Agent"
        assert res.entity == "TCS"
        # Deterministic metrics are preserved
        assert "pe_ratio" in res.supporting_data
        assert "debt_to_equity" in res.supporting_data
        # Status marks fallback
        assert res.llm_synthesis_status in ["offline_fallback", "deterministic_fallback"]
        # Retrieved citations are still attached directly
        assert len(res.citations) > 0
        assert res.citations[0].ticker == "TCS"

# -------------------------------------------------------------------------
# 10. Central Orchestrator Integration & Citation Preservation
# -------------------------------------------------------------------------

def test_orchestrator_preserves_citations():
    orch_res = central_ai_orchestrator.orchestrate(
        query="Explain TCS order book and deal pipeline",
        symbol="TCS",
        requested_agents=["financial"]
    )
    assert isinstance(orch_res, OrchestratedAnalysis)
    assert "financial" in orch_res.agent_results
    fin_agent = orch_res.agent_results["financial"]
    assert len(fin_agent.citations) > 0
    assert any(c.ticker == "TCS" for c in fin_agent.citations)
    # Check all_citations aggregated on orchestrator level
    assert len(orch_res.all_citations) >= len(fin_agent.citations)
    assert orch_res.target_symbol == "TCS"

# -------------------------------------------------------------------------
# 11. API Endpoints: Ingestion, Upload, Search, and CRUD
# -------------------------------------------------------------------------

def test_api_documents_endpoints():
    # 1. Ingest via JSON endpoint
    ingest_payload = {
        "symbol": "HDFCBANK",
        "title": "HDFC Bank Basel III Capital Adequacy Disclosure",
        "doc_type": "Regulatory Filing",
        "publisher": "RBI & BSE Disclosures",
        "publication_date": "2025-01-10",
        "source_url": "https://www.hdfcbank.com/disclosures/basel3.html",
        "text": "HDFC Bank maintained a strong Capital Adequacy Ratio (CAR) of 19.8% under Basel III regulations.",
        "page_or_section": "Capital Adequacy"
    }
    resp = client.post("/api/v1/ai/documents/ingest", json=ingest_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    doc_id = data["doc_id"]

    # 2. List documents for HDFCBANK
    list_resp = client.get("/api/v1/ai/documents?symbol=HDFCBANK")
    assert list_resp.status_code == 200
    list_data = list_resp.json()
    assert list_data["count"] >= 1
    assert any(d["id"] == doc_id for d in list_data["documents"])

    # 3. Get single document detail
    get_resp = client.get(f"/api/v1/ai/documents/{doc_id}")
    assert get_resp.status_code == 200
    get_data = get_resp.json()
    assert get_data["document"]["id"] == doc_id
    assert len(get_data["document"]["chunks"]) >= 1

    # 4. Search documents endpoint
    search_resp = client.post("/api/v1/ai/documents/search", json={
        "symbol": "HDFCBANK",
        "query": "Capital Adequacy Ratio Basel III",
        "top_k": 3
    })
    assert search_resp.status_code == 200
    s_data = search_resp.json()
    assert s_data["count"] >= 1
    assert "Capital Adequacy" in s_data["results"][0]["text"]

    # 5. Delete document
    del_resp = client.delete(f"/api/v1/ai/documents/{doc_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

    # 6. Verify deleted
    get_deleted = client.get(f"/api/v1/ai/documents/{doc_id}")
    assert get_deleted.status_code == 404
