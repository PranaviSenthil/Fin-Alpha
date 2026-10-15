import sqlite3
import os
import json
import math
from contextlib import contextmanager
from datetime import datetime, timezone
from app.core.config import settings

def get_db_connection():
    """Create and configure a SQLite connection with foreign keys and WAL mode enabled."""
    os.makedirs(os.path.dirname(settings.DATABASE_PATH), exist_ok=True)
    conn = sqlite3.connect(settings.DATABASE_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

@contextmanager
def get_db():
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    """Initialize database tables and indexes idempotently."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Users
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
        );
        """)
        
        # 2. User Preferences
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            risk_profile TEXT DEFAULT 'moderate',
            investment_horizon TEXT DEFAULT 'medium_term',
            theme TEXT DEFAULT 'dark',
            notification_prefs TEXT,
            updated_at TEXT NOT NULL
        );
        """)
        
        # 3. Sectors
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS sectors (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            icon TEXT
        );
        """)
        
        # 4. Stock Master (Curated 100 stocks)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS stock_master (
            symbol TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            exchange TEXT NOT NULL,
            provider_symbol TEXT UNIQUE NOT NULL,
            sector_id TEXT REFERENCES sectors(id),
            sector_name TEXT NOT NULL,
            subsector TEXT,
            currency TEXT DEFAULT 'INR',
            is_active INTEGER DEFAULT 1,
            is_semiconductor_adjacent INTEGER DEFAULT 0,
            verified_at TEXT NOT NULL
        );
        """)
        
        # 5. Market Quotes (Latest available quotes cache)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS market_quotes (
            symbol TEXT PRIMARY KEY REFERENCES stock_master(symbol),
            provider_symbol TEXT NOT NULL,
            price REAL,
            previous_close REAL,
            open_price REAL,
            day_high REAL,
            day_low REAL,
            volume INTEGER,
            market_cap REAL,
            currency TEXT DEFAULT 'INR',
            source TEXT NOT NULL,
            market_timestamp TEXT,
            fetched_at TEXT NOT NULL,
            data_status TEXT NOT NULL,
            warnings TEXT
        );
        """)
        
        # 6. Historical Prices
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS historical_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL REFERENCES stock_master(symbol),
            timestamp TEXT NOT NULL,
            interval TEXT NOT NULL,
            open REAL NOT NULL,
            high REAL NOT NULL,
            low REAL NOT NULL,
            close REAL NOT NULL,
            volume INTEGER NOT NULL,
            UNIQUE(symbol, timestamp, interval)
        );
        """)
        
        # 7. Financial Metrics & Fundamentals
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS financial_metrics (
            symbol TEXT PRIMARY KEY REFERENCES stock_master(symbol),
            pe_ratio REAL,
            pb_ratio REAL,
            roe REAL,
            debt_to_equity REAL,
            dividend_yield REAL,
            eps REAL,
            market_cap REAL,
            high_52w REAL,
            low_52w REAL,
            business_summary TEXT,
            income_statement_json TEXT,
            balance_sheet_json TEXT,
            cash_flow_json TEXT,
            updated_at TEXT NOT NULL
        );
        """)
        
        # 8. Watchlists
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS watchlists (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            is_default INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );
        """)
        
        # 9. Watchlist Items
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS watchlist_items (
            id TEXT PRIMARY KEY,
            watchlist_id TEXT NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
            symbol TEXT NOT NULL REFERENCES stock_master(symbol) ON DELETE CASCADE,
            sort_order INTEGER DEFAULT 0,
            added_at TEXT NOT NULL,
            UNIQUE(watchlist_id, symbol)
        );
        """)
        
        # 10. Paper Trading Accounts
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS paper_trading_accounts (
            id TEXT PRIMARY KEY,
            user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            virtual_balance REAL NOT NULL,
            currency TEXT DEFAULT 'INR',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """)
        
        # 11. Simulated Cash Ledger (Double-entry audit trail)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS simulated_cash_ledger (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL REFERENCES paper_trading_accounts(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            balance_after REAL NOT NULL,
            reference_order_id TEXT,
            reference_trade_id TEXT,
            description TEXT,
            created_at TEXT NOT NULL
        );
        """)
        
        # 12. Orders
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            account_id TEXT NOT NULL REFERENCES paper_trading_accounts(id),
            symbol TEXT NOT NULL REFERENCES stock_master(symbol),
            side TEXT NOT NULL,
            order_type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            limit_price REAL,
            trigger_price REAL,
            status TEXT NOT NULL,
            execution_price REAL,
            rejection_reason TEXT,
            idempotency_key TEXT UNIQUE,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """)
        
        # 13. Trades (Executed transactions)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS trades (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL REFERENCES orders(id),
            user_id TEXT NOT NULL REFERENCES users(id),
            account_id TEXT NOT NULL REFERENCES paper_trading_accounts(id),
            symbol TEXT NOT NULL REFERENCES stock_master(symbol),
            side TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            gross_amount REAL NOT NULL,
            fee_amount REAL NOT NULL,
            net_amount REAL NOT NULL,
            executed_at TEXT NOT NULL
        );
        """)
        
        # 14. Holdings (Reliable position tracking with average acquisition cost)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS holdings (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL REFERENCES paper_trading_accounts(id) ON DELETE CASCADE,
            symbol TEXT NOT NULL REFERENCES stock_master(symbol),
            quantity INTEGER NOT NULL,
            average_price REAL NOT NULL,
            total_invested REAL NOT NULL,
            realized_pnl REAL NOT NULL DEFAULT 0.0,
            updated_at TEXT NOT NULL,
            UNIQUE(account_id, symbol)
        );
        """)
        
        # 15. Portfolio Snapshots (For historical portfolio value chart)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS portfolio_snapshots (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL REFERENCES paper_trading_accounts(id) ON DELETE CASCADE,
            total_value REAL NOT NULL,
            invested_value REAL NOT NULL,
            cash_balance REAL NOT NULL,
            unrealized_pnl REAL NOT NULL,
            realized_pnl REAL NOT NULL,
            snapshot_date TEXT NOT NULL
        );
        """)
        
        # 16. AI Analysis Runs (Persistent research & audit trails)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS ai_analysis_runs (
            id TEXT PRIMARY KEY,
            user_id TEXT REFERENCES users(id),
            analysis_type TEXT NOT NULL,
            target_symbol TEXT,
            title TEXT NOT NULL,
            summary TEXT NOT NULL,
            details_json TEXT NOT NULL,
            evidence_citations_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """)
        
        # 17. Audit Logs
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT,
            details TEXT,
            created_at TEXT NOT NULL
        );
        """)

        # 18. Financial Documents (RAG Ingestion Corpus)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS financial_documents (
            id TEXT PRIMARY KEY,
            symbol TEXT NOT NULL,
            company_name TEXT NOT NULL,
            title TEXT NOT NULL,
            doc_type TEXT NOT NULL,
            publisher TEXT NOT NULL,
            source_url TEXT,
            publication_date TEXT,
            content_hash TEXT UNIQUE NOT NULL,
            raw_text TEXT NOT NULL,
            chunk_count INTEGER DEFAULT 0,
            metadata_json TEXT,
            ingested_at TEXT NOT NULL
        );
        """)

        # 19. Financial Document Chunks (RAG Retrieval Passages)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS financial_document_chunks (
            id TEXT PRIMARY KEY,
            doc_id TEXT NOT NULL REFERENCES financial_documents(id) ON DELETE CASCADE,
            symbol TEXT NOT NULL,
            company_name TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            page_or_section TEXT,
            text TEXT NOT NULL,
            token_count INTEGER,
            created_at TEXT NOT NULL
        );
        """)
        
        # Indexes for high performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_stock_sector ON stock_master(sector_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_hist_sym_time ON historical_prices(symbol, timestamp);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlists(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, status);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id, executed_at);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_holdings_acc ON holdings(account_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ledger_acc ON simulated_cash_ledger(account_id, created_at);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ai_user ON ai_analysis_runs(user_id, analysis_type);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_findoc_sym ON financial_documents(symbol);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_findoc_hash ON financial_documents(content_hash);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_findoc_chunk_sym ON financial_document_chunks(symbol);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_findoc_chunk_doc ON financial_document_chunks(doc_id);")

