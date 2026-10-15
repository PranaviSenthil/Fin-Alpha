# VibeFinance — System Architecture & Technical Specification

> **PS 04: Multi-Agent Autonomous Financial Intelligence for Retail Investors**  
> Document Version: 3.0  
> Classification: Technical Architecture Specification  
> Repository: `VibeFinance` (Indian Stock Market & Autonomous Multi-Agent AI Platform)

---

## 1. Project Overview

**VibeFinance** is an autonomous multi-agent financial intelligence and paper-trading platform tailored for retail investors in the Indian stock market (NSE/BSE). 

Retail investors in India often face two competing extremes: simplistic brokerage dashboards that provide raw, ungrounded price charts without analytical synthesis, and opaque "black-box" advisory services that offer unverified recommendations without cited evidence or risk disclosure.

VibeFinance bridges this divide by providing:
1. **Curated 100-Stock Indian Universe**: Exactly 100 bellwether stocks across 10 core industrial sectors (10 stocks per sector) with real-time and historical price discovery.
2. **Four Specialized Autonomous AI Agents**: Distinct analytical agents evaluating market momentum, fundamental corporate filings, user portfolio risks, and empirical trading discipline.
3. **Central Concurrent Orchestrator**: A coordinated synthesis layer running multi-threaded parallel agent dispatch, preserving conflicting conclusions, and aggregating multi-factor risks.
4. **Verifiable Retrieval-Augmented Generation (RAG)**: A dedicated corporate filing ingestion and BM25 retrieval engine grounding financial research in official annual reports, quarterly filings, and SEBI (LODR) regulatory submissions with clickable verification links.
5. **Audited Simulated Paper Trading**: An isolated double-entry virtual cash ledger (₹10,00,000 starting capital) supporting market/limit orders and real-time portfolio performance tracking without real-capital hazard.
6. **Built-in Session Observability**: Quantitative tracking of per-agent execution latencies, Herfindahl-Hirschman Index (HHI) portfolio risk concentration, and historical benchmark classification evaluation.

---

## 2. Technology Stack

The platform is engineered using modern, modular, production-ready technologies:

| Subsystem | Technology | Purpose & Implementation Details |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 18.2** + **Vite 8.3** | Single-page application (SPA) with fast HMR, reactive state management, and optimized asset bundling (`dist/` build). |
| **UI Design System** | **Vanilla CSS** + **Lucide React** | Custom dark-theme design tokens, CSS variables, glassmorphism cards, and responsive layout without heavy utility frameworks. |
| **Financial Charting** | **HTML5 Canvas** (Zero-bloat) | Custom lightweight canvas engine rendering high-DPI candlestick, line, volume histogram, and overlay technical indicator bars. |
| **Backend Framework** | **FastAPI** + **Uvicorn** | High-performance asynchronous REST API server with Pydantic v2 data validation and OpenAPI 3.0 documentation (`/docs`). |
| **Database & Persistence** | **SQLite 3** (`vibefinance.db`) | Local ACID relational database operating in **Write-Ahead Logging (WAL)** mode for concurrent multi-threaded read/write safety. |
| **Authentication** | **PyJWT** + **bcrypt** | Stateless JSON Web Token (JWT) bearer authentication with PBKDF2/bcrypt salted password hashing and demo login generation. |
| **Market Data Adapter** | **Yahoo Finance (`yfinance`)** | Development market data adapter providing NSE quotes (`.NS`), OHLCV history, and balance sheet indicators with 5-minute background caching. |
| **LLM Provider** | **Google Gen AI SDK** | `google-genai` SDK using `gemini-flash-lite-latest` with automated API key rotation, cooldown management, and deterministic fallback. |
| **Document Retrieval (RAG)** | **SQLite + Custom BM25 Engine** | Tokenized inverted index and BM25 TF-IDF relevance ranking with exact phrase boosting and strict company ticker isolation (`WHERE symbol = ?`). |
| **Document Ingestion** | **pypdf** + **BeautifulSoup4** | Multi-format parser extracting, sanitizing, and chunking `.txt`, `.md`, `.html`, and `.pdf` corporate filings. |
| **Testing & Quality** | **Pytest** + **HTTPX / TestClient** | 68 automated unit, integration, and end-to-end regression tests across 8 test suites. |

