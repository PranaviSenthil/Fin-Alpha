import logging
import re
import math
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# 1. Pydantic Models for News and Sentiment
# -----------------------------------------------------------------------------

class FinancialNewsItem(BaseModel):
    symbol: str
    company_name: str
    title: str
    publisher: str
    url: str
    published_at: Optional[str] = None       # ISO-8601 string or date
    retrieved_at: str                        # ISO-8601 string
    provider: str                            # e.g., 'Yahoo Finance Search', 'Google News RSS'
    description: Optional[str] = None
    sentiment_score: Optional[float] = None  # Normalized [-1.0, +1.0]
    sentiment_label: Optional[str] = None    # 'Positive' | 'Neutral' | 'Negative'
    sentiment_confidence: Optional[float] = None # [0.0, 1.0]

class NewsSentimentAggregate(BaseModel):
    symbol: str
    company_name: str
    overall_score: Optional[float] = None    # Recency-weighted mean [-1.0, +1.0], None if unavailable
    classification: str = "Unavailable"      # 'Positive' | 'Neutral' | 'Negative' | 'Unavailable' | 'Insufficient Evidence'
    evidence_quality: str = "Unavailable"    # 'High' | 'Moderate' | 'Low' | 'Insufficient Evidence' | 'Unavailable'
    confidence_score: float = 0.0            # Calibration based on volume, recency, agreement [0.0, 1.0]
    confidence_explanation: str = "No verified financial headlines evaluated."
    headlines_analyzed: int = 0
    positive_count: int = 0
    neutral_count: int = 0
    negative_count: int = 0
    headlines: List[FinancialNewsItem] = Field(default_factory=list)
    provider: str = "None"
    freshness_status: str = "unavailable"    # 'fresh' | 'cached' | 'stale' | 'unavailable'
    retrieved_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    warnings: List[str] = Field(default_factory=list)
    methodology: str = (
        "Deterministic Loughran-McDonald & VADER financial sentiment scoring with "
        "recency-weighted valence aggregation and evidence-quality calibration."
    )


# -----------------------------------------------------------------------------
# 2. Financial Lexicon & Deterministic Sentiment Analyzer
# -----------------------------------------------------------------------------

