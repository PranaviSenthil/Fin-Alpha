import pytest
import os
import time
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from google.genai import types, errors

from app.main import app
from app.core.config import settings
from app.ai.gemini_service import GeminiKeyManager, GeminiKeyState, GeminiService, mask_key, gemini_service

client = TestClient(app)

# -------------------------------------------------------------
# 1. Key Masking & Security Tests
# -------------------------------------------------------------

def test_mask_key_security():
    """Verify that API keys are never exposed in plaintext."""
    assert mask_key("") == "NONE"
    assert mask_key("short") == "AIza***"
    masked = mask_key("AIzaSyB1234567890abcdefXYZ")
    assert masked == "AIza...fXYZ"
    assert "1234567890abcde" not in masked

# -------------------------------------------------------------
# 2. Key Manager & Rotation Tests
# -------------------------------------------------------------

def test_key_manager_filters_placeholder_and_strips_brackets():
    """Verify that placeholder keys and bracket/quote wrappers are handled safely."""
    with patch.dict(os.environ, {
        "GEMINI_API_KEY": "[TEST_MOCK_GEMINI_KEY_VAL_12345]",
        "GEMINI_API_KEYS": ""
    }):
        km = GeminiKeyManager()
        km.refresh_keys()
        status = km.get_pool_status()
        assert status["provider"] == "Google Gemini"
        assert status["total_keys"] == 1
        assert km._keys[0].key == "TEST_MOCK_GEMINI_KEY_VAL_12345"

def test_key_manager_ignores_dummy_placeholder():
    """Verify placeholder string 'YOUR_GEMINI_API_KEY_HERE' is filtered out."""
    with patch.dict(os.environ, {
        "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY_HERE",
        "GEMINI_API_KEYS": ""
    }):
        km = GeminiKeyManager()
        km.refresh_keys()
        status = km.get_pool_status()
        assert status["total_keys"] == 0
        assert status["active_available"] == 0
        assert status["has_usable_key"] is False
        assert status["is_configured"] is False
        assert settings.has_usable_gemini_key() is False

def test_key_manager_rate_limit_and_cooldown():
    """Verify rate-limited keys are placed on cooldown and reactivate after time."""
    ks = GeminiKeyState("test-key-123", 1)
    assert ks.is_available() is True
    
    ks.mark_rate_limited(base_cooldown=1.0)
    assert ks.is_available() is False
    assert ks.cooldown_until > time.time()

    # Fast forward time
    ks.cooldown_until = time.time() - 1.0
    assert ks.is_available() is True

def test_key_manager_mark_invalid():
    """Verify invalid keys are disabled from future acquisition."""
    ks = GeminiKeyState("invalid-key", 1)
    ks.mark_invalid("HTTP 401 Unauthorized")
    assert ks.is_valid is False
    assert ks.is_available() is False

# -------------------------------------------------------------
# 3. System Prompt & Stock Grounding Tests
# -------------------------------------------------------------

def test_gemini_service_system_prompt_safety_and_rules():
    """Verify safety rules and educational directives are present in system prompt."""
    service = GeminiService()
    prompt = service.get_system_prompt()
    # Identity: the assistant identifies as the VibeFinance AI Research Assistant
    assert "VibeFinance AI Research Assistant" in prompt
    # Provider attribution must be present
    assert "Google Gemini" in prompt
    # The prompt must contain response guidelines section
    assert "CRITICAL RESPONSE GUIDELINES" in prompt
    # No-trading-directive safety rule must be present (exact current phrasing)
    assert "NO DIRECT TRADING DIRECTIVES" in prompt
    assert "Never issue direct buy, sell, or hold commands" in prompt
    # Grounding / honesty rule must be present
    assert "FINANCIAL ACCURACY" in prompt

def test_gemini_service_stock_context_injection():
    """Verify stock context (fundamentals, indicators, scenarios) is injected properly."""
    service = GeminiService()
    stock_context = {
        "symbol": "TCS.NS",
        "name": "Tata Consultancy Services Ltd",
        "exchange": "NSE",
        "sector_name": "Information Technology",
        "subsector": "Software Services",
        "price": 3850.50,
        "change_pct": 1.25,
        "data_status": "live",
        "fetched_at": "2026-10-14 15:30:00",
        "rsi_14": 58.4,
        "sma_20": 3810.0,
        "sma_50": 3750.0,
        "volatility_30d": 14.2,
        "pe_ratio": 28.5,
        "scenarios": [
            {
                "case": "Bullish",
                "target_range": "₹4,100 - ₹4,250",
                "implied_change_pct": "+7.8%",
                "probability_assessment": "Moderate",
                "catalysts": ["Cloud deal pipeline expansion"]
            }
        ]
    }
    prompt = service.get_system_prompt(stock_context)
    assert "TCS.NS" in prompt
    assert "Tata Consultancy Services Ltd" in prompt
    assert "₹3850.5" in prompt
    # RSI label in prompt is "RSI (14):" (space before parenthesis) — matches gemini_service.py line 181
    assert "RSI (14): 58.4" in prompt
    assert "Bullish" in prompt
    assert "₹4,100 - ₹4,250" in prompt

# -------------------------------------------------------------
# 4. Chat Execution & Fallback Behavior Tests
# -------------------------------------------------------------

