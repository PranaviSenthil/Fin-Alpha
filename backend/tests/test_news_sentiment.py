import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta

from app.market_data.news_service import (
    FinancialSentimentScorer,
    FinancialNewsService,
    FinancialNewsItem,
    NewsSentimentAggregate,
    news_sentiment_service
)
from app.ai.market_agent import market_analysis_agent
from app.ai.orchestrator import central_ai_orchestrator
from app.ai.schemas import AgentResponse, OrchestratedAnalysis


# -----------------------------------------------------------------------------
# 1. Headline Sentiment Scoring Tests (Positive, Negative, Neutral)
# -----------------------------------------------------------------------------

def test_positive_headline_classification():
    headline = "Tata Consultancy Services reports 18% profit surge and record deal wins"
    score, label, conf = FinancialSentimentScorer.score_headline(headline)
    assert label == "Positive"
    assert score >= 0.05
    assert score <= 1.0
    assert conf > 0.5


def test_negative_headline_classification():
    headline = "Company faces regulatory probe, severe penalty, and fraud allegations amid sharp slump"
    score, label, conf = FinancialSentimentScorer.score_headline(headline)
    assert label == "Negative"
    assert score <= -0.05
    assert score >= -1.0
    assert conf > 0.5


def test_neutral_headline_classification():
    headline = "Infosys shares trade flat in quiet trading session ahead of scheduled board meeting"
    score, label, conf = FinancialSentimentScorer.score_headline(headline)
    assert label == "Neutral"
    assert -0.05 < score < 0.05


# -----------------------------------------------------------------------------
# 2. Financial Language & Complex Phrasing (Negation, Intensifiers)
# -----------------------------------------------------------------------------

def test_financial_negation_inversion():
    # "failed to grow" vs "did not fail to grow"
    bad_hl = "Company failed to beat earnings estimates as revenue declined"
    b_score, b_label, _ = FinancialSentimentScorer.score_headline(bad_hl)
    assert b_label == "Negative"
    assert b_score < 0.0

    good_hl = "Despite headwinds, the firm did not fail to beat earnings projections"
    g_score, g_label, _ = FinancialSentimentScorer.score_headline(good_hl)
    assert g_label == "Positive"
    assert g_score > 0.0


def test_intensifier_magnification():
    mild_hl = "Profits grew slightly during the quarter"
    strong_hl = "Profits surged dramatically with massive order inflows"
    m_score, _, _ = FinancialSentimentScorer.score_headline(mild_hl)
    s_score, _, _ = FinancialSentimentScorer.score_headline(strong_hl)
    assert s_score > m_score


# -----------------------------------------------------------------------------
# 3. Sentiment Aggregation Across Multiple Headlines
# -----------------------------------------------------------------------------

def test_sentiment_aggregation_reproducibility():
    service = FinancialNewsService(cache_ttl_seconds=60)
    now_iso = datetime.now(timezone.utc).isoformat()
    t_minus_1h = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    t_minus_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

    items = [
        FinancialNewsItem(
            symbol="TCS",
            company_name="Tata Consultancy Services",
            title="TCS bags mega $1 billion cloud transformation deal",
            publisher="Economic Times",
            url="https://economictimes.indiatimes.com/tech/tcs-deal",
            published_at=t_minus_1h,
            retrieved_at=now_iso,
            provider="Test Fixture",
            sentiment_score=0.75,
            sentiment_label="Positive"
        ),
        FinancialNewsItem(
            symbol="TCS",
            company_name="Tata Consultancy Services",
            title="TCS operating margins expand to 26% on operational efficiency",
            publisher="Moneycontrol",
            url="https://moneycontrol.com/news/tcs-margins",
            published_at=t_minus_24h,
            retrieved_at=now_iso,
            provider="Test Fixture",
            sentiment_score=0.60,
            sentiment_label="Positive"
        ),
        FinancialNewsItem(
            symbol="TCS",
            company_name="Tata Consultancy Services",
            title="Tech shares face mild profit booking in noon trade",
            publisher="Livemint",
            url="https://livemint.com/market/tech-shares",
            published_at=t_minus_24h,
            retrieved_at=now_iso,
            provider="Test Fixture",
            sentiment_score=-0.15,
            sentiment_label="Negative"
        )
    ]

    agg = service._aggregate_sentiment("TCS", "Tata Consultancy Services", items, "Test Fixture", now_iso, [])
    assert agg.classification == "Positive"
    assert agg.overall_score > 0.05
    assert agg.headlines_analyzed == 3
    assert agg.positive_count == 2
    assert agg.negative_count == 1
    assert agg.evidence_quality in ("High", "Moderate")


