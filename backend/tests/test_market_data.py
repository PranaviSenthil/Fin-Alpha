import pytest
from app.market_data.service import MarketDataService
from app.market_data.provider_base import NormalizedQuote

def test_technical_indicator_calculations():
    # Synthetic closing prices (30 data points)
    bars = []
    for i in range(30):
        bars.append({
            "timestamp": f"2026-01-{i+1:02d}T09:15:00",
            "open": 100.0 + i,
            "high": 105.0 + i,
            "low": 98.0 + i,
            "close": 100.0 + i,
            "volume": 1000 + i * 50
        })

    indicators = MarketDataService.calculate_indicators(bars)
    assert "bars_with_indicators" in indicators
    assert len(indicators["bars_with_indicators"]) == 30
    
    latest = indicators["latest"]
    assert latest is not None
    assert latest["sma20"] is not None
    # For strictly increasing sequence 100, 101, ..., 129, SMA 20 of last 20 elements (110..129) is 119.5
    assert latest["sma20"] == 119.5
    assert latest["ema20"] is not None
    assert latest["rsi14"] is not None
    # Strictly increasing prices should have RSI of 100.0
    assert latest["rsi14"] == 100.0
    assert latest["bb_upper"] is not None
    assert latest["bb_lower"] is not None
    assert latest["bb_upper"] > latest["bb_middle"] > latest["bb_lower"]

def test_normalized_quote_contract():
    q = NormalizedQuote(
        symbol="TCS",
        exchange="NSE",
        provider_symbol="TCS.NS",
        price=3850.50,
        previous_close=3800.00,
        change=50.50,
        change_pct=1.33,
        fetched_at="2026-10-14T09:30:00Z",
        data_status="fresh"
    )
    assert q.symbol == "TCS"
    assert q.currency == "INR"
    assert q.price == 3850.50
    assert q.data_status == "fresh"


# ---------------------------------------------------------------------------
# Regression tests for the self.source_label AttributeError bug
# (fixed in get_all_quotes(): replaced self.source_label with
#  settings.MARKET_DATA_PROVIDER in both the price-available and the
#  price-unavailable branches)
# ---------------------------------------------------------------------------

from contextlib import contextmanager
from unittest.mock import patch, MagicMock
from app.core.config import settings


# Minimal stock entry that matches the shape of STOCK_UNIVERSE items
_STUB_STOCK = {
    "symbol": "TESTSTK",
    "name": "Test Stock Ltd",
    "exchange": "NSE",
    "provider_symbol": "TESTSTK.NS",
    "sector_id": "it",
    "sector_name": "Information Technology",
    "subsector": "Software",
    "currency": "INR",
}


@contextmanager
def _empty_db():
    """Context manager that returns a db connection whose cursor finds no rows."""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = []
    mock_conn.cursor.return_value = mock_cursor
    mock_conn.__enter__ = lambda s: s
    mock_conn.__exit__ = MagicMock(return_value=False)
    yield mock_conn


def test_get_all_quotes_unavailable_path_does_not_raise():
    """
    Regression test: when the market_quotes table has NO rows for a stock,
    get_all_quotes() previously raised AttributeError because it referenced
    self.source_label which does not exist on MarketDataService.
    After the fix it must complete without error and each unavailable quote
    must carry a non-empty source string.
    """
    svc = MarketDataService()

    with patch("app.market_data.service.get_db", return_value=_empty_db()), \
         patch("app.market_data.service.STOCK_UNIVERSE", [_STUB_STOCK]):

        # This must NOT raise AttributeError
        quotes = svc.get_all_quotes(force_refresh=False)

    assert len(quotes) == 1, "Expected exactly one quote for the one stubbed stock"
    q = quotes[0]

    # Core contract
    assert q.symbol == "TESTSTK"
    assert q.data_status == "unavailable"
    assert q.price is None

    # The bug: source must be a non-empty string, not an AttributeError
    assert isinstance(q.source, str), "source must be a str, not missing"
    assert q.source, "source must be non-empty"
    assert q.source == settings.MARKET_DATA_PROVIDER, (
        f"source should equal settings.MARKET_DATA_PROVIDER "
        f"('{settings.MARKET_DATA_PROVIDER}'), got '{q.source}'"
    )


def test_get_all_quotes_null_source_in_db_row_uses_fallback():
    """
    Regression test: when a DB row has a NULL/empty source column (the
    'row[\"source\"] or self.source_label' branch), get_all_quotes() previously
    raised AttributeError.  After the fix it must fall back to
    settings.MARKET_DATA_PROVIDER.
    """
    svc = MarketDataService()

    # Build a realistic DB row dict with source=None
    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    stub_row = {
        "symbol": "TESTSTK",
        "provider_symbol": "TESTSTK.NS",
        "price": 1500.0,
        "previous_close": 1480.0,
        "open_price": 1490.0,
        "day_high": 1520.0,
        "day_low": 1475.0,
        "volume": 500000,
        "market_cap": None,
        "currency": "INR",
        "source": None,          # ← the problematic NULL value
        "market_timestamp": now_iso,
        "fetched_at": now_iso,
        "data_status": "fresh",
        "warnings": None,
    }

    @contextmanager
    def _db_with_null_source():
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        # fetchall() returns the stub row
        mock_cursor.fetchall.return_value = [stub_row]
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = lambda s: s
        mock_conn.__exit__ = MagicMock(return_value=False)
        yield mock_conn

    with patch("app.market_data.service.get_db", return_value=_db_with_null_source()), \
         patch("app.market_data.service.STOCK_UNIVERSE", [_STUB_STOCK]):

        # This must NOT raise AttributeError
        quotes = svc.get_all_quotes(force_refresh=False)

    assert len(quotes) == 1
    q = quotes[0]

    assert q.symbol == "TESTSTK"
    assert q.price == 1500.0
    assert q.data_status in ("fresh", "stale")   # depends on clock, both valid

    # The bug: source must be a non-empty string, not an AttributeError
    assert isinstance(q.source, str), "source must be a str, not missing"
    assert q.source, "source must be non-empty"
    assert q.source == settings.MARKET_DATA_PROVIDER, (
        f"source should fall back to settings.MARKET_DATA_PROVIDER "
        f"('{settings.MARKET_DATA_PROVIDER}'), got '{q.source}'"
    )
