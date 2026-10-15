import time
import logging
import threading
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types, errors
from app.core.config import settings

logger = logging.getLogger(__name__)

def mask_key(k: str) -> str:
    """Mask API key for safe logging and client status without leaking secrets."""
    if not k:
        return "NONE"
    if len(k) <= 8:
        return "AIza***"
    return f"{k[:4]}...{k[-4:]}"

class GeminiKeyState:
    def __init__(self, key: str, index: int):
        self.key = key
        self.index = index
        self.masked = mask_key(key)
        self.cooldown_until: float = 0.0
        self.failure_count: int = 0
        self.is_valid: bool = True
        self.total_requests: int = 0
        self.total_successes: int = 0

    def is_available(self) -> bool:
        return self.is_valid and time.time() >= self.cooldown_until

    def mark_rate_limited(self, base_cooldown: float = 45.0):
        self.failure_count += 1
        delay = min(base_cooldown * (2 ** (self.failure_count - 1)), 300.0)
        self.cooldown_until = time.time() + delay
        logger.warning(f"Gemini Key #{self.index} ({self.masked}) rate-limited (429/quota). Cooldown for {delay:.1f}s.")

    def mark_invalid(self, reason: str = ""):
        self.is_valid = False
        logger.error(f"Gemini Key #{self.index} ({self.masked}) marked invalid: {reason}")

    def mark_success(self):
        self.failure_count = 0
        self.total_successes += 1
        self.cooldown_until = 0.0