# -----------------------------------------------------------------------------
# 4. Duplicate Headline Handling
# -----------------------------------------------------------------------------

def test_duplicate_headline_deduplication():
    service = FinancialNewsService()
    now_iso = datetime.now(timezone.utc).isoformat()
    raw = [
        {"title": "Reliance Industries expands retail footprint across tier 2 cities", "url": "https://url1.com/1", "publisher": "ET"},
        {"title": "Reliance Industries expands retail footprint across tier 2 cities", "url": "https://url2.com/2", "publisher": "Mint"},
        {"title": "reliance industries expands retail footprint across tier 2 cities!", "url": "https://url3.com/3", "publisher": "MC"},
        {"title": "Reliance plans green hydrogen investments", "url": "https://url4.com/4", "publisher": "Reuters"}
    ]
    scored = service._process_and_score_headlines("RELIANCE", "Reliance Industries", raw, "Test", now_iso)
    assert len(scored) == 2  # The 3 duplicate variations reduced to 1, plus the green hydrogen one


# -----------------------------------------------------------------------------
# 5. Missing or Malformed Timestamps
# -----------------------------------------------------------------------------

def test_missing_and_invalid_timestamps():
    service = FinancialNewsService()
    now_iso = datetime.now(timezone.utc).isoformat()
    items = [
        FinancialNewsItem(
            symbol="INFY",
            company_name="Infosys",
            title="Infosys announces fresh dividend and guidance boost",
            publisher="Bloomberg",
            url="https://bloomberg.com/infy",
            published_at=None,  # Missing timestamp
            retrieved_at=now_iso,
            provider="Test",
            sentiment_score=0.65,
            sentiment_label="Positive"
        ),
        FinancialNewsItem(
            symbol="INFY",
            company_name="Infosys",
            title="Infosys steady in morning trades",
            publisher="Reuters",
            url="https://reuters.com/infy",
            published_at="invalid-date-string-here",  # Malformed timestamp
            retrieved_at=now_iso,
            provider="Test",
            sentiment_score=0.10,
            sentiment_label="Positive"
        )
    ]
    # Should not crash on invalid/missing timestamps
    agg = service._aggregate_sentiment("INFY", "Infosys", items, "Test", now_iso, [])
    assert agg.overall_score is not None
    assert agg.headlines_analyzed == 2


# -----------------------------------------------------------------------------
# 6. Invalid or Irrelevant Headline Records
# -----------------------------------------------------------------------------

def test_irrelevant_and_empty_records_filtered():
    service = FinancialNewsService()
    now_iso = datetime.now(timezone.utc).isoformat()
    raw = [
        {"title": "", "url": "https://valid.com/1"},  # Empty title
        {"title": "Valid title", "url": ""},  # Empty URL
        {"title": "Recipe for chocolate cake with strawberry frosting", "url": "https://recipes.com"},  # Irrelevant
        {"title": "HDFC Bank opens 100 new branches in expansion drive", "url": "https://reuters.com/hdfc"}  # Relevant
    ]
    scored = service._process_and_score_headlines("HDFCBANK", "HDFC Bank", raw, "Test", now_iso)
    assert len(scored) == 1
    assert "HDFC Bank" in scored[0].title


