import math
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.market_data.provider_base import MarketDataProvider, NormalizedQuote, HistoricalBar, Fundamentals
from app.market_data.yfinance_provider import YFinanceProvider
from app.market_data.symbols import STOCK_UNIVERSE, SYMBOL_MAP, SECTORS
from app.core.database import get_db
from app.core.config import settings

logger = logging.getLogger(__name__)

class MarketDataService:
    def __init__(self, provider: Optional[MarketDataProvider] = None):
        self.provider = provider or YFinanceProvider()
        self.last_refresh_attempt: Optional[str] = None
        self.last_successful_refresh: Optional[str] = None

    def get_stock_quote(self, symbol: str, force_refresh: bool = False) -> NormalizedQuote:
        symbol = symbol.upper()
        meta = SYMBOL_MAP.get(symbol)
        if not meta:
            now_iso = datetime.now(timezone.utc).isoformat()
            return NormalizedQuote(
                symbol=symbol,
                exchange="NSE",
                provider_symbol=symbol,
                price=None,
                fetched_at=now_iso,
                data_status="unavailable",
                warnings="Symbol not found in 100-stock universe"
            )

        now = datetime.now(timezone.utc)
        
        # Check cached quote in DB
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT symbol, provider_symbol, price, previous_close, open_price, day_high, day_low,
                       volume, market_cap, currency, source, market_timestamp, fetched_at, data_status, warnings
                FROM market_quotes WHERE symbol = ?
            """, (symbol,))
            row = cursor.fetchone()

        if row and not force_refresh:
            try:
                fetched_dt = datetime.fromisoformat(row["fetched_at"])
                age_seconds = (now - fetched_dt).total_seconds()
                
                # If cached quote is recent enough, return it
                if age_seconds < settings.STALE_THRESHOLD_SECONDS and row["price"] is not None:
                    change = None
                    change_pct = None
                    if row["price"] and row["previous_close"]:
                        change = round(row["price"] - row["previous_close"], 2)
                        change_pct = round((change / row["previous_close"]) * 100, 2)
                    
                    return NormalizedQuote(
                        symbol=row["symbol"],
                        exchange=meta["exchange"],
                        provider_symbol=row["provider_symbol"],
                        price=row["price"],
                        previous_close=row["previous_close"],
                        open_price=row["open_price"],
                        day_high=row["day_high"],
                        day_low=row["day_low"],
                        volume=row["volume"],
                        market_cap=row["market_cap"],
                        currency=row["currency"] or "INR",
                        change=change,
                        change_pct=change_pct,
                        source=row["source"],
                        market_timestamp=row["market_timestamp"],
                        fetched_at=row["fetched_at"],
                        data_status="stale" if age_seconds > settings.STALE_THRESHOLD_SECONDS else "fresh",
                        warnings=row["warnings"]
                    )
            except Exception as e:
                logger.warning(f"Error parsing cached quote for {symbol}: {e}")

        # Fetch from provider
        quote = self.provider.get_quote(symbol, meta["provider_symbol"], meta["exchange"])
        
        # Save to DB cache
        if quote.price is not None:
            self._save_quote_to_db(quote)
            self.last_successful_refresh = quote.fetched_at
        elif row and row["price"] is not None:
            # Fallback to stale database entry if provider failed
            quote = NormalizedQuote(
                symbol=row["symbol"],
                exchange=meta["exchange"],
                provider_symbol=row["provider_symbol"],
                price=row["price"],
                previous_close=row["previous_close"],
                open_price=row["open_price"],
                day_high=row["day_high"],
                day_low=row["day_low"],
                volume=row["volume"],
                market_cap=row["market_cap"],
                currency=row["currency"] or "INR",
                source=row["source"],
                market_timestamp=row["market_timestamp"],
                fetched_at=row["fetched_at"],
                data_status="stale",
                warnings="Provider refresh failed; serving last known price"
            )

        self.last_refresh_attempt = datetime.now(timezone.utc).isoformat()
        return quote

    def _save_quote_to_db(self, quote: NormalizedQuote):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO market_quotes (
                    symbol, provider_symbol, price, previous_close, open_price, day_high, day_low,
                    volume, market_cap, currency, source, market_timestamp, fetched_at, data_status, warnings
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(symbol) DO UPDATE SET
                    price = excluded.price,
                    previous_close = excluded.previous_close,
                    open_price = excluded.open_price,
                    day_high = excluded.day_high,
                    day_low = excluded.day_low,
                    volume = excluded.volume,
                    market_cap = excluded.market_cap,
                    currency = excluded.currency,
                    source = excluded.source,
                    market_timestamp = excluded.market_timestamp,
                    fetched_at = excluded.fetched_at,
                    data_status = excluded.data_status,
                    warnings = excluded.warnings;
            """, (
                quote.symbol, quote.provider_symbol, quote.price, quote.previous_close,
                quote.open_price, quote.day_high, quote.day_low, quote.volume,
                quote.market_cap, quote.currency, quote.source, quote.market_timestamp,
                quote.fetched_at, quote.data_status, quote.warnings
            ))

    def get_all_quotes(self, force_refresh: bool = False) -> List[NormalizedQuote]:
        """Fetch quotes for all 100 stocks from central database cache."""
        if force_refresh:
            self.refresh_universe_quotes(max_workers=5)

        quotes_map = {}
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM market_quotes")
            for r in cursor.fetchall():
                quotes_map[r["symbol"]] = dict(r)

        now = datetime.now(timezone.utc)
        quotes = []
        for stock in STOCK_UNIVERSE:
            sym = stock["symbol"]
            row = quotes_map.get(sym)
            if row and row["price"] is not None:
                change = None
                change_pct = None
                if row["previous_close"] and row["previous_close"] > 0:
                    change = round(row["price"] - row["previous_close"], 2)
                    change_pct = round((change / row["previous_close"]) * 100, 2)
                
                try:
                    fetched_dt = datetime.fromisoformat(row["fetched_at"])
                    is_stale = (now - fetched_dt).total_seconds() > settings.STALE_THRESHOLD_SECONDS
                except Exception:
                    is_stale = False

                quotes.append(NormalizedQuote(
                    symbol=sym,
                    exchange=stock["exchange"],
                    provider_symbol=stock["provider_symbol"],
                    price=row["price"],
                    previous_close=row["previous_close"],
                    open_price=row["open_price"],
                    day_high=row["day_high"],
                    day_low=row["day_low"],
                    volume=row["volume"],
                    market_cap=row["market_cap"],
                    currency=row["currency"] or "INR",
                    change=change,
                    change_pct=change_pct,
                    source=row["source"] or settings.MARKET_DATA_PROVIDER,
                    market_timestamp=row["market_timestamp"],
                    fetched_at=row["fetched_at"],
                    data_status="stale" if is_stale else "fresh",
                    warnings=row["warnings"]
                ))
            else:
                quotes.append(NormalizedQuote(
                    symbol=sym,
                    exchange=stock["exchange"],
                    provider_symbol=stock["provider_symbol"],
                    price=None,
                    fetched_at=now.isoformat(),
                    data_status="unavailable",
                    source=settings.MARKET_DATA_PROVIDER,
                    warnings="Quote awaiting initial refresh"
                ))
        return quotes

    def refresh_universe_quotes(self, max_workers: int = 5) -> Dict[str, Any]:
        """
        Background batch refresh across 100 stocks with bounded concurrency
        and rate-limit mitigation.
        """
        self.last_refresh_attempt = datetime.now(timezone.utc).isoformat()
        refreshed_count = 0
        failed_count = 0

        def fetch_one(s_info):
            try:
                q = self.provider.get_quote(s_info["symbol"], s_info["provider_symbol"], s_info["exchange"])
                if q.price is not None:
                    self._save_quote_to_db(q)
                    return True
                return False
            except Exception as e:
                logger.error(f"Failed to refresh {s_info['symbol']}: {e}")
                return False

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [executor.submit(fetch_one, stock) for stock in STOCK_UNIVERSE]
            for future in as_completed(futures):
                if future.result():
                    refreshed_count += 1
                else:
                    failed_count += 1

        self.last_successful_refresh = datetime.now(timezone.utc).isoformat()
        return {
            "refreshed_count": refreshed_count,
            "failed_count": failed_count,
            "total": len(STOCK_UNIVERSE),
            "timestamp": self.last_successful_refresh
        }

    def get_history(self, symbol: str, period: str = "1mo", interval: str = "1d") -> List[Dict[str, Any]]:
        meta = SYMBOL_MAP.get(symbol.upper())
        if not meta:
            return []
        bars = self.provider.get_history(meta["provider_symbol"], period=period, interval=interval)
        return [b.model_dump() for b in bars]

    def get_fundamentals(self, symbol: str) -> Fundamentals:
        meta = SYMBOL_MAP.get(symbol.upper())
        if not meta:
            now_iso = datetime.now(timezone.utc).isoformat()
            return Fundamentals(symbol=symbol, provider_symbol=symbol, source=settings.MARKET_DATA_PROVIDER, fetched_at=now_iso)
        return self.provider.get_fundamentals(symbol.upper(), meta["provider_symbol"])

    def get_market_overview(self) -> Dict[str, Any]:
        indices = self.provider.get_indices()
        all_quotes = self.get_all_quotes()
        
        valid_quotes = [q for q in all_quotes if q.price is not None and q.change_pct is not None]
        
        # Sort for gainers & losers
        gainers = sorted(valid_quotes, key=lambda x: x.change_pct or 0, reverse=True)[:5]
        losers = sorted(valid_quotes, key=lambda x: x.change_pct or 0)[:5]
        
        # Most active by volume
        most_active = sorted([q for q in valid_quotes if q.volume], key=lambda x: x.volume or 0, reverse=True)[:5]
        
        # Sector performance
        sector_perf = {}
        for sec in SECTORS:
            sec_stocks = [q for q in valid_quotes if SYMBOL_MAP.get(q.symbol, {}).get("sector_id") == sec["id"]]
            if sec_stocks:
                avg_change = sum(s.change_pct for s in sec_stocks) / len(sec_stocks)
                sector_perf[sec["id"]] = {
                    "sector_name": sec["name"],
                    "avg_change_pct": round(avg_change, 2),
                    "stock_count": len(sec_stocks)
                }

        # Market status determination (NSE trading hours approx 9:15 AM - 3:30 PM IST Mon-Fri)
        # Note: We provide truthful label
        status_label = "open"
        now_utc = datetime.now(timezone.utc)
        now_ist = now_utc + timedelta(hours=5, minutes=30)
        weekday = now_ist.weekday()  # 0=Mon, 6=Sun
        
        if weekday in [5, 6]:
            status_label = "closed (weekend)"
        else:
            time_mins = now_ist.hour * 60 + now_ist.minute
            if 9 * 60 + 15 <= time_mins <= 15 * 60 + 30:
                status_label = "open (regular trading)"
            else:
                status_label = "closed (after-market)"

        return {
            "indices": indices,
            "gainers": [g.model_dump() for g in gainers],
            "losers": [l.model_dump() for l in losers],
            "most_active": [m.model_dump() for m in most_active],
            "sector_performance": sector_perf,
            "market_status": status_label,
            "provider": settings.MARKET_DATA_PROVIDER,
            "last_refresh_attempt": self.last_refresh_attempt,
            "last_successful_refresh": self.last_successful_refresh
        }

    # Technical Indicators Calculations
    @staticmethod
    def calculate_indicators(bars: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculate SMA(20, 50), EMA(20), RSI(14), MACD(12, 26, 9), and Bollinger Bands(20, 2)
        from historical close price series.
        """
        if not bars:
            return {}

        closes = [b["close"] for b in bars]
        n = len(closes)
        
        # 1. SMA 20 & 50
        def sma(data, period):
            res = [None] * len(data)
            for i in range(period - 1, len(data)):
                res[i] = round(sum(data[i - period + 1 : i + 1]) / period, 2)
            return res

        sma20 = sma(closes, 20) if n >= 20 else [None] * n
        sma50 = sma(closes, 50) if n >= 50 else [None] * n

        # 2. EMA 20
        def ema(data, period):
            res = [None] * len(data)
            if len(data) < period:
                return res
            # Initial SMA as first EMA
            res[period - 1] = sum(data[:period]) / period
            multiplier = 2 / (period + 1)
            for i in range(period, len(data)):
                res[i] = (data[i] - res[i - 1]) * multiplier + res[i - 1]
            return [round(x, 2) if x is not None else None for x in res]

        ema20 = ema(closes, 20) if n >= 20 else [None] * n

        # 3. RSI 14
        def rsi(data, period=14):
            res = [None] * len(data)
            if len(data) <= period:
                return res
            gains = []
            losses = []
            for i in range(1, len(data)):
                diff = data[i] - data[i - 1]
                gains.append(max(diff, 0.0))
                losses.append(max(-diff, 0.0))
            
            avg_gain = sum(gains[:period]) / period
            avg_loss = sum(losses[:period]) / period
            
            for i in range(period, len(data)):
                if i > period:
                    avg_gain = (avg_gain * (period - 1) + gains[i - 1]) / period
                    avg_loss = (avg_loss * (period - 1) + losses[i - 1]) / period
                
                if avg_loss == 0:
                    res[i] = 100.0
                else:
                    rs = avg_gain / avg_loss
                    res[i] = round(100.0 - (100.0 / (1.0 + rs)), 2)
            return res

        rsi14 = rsi(closes, 14)

        # 4. Bollinger Bands (20, 2)
        def bollinger_bands(data, period=20, num_std=2):
            upper = [None] * len(data)
            middle = [None] * len(data)
            lower = [None] * len(data)
            if len(data) < period:
                return upper, middle, lower
            for i in range(period - 1, len(data)):
                window = data[i - period + 1 : i + 1]
                mean = sum(window) / period
                variance = sum((x - mean) ** 2 for x in window) / period
                std = math.sqrt(variance)
                middle[i] = round(mean, 2)
                upper[i] = round(mean + (num_std * std), 2)
                lower[i] = round(mean - (num_std * std), 2)
            return upper, middle, lower

        bb_upper, bb_mid, bb_lower = bollinger_bands(closes, 20, 2)

        # 5. MACD (12, 26, 9)
        def macd(data):
            fast = ema(data, 12)
            slow = ema(data, 26)
            macd_line = [None] * len(data)
            for i in range(len(data)):
                if fast[i] is not None and slow[i] is not None:
                    macd_line[i] = fast[i] - slow[i]
            
            # Signal line is EMA 9 of MACD line
            signal_line = [None] * len(data)
            valid_macd = [(idx, val) for idx, val in enumerate(macd_line) if val is not None]
            if len(valid_macd) >= 9:
                start_idx = valid_macd[8][0]
                first_slice = [val for _, val in valid_macd[:9]]
                signal_line[start_idx] = sum(first_slice) / 9
                mult = 2 / (9 + 1)
                for j in range(9, len(valid_macd)):
                    cur_idx = valid_macd[j][0]
                    prev_idx = valid_macd[j - 1][0]
                    signal_line[cur_idx] = (macd_line[cur_idx] - signal_line[prev_idx]) * mult + signal_line[prev_idx]

            hist = [None] * len(data)
            for i in range(len(data)):
                if macd_line[i] is not None and signal_line[i] is not None:
                    hist[i] = round(macd_line[i] - signal_line[i], 2)
                    macd_line[i] = round(macd_line[i], 2)
                    signal_line[i] = round(signal_line[i], 2)

            return macd_line, signal_line, hist

        macd_line, macd_signal, macd_hist = macd(closes)

        # Build output indexed by bar timestamp
        results = []
        for i in range(n):
            results.append({
                "timestamp": bars[i]["timestamp"],
                "close": closes[i],
                "sma20": sma20[i],
                "sma50": sma50[i],
                "ema20": ema20[i],
                "rsi14": rsi14[i],
                "bb_upper": bb_upper[i],
                "bb_middle": bb_mid[i],
                "bb_lower": bb_lower[i],
                "macd": macd_line[i],
                "macd_signal": macd_signal[i],
                "macd_hist": macd_hist[i],
            })

        return {
            "bars_with_indicators": results,
            "latest": results[-1] if results else None
        }

market_data_service = MarketDataService()