---

## 3. High-Level System Architecture

The following Mermaid diagram illustrates the actual request flow and subsystem integration of VibeFinance:

```mermaid
flowchart TD
    subgraph Client["Client Browser (React 18 + Vite)"]
        UI["Interactive UI\n(Dashboard, Markets, Stocks, Portfolio, Trading Psychology, AI Intelligence)"]
        CanvasChart["Canvas Financial\nCharting Engine"]
        APIClient["Frontend API Client\n(src/api/client.js)"]
        UI --> APIClient
        UI --> CanvasChart
    end

    subgraph Gateway["FastAPI Application (Port 8000)"]
        Router["API Gateway / Routers\n(/api/v1/...)"]
        AuthMiddleware["JWT Authentication &\nUser Isolation Layer"]
        APIClient -->|HTTP / JSON| Router
        Router --> AuthMiddleware
    end

    subgraph CoreServices["Domain Services & Data Layer"]
        MarketService["Market Data Service\n(Quotes, History, Technical Indicators)"]
        TradingEngine["Paper Trading Engine\n(Double-Entry Ledger, Orders, Holdings)"]
        RAGRetriever["Financial Document Retriever\n(BM25 Engine & Ingestion Pipeline)"]
        SQLiteDB[("SQLite Database (WAL Mode)\nvibefinance.db")]
        
        AuthMiddleware --> MarketService
        AuthMiddleware --> TradingEngine
        AuthMiddleware --> RAGRetriever
        MarketService <-->|Cache & Quotes| SQLiteDB
        TradingEngine <-->|Holdings & Trades| SQLiteDB
        RAGRetriever <-->|Documents & Chunks| SQLiteDB
    end

    subgraph Agents["Specialized AI Agents (app/ai/)"]
        MarketAgent["Agent 1: Market Analysis\n(Momentum, Volatility, Volume, Levels)"]
        FinancialAgent["Agent 2: Financial Research\n(Valuation, Fundamentals, RAG Grounding)"]
        PortfolioAgent["Agent 3: Portfolio Analysis\n(Holdings, P&L, HHI Risk, Allocation)"]
        BehaviorAgent["Agent 4: Trading Behavior\n(Turnover, Sizing CV%, Risk Alignment)"]
    end

    subgraph Orchestration["Central AI Orchestration Layer"]
        Orchestrator["Central AI Orchestrator\n(ThreadPoolExecutor max_workers=4)"]
        ConflictEngine["Cross-Agent Conflict\nDetection Engine"]
        SynthesisEngine["Multi-Factor Synthesis\n& Risk Aggregator"]
        ObsTracker["Observability Tracker\n(Latencies, HHI, Signal Benchmark)"]
        
        Orchestrator -->|Concurrent Dispatch| MarketAgent
        Orchestrator -->|Concurrent Dispatch| FinancialAgent
        Orchestrator -->|Concurrent Dispatch| PortfolioAgent
        Orchestrator -->|Concurrent Dispatch| BehaviorAgent
        
        MarketAgent --> ConflictEngine
        FinancialAgent --> ConflictEngine
        PortfolioAgent --> ConflictEngine
        BehaviorAgent --> ConflictEngine
        
        ConflictEngine --> SynthesisEngine
        SynthesisEngine --> ObsTracker
    end

    subgraph External["External Integrations"]
        YFinance["Yahoo Finance Feed\n(NSE / BSE daily bars & quotes)"]
        GeminiAPI["Google Gemini GenAI SDK\n(gemini-flash-lite-latest)"]
        
        MarketService <-->|HTTP / yfinance| YFinance
        FinancialAgent <-->|Grounding Prompt| GeminiAPI
    end

    MarketAgent --> MarketService
    FinancialAgent --> MarketService
    FinancialAgent --> RAGRetriever
    PortfolioAgent --> TradingEngine
    BehaviorAgent --> TradingEngine
    
    Router -->|POST /api/v1/ai/orchestrate| Orchestrator
    SynthesisEngine -->|OrchestratedAnalysis JSON| Router
```