class GeminiKeyManager:
    """
    Manages loading, status, and optional rotation across Google Gemini API keys.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self._keys: List[GeminiKeyState] = []
        self._current_index = 0
        self.refresh_keys()

    def refresh_keys(self):
        """Reload keys from environment settings."""
        with self._lock:
            configured = settings.get_gemini_api_keys()
            existing_map = {ks.key: ks for ks in self._keys}
            new_keys = []
            for idx, k in enumerate(configured, 1):
                if k in existing_map:
                    new_keys.append(existing_map[k])
                else:
                    new_keys.append(GeminiKeyState(k, idx))
            self._keys = new_keys
            if self._keys:
                logger.info(f"Loaded {len(self._keys)} Google Gemini API key(s): {[k.masked for k in self._keys]}")
            else:
                logger.info("No active Google Gemini API key configured in backend environment.")

    def get_pool_status(self) -> Dict[str, Any]:
        """Status of keys without exposing secrets."""
        with self._lock:
            now = time.time()
            active_count = sum(1 for k in self._keys if k.is_available())
            return {
                "provider": "Google Gemini",
                "has_usable_key": active_count > 0,
                "is_configured": len(self._keys) > 0,
                "total_keys": len(self._keys),
                "active_available": active_count,
                "keys": [
                    {
                        "index": k.index,
                        "masked": k.masked,
                        "is_valid": k.is_valid,
                        "in_cooldown": now < k.cooldown_until,
                        "cooldown_remaining_sec": max(0.0, round(k.cooldown_until - now, 1)),
                        "successes": k.total_successes
                    }
                    for k in self._keys
                ]
            }

    def acquire_key(self) -> Optional[GeminiKeyState]:
        """Retrieve next available valid Gemini key."""
        with self._lock:
            if not self._keys:
                self.refresh_keys()
            if not self._keys:
                return None

            n = len(self._keys)
            for i in range(n):
                idx = (self._current_index + i) % n
                candidate = self._keys[idx]
                if candidate.is_available():
                    self._current_index = (idx + 1) % n
                    candidate.total_requests += 1
                    return candidate
            return None

class GeminiService:
    """
    Official Google Gemini API Service powered by the google-genai SDK.
    Supports multi-turn chat, grounded stock research, financial safety rules,
    and automatic error diagnostics.
    """
    def __init__(self):
        self.key_manager = GeminiKeyManager()

    @property
    def model(self) -> str:
        return settings.GEMINI_MODEL

    @property
    def timeout(self) -> float:
        return settings.GEMINI_REQUEST_TIMEOUT

    def get_system_prompt(self, stock_context: Optional[Dict[str, Any]] = None) -> str:
        prompt = (
            "You are the VibeFinance AI Research Assistant, an intelligent, objective, educational equity research agent specializing in Indian stock markets (NSE & BSE listed equities), powered by Google Gemini.\n\n"
            "CRITICAL RESPONSE GUIDELINES:\n"
            "1. ANSWER DIRECTLY FIRST: Always answer the user's exact question in the very first sentence. Never open with boilerplate greetings, self-introductions ('As an AI...'), or canned legal disclaimers.\n"
            "2. RIGHT-SIZED & NATURAL ANSWERS: Keep simple questions short, direct, and conversational (1 to 3 concise paragraphs). For example, if asked what a company does, its current P/E, RSI, or why the price changed today, answer that specific query immediately without generating an unsolicited multi-page bull/bear report or excessive headings. Reserve deep, multi-section analysis ONLY for questions that explicitly ask for detailed research or comprehensive breakdowns.\n"
            "3. NO DIRECT TRADING DIRECTIVES: Never issue direct buy, sell, or hold commands, and never state an investment outcome as guaranteed. You are strictly an educational research assistant.\n"
            "4. NATURAL CLOSING REMINDER: When evaluating a stock, valuation, or investment consideration, conclude naturally with a single brief reminder: 'Consider these factors carefully and do your own research before making an investment decision.' Do NOT repeat this disclaimer multiple times or across every paragraph.\n"
            "5. FINANCIAL ACCURACY & HONESTY: Ground all quantitative answers in the verified exchange data provided below. Use the ₹ symbol for Indian Rupees with standard formatting (e.g., ₹3,850.50, ₹14,200 Cr). If a specific metric or reason is unavailable or unverified, state that clearly rather than inventing figures or external rumors.\n"
            "6. PRICE ACTION & VOLATILITY: When asked why a stock moved or fell today, explain the observable price action, intraday high/low range, trading volume, and broader sector context from the verified data. Never invent unverified rumors, news leaks, or events.\n"
            "7. MULTI-TURN CONVERSATION & COMPARISONS: If the user asks a follow-up question (e.g. 'How does it compare with Infosys?' after asking about TCS), retain the active stock as the primary subject, use the mentioned company as the comparison subject, and compare their verified metrics directly.\n"
            "8. CLEAN FORMATTING: Use clean, natural Markdown. Use bold sparingly for key figures and metrics, clean bullet lists for points, and avoid excessive headings or artificial dividers.\n"
        )

        if stock_context:
            sym = stock_context.get('symbol', 'EQUITY')
            prompt += f"\n--- VERIFIED GROUNDED CONTEXT: {sym} ---\n"
            prompt += f"Company: {stock_context.get('name', sym)} ({sym}) | Exchange: {stock_context.get('exchange', 'NSE')}\n"
            prompt += f"Sector: {stock_context.get('sector_name', 'N/A')} | Subsector/Industry: {stock_context.get('subsector', 'N/A')}\n"
            if stock_context.get('business_summary'):
                prompt += f"Business Overview: {stock_context.get('business_summary')}\n"

            # Price & Trading Action
            prompt += f"Current Price: ₹{stock_context.get('price', 'N/A')} (Change: {stock_context.get('change_pct', 0.0)}%)\n"
            if stock_context.get('previous_close'):
                prompt += f"Previous Close: ₹{stock_context.get('previous_close')} | Day Range: ₹{stock_context.get('day_low', 'N/A')} - ₹{stock_context.get('day_high', 'N/A')}\n"
            if stock_context.get('high_52w') and stock_context.get('low_52w'):
                prompt += f"52-Week Range: ₹{stock_context.get('low_52w')} - ₹{stock_context.get('high_52w')}\n"
            if stock_context.get('volume'):
                prompt += f"Trading Volume: {stock_context.get('volume'):,}\n"
            prompt += f"Data Freshness: {stock_context.get('data_status', 'N/A')} (as of {stock_context.get('fetched_at', 'Latest Session')})\n"

            # Valuation & Fundamentals
            prompt += "Valuation & Fundamentals (Verified Disclosures):\n"
            prompt += f"  - Trailing P/E: {stock_context.get('pe_ratio', 'N/A')}x\n"
            prompt += f"  - Price-to-Book (P/B): {stock_context.get('pb_ratio', 'N/A')}x\n"
            prompt += f"  - Return on Equity (RoE): {stock_context.get('roe_pct', 'N/A')}%\n"
            if stock_context.get('eps'):
                prompt += f"  - EPS: ₹{stock_context.get('eps')}\n"
            prompt += f"  - Debt-to-Equity: {stock_context.get('debt_to_equity_ratio', 'N/A')}x ({stock_context.get('debt_classification', 'Verified Balance Sheet')})\n"
            if stock_context.get('market_cap'):
                prompt += f"  - Market Capitalization: ₹{stock_context.get('market_cap')} Cr\n"
            if stock_context.get('dividend_yield'):
                prompt += f"  - Dividend Yield: {stock_context.get('dividend_yield')}%\n"

            # Technicals
            prompt += "Technical Indicators (Grounded):\n"
            prompt += f"  - RSI (14): {stock_context.get('rsi_14', 'N/A')}\n"
            prompt += f"  - Moving Averages: SMA20=₹{stock_context.get('sma_20', 'N/A')}, SMA50=₹{stock_context.get('sma_50', 'N/A')}, SMA200=₹{stock_context.get('sma_200', 'N/A')}\n"
            if stock_context.get('price') and stock_context.get('sma_50'):
                is_above_50 = stock_context.get('price') > stock_context.get('sma_50')
                prompt += f"  - Position vs 50-Day Moving Average: Trading {'ABOVE' if is_above_50 else 'BELOW'} 50-day SMA\n"
            if stock_context.get('volatility_30d'):
                prompt += f"  - 30-Day Volatility: {stock_context.get('volatility_30d')}%\n"
            if stock_context.get('support_level') or stock_context.get('resistance_level'):
                prompt += f"  - Support: ₹{stock_context.get('support_level', 'N/A')} | Resistance: ₹{stock_context.get('resistance_level', 'N/A')}\n"

            # Comparison Stock Context if available
            comp = stock_context.get('comparison')
            if comp:
                prompt += f"\n--- COMPARISON STOCK CONTEXT: {comp.get('symbol')} ---\n"
                prompt += f"Company: {comp.get('name')} ({comp.get('symbol')}) | Sector: {comp.get('sector_name')}\n"
                prompt += f"Current Price: ₹{comp.get('price', 'N/A')} (Change: {comp.get('change_pct', 0.0)}%)\n"
                prompt += f"Trailing P/E: {comp.get('pe_ratio', 'N/A')}x | P/B: {comp.get('pb_ratio', 'N/A')}x\n"
                prompt += f"RoE: {comp.get('roe_pct', 'N/A')}% | Debt-to-Equity: {comp.get('debt_to_equity_ratio', 'N/A')}x\n"
                prompt += f"RSI(14): {comp.get('rsi_14', 'N/A')} | SMA50: ₹{comp.get('sma_50', 'N/A')}\n"
                if comp.get('market_cap'):
                    prompt += f"Market Cap: ₹{comp.get('market_cap')} Cr\n"
                prompt += "------------------------------------------------\n"

            # User Portfolio Context if applicable
            user_portfolio = stock_context.get('user_portfolio')
            if user_portfolio:
                prompt += "\n--- AUTHENTICATED USER'S PORTFOLIO CONTEXT ---\n"
                prompt += f"Available Cash Balance: ₹{user_portfolio.get('cash_balance', 0.0):,.2f}\n"
                prompt += f"Total Portfolio Value: ₹{user_portfolio.get('total_value', 0.0):,.2f}\n"
                user_pos = stock_context.get('user_stock_position')
                if user_pos:
                    prompt += f"User's Active Position in {sym}: {user_pos.get('quantity')} shares @ Avg Cost ₹{user_pos.get('average_price'):,.2f} (Unrealized P&L: ₹{user_pos.get('unrealized_pnl'):,.2f})\n"
                else:
                    prompt += f"User's Active Position in {sym}: None currently held in portfolio.\n"
                prompt += "----------------------------------------------\n"

            # Scenarios (Reference only)
            scenarios = stock_context.get("scenarios", [])
            if scenarios:
                prompt += "Model Projections (Reference Scenarios):\n"
                for sc in scenarios:
                    prompt += f"  * {sc.get('case')}: Target {sc.get('target_range')} ({sc.get('implied_change_pct', 'N/A')}%) - {sc.get('probability_assessment')}\n"
            prompt += "--------------------------------------------------------\n"

        return prompt

    def chat(
        self,
        messages: List[Dict[str, str]],
        stock_context: Optional[Dict[str, Any]] = None,
        max_tokens: int = 1500,
        temperature: float = 0.3
    ) -> Dict[str, Any]:
        """
        Execute chat completion using Google Gemini SDK with error diagnostics and fallback.
        """
        self.key_manager.refresh_keys()
        pool_status = self.key_manager.get_pool_status()

        if pool_status["total_keys"] == 0:
            return {
                "success": False,
                "error": (
                    "Google Gemini API key is not configured. Please add your official Gemini API key "
                    "(e.g., GEMINI_API_KEY=AIzaSy... from https://aistudio.google.com/) to the backend/.env file "
                    "to activate live AI conversational intelligence."
                ),
                "unconfigured": True,
                "provider": "Google Gemini",
                "pool_status": pool_status
            }

        system_instruction = self.get_system_prompt(stock_context)

        # Assemble conversation history into Gemini types.Content
        contents = []
        for m in messages[-8:]:
            role = m.get("role", "user")
            content_text = m.get("content", "").strip()
            if not content_text:
                continue
            # Map role: user -> user, assistant -> model
            gemini_role = "model" if role == "assistant" else "user"
            contents.append(
                types.Content(
                    role=gemini_role,
                    parts=[types.Part.from_text(text=content_text)]
                )
            )

        if not contents:
            return {
                "success": False,
                "error": "Empty message query provided.",
                "pool_status": pool_status
            }

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature,
            max_output_tokens=max_tokens
        )

        attempts = 0
        max_attempts = min(pool_status["total_keys"] + 1, 5)

        while attempts < max_attempts:
            attempts += 1
            key_state = self.key_manager.acquire_key()
            if not key_state:
                return {
                    "success": False,
                    "error": (
                        "Configured Google Gemini API key is temporarily cooling down due to rate limits (429) "
                        "or quota constraints. Please wait a brief moment and retry."
                    ),
                    "rate_limited": True,
                    "provider": "Google Gemini",
                    "pool_status": self.key_manager.get_pool_status()
                }

            try:
                client = genai.Client(api_key=key_state.key)
                target_model = self.model
                response = None
                try:
                    response = client.models.generate_content(
                        model=target_model,
                        contents=contents,
                        config=config
                    )
                except errors.APIError as me:
                    if (getattr(me, "code", None) in (404, 503) or "no longer available" in str(me).lower()) and target_model != "gemini-flash-lite-latest":
                        logger.info(f"Model {target_model} unavailable ({getattr(me, 'code', None)}). Falling back to gemini-flash-lite-latest...")
                        target_model = "gemini-flash-lite-latest"
                        response = client.models.generate_content(
                            model=target_model,
                            contents=contents,
                            config=config
                        )
                    else:
                        raise me

                if response and response.text:
                    key_state.mark_success()
                    return {
                        "success": True,
                        "reply": response.text,
                        "model": target_model,
                        "provider": "Google Gemini",
                        "key_index": key_state.index,
                        "key_masked": key_state.masked
                    }
                else:
                    return {
                        "success": False,
                        "error": "Google Gemini returned an empty response.",
                        "pool_status": self.key_manager.get_pool_status()
                    }

            except errors.APIError as e:
                code = getattr(e, "code", None)
                status = getattr(e, "status", "")
                err_msg = str(getattr(e, "message", None) or e)
                full_err_str = f"{code} {status} {err_msg}".lower()

                logger.warning(f"Gemini APIError on Key #{key_state.index} (code={code}, status={status}): {err_msg}")

                # Rate limit / Quota exhaustion (429)
                if code == 429 or "resource_exhausted" in full_err_str or "quota" in full_err_str or "rate limit" in full_err_str:
                    key_state.mark_rate_limited()
                    continue

                # Invalid key / Authentication failure (400, 401, 403)
                elif code in (400, 401, 403) or "api key not valid" in full_err_str or "invalid_argument" in full_err_str or "permission_denied" in full_err_str:
                    key_state.mark_invalid(err_msg[:120])
                    return {
                        "success": False,
                        "error": (
                            f"Invalid or unauthorized Gemini API key ({key_state.masked}). "
                            "Please verify your key at https://aistudio.google.com/ and update backend/.env."
                        ),
                        "invalid_key": True,
                        "provider": "Google Gemini",
                        "pool_status": self.key_manager.get_pool_status()
                    }

                # Server error (5xx)
                elif code and code >= 500:
                    key_state.mark_rate_limited(base_cooldown=15.0)
                    continue

                else:
                    return {
                        "success": False,
                        "error": f"Google Gemini API error: {err_msg}",
                        "provider": "Google Gemini",
                        "pool_status": self.key_manager.get_pool_status()
                    }

            except ValueError as ve:
                logger.error(f"Value error initializing Gemini Client: {ve}")
                key_state.mark_invalid("Invalid key format")
                return {
                    "success": False,
                    "error": f"Gemini configuration error: {str(ve)}",
                    "provider": "Google Gemini",
                    "pool_status": self.key_manager.get_pool_status()
                }

            except Exception as ex:
                logger.error(f"Network error communicating with Google Gemini: {ex}")
                return {
                    "success": False,
                    "error": f"Network error contacting Google Gemini: {str(ex)}",
                    "network_error": True,
                    "provider": "Google Gemini",
                    "pool_status": self.key_manager.get_pool_status()
                }

        return {
            "success": False,
            "error": "Unable to obtain a response from Google Gemini. Please check your network connection and API key quota.",
            "provider": "Google Gemini",
            "pool_status": self.key_manager.get_pool_status()
        }

    def synthesize_financial_rag(
        self,
        company_name: str,
        symbol: str,
        query: str,
        deterministic_metrics: Dict[str, Any],
        retrieved_passages: List[Dict[str, Any]],
        max_tokens: int = 1200
    ) -> Dict[str, Any]:
        """
        Synthesize documentary evidence retrieved from corporate filings & transcripts
        with deterministic quantitative fundamentals.
        Instructs the LLM to ground all statements in verified citations.
        """
        self.key_manager.refresh_keys()
        pool_status = self.key_manager.get_pool_status()
        if not pool_status.get("has_usable_key"):
            return {
                "success": False,
                "error": "Google Gemini API key is unconfigured or cooling down.",
                "unconfigured": True
            }

        # Build evidence grounding prompt
        user_content = (
            f"COMPANY: {company_name} ({symbol})\n"
            f"RESEARCH QUERY: {query}\n\n"
            f"QUANTITATIVE FUNDAMENTALS (Deterministic Verified Calculations):\n"
            f"- Price: ₹{deterministic_metrics.get('price', 'N/A')}\n"
            f"- Trailing P/E: {deterministic_metrics.get('pe_ratio', 'N/A')}x\n"
            f"- Price to Book: {deterministic_metrics.get('pb_ratio', 'N/A')}x\n"
            f"- Return on Equity: {deterministic_metrics.get('roe', 'N/A')}%\n"
            f"- Debt-to-Equity: {deterministic_metrics.get('debt_to_equity', 'N/A')}x ({deterministic_metrics.get('debt_classification', 'N/A')})\n"
            f"- Market Cap: ₹{deterministic_metrics.get('market_cap_cr', 'N/A')} Cr\n\n"
            f"RETRIEVED DOCUMENTARY EVIDENCE PASSAGES (Official Filings & Disclosures):\n"
        )

        for p in retrieved_passages:
            c_id = p.get('citation_id', 'CIT')
            doc_title = p.get('document_title', 'Corporate Disclosure')
            doc_type = p.get('doc_type', 'filing')
            publisher = p.get('publisher', 'Official Disclosures')
            pub_date = p.get('publication_date') or 'N/A'
            page_sec = p.get('page_or_section') or 'General'
            passage = p.get('passage') or ''
            user_content += (
                f"\n--- CITATION: [{c_id}] ---\n"
                f"Document: {doc_title}\n"
                f"Type: {doc_type} | Publisher: {publisher} | Date: {pub_date}\n"
                f"Section/Page: {page_sec}\n"
                f"Passage Excerpt: \"{passage}\"\n"
            )

        user_content += (
            "\nTASK:\n"
            "Synthesize these retrieved documentary passages in response to the research query. "
            "Ground every finding in the passages using [CIT-...] citation tags. "
            "Differentiate verified historical filing disclosures from forward-looking management commentary. "
            "If the evidence contains conflicting statements or cautious disclosures, present both. "
            "If certain information is not in the passages, explicitly state that it is unavailable in the document corpus."
        )

        messages = [{"role": "user", "content": user_content}]
        return self.chat(
            messages=messages,
            stock_context={"name": company_name, "symbol": symbol, "pe_ratio": deterministic_metrics.get("pe_ratio")},
            max_tokens=max_tokens,
            temperature=0.2
        )


gemini_service = GeminiService()
