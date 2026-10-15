# VibeFinance — Indian Stock Market & AI Investment Intelligence Platform

A high-performance Indian stock market browsing, financial charting, paper trading, and AI-driven investment intelligence web platform inspired by Zerodha Kite and INDmoney.

> **Official PS 04 Architecture Specification**: For the complete technical design of the four specialized AI agents, central concurrent orchestrator, RAG document pipeline, verifiable citation models, and session observability matrix, see the comprehensive [Architecture Documentation](ARCHITECTURE.md).

---

## Key Features

### 1. Curated 100-Stock Universe Across 10 Sectors
- **Strict Architecture**: Exactly 100 Indian stocks distributed evenly across 10 core sectors (10 stocks per sector):
  1. **IT & Software**: TCS, INFY, HCLTECH, WIPRO, TECHM, LTIMindtree/MPHASIS, PERSISTENT, COFORGE, OFSS, TATAELXSI
  2. **Banking**: HDFCBANK, ICICIBANK, SBIN, KOTAKBANK, AXISBANK, INDUSINDBK, BANKBARODA, PNB, IDFCFIRSTB, CANBK
  3. **Financial Services**: BAJFINANCE, BAJAJFINSV, CHOLAFIN, SHRIRAMFIN, MUTHOOTFIN, JIOFIN, SBICARD, HDFCLIFE, SBILIFE, ICICIPRULI
  4. **Semiconductors & Electronics**: DIXON, KAYNES, SYRMA, AMBER, AVALON, CYIENTDLM, PGEL, MOSCHIP, SPEL, CENTUM
  5. **Automobile, EV & Mobility**: MOTHERSON, MARUTI, M&M, BAJAJ-AUTO, HEROMOTOCO, TVSMOTOR, EICHERMOT, ASHOKLEY, BHARATFORG, SONACOMS
  6. **Energy, Power & Utilities**: RELIANCE, NTPC, POWERGRID, ONGC, COALINDIA, ADANIGREEN, TATAPOWER, IOC, BPCL, GAIL
  7. **FMCG & Consumer Goods**: ITC, HINDUNILVR, NESTLEIND, BRITANNIA, VBL, GODREJCP, DABUR, MARICO, TATACONSUM, COLPAL
  8. **Healthcare & Pharmaceuticals**: SUNPHARMA, CIPLA, DRREDDY, DIVISLAB, APOLLOHOSP, MANKIND, TORNTPHARM, LUPIN, ZYDUSLIFE, AUROPHARMA
  9. **Infrastructure, Industrials & Realty**: LT, ADANIENT, DLF, BEL, HAL, SIEMENS, ABB, ULTRACEMCO, GRASIM, TITAN
  10. **Steel, Metals & Materials**: TATASTEEL, JSWSTEEL, HINDALCO, VEDL, JINDALSTEL, NMDC, SAIL, NATIONALUM, APLLTD, RATNAMANI

### 2. Market Data Adapter with Honest Freshness Labels
- **Data Provider**: Configurable development adapter via Yahoo Finance (`yfinance`) with a 5-minute background refresh cadence.
- **Honest Status**: Explicit freshness status labels (`fresh`, `stale`, `unavailable`) and last-updated timestamps are displayed prominently on all quotes.
- **Production Disclosure**: Notice acknowledging that Yahoo Finance is a free development provider and not an exchange-authorized live feed; an authorized licensed market data provider is required for live redistribution.

### 3. Interactive Financial Canvas Charts & Technical Indicators
- Custom HTML5 Canvas financial charting engine (ultra-fast, zero bloat).
- **Timeframes**: 1D, 1W, 1M, 1Y, 5Y historical price series.
- **Display Modes**: Candlestick and Line chart toggles with dynamic volume histogram.
- **Technical Indicator Overlays**:
  - Simple Moving Averages: SMA 20, SMA 50
  - Exponential Moving Average: EMA 20
  - Relative Strength Index: RSI 14 with overbought (70) and oversold (30) levels
  - Bollinger Bands: 20-period upper/lower standard deviation bands
  - MACD (12, 26, 9) signal line indicators

### 4. Paper-Trading Simulation Engine
- **Virtual Balance**: ₹10,00,000 starting cash balance per account.
- **Order Types**: Market and Limit orders (Buy & Sell).
- **Double-Entry Cash Ledger**: Atomic debit/credit tracking with running balances for full financial auditability.
- **Real-Time Limit Matching**: Background order matching engine that evaluates pending limit orders against latest market quotes every 5 minutes.
- **Position Tracking**: Average acquisition cost calculation, unrealized P&L, realized P&L, and 1-click account reset.
- *Strictly simulated: Real payments and live broker execution are explicitly excluded.*

### 5. AI Investment Intelligence Suite
- **Macro Market Pulse**: AI commentary on Indian market drivers, NIFTY 50/SENSEX trends, and sector momentum.
- **Company Deep Research**: Automated SWOT analysis (Strengths, Weaknesses, Opportunities, Threats), fundamental valuation assessment (P/E, P/B, RoE), and Fair Value estimations with evidence citations.
- **Portfolio Risk & Diversification Audit**: Concentration metrics, single-stock exposure thresholds, sector skew warnings, and diversification scoring.
- **Trading Psychology Coaching**: Behavioral diagnostics identifying overtrading, revenge trading, and emotional holding patterns.
- **Autonomous Multi-Agent Architecture**: Four specialized parallel agents (Market Analysis, Financial Research, Portfolio Analysis, Trading Behavior) coordinated by a central concurrent orchestrator with BM25 RAG document citations and session observability. Detailed in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Architecture Overview