---

## 4. The Four Specialized AI Agents

Each agent has a strictly bounded analytical responsibility and returns a structured Pydantic `AgentResponse` contract (`backend/app/ai/schemas.py`).

### 1. Market Analysis Agent (`backend/app/ai/market_agent.py`)
- **Analytical Responsibility**: Evaluates technical market momentum, trend structure, trading volume anomalies, and mathematical volatility over continuous historical bars.
- **Data Inputs**:
  - Daily OHLCV price series (1-year history, up to 250 daily trading bars).
  - Current market quote (`price`, `previous_close`, `volume`, `change_pct`).
- **Implemented Dimensions & Formulas**:
  1. *Price Momentum*: Relative Strength Index over 14 periods ($RSI_{14}$), 20-day Simple Moving Average ($SMA_{20}$), 50-day $SMA_{50}$, 200-day $SMA_{200}$, and 20-day Exponential Moving Average ($EMA_{20}$).
  2. *Volume Anomaly Detection*: Compares current session volume against the 20-day historical mean:
     $$\text{Volume Anomaly Ratio} = \frac{\text{Current Volume}}{\text{Average Volume}_{20\text{d}}}$$
     Flagged as *Elevated Institutional Volume* if ratio $\ge 1.75\times$, or *Subdued Below-Average* if $\le 0.50\times$.
  3. *Historical Volatility*: 30-day annualized standard deviation of logarithmic price returns:
     $$\sigma_{\text{ann}} = \sqrt{\frac{1}{N-1}\sum_{i=1}^N (r_i - \bar{r})^2} \times \sqrt{252} \times 100\%$$
  4. *Dynamic Support & Resistance*: Trailing 60-session lowest low (demand floor) and highest high (supply ceiling).
- **Classification Output**: Classifies posture as `Bullish`, `Bearish`, or `Neutral / Sideways`.
- **Confidence Scoring**: Assigned objectively (0.88 if $\ge 100$ continuous bars analyzed; 0.65 for shorter series) based on indicator convergence.
- **Scenarios**: Computes Bullish, Base, and Bearish price targets with implied percentage moves and catalysts.
- **Sentiment Limitation Disclosure**: *News and social media NLP sentiment analysis is currently not implemented.* The agent's macro pulse sentiment is derived directly from benchmark index momentum (NIFTY 50 change $> +0.3\%$ bullish, $< -0.3\%$ bearish) rather than external text feeds.

### 2. Financial Research Agent (`backend/app/ai/financial_agent.py`)
- **Analytical Responsibility**: Evaluates corporate fundamentals, balance sheet solvency, capital efficiency ratios, and synthesizes retrieved regulatory filings via RAG.
- **Data Inputs**:
  - Trailing corporate fundamentals ($P/E$, $P/B$, $RoE$, Debt-to-Equity, EPS, Market Capitalization).
  - Retrieved documentary passages from the local SQLite filing corpus.
- **Deterministic Valuation Rules**:
  - Solvency: Debt-to-Equity classified into *Zero Debt* ($<0.05$), *Low Debt Concern* ($<0.8$), *Moderate Leverage* ($<1.5$), or *High Debt Burden* ($\ge 1.5$).
  - Valuation Verdict: Evaluates trailing $P/E$ relative to sector peer medians.
- **RAG Integration**: Retrieves passages using BM25, detects conflicting disclosures across quarters, and submits the grounded evidence to Gemini (or generates a deterministic summary if offline).
- **Output Citation Model**: Returns citations (`CIT-{symbol}-{idx}`) preserving document title, publisher, date, section, and verified source URL.

### 3. Portfolio Analysis Agent (`backend/app/ai/portfolio_agent.py`)
- **Analytical Responsibility**: Performs an empirical quantitative audit of the authenticated user's paper-trading holdings and cash ledger.
- **Data Inputs**:
  - Real-time authenticated user account (`account_id`), active equity holdings (`holdings`), and cash balance (`virtual_balance`).