# Loughran-McDonald inspired financial dictionary and VADER valence scores (-4.0 to +4.0)
FINANCIAL_LEXICON: Dict[str, float] = {
    # Strong Positive (+2.5 to +3.5)
    "surge": 3.0, "surges": 3.0, "surged": 3.0, "surging": 3.0,
    "soar": 3.0, "soars": 3.0, "soared": 3.0, "soaring": 3.0,
    "rally": 2.8, "rallies": 2.8, "rallied": 2.8, "rallying": 2.8,
    "outperform": 3.0, "outperformed": 3.0, "outperforming": 3.0,
    "record": 2.5, "breakthrough": 3.0, "turnaround": 2.8,
    "multibagger": 3.2, "jackpot": 3.0, "supercharged": 2.8,

    # Moderate Positive (+1.5 to +2.4)
    "profit": 2.2, "profits": 2.2, "profitable": 2.2, "profitability": 2.2,
    "gain": 2.0, "gains": 2.0, "gained": 2.0, "gaining": 2.0,
    "growth": 2.2, "grow": 1.8, "grows": 1.8, "growing": 1.8,
    "beat": 2.4, "beats": 2.4, "beating": 2.4,
    "upgrade": 2.5, "upgrades": 2.5, "upgraded": 2.5, "upgrading": 2.5,
    "dividend": 2.0, "dividends": 2.0, "buyback": 2.2,
    "bullish": 2.4, "expansion": 2.0, "expands": 2.0, "expanded": 2.0,
    "robust": 2.2, "strong": 2.0, "strength": 2.0, "strengthened": 2.0,
    "upbeat": 2.2, "positive": 2.0, "success": 2.2, "successful": 2.2,
    "win": 2.0, "wins": 2.0, "won": 2.0, "winning": 2.0,
    "deal": 1.5, "order": 1.4, "orders": 1.4, "contract": 1.5, "inflow": 2.0,
    "milestone": 2.0, "high": 1.8, "highs": 1.8, "peak": 1.6,

    # Mild Positive (+0.8 to +1.4)
    "steady": 1.2, "stable": 1.0, "resilient": 1.5, "recovery": 1.5,
    "recover": 1.4, "recovers": 1.4, "recovered": 1.4, "advance": 1.4,
    "advances": 1.4, "advanced": 1.4, "favorable": 1.5, "optimistic": 1.6,
    "opportunity": 1.4, "potential": 1.0, "boost": 1.8, "boosts": 1.8,

    # Strong Negative (-2.8 to -3.8)
    "plunge": -3.2, "plunges": -3.2, "plunged": -3.2, "plunging": -3.2,
    "crash": -3.5, "crashes": -3.5, "crashed": -3.5, "crashing": -3.5,
    "slump": -3.0, "slumps": -3.0, "slumped": -3.0, "slumping": -3.0,
    "fraud": -3.8, "scam": -3.8, "scandal": -3.5, "default": -3.5,
    "defaults": -3.5, "defaulted": -3.5, "bankruptcy": -3.8, "bankrupt": -3.8,
    "penalty": -3.0, "penalties": -3.0, "fine": -2.6, "fines": -2.6,
    "fined": -2.8, "probe": -2.8, "probes": -2.8, "probed": -2.8,
    "raid": -3.0, "raids": -3.0, "arrest": -3.2, "investigation": -2.5,
    "allegation": -2.8, "allegations": -2.8, "lawsuit": -2.8, "sued": -2.8,

    # Moderate Negative (-1.5 to -2.7)
    "loss": -2.4, "losses": -2.4, "decline": -2.0, "declines": -2.0,
    "declined": -2.0, "declining": -2.0, "drop": -2.0, "drops": -2.0,
    "dropped": -2.0, "dropping": -2.0, "fell": -2.0, "fall": -1.8,
    "falls": -1.8, "falling": -1.8, "miss": -2.2, "misses": -2.2,
    "missed": -2.2, "downgrade": -2.6, "downgrades": -2.6, "downgraded": -2.6,
    "bearish": -2.2, "weak": -2.0, "weakness": -2.0, "debt": -1.8,
    "debt-laden": -2.5, "deficit": -2.0, "headwind": -1.8, "breadcrumbs": -1.0,
    "cut": -1.8, "cuts": -1.8, "layoff": -2.5, "layoffs": -2.5,
    "warning": -2.2, "warns": -2.2, "warned": -2.2, "curb": -1.8,
    "curbs": -1.8, "halt": -2.0, "halted": -2.0, "down": -1.4,
    "underperform": -2.5, "underperformed": -2.5, "negative": -1.8,

    # Mild Negative (-0.8 to -1.4)
    "slowdown": -1.6, "sluggish": -1.5, "downturn": -1.8, "worry": -1.5,
    "worries": -1.5, "concern": -1.4, "concerns": -1.4, "cautious": -1.0,
    "uncertain": -1.2, "uncertainty": -1.4, "pressure": -1.4, "pressured": -1.5,
    "drag": -1.5, "drags": -1.5, "stumble": -1.6, "stumbles": -1.6,
    "dip": -1.2, "dips": -1.2, "low": -1.0, "lows": -1.2
}

# Negation tokens that invert following sentiment
NEGATION_TOKENS = {
    "not", "no", "never", "neither", "nor", "none", "hardly", "scarcely",
    "barely", "fail", "fails", "failed", "failing", "failure", "cannot", "can't",
    "won't", "don't", "didn't", "isn't", "aren't", "without", "lacks", "lacking"
}

# Intensifier tokens that magnify valence
INTENSIFIERS = {
    "sharply": 1.5, "steeply": 1.5, "substantially": 1.4, "significantly": 1.4,
    "massively": 1.6, "dramatically": 1.5, "hugely": 1.4, "heavily": 1.3,
    "deeply": 1.4, "strongly": 1.3, "extremely": 1.5, "major": 1.3,
    "slightly": 0.6, "marginally": 0.6, "modestly": 0.7, "partially": 0.8
}