# -----------------------------------------------------------------------------
# 7. Provider Returning No Headlines
# -----------------------------------------------------------------------------

def test_provider_returns_empty_headlines():
    service = FinancialNewsService()
    with patch.object(service, "_fetch_from_yfinance_search", return_value=[]):
        with patch.object(service, "_fetch_from_google_rss", return_value=[]):
            res = service.get_stock_sentiment("UNKNOWN", "Unknown Corp", force_refresh=True)
            assert res.classification == "Unavailable"
            assert res.overall_score is None
            assert res.evidence_quality == "Unavailable"
            assert res.headlines_analyzed == 0
            assert len(res.headlines) == 0


# -----------------------------------------------------------------------------
# 8. Provider Unavailable or Exception Handling
# -----------------------------------------------------------------------------

def test_provider_exception_fallback():
    service = FinancialNewsService()
    # Primary throws exception, fallback succeeds
    now_iso = datetime.now(timezone.utc).isoformat()
    fallback_items = [
        {
            "title": "State Bank of India reports strong asset quality improvements",
            "url": "https://rss.google.com/sbi",
            "publisher": "Google News RSS",
            "published_at": now_iso
        }
    ]
    with patch.object(service, "_fetch_from_yfinance_search", side_effect=Exception("Rate limit exceeded")):
        with patch.object(service, "_fetch_from_google_rss", return_value=fallback_items):
            res = service.get_stock_sentiment("SBIN", "State Bank of India", force_refresh=True)
            assert res.provider == "Google News RSS (India)"
            assert res.headlines_analyzed == 1
            assert any("temporarily unavailable" in w for w in res.warnings)


# -----------------------------------------------------------------------------
# 9. In-Memory Cache and Freshness Handling
# -----------------------------------------------------------------------------

def test_in_memory_cache_freshness():
    service = FinancialNewsService(cache_ttl_seconds=600)
    now_iso = datetime.now(timezone.utc).isoformat()
    mock_items = [
        {"title": "Wipro signs deal with European automotive group", "url": "https://wipro.com/deal", "publisher": "PR"}
    ]
    with patch.object(service, "_fetch_from_yfinance_search", return_value=mock_items):
        # 1st fetch: populates cache
        res1 = service.get_stock_sentiment("WIPRO", "Wipro Limited", force_refresh=True)
        assert res1.freshness_status == "fresh"

        # 2nd fetch: should come from cache
        with patch.object(service, "_fetch_from_yfinance_search", side_effect=Exception("Should not be called")):
            res2 = service.get_stock_sentiment("WIPRO", "Wipro Limited")
            assert res2.symbol == "WIPRO"
            assert res2.headlines_analyzed == 1


# -----------------------------------------------------------------------------
# 10. Unsupported Stock Symbols
# -----------------------------------------------------------------------------

def test_unsupported_stock_symbol_market_agent():
    res = market_analysis_agent.analyze("NONEXISTENT_TICKER_99")
    assert res.signal == "Unavailable"
    assert "not active" in res.summary


# -----------------------------------------------------------------------------
# 11. Sentiment Unavailable While Quantitative Matrix Operates
# -----------------------------------------------------------------------------

def test_sentiment_unavailable_preserves_quantitative_indicators():
    with patch("app.market_data.news_service.news_sentiment_service.get_stock_sentiment") as mock_sent:
        now_iso = datetime.now(timezone.utc).isoformat()
        mock_sent.return_value = NewsSentimentAggregate(
            symbol="TCS",
            company_name="Tata Consultancy Services",
            overall_score=None,
            classification="Unavailable",
            evidence_quality="Unavailable",
            headlines_analyzed=0,
            headlines=[],
            retrieved_at=now_iso,
            warnings=["External feed down"]
        )

        res = market_analysis_agent.analyze("TCS")
        # Technical analysis must succeed
        assert res.signal in ("Bullish", "Bearish", "Neutral / Sideways")
        assert res.supporting_data["current_price"] is not None
        assert "rsi_14" in res.supporting_data
        assert "volume_anomaly_ratio" in res.supporting_data
        # News sentiment is marked unavailable
        assert res.news_sentiment["classification"] == "Unavailable"
        assert any("Unavailable" in f for f in res.key_findings)


