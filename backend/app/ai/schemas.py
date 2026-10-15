from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime, timezone

class Citation(BaseModel):
    source: str
    metric: Optional[str] = "Document Evidence"
    value: Optional[Union[float, int, str]] = None
    timestamp: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    # Phase 2: Verifiable Citation Fields
    citation_id: Optional[str] = None
    document_title: Optional[str] = None
    company: Optional[str] = None
    ticker: Optional[str] = None
    source_url: Optional[str] = None
    publisher: Optional[str] = None
    publication_date: Optional[str] = None
    page_or_section: Optional[str] = None
    passage: Optional[str] = None
    relevance_score: Optional[float] = None

class DocumentIngestRequest(BaseModel):
    symbol: str
    title: str
    doc_type: str = "exchange_filing"  # 'annual_report' | 'earnings_transcript' | 'exchange_filing' | 'announcement'
    publisher: str = "Company Disclosures"
    source_url: Optional[str] = None
    publication_date: Optional[str] = None
    content: Optional[str] = None
    text: Optional[str] = None
    file_type: Optional[str] = "text"  # 'text' | 'html' | 'pdf' | 'markdown'
    page_or_section: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class RetrievedEvidenceChunk(BaseModel):
    chunk_id: str
    doc_id: str
    symbol: str
    company_name: str
    document_title: str
    doc_type: str
    publisher: str
    source_url: Optional[str] = None
    publication_date: Optional[str] = None
    page_or_section: Optional[str] = None
    text: str
    relevance_score: float

class Scenario(BaseModel):
    case: str              # 'Bullish' | 'Base' | 'Bearish'
    target_price: Optional[float] = None
    target_range: Optional[str] = None
    implied_change_pct: Optional[float] = None
    probability_assessment: Optional[str] = None
    catalysts: List[str] = Field(default_factory=list)
    assumptions: List[str] = Field(default_factory=list)
    label: str = "Model-Estimated Scenario"

class AgentResponse(BaseModel):
    agent_name: str
    entity: Optional[str] = None           # Symbol or 'MARKET' or 'PORTFOLIO' or 'TRADER'
    summary: str
    signal: Optional[str] = None           # 'Bullish' | 'Bearish' | 'Neutral' | 'Balanced' | 'Overextended' | etc.
    key_findings: List[str] = Field(default_factory=list)
    supporting_data: Dict[str, Any] = Field(default_factory=dict)
    scenarios: Optional[List[Scenario]] = None
    sources: List[Citation] = Field(default_factory=list)
    citations: List[Citation] = Field(default_factory=list)
    risks_and_limitations: List[str] = Field(default_factory=list)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    data_freshness: str = "fresh"          # 'fresh' | 'stale' | 'delayed' | 'simulated' | 'unavailable'
    confidence: Optional[Dict[str, Any]] = None # {'score': 0.85, 'scale': '0-1.0', 'factors': [...]}
    missing_data: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    disclaimer: str = "Simulated algorithmic financial intelligence. Not SEBI-registered financial advice."
    # RAG Verifiable Grounding Metadata
    retrieval_status: Optional[str] = None  # 'evidence_retrieved' | 'corpus_empty' | 'no_matching_passages' | 'unsupported_symbol'
    conflicting_evidence: List[Dict[str, Any]] = Field(default_factory=list)
    llm_synthesis_status: Optional[str] = None  # 'gemini_synthesized' | 'deterministic_fallback' | 'unavailable'
    # Financial News Sentiment Analysis (PS 04 Task 2)
    news_sentiment: Optional[Dict[str, Any]] = None

class OrchestratedAnalysis(BaseModel):
    query: str
    target_symbol: Optional[str] = None
    executive_summary: str
    overall_sentiment: Optional[str] = None
    agents_involved: List[str] = Field(default_factory=list)
    agent_results: Dict[str, AgentResponse] = Field(default_factory=dict)
    cross_agent_conflicts: List[str] = Field(default_factory=list)
    key_risks: List[str] = Field(default_factory=list)
    all_citations: List[Citation] = Field(default_factory=list)
    execution_metrics: Optional[Dict[str, Any]] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    disclaimer: str = "Multi-agent synthesis generated using quantitative market feeds and user paper-trading records."