class FinancialSentimentScorer:
    """
    Deterministic rule-based NLP sentiment scoring engine tailored for financial news headlines.
    Uses Loughran-McDonald financial dictionary weights with VADER negation & intensifier dynamics.
    Binds compound valence to [-1.0, +1.0] range via soft-clipping normalization.
    """

    @classmethod
    def clean_text(cls, text: str) -> str:
        """Strip HTML entities, redundant punctuation, and normalize whitespace."""
        if not text:
            return ""
        # Remove URLs
        text = re.sub(r'https?://\S+', '', text)
        # Remove XML/HTML entities
        text = re.sub(r'&[a-zA-Z0-9#]+;', ' ', text)
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    @classmethod
    def score_headline(cls, headline: str) -> Tuple[float, str, float]:
        """
        Analyze a single headline text.
        Returns:
            (normalized_score [-1.0, +1.0], label ['Positive', 'Neutral', 'Negative'], confidence [0.0, 1.0])
        """
        cleaned = cls.clean_text(headline)
        if not cleaned:
            return 0.0, "Neutral", 0.0

        # Tokenize preserving alphanumeric characters and hyphens
        tokens = re.findall(r"[A-Za-z0-9\-']+", cleaned.lower())
        if not tokens:
            return 0.0, "Neutral", 0.0

        valences: List[float] = []
        is_negated = False
        negation_window = 0
        current_multiplier = 1.0

        for i, token in enumerate(tokens):
            # Check negation token (double negatives cancel out: "not fail to beat" -> positive)
            if token in NEGATION_TOKENS:
                if is_negated:
                    is_negated = False
                    negation_window = 0
                else:
                    is_negated = True
                    negation_window = 3 # Affects up to next 3 tokens
                continue

            # Check intensifier
            if token in INTENSIFIERS:
                current_multiplier = INTENSIFIERS[token]
                continue

            # Check lexicon
            if token in FINANCIAL_LEXICON:
                raw_val = FINANCIAL_LEXICON[token] * current_multiplier
                if is_negated:
                    # Negation inverts valence by -0.74 (standard VADER inversion scalar)
                    raw_val = raw_val * -0.74
                valences.append(raw_val)
                # Reset multiplier after consumption
                current_multiplier = 1.0

            # Decrement negation window
            if negation_window > 0:
                negation_window -= 1
                if negation_window == 0:
                    is_negated = False

        if not valences:
            return 0.0, "Neutral", 0.35 # Baseline neutral confidence

        sum_v = sum(valences)
        # Soft-clipping normalization: compound = sum_v / sqrt(sum_v^2 + alpha)
        # alpha = 15 yields smooth [-1.0, +1.0] distribution
        alpha = 15.0
        compound = sum_v / math.sqrt((sum_v ** 2) + alpha)
        compound = max(-1.0, min(1.0, round(compound, 3)))

        # Classification thresholds (standard VADER: >= 0.05 is positive, <= -0.05 is negative)
        if compound >= 0.05:
            label = "Positive"
        elif compound <= -0.05:
            label = "Negative"
        else:
            label = "Neutral"

        # Confidence based on density of sentiment tokens and intensity
        confidence = min(1.0, round(0.4 + (len(valences) * 0.15) + (abs(compound) * 0.3), 2))
        return compound, label, confidence


# -----------------------------------------------------------------------------
# 3. Modular Financial News Service with Multi-Source Fallback & Caching
# -----------------------------------------------------------------------------

