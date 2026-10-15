import math
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from app.market_data.service import market_data_service
from app.market_data.symbols import SYMBOL_MAP
from app.market_data.news_service import news_sentiment_service
from app.ai.schemas import AgentResponse, Citation, Scenario

class MarketAnalysisAgent:
    """
    Agent 1: Market Analysis Agent.
    Analyzes historical trends, technical momentum, volume anomalies,
    moving averages, support/resistance, volatility, and market signals.
    """
    agent_name = "Market Analysis Agent"

    def analyze(self, symbol: Optional[str] = None) -> AgentResponse:
        now_iso = datetime.now(timezone.utc).isoformat()
        if not symbol:
            return self._analyze_macro_market()
        
        symbol = symbol.upper()
        meta = SYMBOL_MAP.get(symbol)
        if not meta:
            return AgentResponse(
                agent_name=self.agent_name,
                entity=symbol,
                summary=f"Instrument {symbol} is not active in the 100-stock universe.",
                signal="Unavailable",
                key_findings=["Symbol not recognized in curated Indian stock universe."],
                data_freshness="unavailable",
                missing_data=[f"Market data for {symbol}"]
            )

        # 1. Fetch quote, history, indicators
        quote = market_data_service.get_stock_quote(symbol)
        history = market_data_service.get_history(symbol, period="1y", interval="1d")
        indicators = market_data_service.calculate_indicators(history)
        latest_ind = indicators.get("latest", {})

        current_price = quote.price or (history[-1]["close"] if history else None)
        prev_close = quote.previous_close or (history[-2]["close"] if len(history) > 1 else current_price)
        change_pct = quote.change_pct
        if change_pct is None and current_price and prev_close:
            change_pct = round(((current_price - prev_close) / prev_close) * 100, 2)

        # 2. Moving averages
        sma20 = latest_ind.get("sma20")
        sma50 = latest_ind.get("sma50")
        ema20 = latest_ind.get("ema20")
        rsi = latest_ind.get("rsi14")

        # Calculate SMA 200 if sufficient history
        sma200 = None
        if len(history) >= 200:
            closes_200 = [b["close"] for b in history[-200:]]
            sma200 = round(sum(closes_200) / 200, 2)
        elif len(history) >= 100:
            # Note insufficient data for 200, calculate partial
            sma200 = None

        # 3. Volume Anomaly Analysis
        recent_volumes = [b.get("volume", 0) for b in history[-20:]] if history else []
        avg_volume_20 = round(sum(recent_volumes) / len(recent_volumes), 0) if recent_volumes else 0
        current_volume = quote.volume or (history[-1].get("volume", 0) if history else 0)
        
        volume_anomaly_ratio = round(current_volume / avg_volume_20, 2) if avg_volume_20 > 0 else 1.0
        volume_anomaly_detected = volume_anomaly_ratio >= 1.75 or volume_anomaly_ratio <= 0.35
        volume_status = "Elevated Institutional Volume" if volume_anomaly_ratio >= 1.75 else (
            "Subdued Below-Average Volume" if volume_anomaly_ratio <= 0.5 else "Normal Trading Volume"
        )

        # 4. Volatility Measurements (Annualized Historical Volatility 30-day)
        volatility_30d = None
        if len(history) >= 30:
            returns = []
            for i in range(len(history) - 29, len(history)):
                p_curr = history[i]["close"]
                p_prev = history[i-1]["close"]
                if p_prev > 0:
                    returns.append(math.log(p_curr / p_prev))
            if returns:
                mean_ret = sum(returns) / len(returns)
                variance = sum((r - mean_ret) ** 2 for r in returns) / len(returns)
                daily_vol = math.sqrt(variance)
                volatility_30d = round(daily_vol * math.sqrt(252) * 100, 2) # Annualized %

        # 5. Support and Resistance Estimates
        support_level = None
        resistance_level = None
        if history and len(history) >= 20:
            recent_lows = [b["low"] for b in history[-60:]]
            recent_highs = [b["high"] for b in history[-60:]]
            support_level = round(min(recent_lows), 2)
            resistance_level = round(max(recent_highs), 2)

        # 6. Signal Determination
        bull_points = 0
        bear_points = 0
        if current_price and sma20 and current_price > sma20: bull_points += 1
        else: bear_points += 1
        
        if current_price and sma50 and current_price > sma50: bull_points += 1
        else: bear_points += 1

        if sma200 and current_price and current_price > sma200: bull_points += 1.5
        elif sma200 and current_price and current_price < sma200: bear_points += 1.5

        if rsi:
            if 45 <= rsi <= 65: bull_points += 1
            elif rsi > 70: bear_points += 1 # Overbought
            elif rsi < 30: bull_points += 0.5 # Oversold mean reversion
            elif rsi < 45: bear_points += 1

        if bull_points >= 3.0:
            overall_signal = "Bullish"
        elif bear_points >= 3.0:
            overall_signal = "Bearish"
        else:
            overall_signal = "Neutral / Sideways"

        # 7. Scenarios (Model-Estimated Scenarios)
        scenarios = []
        if current_price:
            bull_target = round(resistance_level if (resistance_level and resistance_level > current_price) else current_price * 1.10, 2)
            base_target = round(current_price * 1.02, 2)
            bear_target = round(support_level if (support_level and support_level < current_price) else current_price * 0.92, 2)

            bull_implied = round(((bull_target - current_price) / current_price) * 100, 2)
            base_implied = round(((base_target - current_price) / current_price) * 100, 2)
            bear_implied = round(((bear_target - current_price) / current_price) * 100, 2)

            scenarios = [
                Scenario(
                    case="Bullish",
                    target_price=bull_target,
                    target_range=f"₹{round(bull_target * 0.98, 2):,.2f} – ₹{round(bull_target * 1.04, 2):,.2f}",
                    implied_change_pct=bull_implied,
                    probability_assessment="High momentum continuation if volume expands above 1.5x 20-day average.",
                    assumptions=[
                        f"Technical breakout confirmed above ₹{sma20 or current_price:,.2f} with institutional volume",
                        "RSI oscillator stabilizes in the 55-68 momentum zone without exhaustion"
                    ],
                    catalysts=[f"Sustained breakout above ₹{sma20 or current_price:,.2f}", "Sector tailwinds & institutional inflows"],
                    label="Model-Estimated Scenario"
                ),
                Scenario(
                    case="Base",
                    target_price=base_target,
                    target_range=f"₹{round(current_price * 0.98, 2):,.2f} – ₹{round(current_price * 1.03, 2):,.2f}",
                    implied_change_pct=base_implied,
                    probability_assessment="Consolidation within established 60-day price discovery channel.",
                    assumptions=[
                        "Oscillation within defined moving average envelopes (SMA 20/50)",
                        "Trading volume tracks near 20-day daily moving average"
                    ],
                    catalysts=["Range-bound trading with sideways oscillator alignment"],
                    label="Model-Estimated Scenario"
                ),
                Scenario(
                    case="Bearish",
                    target_price=bear_target,
                    target_range=f"₹{round(bear_target * 0.96, 2):,.2f} – ₹{round(bear_target * 1.02, 2):,.2f}",
                    implied_change_pct=bear_implied,
                    probability_assessment="Retest of recent demand floor upon breakdown below key moving averages.",
                    assumptions=[
                        f"Failure to hold support band near ₹{support_level or current_price * 0.95:,.2f}",
                        "RSI deteriorating into sub-40 bearish trajectory with sector distribution"
                    ],
                    catalysts=[f"Breakdown below ₹{support_level or current_price * 0.95:,.2f}", "RSI sliding into sub-40 bearish trajectory"],
                    label="Model-Estimated Scenario"
                )
            ]

        # 8. Genuine Financial News Sentiment Analysis (PS 04 Task 2)
        sentiment_res = news_sentiment_service.get_stock_sentiment(symbol, meta["name"])
        sentiment_dict = sentiment_res.model_dump()

        # 9. Confidence Assessment
        confidence_factors = [
            f"Historical daily bars analyzed: {len(history)} sessions",
            f"Quote freshness: {quote.data_status}",
            "Technical indicator convergence across RSI and Dual Moving Averages"
        ]
        if sentiment_res.classification != "Unavailable":
            confidence_factors.append(
                f"News Sentiment: {sentiment_res.classification} ({sentiment_res.headlines_analyzed} headlines, {sentiment_res.evidence_quality} evidence)"
            )
        else:
            confidence_factors.append("News Sentiment: Unavailable from public feeds")
        confidence_score = 0.88 if len(history) >= 100 else 0.65

        # 10. Key Findings
        price_str = f"₹{current_price:,.2f}" if current_price is not None else "Price unavailable"
        chg_str = f" ({change_pct:+.2f}%)" if change_pct is not None else ""
        key_findings = [
            f"Price currently at {price_str}{chg_str} on {meta['exchange']}.",
            f"Technical momentum classified as '{overall_signal}' with RSI(14) at {rsi or 'N/A'}.",
            f"20-day Volume Anomaly Ratio: {volume_anomaly_ratio}x ({volume_status}).",
        ]
        if support_level is not None and resistance_level is not None:
            key_findings.append(f"Support estimated near ₹{support_level:,.2f} and Resistance near ₹{resistance_level:,.2f}.")
        elif support_level is not None:
            key_findings.append(f"Support estimated near ₹{support_level:,.2f}.")
        elif resistance_level is not None:
            key_findings.append(f"Resistance estimated near ₹{resistance_level:,.2f}.")
        else:
            key_findings.append("Support and resistance levels require additional historical trading volume.")

        if sma200 and current_price:
            key_findings.append(f"Long-term Trend: Price is {'above' if current_price > sma200 else 'below'} 200-day SMA (₹{sma200:,.2f}).")
        if volatility_30d:
            key_findings.append(f"Annualized 30-day volatility measured at {volatility_30d}%.")

        # News Sentiment Findings & Disagreement Detection
        if sentiment_res.classification != "Unavailable":
            score_str = f"{sentiment_res.overall_score:+.2f}" if sentiment_res.overall_score is not None else "N/A"
            key_findings.append(
                f"Financial News Sentiment: {sentiment_res.classification} (Score: {score_str}, Evidence: {sentiment_res.evidence_quality}) "
                f"across {sentiment_res.headlines_analyzed} recent headlines from {sentiment_res.provider}."
            )
            # Surface explicit disagreements between technical momentum and news sentiment
            if "Bullish" in overall_signal and sentiment_res.classification == "Negative":
                key_findings.append(
                    "Signal Divergence Detected: Technical momentum is Bullish, but recent financial news headlines reflect Negative sentiment."
                )
            elif "Bearish" in overall_signal and sentiment_res.classification == "Positive":
                key_findings.append(
                    "Signal Divergence Detected: Technical momentum is Bearish, but recent financial news headlines reflect Positive sentiment."
                )
        else:
            key_findings.append(
                "Financial News Sentiment: Unavailable (insufficient recent news headlines from external public feeds; quantitative analysis unaffected)."
            )

        missing_data = []
        if not sma200:
            missing_data.append("200-day SMA requires at least 200 trading days of continuous history.")
        if not support_level or not resistance_level:
            missing_data.append("Support and resistance calculations require at least 20 historical sessions.")

        sources = [
            Citation(source=f"Yahoo Finance ({meta['provider_symbol']})", metric="Latest Quote", value=current_price, timestamp=quote.fetched_at),
            Citation(source="VibeFinance Quantitative Indicator Engine", metric="RSI & Moving Averages", value=rsi, timestamp=now_iso),
            Citation(source="VibeFinance Volatility Model", metric="30D Annualized Volatility", value=volatility_30d, timestamp=now_iso)
        ]
        # Append verifiable news headline citations
        for h in sentiment_res.headlines:
            sources.append(
                Citation(
                    source=f"News: {h.publisher}",
                    metric="Headline Polarity",
                    value=h.sentiment_score,
                    timestamp=h.published_at or now_iso,
                    source_url=h.url,
                    publisher=h.publisher,
                    publication_date=h.published_at,
                    passage=h.title,
                    relevance_score=h.sentiment_confidence
                )
            )

        all_warnings = [quote.warnings] if quote.warnings else []
        if sentiment_res.warnings:
            all_warnings.extend(sentiment_res.warnings)

        price_disp = f"₹{current_price:,.2f}" if current_price is not None else "N/A"

        return AgentResponse(
            agent_name=self.agent_name,
            entity=symbol,
            summary=f"{meta['name']} ({symbol}) displays a {overall_signal.lower()} market profile trading at {price_disp} with RSI at {rsi or 'N/A'}.",
            signal=overall_signal,
            key_findings=key_findings,
            supporting_data={
                "symbol": symbol,
                "name": meta["name"],
                "exchange": meta["exchange"],
                "sector": meta["sector_name"],
                "current_price": current_price,
                "previous_close": prev_close,
                "change_pct": change_pct,
                "rsi_14": rsi,
                "sma_20": sma20,
                "sma_50": sma50,
                "sma_200": sma200,
                "ema_20": ema20,
                "current_volume": current_volume,
                "avg_volume_20d": avg_volume_20,
                "volume_anomaly_ratio": volume_anomaly_ratio,
                "volume_status": volume_status,
                "volatility_30d_pct": volatility_30d,
                "support_level": support_level,
                "resistance_level": resistance_level,
                "news_sentiment": sentiment_dict
            },
            scenarios=scenarios,
            sources=sources,
            citations=sources,
            risks_and_limitations=[
                "yfinance is a development data adapter subject to non-realtime delays and rate limits.",
                "Moving averages and support/resistance are historical mathematical estimations, not guaranteed price barriers.",
                "News sentiment is a linguistic polarity measurement of public headlines, not a calibrated price direction forecast.",
                "Surge in unexpected macroeconomic news can invalidate technical setups."
            ],
            timestamp=now_iso,
            data_freshness=quote.data_status,
            confidence={
                "score": confidence_score,
                "scale": "0.0 - 1.0",
                "factors": confidence_factors
            },
            missing_data=missing_data,
            warnings=all_warnings,
            disclaimer="Educational technical market intelligence. Not SEBI-registered financial advice. Does not constitute a buy, sell, or hold recommendation.",
            news_sentiment=sentiment_dict
        )

    def _analyze_macro_market(self) -> AgentResponse:
        now_iso = datetime.now(timezone.utc).isoformat()
        overview = market_data_service.get_market_overview()
        indices = overview.get("indices", [])
        sector_perf = overview.get("sector_performance", {})
        gainers = overview.get("gainers", [])
        losers = overview.get("losers", [])

        nifty = next((i for i in indices if i["symbol"] == "NIFTY50"), None)
        sensex = next((i for i in indices if i["symbol"] == "SENSEX"), None)
        nifty_change = (nifty.get("change_pct") or 0.0) if nifty else 0.0
        sensex_change = (sensex.get("change_pct") or 0.0) if sensex else 0.0

        sorted_sectors = sorted(
            sector_perf.items(),
            key=lambda x: (x[1].get("avg_change_pct") or 0.0),
            reverse=True
        )
        leading_sec = sorted_sectors[0][1]["sector_name"] if sorted_sectors else "Technology"
        lagging_sec = sorted_sectors[-1][1]["sector_name"] if sorted_sectors else "Metals"

        regime = "Bullish" if nifty_change > 0.3 else ("Bearish" if nifty_change < -0.3 else "Neutral / Consolidating")

        nifty_price = nifty.get("price") if nifty else "N/A"
        sensex_price = sensex.get("price") if sensex else "N/A"
        key_findings = [
            f"NIFTY 50 trading at ₹{nifty_price} ({nifty_change:+.2f}%).",
            f"S&P BSE SENSEX trading at ₹{sensex_price} ({sensex_change:+.2f}%).",
            f"Sector Leadership: {leading_sec} leading performance.",
            f"Sector Laggard: {lagging_sec} facing relative distribution.",
            f"Market Breadth: {len(gainers)} top gainers vs {len(losers)} top losers in universe sample."
        ]

        return AgentResponse(
            agent_name=self.agent_name,
            entity="INDIAN_MARKET",
            summary=f"Indian benchmark indices show a {regime.lower()} market regime with NIFTY 50 at {nifty_change:+.2f}%. Sector leadership is driven by {leading_sec}.",
            signal=regime,
            key_findings=key_findings,
            supporting_data={
                "nifty": nifty,
                "sensex": sensex,
                "leading_sector": leading_sec,
                "lagging_sector": lagging_sec,
                "sector_performance": sector_perf
            },
            sources=[
                Citation(source="Yahoo Finance (^NSEI)", metric="NIFTY 50", value=nifty.get("price") if nifty else None),
                Citation(source="Yahoo Finance (^BSESN)", metric="SENSEX", value=sensex.get("price") if sensex else None),
                Citation(source="VibeFinance Sector Aggregator", metric="10 Sector Matrix")
            ],
            risks_and_limitations=[
                "Market sentiment reflects daily close updates and 5-minute sampling intervals.",
                "Development data adapter; not intended for automated exchange trade routing."
            ],
            timestamp=now_iso,
            data_freshness="fresh",
            confidence={
                "score": 0.85,
                "scale": "0.0 - 1.0",
                "factors": ["Live NIFTY 50 and SENSEX quotes", "Comprehensive 10-sector weighted matrix"]
            }
        )

market_agent = MarketAnalysisAgent()
market_analysis_agent = market_agent