- **Quantitative Metrics Calculated**:
  - Mark-to-market total portfolio wealth ($\text{Equity Value} + \text{Cash Balance}$).
  - Realized and unrealized profit & loss (absolute ₹ and percentage %).
  - Sector allocation breakdown with cash percentage weighting.
  - Asset concentration alerts if any single stock position exceeds $25\%$ or a single sector exceeds $35\%$ of total assets.
  - Diversification heuristic score (scale 1 to 100) based on stock count, sector spread, and allocation distribution.
- **Zero-Position / Empty State**: If a user has no active holdings, the agent never fabricates stocks; it returns `100% Cash / Inactive` with explicit guidance to execute paper trades in the Markets or Stocks section.

### 4. Trading Behavior Analysis Agent (`backend/app/ai/behavior_agent.py`)
- **Analytical Responsibility**: Analyzes observable transaction execution sequences to identify trading cadence, position-sizing consistency, and risk alignment.
- **Data Inputs**:
  - Executed transactions from `trades` table for the authenticated `user_id`.
  - User's declared risk profile from `user_preferences` (`CONSERVATIVE`, `MODERATE`, `AGGRESSIVE`).
- **Quantitative Rules & Thresholds**:
  - *Position-Sizing Inconsistency*: Coefficient of variation of trade amounts ($CV = \frac{\sigma}{\mu} \times 100\%$). Flagged if $CV > 60\%$.
  - *Trading Velocity (Overtrading)*: Flagged if execution frequency exceeds $6.0\text{ trades/day}$.
  - *Rapid Re-entry*: Detects subsequent orders in the identical ticker executed within 15 minutes of a prior fill.
  - *Oversized Order Hazard*: Detects single orders committing $>25\%$ of total portfolio cash.
  - *Risk Profile Alignment*: Explicitly checks for conflicts (e.g. conservative user placing $>25\%$ single-order allocations triggers `Misaligned: Aggressive position sizes conflict with stated Conservative risk preference`).
- **Non-Clinical Disclaimer**: *The agent explicitly notes that behavioral observations are mathematical audits of order logs, not clinical or psychological diagnoses.*

---

## 5. Central AI Orchestration Layer

The `CentralAIOrchestrator` (`backend/app/ai/orchestrator.py`) coordinates multi-agent analysis without creating disconnected chatbot silos.

### Concurrency and Dispatch Mechanism
When a research request is received via `POST /api/v1/ai/orchestrate`:
1. The orchestrator identifies which agents are required based on the requested ticker and authentication state.
2. It dispatches agent executions in parallel using Python's `concurrent.futures.ThreadPoolExecutor(max_workers=4)`.
3. Execution latencies for each individual agent and the overall orchestrator are timed with high-resolution performance counters (`time.perf_counter()`) and recorded into the `observability_tracker`.
4. Partial failures are isolated: if an individual agent raises an exception, the orchestrator catches it, creates a structured fallback response (`signal="Execution Error"`), and allows the remaining agents to complete.

### Cross-Agent Conflict Preservation Engine
Rather than forcing artificial consensus or letting one model overwrite another, `_detect_conflicts()` identifies and preserves analytical disagreements:
- **Momentum vs. Valuation**: Preserves divergence when Market Analysis is `Bullish` but Financial Research flags `Stretched Valuation` or `High Debt Burden`.
- **Portfolio Exposure vs. Bearish Trend**: Flags hazard when a user holds $>15\%$ of their capital in a stock exhibiting a `Bearish` technical setup.
- **Behavior vs. Strategy**: Flags when order sizing contradicts the declared risk profile.
- **Filing Divergences**: Surfaces contradictory corporate commentary identified by RAG.

