import os
import logging
from typing import List, Dict, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ENV_FILE_PATH = os.path.join(BACKEND_DIR, ".env")
ROOT_ENV_FILE_PATH = os.path.abspath(os.path.join(BACKEND_DIR, "..", ".env"))

def is_placeholder_key(key: Optional[str]) -> bool:
    """Check if an API key string is an unconfigured template or placeholder."""
    if not key:
        return True
    clean = key.strip().strip("'\"[]").strip()
    if not clean:
        return True
    lower = clean.lower()
    if (
        "your_" in lower
        or "your-" in lower
        or lower.startswith("<your")
        or "gemini_api_key_here" in lower
        or "api_key_here" in lower
        or lower in ("placeholder", "none", "null", "undefined", "changeme", "test", "fake", "enter_your_key")
        or lower.startswith("aizasy...")
    ):
        return True
    if len(clean) < 15:
        return True
    return False

def read_env_file_disk() -> Dict[str, str]:
    """
    Directly parse backend/.env and root .env from disk without clobbering os.environ.
    Returns key-value pairs cleaned of quotes and surrounding brackets.
    """
    env_vars: Dict[str, str] = {}
    target_paths = [ENV_FILE_PATH, ROOT_ENV_FILE_PATH]

    for path in target_paths:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k = k.strip()
                            v = v.strip().strip("'\"")
                            # Strip brackets if user formatted as [API_KEY]
                            if v.startswith("[") and v.endswith("]"):
                                v = v[1:-1].strip()
                            # Strip duplicate variable prefix if user pasted KEY=value inside value
                            while "=" in v and any(v.upper().startswith(p) for p in ("GEMINI_API_KEY=", "GEMINIAPIKEY=")):
                                _, v = v.split("=", 1)
                                v = v.strip().strip("'\"")
                            if k:
                                env_vars[k] = v
            except Exception as e:
                logger.warning(f"Could not read env file {path}: {e}")

    return env_vars

def init_os_environ():
    """Seed os.environ from .env on startup if not already defined."""
    file_vars = read_env_file_disk()
    for k, v in file_vars.items():
        if k not in os.environ:
            os.environ[k] = v

init_os_environ()

class Settings(BaseModel):
    PROJECT_NAME: str = "VibeFinance"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", os.path.join(BACKEND_DIR, "vibefinance.db"))
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "vibefinance-super-secret-jwt-key-2026-production-ready")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Paper Trading Defaults
    DEFAULT_STARTING_BALANCE: float = 1_000_000.0  # ₹10,00,000 (10 Lakhs Virtual Funds)
    SIMULATED_COMMISSION_PCT: float = 0.05 / 100    # 0.05% brokerage simulation
    
    # Market Data Caching & Freshness
    REFRESH_INTERVAL_SECONDS: int = 300            # 5-minute background refresh attempt
    STALE_THRESHOLD_SECONDS: int = 900             # 15 minutes before marking quote as stale
    QUOTE_MAX_AGE_FOR_MARKET_ORDER: int = 86400 * 4 # Max permitted age for simulated market order (accounting for weekends/holidays)
    
    # Market Data Provider
    MARKET_DATA_PROVIDER: str = "Yahoo Finance via yfinance"
    ALLOW_MOCK_FALLBACK: bool = False             # Never fabricate live quotes

    # Google Gemini Official API Configuration Defaults
    DEFAULT_GEMINI_MODEL: str = "gemini-flash-lite-latest"
    DEFAULT_GEMINI_TIMEOUT: float = 30.0

    @property
    def GEMINI_MODEL(self) -> str:
        # Dynamic read: check os.environ first, then .env file on disk, then default
        env_dict = read_env_file_disk()
        return os.getenv("GEMINI_MODEL") or env_dict.get("GEMINI_MODEL") or self.DEFAULT_GEMINI_MODEL

    @property
    def GEMINI_REQUEST_TIMEOUT(self) -> float:
        val = os.getenv("GEMINI_REQUEST_TIMEOUT")
        if val:
            try:
                return float(val)
            except ValueError:
                pass
        return self.DEFAULT_GEMINI_TIMEOUT

    def get_gemini_api_keys(self) -> List[str]:
        """
        Collect all configured, usable Gemini API keys across .env and os.environ.
        Checks explicit os.environ first, falls back to disk .env, and strictly filters placeholders.
        """
        file_vars = read_env_file_disk()

        def resolve_val(name: str) -> str:
            # If explicitly set in environment, os.environ is authoritative
            if name in os.environ:
                env_val = os.environ[name].strip().strip("'\"[]")
                if env_val and not is_placeholder_key(env_val):
                    return env_val
                return ""

            # Otherwise fall back to file on disk
            file_val = file_vars.get(name, "").strip().strip("'\"[]")
            if not file_val and "_" in name:
                no_under = name.replace("_", "")
                file_val = file_vars.get(no_under, "").strip().strip("'\"[]")

            if file_val and not is_placeholder_key(file_val):
                return file_val

            return ""

        keys: List[str] = []

        # 1. Multi-key list in GEMINI_API_KEYS
        if "GEMINI_API_KEYS" in os.environ:
            raw_list = os.environ.get("GEMINI_API_KEYS", "")
        else:
            raw_list = file_vars.get("GEMINI_API_KEYS", "")
        if raw_list:
            for item in raw_list.replace(",", " ").replace("[", " ").replace("]", " ").split():
                clean = item.strip().strip("'\"[]")
                if clean and clean not in keys and not is_placeholder_key(clean):
                    keys.append(clean)

        # 2. Single key in GEMINI_API_KEY
        single = resolve_val("GEMINI_API_KEY")
        if single and single not in keys:
            keys.append(single)

        # 3. Indexed keys GEMINI_API_KEY_1 .. 20
        for i in range(1, 21):
            val = resolve_val(f"GEMINI_API_KEY_{i}")
            if val and val not in keys:
                keys.append(val)

        return keys

    def get_gemini_api_key(self) -> str:
        """Return primary active Gemini API key or empty string."""
        keys = self.get_gemini_api_keys()
        return keys[0] if keys else ""

    def has_usable_gemini_key(self) -> bool:
        """Boolean indicator of whether a valid key is present."""
        return len(self.get_gemini_api_keys()) > 0

settings = Settings()