# -----------------------------------------------------------------------------
# 12. Correct Preservation of Article URLs and Timestamps
# -----------------------------------------------------------------------------

def test_article_url_and_timestamp_preservation():
    now_iso = datetime.now(timezone.utc).isoformat()
    mock_items = [
        {
            "title": "Larsen & Toubro wins prestigious metro infrastructure contract",
            "url": "https://economictimes.indiatimes.com/lt-metro-deal-12345",
            "publisher": "The Economic Times",
            "published_at": "2026-10-14T10:00:00+00:00"
        }
    ]
    with patch("app.market_data.news_service.news_sentiment_service._fetch_from_yfinance_search", return_value=mock_items):
        res = market_analysis_agent.analyze("LT")
        news_cits = [c for c in res.sources if "News:" in c.source]
        assert len(news_cits) >= 1
        cit = news_cits[0]
        assert cit.source_url == "https://economictimes.indiatimes.com/lt-metro-deal-12345"
        assert cit.publisher == "The Economic Times"
        assert cit.publication_date == "2026-10-14T10:00:00+00:00"
        assert "Larsen & Toubro" in (cit.passage or "")


# -----------------------------------------------------------------------------
# 13. Orchestrator Handling of Sentiment & Divergence Preservation
# -----------------------------------------------------------------------------

def test_orchestrator_detects_momentum_vs_sentiment_conflict():
    # Construct a mock Market Analysis response with Bullish momentum but Negative news sentiment
    now_iso = datetime.now(timezone.utc).isoformat()
    mock_market = AgentResponse(
        agent_name="Market Analysis Agent",
        entity="INFY",
        summary="Infosys is in a strong technical uptrend.",
        signal="Bullish",
        supporting_data={
            "news_sentiment": {
                "classification": "Negative",
                "overall_score": -0.45,
                "headlines_analyzed": 5,
                "evidence_quality": "High"
            }
        },
        news_sentiment={
            "classification": "Negative",
            "overall_score": -0.45,
            "headlines_analyzed": 5,
            "evidence_quality": "High"
        }
    )

    with patch.object(market_analysis_agent, "analyze", return_value=mock_market):
        orch = central_ai_orchestrator.orchestrate(symbol="INFY", query="growth outlook", requested_agents=["market"])
        assert isinstance(orch, OrchestratedAnalysis)
        # Verify cross-agent conflict was flagged
        assert len(orch.cross_agent_conflicts) >= 1
        conflict_txt = orch.cross_agent_conflicts[0]
        assert "Conflict" in conflict_txt or "Disagreement" in conflict_txt
        assert "Bullish" in conflict_txt
        assert "Negative" in conflict_txt


# -----------------------------------------------------------------------------
# 14. Insufficient Evidence Handling
# -----------------------------------------------------------------------------

def test_insufficient_evidence_single_headline():
    service = FinancialNewsService()
    now_iso = datetime.now(timezone.utc).isoformat()
    items = [
        FinancialNewsItem(
            symbol="TITAN",
            company_name="Titan Company",
            title="Titan updates festive store network count",
            publisher="Mint",
            url="https://livemint.com/titan",
            published_at=now_iso,
            retrieved_at=now_iso,
            provider="Test",
            sentiment_score=0.20,
            sentiment_label="Positive"
        )
    ]
    agg = service._aggregate_sentiment("TITAN", "Titan Company", items, "Test", now_iso, [])
    # 1 headline is insufficient sample size to declare definitive sentiment
    assert agg.classification == "Insufficient Evidence"
    assert agg.evidence_quality == "Low / Insufficient Evidence"
    assert agg.headlines_analyzed == 1
    assert len(agg.warnings) >= 1