class FinancialNewsService:
    """
    Dedicated financial news service that fetches genuine news headlines for Indian equities,
    scores each headline deterministically, and aggregates sentiment with evidence calibration.
    
    Primary Provider: Yahoo Finance Search (yf.Search)
    Fallback Provider: Google News RSS Feed (India Edition)
    Cache Strategy: 15-minute in-memory cache per symbol to prevent rate-limiting.
    """

    def __init__(self, cache_ttl_seconds: int = 900):
        self.cache_ttl = cache_ttl_seconds
        self._cache: Dict[str, Dict[str, Any]] = {} # symbol -> {timestamp, data}

    def get_stock_sentiment(
        self,
        symbol: str,
        company_name: Optional[str] = None,
        max_headlines: int = 8,
        force_refresh: bool = False
    ) -> NewsSentimentAggregate:
        """
        Public entry point to get sentiment analysis for a stock symbol.
        Checks cache first, then tries primary (Yahoo Search), then fallback (Google RSS).
        """
        symbol = symbol.upper()
        name = company_name or symbol

        now_ts = time.time()
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Check in-memory cache
        if not force_refresh and symbol in self._cache:
            entry = self._cache[symbol]
            age = now_ts - entry["timestamp"]
            if age < self.cache_ttl:
                cached_res: NewsSentimentAggregate = entry["data"]
                # Return cached with freshness status clearly marked
                cached_copy = cached_res.model_copy()
                cached_copy.freshness_status = "cached" if age > 60 else "fresh"
                return cached_copy

        # 2. Attempt fetching headlines from real providers
        raw_items: List[Dict[str, Any]] = []
        provider_used = "None"
        warnings: List[str] = []

        try:
            # Primary: Yahoo Finance Search
            raw_items = self._fetch_from_yfinance_search(symbol, name, max_headlines)
            if raw_items:
                provider_used = "Yahoo Finance Search"
        except Exception as e:
            logger.warning(f"YFinance Search news provider failed for {symbol}: {e}")
            warnings.append(f"Yahoo Search provider temporarily unavailable: {str(e)}")

        # Fallback to Google News RSS if primary returned nothing
        if not raw_items:
            try:
                raw_items = self._fetch_from_google_rss(symbol, name, max_headlines)
                if raw_items:
                    provider_used = "Google News RSS (India)"
            except Exception as e:
                logger.warning(f"Google News RSS provider failed for {symbol}: {e}")
                warnings.append(f"Google News RSS provider temporarily unavailable: {str(e)}")

        # 3. Handle Empty or Unavailable state
        if not raw_items:
            empty_res = NewsSentimentAggregate(
                symbol=symbol,
                company_name=name,
                overall_score=None,
                classification="Unavailable",
                evidence_quality="Unavailable",
                confidence_score=0.0,
                confidence_explanation=f"No recent verifiable news headlines returned for {name} ({symbol}) from external public feeds.",
                headlines_analyzed=0,
                positive_count=0,
                neutral_count=0,
                negative_count=0,
                headlines=[],
                provider="Unavailable",
                freshness_status="unavailable",
                retrieved_at=now_iso,
                warnings=warnings or ["No recent news headlines available for this symbol."]
            )
            # Cache failure briefly for 3 minutes to avoid thrashing external endpoints
            self._cache[symbol] = {"timestamp": now_ts - (self.cache_ttl - 180), "data": empty_res}
            return empty_res

        # 4. Clean, Deduplicate, and Score Headlines
        scored_headlines = self._process_and_score_headlines(symbol, name, raw_items, provider_used, now_iso)
        if not scored_headlines:
            empty_res = NewsSentimentAggregate(
                symbol=symbol,
                company_name=name,
                overall_score=None,
                classification="Unavailable",
                evidence_quality="Unavailable",
                confidence_score=0.0,
                confidence_explanation=f"Headlines retrieved for {name} lacked sufficient relevance or valid metadata.",
                headlines_analyzed=0,
                headlines=[],
                provider=provider_used,
                freshness_status="unavailable",
                retrieved_at=now_iso,
                warnings=warnings + ["Headlines filtered out due to missing URLs or low relevance."]
            )
            return empty_res

        # 5. Aggregate Sentiment with Recency Weighting & Evidence Calibration
        aggregate = self._aggregate_sentiment(
            symbol=symbol,
            company_name=name,
            headlines=scored_headlines,
            provider=provider_used,
            now_iso=now_iso,
            warnings=warnings
        )

        # Store in cache
        self._cache[symbol] = {"timestamp": now_ts, "data": aggregate}
        return aggregate

    def _fetch_from_yfinance_search(self, symbol: str, company_name: str, max_items: int) -> List[Dict[str, Any]]:
        """Fetch headlines using yf.Search API."""
        import yfinance as yf
        # Search using company name or symbol
        query = company_name if company_name else symbol
        search = yf.Search(query, news_count=max_items * 2)
        news_list = getattr(search, "news", []) or []
        
        extracted = []
        for item in news_list:
            title = item.get("title")
            link = item.get("link")
            if not title or not link or not link.startswith("http"):
                continue
            
            # Timestamp handling
            pub_time = item.get("providerPublishTime")
            pub_iso = None
            if pub_time:
                try:
                    pub_iso = datetime.fromtimestamp(pub_time, tz=timezone.utc).isoformat()
                except Exception:
                    pub_iso = None

            publisher = item.get("publisher") or "Financial Media"
            summary = item.get("summary") or ""

            extracted.append({
                "title": title,
                "url": link,
                "publisher": publisher,
                "published_at": pub_iso,
                "description": summary,
                "provider": "Yahoo Finance Search"
            })
            if len(extracted) >= max_items:
                break
        return extracted

    def _fetch_from_google_rss(self, symbol: str, company_name: str, max_items: int) -> List[Dict[str, Any]]:
        """Fetch headlines using Google News RSS search for Indian equities."""
        search_query = f"{company_name} stock NSE"
        encoded_query = urllib.parse.quote_plus(search_query)
        rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-IN&gl=IN&ceid=IN:en"

        req = urllib.request.Request(
            rss_url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) VibeFinance/1.0"}
        )
        with urllib.request.urlopen(req, timeout=8.0) as resp:
            content = resp.read()

        root = ET.fromstring(content)
        channel = root.find("channel")
        if channel is None:
            return []

        items = channel.findall("item")
        extracted = []
        for it in items:
            title_elem = it.find("title")
            link_elem = it.find("link")
            pub_date_elem = it.find("pubDate")
            source_elem = it.find("source")

            if title_elem is None or not title_elem.text:
                continue
            title = title_elem.text.strip()
            link = link_elem.text.strip() if link_elem is not None and link_elem.text else ""
            if not link or not link.startswith("http"):
                continue

            publisher = "Financial News"
            if source_elem is not None and source_elem.text:
                publisher = source_elem.text.strip()
            elif " - " in title:
                # Often formatted as "Headline text - Source Name"
                parts = title.rsplit(" - ", 1)
                title = parts[0].strip()
                publisher = parts[1].strip()

            published_at = None
            if pub_date_elem is not None and pub_date_elem.text:
                try:
                    # Google RSS date format: "Mon, 13 Oct 2026 06:12:00 GMT"
                    from email.utils import parsedate_to_datetime
                    dt = parsedate_to_datetime(pub_date_elem.text.strip())
                    published_at = dt.astimezone(timezone.utc).isoformat()
                except Exception:
                    published_at = pub_date_elem.text.strip()

            extracted.append({
                "title": title,
                "url": link,
                "publisher": publisher,
                "published_at": published_at,
                "description": "",
                "provider": "Google News RSS"
            })
            if len(extracted) >= max_items:
                break
        return extracted

    def _process_and_score_headlines(
        self,
        symbol: str,
        company_name: str,
        raw_items: List[Dict[str, Any]],
        provider: str,
        retrieved_at: str
    ) -> List[FinancialNewsItem]:
        """Clean, deduplicate, and score each valid headline record."""
        seen_titles = set()
        scored_items: List[FinancialNewsItem] = []

        # Keywords to filter relevance
        name_words = [w.lower() for w in re.findall(r'[A-Za-z]+', company_name) if len(w) > 2]
        sym_lower = symbol.lower()

        for item in raw_items:
            title = item.get("title", "").strip()
            url = item.get("url", "").strip()
            if not title or not url:
                continue

            # Deduplication key based on normalized title
            norm_key = re.sub(r'[^a-zA-Z0-9]', '', title.lower())
            if norm_key in seen_titles:
                continue
            seen_titles.add(norm_key)

            # Relevance check: title should reference symbol or company keywords or Indian market context
            title_lower = title.lower()
            is_relevant = (
                sym_lower in title_lower or
                any(nw in title_lower for nw in name_words) or
                "nifty" in title_lower or "sensex" in title_lower or "share" in title_lower or "stock" in title_lower
            )
            if not is_relevant and len(raw_items) > 3:
                # If plenty of headlines exist, drop irrelevant ones
                continue

            # Calculate deterministic sentiment score
            score, label, conf = FinancialSentimentScorer.score_headline(title)

            scored_items.append(
                FinancialNewsItem(
                    symbol=symbol,
                    company_name=company_name,
                    title=title,
                    publisher=item.get("publisher", "Financial News"),
                    url=url,
                    published_at=item.get("published_at"),
                    retrieved_at=retrieved_at,
                    provider=provider,
                    description=item.get("description"),
                    sentiment_score=score,
                    sentiment_label=label,
                    sentiment_confidence=conf
                )
            )

        return scored_items

    def _aggregate_sentiment(
        self,
        symbol: str,
        company_name: str,
        headlines: List[FinancialNewsItem],
        provider: str,
        now_iso: str,
        warnings: List[str]
    ) -> NewsSentimentAggregate:
        """
        Aggregate individual headline sentiment scores using a recency-weighted mean.
        Calibrates evidence quality separately from sentiment polarity.
        """
        n = len(headlines)
        if n == 0:
            return NewsSentimentAggregate(
                symbol=symbol,
                company_name=company_name,
                overall_score=None,
                classification="Unavailable",
                evidence_quality="Unavailable",
                confidence_score=0.0,
                confidence_explanation="No usable headlines after filtering.",
                headlines_analyzed=0,
                headlines=[],
                provider=provider,
                freshness_status="unavailable",
                retrieved_at=now_iso,
                warnings=warnings
            )

        pos_count = sum(1 for h in headlines if (h.sentiment_score or 0.0) >= 0.05)
        neg_count = sum(1 for h in headlines if (h.sentiment_score or 0.0) <= -0.05)
        neu_count = n - pos_count - neg_count

        # Recency-weighted aggregation:
        # Newer articles get higher weight if timestamps exist
        weighted_sum = 0.0
        total_weight = 0.0
        now_dt = datetime.now(timezone.utc)

        for h in headlines:
            w = 1.0
            if h.published_at:
                try:
                    pub_dt = datetime.fromisoformat(h.published_at.replace("Z", "+00:00"))
                    diff_hours = max(0.0, (now_dt - pub_dt).total_seconds() / 3600.0)
                    # Exponential decay: half-life ~48 hours
                    w = math.exp(-0.015 * diff_hours)
                except Exception:
                    w = 1.0
            weighted_sum += (h.sentiment_score or 0.0) * w
            total_weight += w

        overall_score = round(weighted_sum / total_weight, 3) if total_weight > 0 else 0.0

        # Classification thresholds
        if n < 2:
            # Insufficient evidence sample to classify conclusively
            classification = "Insufficient Evidence"
        elif overall_score >= 0.05:
            classification = "Positive"
        elif overall_score <= -0.05:
            classification = "Negative"
        else:
            classification = "Neutral"

        # Evidence Quality & Confidence Assessment
        # Distinct from polarity score: evaluates sample size, publisher diversity, and consensus
        publishers = {h.publisher for h in headlines if h.publisher}
        diversity_factor = min(1.0, len(publishers) / 3.0)
        sample_factor = min(1.0, n / 5.0)

        # Polarity consensus factor (agreement among headlines)
        majority_count = max(pos_count, neg_count, neu_count)
        consensus_ratio = majority_count / n if n > 0 else 0.0

        confidence = round((sample_factor * 0.45) + (diversity_factor * 0.25) + (consensus_ratio * 0.30), 2)

        if n >= 4 and confidence >= 0.70:
            evidence_quality = "High"
            explanation = f"High confidence based on {n} distinct headlines across {len(publishers)} publisher(s) with {round(consensus_ratio*100)}% directional consensus."
        elif n >= 2 and confidence >= 0.45:
            evidence_quality = "Moderate"
            explanation = f"Moderate evidence based on {n} headlines across {len(publishers)} publisher(s)."
        else:
            evidence_quality = "Low / Insufficient Evidence"
            explanation = f"Sample contains only {n} headline(s). Additional news volume is required for statistical reliability."
            warnings.append("Sample size too small for statistical certainty. Rely primarily on quantitative indicators.")

        return NewsSentimentAggregate(
            symbol=symbol,
            company_name=company_name,
            overall_score=overall_score,
            classification=classification,
            evidence_quality=evidence_quality,
            confidence_score=confidence,
            confidence_explanation=explanation,
            headlines_analyzed=n,
            positive_count=pos_count,
            neutral_count=neu_count,
            negative_count=neg_count,
            headlines=headlines,
            provider=provider,
            freshness_status="fresh",
            retrieved_at=now_iso,
            warnings=warnings
        )

# Global singleton instance
news_sentiment_service = FinancialNewsService()