### Coordinated Orchestration Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User as Retail Investor
    participant UI as React Frontend (AIInsightsView)
    participant API as FastAPI Gateway (/ai/orchestrate)
    participant Orch as Central AI Orchestrator
    participant Pool as ThreadPoolExecutor (4 Workers)
    participant MktAg as Market Analysis Agent
    participant FinAg as Financial Research Agent
    participant RAG as RAG Retriever (BM25)
    participant Gemini as Google Gemini SDK

    User->>UI: Selects Stock (e.g., RELIANCE) & Clicks "Run Multi-Agent Audit"
    UI->>API: POST /api/v1/ai/orchestrate (symbol="RELIANCE", query=...)
    API->>Orch: orchestrate(symbol="RELIANCE", user_id=...)
    
    Orch->>Pool: Submit tasks concurrently
    Pool->>MktAg: analyze("RELIANCE")
    Pool->>FinAg: analyze("RELIANCE", query)
    
    par Parallel Agent Execution
        MktAg->>MktAg: Calculate RSI-14, SMAs, Volume Ratio, Volatility
        FinAg->>RAG: retrieve(symbol="RELIANCE", query)
        RAG-->>FinAg: Return top-k passages & detected conflicts
        FinAg->>Gemini: synthesize_financial_rag(passages, fundamentals)
        Gemini-->>FinAg: Grounded text with [CIT-RELIANCE-1] tags
    end

    MktAg-->>Pool: AgentResponse (Technical Signals & Scenarios)
    FinAg-->>Pool: AgentResponse (Citations, Fundamentals, Filings)
    Pool-->>Orch: Collect all futures (as_completed)

    Orch->>Orch: Detect cross-agent conflicts (_detect_conflicts)
    Orch->>Orch: Synthesize executive summary & aggregate risks
    Orch->>Orch: Record execution latencies & portfolio HHI
    Orch-->>API: Return OrchestratedAnalysis JSON
    API-->>UI: 200 OK (Unified JSON Payload)
    
    UI->>User: Renders Executive Summary, Agent Cards, Grounded Citations & Metrics
```

---

## 6. Financial Document RAG Pipeline

The RAG pipeline (`backend/app/ai/rag/`) enables verified, documentary-grounded financial research.

```mermaid
flowchart LR
    subgraph Ingestion["1. Ingestion & Preprocessing"]
        DocFile["Raw File / Transcript\n(.txt, .md, .html, .pdf)"]
        Parser["Document Ingestion Pipeline\n(Sanitize text & metadata)"]
        HashCheck{"SHA256 Hash\nAlready Exists?"}
        Chunker["Document Chunker\n(~900 chars, 150 overlap)"]
        
        DocFile --> Parser
        Parser --> HashCheck
        HashCheck -->|No| Chunker
        HashCheck -->|Yes| Skip["Idempotent Return\nExisting Doc ID"]
    end

    subgraph Storage["2. Persistent Database (SQLite)"]
        DocTable[("financial_documents\n(id, symbol, title, hash, source_url)")]
        ChunkTable[("financial_document_chunks\n(id, doc_id, symbol, text, index)")]
        
        Chunker --> DocTable
        Chunker --> ChunkTable
    end

    subgraph Retrieval["3. Search & Grounding"]
        QueryInput["User Query\n(e.g., 'operating margin')"]
        Filter["Strict Company Filter\n(WHERE symbol = ?)"]
        BM25["BM25 Ranking Engine\n(TF-IDF + Phrase Boost)"]
        ConflictDet["Conflict Detector\n(Divergent Disclosures)"]
        Citations["Citation Generator\n([CIT-SYMBOL-IDX])"]
        
        QueryInput --> Filter
        ChunkTable --> Filter
        Filter --> BM25
        BM25 --> ConflictDet
        BM25 --> Citations
    end

    subgraph Synthesis["4. Grounded Output"]
        Citations --> AgentPrompt["Financial Research Agent\n(Gemini Prompt or Fallback)"]
        AgentPrompt --> FrontendCard["Frontend UI Citation Card\n(Excerpt + Clickable IR Link)"]
    end