def test_chat_unconfigured_key_returns_setup_message():
    """When no valid key is configured, a clear setup message must be returned without fake responses."""
    service = GeminiService()
    service.key_manager._keys = []
    
    with patch.object(service.key_manager, "refresh_keys", return_value=None):
        result = service.chat(
            messages=[{"role": "user", "content": "Analyze TCS"}]
        )
        assert result["success"] is False
        assert result["unconfigured"] is True
        assert "Google Gemini API key is not configured" in result["error"]
        assert "https://aistudio.google.com/" in result["error"]
        assert "reply" not in result or result.get("reply") == ""

@patch("google.genai.Client")
def test_chat_successful_mock_response(mock_client_class):
    """Verify role mapping and correct parsing of Gemini model response."""
    mock_instance = MagicMock()
    mock_client_class.return_value = mock_instance
    
    # Mock generate_content response
    mock_response = MagicMock()
    mock_response.text = "TCS fundamentals demonstrate stable operating margins and robust free cash flow."
    mock_instance.models.generate_content.return_value = mock_response

    service = GeminiService()

    with patch.dict(os.environ, {"GEMINI_API_KEY": "AIzaFakeValidKey1234"}):
        result = service.chat(
            messages=[
                {"role": "user", "content": "What is the valuation of TCS?"},
                {"role": "assistant", "content": "TCS trades at a P/E of 28.5x."},
                {"role": "user", "content": "Is the balance sheet healthy?"}
            ]
        )

        assert result["success"] is True
        assert "TCS fundamentals demonstrate stable" in result["reply"]
        assert result["provider"] == "Google Gemini"
        assert result["key_index"] == 1
        assert result["key_masked"] == "AIza...1234"

        # Verify calls to client
        mock_instance.models.generate_content.assert_called_once()
        call_kwargs = mock_instance.models.generate_content.call_args[1]
        contents = call_kwargs["contents"]
        assert len(contents) == 3
        assert contents[0].role == "user"
        assert contents[1].role == "model"  # Assistant correctly converted to Gemini "model"
        assert contents[2].role == "user"

@patch("google.genai.Client")
def test_chat_rate_limit_error_handling(mock_client_class):
    """Verify 429 / RESOURCE_EXHAUSTED errors trigger cooldown and return educational message."""
    mock_instance = MagicMock()
    mock_client_class.return_value = mock_instance
    
    api_error = errors.APIError(code=429, response_json={"error": {"message": "Resource exhausted", "status": "RESOURCE_EXHAUSTED"}})
    mock_instance.models.generate_content.side_effect = api_error

    service = GeminiService()

    with patch.dict(os.environ, {"GEMINI_API_KEY": "AIzaRateLimitedKey1234"}):
        result = service.chat(
            messages=[{"role": "user", "content": "Market outlook"}]
        )

        assert result["success"] is False
        assert result.get("rate_limited") is True
        assert "rate limits (429) or quota constraints" in result["error"]

@patch("google.genai.Client")
def test_chat_invalid_key_error_handling(mock_client_class):
    """Verify 401 / 400 invalid key errors mark key invalid and inform user."""
    mock_instance = MagicMock()
    mock_client_class.return_value = mock_instance
    
    api_error = errors.APIError(code=400, response_json={"error": {"message": "API key not valid", "status": "INVALID_ARGUMENT"}})
    mock_instance.models.generate_content.side_effect = api_error

    service = GeminiService()

    with patch.dict(os.environ, {"GEMINI_API_KEY": "AIzaInvalidKey1234"}):
        result = service.chat(
            messages=[{"role": "user", "content": "Analyze Reliance"}]
        )

        assert result["success"] is False
        assert result.get("invalid_key") is True
        assert "Invalid or unauthorized Gemini API key" in result["error"]
        assert "https://aistudio.google.com/" in result["error"]

# -------------------------------------------------------------
# 5. FastAPI Endpoints Integration Tests
# -------------------------------------------------------------

def test_api_chat_status_endpoint():
    """Verify GET /api/v1/ai/chat/status returns Google Gemini provider info."""
    res = client.get("/api/v1/ai/chat/status")
    assert res.status_code == 200
    data = res.json()
    assert data["provider"] == "Google Gemini"
    assert "gemini" in data["model"].lower()
    assert "pool" in data
    assert "total_keys" in data["pool"]
    assert "has_usable_key" in data
    assert "is_configured" in data

def test_api_chat_post_with_unconfigured_key():
    """Verify POST /api/v1/ai/chat returns informative setup banner when key is placeholder."""
    res = client.post("/api/v1/ai/chat", json={
        "query": "What are the key technical levels for TCS?",
        "symbol": "TCS"
    })
    assert res.status_code == 200
    data = res.json()
    assert "stock_context" in data
    assert data["stock_context"]["symbol"] == "TCS"
    assert "disclaimer" in data
    assert data["provider"] == "Google Gemini"
    if data.get("unconfigured"):
        assert "Google Gemini API key is not configured" in data["error"]

# -------------------------------------------------------------
# 6. Live API Key Test Marker
# -------------------------------------------------------------

@pytest.mark.skipif(
    not settings.get_gemini_api_key(),
    reason="Requires active GEMINI_API_KEY environment variable. Will run when real key is provided."
)
def test_live_gemini_api_generation():
    """
    Live test against upstream Google Gemini API.
    Only executes when a valid real GEMINI_API_KEY is configured in backend/.env.
    """
    real_key = settings.get_gemini_api_key()
    service = GeminiService()
    service.key_manager._keys = [GeminiKeyState(real_key, 1)]
    result = service.chat(
        messages=[{"role": "user", "content": "Briefly describe the Indian stock market in one sentence."}]
    )
    assert result["success"] is True
    assert len(result["reply"]) > 10
    assert result["provider"] == "Google Gemini"