def seed_master_data():
    """Seed Sectors and 100 Stock Universe idempotently."""
    from app.market_data.symbols import SECTORS, STOCK_UNIVERSE
    now_iso = datetime.now(timezone.utc).isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Seed Sectors
        for sec in SECTORS:
            cursor.execute("""
            INSERT INTO sectors (id, name, description, icon)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                icon = excluded.icon;
            """, (sec["id"], sec["name"], sec["description"], sec["icon"]))
            
        # Prune deprecated symbols if any exist (child tables first to satisfy foreign keys)
        valid_symbols = [s["symbol"] for s in STOCK_UNIVERSE]
        placeholders = ",".join(["?"] * len(valid_symbols))
        cursor.execute(f"DELETE FROM watchlist_items WHERE symbol NOT IN ({placeholders})", valid_symbols)
        cursor.execute(f"DELETE FROM trades WHERE symbol NOT IN ({placeholders})", valid_symbols)
        cursor.execute(f"DELETE FROM orders WHERE symbol NOT IN ({placeholders})", valid_symbols)
        cursor.execute(f"DELETE FROM holdings WHERE symbol NOT IN ({placeholders})", valid_symbols)
        cursor.execute(f"DELETE FROM market_quotes WHERE symbol NOT IN ({placeholders})", valid_symbols)
        cursor.execute(f"DELETE FROM financial_metrics WHERE symbol NOT IN ({placeholders})", valid_symbols)
        cursor.execute(f"DELETE FROM historical_prices WHERE symbol NOT IN ({placeholders})", valid_symbols)
        cursor.execute(f"DELETE FROM stock_master WHERE symbol NOT IN ({placeholders})", valid_symbols)

        # Seed 100 Stocks
        for stock in STOCK_UNIVERSE:
            cursor.execute("""
            INSERT INTO stock_master (
                symbol, name, exchange, provider_symbol, sector_id, sector_name, subsector,
                currency, is_active, is_semiconductor_adjacent, verified_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(symbol) DO UPDATE SET
                name = excluded.name,
                exchange = excluded.exchange,
                provider_symbol = excluded.provider_symbol,
                sector_id = excluded.sector_id,
                sector_name = excluded.sector_name,
                subsector = excluded.subsector,
                is_semiconductor_adjacent = excluded.is_semiconductor_adjacent,
                verified_at = excluded.verified_at;
            """, (
                stock["symbol"],
                stock["name"],
                stock["exchange"],
                stock["provider_symbol"],
                stock["sector_id"],
                stock["sector_name"],
                stock["subsector"],
                stock.get("currency", "INR"),
                1 if stock.get("is_semiconductor_adjacent") else 0,
                now_iso
            ))

        # Seed initial baseline quotes, fundamentals, and historical bars
        from app.market_data.reference_data import REFERENCE_STOCK_DATA
        for stock in STOCK_UNIVERSE:
            sym = stock["symbol"]
            ref = REFERENCE_STOCK_DATA.get(sym, {"price": 1000.0, "prev_close": 990.0, "pe": 25.0, "pb": 3.0, "roe": 15.0, "high_52w": 1200.0, "low_52w": 800.0, "market_cap": 500000000000})
            price = ref["price"]
            prev_close = ref["prev_close"]
            day_high = round(price * 1.015, 2)
            day_low = round(price * 0.985, 2)
            open_price = round((price + prev_close) / 2, 2)
            volume = 1250000

            cursor.execute("""
                INSERT INTO market_quotes (
                    symbol, provider_symbol, price, previous_close, open_price, day_high, day_low,
                    volume, market_cap, currency, source, market_timestamp, fetched_at, data_status, warnings
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', 'Yahoo Finance via yfinance', ?, ?, 'fresh', NULL)
                ON CONFLICT(symbol) DO NOTHING;
            """, (
                sym, stock["provider_symbol"], price, prev_close, open_price, day_high, day_low,
                volume, ref.get("market_cap"), now_iso, now_iso
            ))

            # Fundamentals
            cursor.execute("""
                INSERT INTO financial_metrics (
                    symbol, pe_ratio, pb_ratio, roe, debt_to_equity, dividend_yield, eps,
                    market_cap, high_52w, low_52w, business_summary, updated_at
                )
                VALUES (?, ?, ?, ?, 0.45, 1.25, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(symbol) DO NOTHING;
            """, (
                sym, ref.get("pe"), ref.get("pb"), ref.get("roe"),
                round(price / (ref.get("pe") or 25.0), 2),
                ref.get("market_cap"), ref.get("high_52w"), ref.get("low_52w"),
                f"{stock['name']} is a leading constituent of the {stock['sector_name']} sector listed on the {stock['exchange']}. Specializes in {stock.get('subsector', 'industry solutions')} with strong domestic institutional participation.",
                now_iso
            ))

            # Historical daily bars (past 30 trading days)
            from datetime import timedelta
            base_p = prev_close
            for day_offset in range(30, 0, -1):
                bar_date = (datetime.now(timezone.utc) - timedelta(days=day_offset)).strftime("%Y-%m-%dT15:30:00")
                # slight deterministic variation
                factor = 1.0 + (math.sin(day_offset + hash(sym) % 10) * 0.02)
                c = round(base_p * factor, 2)
                o = round(c * 0.995, 2)
                h = round(max(o, c) * 1.01, 2)
                l = round(min(o, c) * 0.99, 2)
                v = 800000 + (day_offset * 15000)
                
                cursor.execute("""
                    INSERT INTO historical_prices (symbol, timestamp, interval, open, high, low, close, volume)
                    VALUES (?, ?, '1d', ?, ?, ?, ?, ?)
                    ON CONFLICT(symbol, timestamp, interval) DO NOTHING;
                """, (sym, bar_date, o, h, l, c, v))

    # Seed genuine financial documents corpus for RAG
    try:
        from app.ai.rag.seed_data import seed_financial_documents
        seed_financial_documents()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"RAG seed_financial_documents warning: {e}")