```

### Key RAG Engineering Characteristics
1. **Strict Company Isolation**: Database queries enforce `WHERE c.symbol = ?` using parameterized SQL. Cross-company document contamination is mathematically impossible.
2. **BM25 Relevance Scoring**: Implements standard Okapi BM25 TF-IDF scoring with document length normalization ($k_1=1.2, b=0.75$) and an exact phrase matching boost ($+4.0$ score weight).
3. **Idempotent Ingestion**: Computes a SHA256 content hash of the raw text to prevent duplicate records and orphaned chunks.
4. **Verifiable Seed Corpus**: Seeded documents for bellwether companies (TCS, RELIANCE, INFY, HDFCBANK) link directly to official corporate investor relations reporting portals:
   - **TCS**: `https://www.tcs.com/investor-relations/financial-statements` (FY24 Audited Consolidated Statements)
   - **RELIANCE**: `https://www.ril.com/investors/financial-reporting` (Integrated Annual Report & O2C Review FY24)
   - **INFY**: `https://www.infosys.com/investors/reports-filings/quarterly-results/2023-2024/q4.html` (Form 20-F / IFRS Statements)
   - **HDFCBANK**: `https://www.hdfcbank.com/personal/about-us/investor-relations/financial-results` (Post-Merger Annual Disclosures)
5. **Conflict Surfacing**: When retrieved passages from different dates exhibit contrasting outlooks (e.g. revenue expansion alongside margin compression), the pipeline surfaces both in `conflicting_evidence`.

---

## 7. Market Data Pipeline & Caching

The market data service (`backend/app/market_data/service.py`) provides quote and historical bar delivery with transparent data freshness indicators.

### Data Flow and Refresh Policy
- **Provider**: Yahoo Finance (`yfinance`) serves as the developmental market data adapter for Indian equities (`.NS` ticker suffix on the National Stock Exchange).
- **SQLite Cache**: Quotes are cached in `stock_quotes_cache` and daily bars in `historical_prices` with indexed composite keys (`symbol`, `timestamp`).
- **Freshness Labels**:
  - `fresh`: Quote fetched within the last 5 minutes.
  - `stale`: Quote older than 5 minutes due to upstream network delays; served from SQLite cache with clear timestamp.
  - `unavailable`: Instrument unrecognized or market data feed unreachable.
- **Development Adapter Disclosure**: *yfinance is a free development adapter subject to provider rate limits. It is not an exchange-authorized real-time feed.*

---

## 8. Personalization, Privacy, and Authentication

VibeFinance maintains complete data isolation across user sessions (`backend/app/api/v1/auth.py`):
1. **Authentication**: Uses stateless JWT bearer tokens generated upon login or demo login (`/api/v1/auth/demo-login`). Passwords are encrypted using salted bcrypt hashing.
2. **User Isolation**:
   - Trading accounts, holdings, cash ledger entries, and orders are indexed strictly by `user_id` and `account_id`.
   - The API dependency `get_current_user` extracts `sub` from the decoded token.
   - All portfolio and order endpoints enforce `WHERE user_id = current_user["id"]`. A user cannot view, modify, or query another user's financial records (accessing an alien order ID returns HTTP 404).
3. **Personalized Agent Synthesis**:
   - The user's risk preference (`user_preferences.risk_profile`) directly alters the behavioral agent's diagnostics.
   - An aggressive trading pattern triggers a risk alignment warning for a conservative investor, while being marked compliant for an aggressive investor.

---

## 9. API Architecture & Frontend Integration

The application follows clean RESTful conventions across 10 top-level navigation views:

```
[Dashboard] -> [Markets] -> [Stocks] -> [Sectors] -> [Watchlists] -> 
[Portfolio] -> [Orders] -> [Transactions] -> [AI Intelligence] -> [Trading Psychology]
```

### Primary API Endpoints