For an exhaustive, production-grade architectural specification including Mermaid data-flow and sequence diagrams, agent input/output contracts, and evaluation methodologies, refer directly to [ARCHITECTURE.md](ARCHITECTURE.md).

```
fin-alpha/
├── backend/                        # FastAPI Application
│   ├── app/
│   │   ├── ai/                     # AI Market Analysis, SWOT & Risk Audit Engine
│   │   ├── api/v1/                 # REST API (auth, stocks, market, watchlists, trading, ai)
│   │   ├── core/                   # Security, Config, SQLite database with WAL mode
│   │   ├── market_data/            # Universe, Reference Data, yfinance Provider & Scheduler
│   │   └── trading/                # Paper Trading Engine & Double-Entry Cash Ledger
│   ├── tests/                      # Pytest suite (17 comprehensive unit/integration tests)
│   └── vibefinance.db              # SQLite Database
├── frontend/                       # Vite + React Modern Web Application
│   ├── src/
│   │   ├── api/                    # Unified API Client with Auth Interceptors
│   │   ├── components/             # Navbar, StockChart (Canvas), OrderModal, StockDetailModal
│   │   ├── views/                  # MarketOverview, Stocks, Sectors, Watchlists, Portfolio, Orders, AI
│   │   ├── App.jsx                 # App shell with view routing & notifications
│   │   └── index.css               # Premium dark theme design system
│   └── vite.config.js              # Vite configuration with /api reverse proxy
└── venv/                           # Python Virtual Environment
```

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Backend Setup (Windows PowerShell)

Run these commands from the project's root directory.

**Step 1: Create a virtual environment**

If the virtual environment does not already exist, create it:

```powershell
if (!(Test-Path .\venv)) {
    py -m venv venv
}
```

**Step 2: Activate the virtual environment**

```powershell
.\venv\Scripts\Activate.ps1
```

**Step 3: Install backend dependencies**

Install all dependencies listed in the backend requirements file:

```powershell
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
```

**Step 4: Configure environment variables**

Create your local `.env` file from the example file if it does not already exist:

```powershell
if (!(Test-Path .\backend\.env)) {
    Copy-Item .\backend\.env.example .\backend\.env
}
```

Open `backend/.env` and configure the required environment variables, including your Gemini API key and any other required secrets.

> **Important:** Keep your `.env` file private. Never commit API keys, passwords, tokens, or other secrets to GitHub.

**Step 5: Start the backend server**

From the project root, run:

```powershell
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The FastAPI backend will be available at:

- **API Base URL:** http://127.0.0.1:8000
- **Interactive API Documentation:** http://127.0.0.1:8000/docs
- **Alternative API Documentation:** http://127.0.0.1:8000/redoc

Keep the terminal running while using the application.

**Troubleshooting**

- If `py` is not recognized, install Python and ensure it is added to your system PATH.
- If PowerShell blocks virtual environment activation, run the following command in the current PowerShell session and activate the environment again:

  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  ```

- If dependency installation fails, verify that `backend/requirements.txt` exists and lists all required backend dependencies.
- If AI features fail to initialize, check the API key and other configuration values in `backend/.env`.
### 2. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
Open your browser at: `http://localhost:5173/`

### 3. Running Test Suite
```bash
cd backend
pytest -v tests
```
All 17 tests validate:
- 10 sectors with exactly 10 stocks each (100 total universe)
- Accurate technical indicator formulas (SMA, EMA, RSI, Bollinger Bands)
- Normalized quote contracts and freshness status
- Paper trading account lifecycle, double-entry cash ledger, buy/sell executions
- Insufficient fund/holdings guardrails & limit order cancellation
- REST API auth, demo login, stock filters, watchlists, and AI runs

---

## 1-Click Demo Login
The application includes a zero-friction **"Instant Demo Login"** button in the header and landing screen that automatically generates a demonstration session with ₹10,00,000 in virtual funds for immediate paper trading and feature exploration.

---

## Production Deployment
Complete step-by-step guides for cloud deployment are available in [DEPLOYMENT.md](DEPLOYMENT.md):
- **Render (Free Tier)**: 1-click blueprint via `render.yaml` or multi-stage `Dockerfile`.
- **Split Hosting**: Vercel for React Frontend + Render for FastAPI Backend.
- **Unified Single-Port Delivery**: FastAPI serves the built Vite React SPA from `/` while routing all API calls to `/api/v1/`.

---

## Production & Legal Disclaimers
1. **Market Data**: Market quotes, historical bars, and financial metrics are provided via `yfinance` for developmental and educational purposes. Data may be delayed or unavailable depending on upstream provider availability.
2. **Paper Trading Only**: All trading features, orders, cash balances, and P&L statements are entirely simulated. No real money or exchange broker accounts are involved.
3. **Financial Advice**: AI analysis, SWOT audits, and valuation diagnostics are algorithmic educational tools and do not constitute registered SEBI financial or investment advice.