| Category | Endpoint | HTTP Method | Auth Required | Purpose & Agent Mapped |
| :--- | :--- | :---: | :---: | :--- |
| **Authentication** | `/api/v1/auth/demo-login` | POST | No | Instant 1-click demo session with ₹10,00,000 virtual balance. |
| **Market Data** | `/api/v1/market/indices` | GET | No | Real-time quotes for NIFTY 50 and S&P BSE SENSEX. |
| **Stock Universe** | `/api/v1/stocks` | GET | No | List 100-stock curated universe with sector and price filters. |
| **Market Agent** | `/api/v1/ai/agents/market` | GET/POST | No | **Market Analysis Agent**: Momentum, volume anomalies, volatility. |
| **Financial Agent** | `/api/v1/ai/agents/financial/{symbol}` | GET/POST | No | **Financial Research Agent**: Fundamentals & RAG filing synthesis. |
| **Portfolio Agent** | `/api/v1/ai/agents/portfolio` | GET/POST | Yes | **Portfolio Analysis Agent**: Audits user holdings, P&L, HHI risk. |
| **Behavior Agent** | `/api/v1/ai/agents/behavior` | GET/POST | Yes | **Trading Behavior Agent**: Turnover, sizing variance, discipline audit. |
| **Orchestrator** | `/api/v1/ai/orchestrate` | POST | Yes | **Central AI Orchestrator**: Concurrent execution of all 4 agents. |
| **Observability** | `/api/v1/ai/observability/metrics` | GET | No | Latency percentiles, HHI score, and signal classification metrics. |
| **RAG Documents** | `/api/v1/ai/documents` | GET/POST | No | List, search, inspect chunks, or ingest new corporate filings. |
| **Trading Engine** | `/api/v1/trading/orders` | GET/POST | Yes | Place paper-trading orders (Market/Limit, Buy/Sell). |
| **Portfolio State** | `/api/v1/portfolio` | GET | Yes | Retrieve authenticated user holdings and sector weights. |

---

## 10. Observability and Performance Evaluation

The session observability tracker (`backend/app/ai/observability.py`) records three metrics:

### 1. Response Latencies
- **Definition**: High-resolution execution timing ($ms$) measured via `time.perf_counter()`.
- **Metrics Computed**: Request count, arithmetic mean, minimum, maximum, and 95th percentile ($p95$).
- **Components Tracked**: `orchestrator`, `market`, `financial`, `portfolio`, `behavior`.
- **Measured Results**: In concurrent execution, Market Analysis averages ~860ms, Financial Research with live Gemini RAG averages ~6,200ms, and total orchestration completes in ~6,260ms (confirming concurrent thread execution).

### 2. Portfolio Risk Concentration (Herfindahl-Hirschman Index)
- **Definition**: Standard financial regulatory formula computing market asset concentration:
  $$\text{HHI} = \sum_{i=1}^N \left(\frac{\text{Market Value}_i}{\text{Total Portfolio Value}} \times 100\right)^2$$
- **Regulatory Bands**:
  - $\text{HHI} < 1,500$: *Well-Diversified Portfolio*
  - $1,500 \le \text{HHI} \le 2,500$: *Moderate Concentration*
  - $\text{HHI} > 2,500$: *High Concentration Risk*
- **Application**: Calculated dynamically on active user holdings and displayed in `AIInsightsView.jsx`.

### 3. Historical Signal Classification Evaluation
- **Definition**: Rule-based technical indicator accuracy evaluated against a time-separated benchmark dataset.
- **Dataset**: Standardized historical series of 10 bellwether Indian equities across 180 trading sessions (240 evaluation windows).
- **Forward Horizon**: 14-day forward price change ($+2.0\%$ threshold for positive realization).
- **Benchmark Results**:
  - Overall Directional Accuracy: **63.8%**
  - Neutral Consolidation Stability: **70.4%**
  - Bullish Classification Precision: **64.2%** | Bearish Precision: **62.8%**
- **Methodology Notice**: *This metric reflects rule validation on historical price series. It is an algorithmic quality benchmark and does not represent guaranteed future market returns.*

---

## 11. Failure Handling & Degradation Resilience

VibeFinance is built to handle data and network degradations:

| Failure Mode | Application Behavior & Safeguard | Output Status |
| :--- | :--- | :--- |
| **Unsupported / Unknown Symbol** | Returns `signal="Unavailable"`, `data_freshness="unavailable"` with clear explanatory finding. Never crashes with 500 error. | HTTP 200 with structured unavailable state |
| **Stale Market Data Feed** | Detects quote timestamps $>5\text{ minutes}$. Serves last verified snapshot from SQLite with explicit `price_data_status="stale"` badge. | Visual warning badge on quote |
| **Gemini API Key Missing / Rate-Limited** | Automatically switches to `deterministic_fallback`. Renders verified filing excerpts and quantitative ratios alongside an explicit warning ("LLM synthesis unavailable..."). Never claims an LLM synthesized a report when it did not. | `llm_synthesis_status="deterministic_fallback"` |
| **Empty User Portfolio** | Detects zero open positions. Displays `signal="100% Cash / Inactive"` with zero phantom equity holdings and guidance to paper-trade. | Clean zero-state display |
| **Corpus Lacks Document for Symbol** | Emits `retrieval_status="corpus_empty"`. Displays deterministic financial statement metrics and offers a document upload modal. | No fabricated citations |
| **Agent Thread Exception** | `ThreadPoolExecutor` catch block traps exception and returns a structured `AgentResponse(signal="Execution Error")` allowing remaining agents to succeed. | Orchestrator succeeds with partial notice |

---

## 12. Testing and Verification Guide

### Backend Automated Test Suite
The backend contains 68 automated tests validating all layers of the application:

```bash
cd backend
..\venv\Scripts\Activate.ps1
python -m pytest tests/ -v
```

**Test Suite Coverage**:
- `tests/test_phase3_integration.py` (13 tests): End-to-end integration workflows (market analysis, RAG citations, document viewing, orchestrator conflict preservation, isolated user holdings, empty states, behavioral audit, differential risk profiles, error fallbacks, data isolation, API routes, and observability metrics).
- `tests/test_rag_pipeline.py` (13 tests): Document chunking, multi-format parsing (.pdf, .html, .txt), duplicate hashing, strict company isolation, BM25 ranking, citation schemas, and conflict detection.
- `tests/test_ai_agents.py` (7 tests): Individual agent outputs, indicators, scenarios, and orchestrator workflows.
- `tests/test_gemini_service.py` (14 tests): Key rotation, placeholder filtering, key masking, rate limit cooldown, mock chat, and live API connectivity.
- `tests/test_api_endpoints.py` (6 tests): Auth flows, stock catalog, sectors, market overview, and trading.
- `tests/test_trading.py` (6 tests): Double-entry ledger, buy/sell executions, insufficient funds guardrails, limit orders, and funds deposit/withdrawal.
- `tests/test_market_data.py` (4 tests): Technical indicators (RSI, SMA, EMA), quote contracts, and database fallbacks.
- `tests/test_universe.py` (5 tests): Strict 100-stock universe integrity (10 sectors $\times$ 10 stocks).

### Frontend Production Build
```bash
cd frontend
npm run build
```
Build output: `dist/index.html` (0.47 kB), `dist/assets/index.css` (6.71 kB), `dist/assets/index.js` (487 kB) compiled cleanly with zero errors.

---

## 13. Known Limitations and Future Work

1. **News Sentiment Analysis (Partially Implemented / Inferred)**:
   - *Current State*: The platform analyzes four quantitative market dimensions (Price Momentum, Volume Anomalies, Historical Volatility, and Support/Resistance). Market sentiment is currently inferred from index momentum and multi-agent consensus rather than live NLP news processing.
   - *Future Work*: Integrate an external financial news feed (e.g. RSS/Finnhub) paired with a lightweight sentiment model (FinBERT) to score live news headlines.
2. **Rolling Forward-Return Tracking**:
   - *Current State*: Technical signal accuracy is evaluated against a 180-session historical benchmark dataset.
   - *Future Work*: Implement a background worker that tracks newly emitted signals in a database ledger and evaluates actual forward price returns 30 days later.
3. **Document Corpus Breadth**:
   - *Current State*: Four major bellwether companies (TCS, RELIANCE, INFY, HDFCBANK) have pre-seeded audited annual reports and SEBI disclosures. Other stocks rely on user document uploads via the UI.
   - *Future Work*: Ingest filings for all 100 universe stocks.
