-- ==========================================
-- MIGRAZIONE CRYPTO DA SQLITE A POSTGRESQL
-- ==========================================
-- Questo script crea le tabelle PostgreSQL per il sistema crypto
-- Esegui questo script PRIMA di eseguire la migrazione dati

-- ✅ ISOLAMENTO COMPLETO: 
-- Per isolare completamente i dati crypto, esegui questo script su un database separato:
--   psql postgresql://user:pass@host:5432/crypto_db -f migrate-crypto-to-postgresql.sql
--
-- Oppure crea il database separato:
--   CREATE DATABASE crypto_db;
--   \c crypto_db
--   \i migrate-crypto-to-postgresql.sql
--
-- Poi configura in .env:
--   DATABASE_URL_CRYPTO=postgresql://user:pass@host:5432/crypto_db

-- Portfolio table: tracks USDT balance and crypto holdings
CREATE TABLE IF NOT EXISTS portfolio (
    id SERIAL PRIMARY KEY,
    balance_usd DOUBLE PRECISION DEFAULT 10000.0,
    holdings TEXT DEFAULT '{}'
);

-- Inserisci record di default se non esiste
INSERT INTO portfolio (id, balance_usd, holdings)
VALUES (1, 10000.0, '{}')
ON CONFLICT (id) DO NOTHING;

-- Trades history
CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    symbol TEXT,
    type TEXT,
    amount DOUBLE PRECISION,
    price DOUBLE PRECISION,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    strategy TEXT,
    profit_loss DOUBLE PRECISION,
    ticket_id TEXT
);

-- Bot settings - Supporta multi-simbolo
CREATE TABLE IF NOT EXISTS bot_settings (
    id SERIAL PRIMARY KEY,
    strategy_name TEXT NOT NULL,
    symbol TEXT NOT NULL DEFAULT 'bitcoin',
    is_active INTEGER DEFAULT 0,
    parameters TEXT,
    UNIQUE(strategy_name, symbol)
);

-- Insert default strategy for bitcoin if not exists
INSERT INTO bot_settings (strategy_name, symbol, is_active, parameters)
VALUES (
    'RSI_Strategy',
    'bitcoin',
    0,
    '{
        "rsi_period": 14,
        "rsi_oversold": 30,
        "rsi_overbought": 70,
        "stop_loss_pct": 2.0,
        "take_profit_pct": 3.0,
        "trade_size_usdt": 50,
        "trailing_stop_enabled": false,
        "trailing_stop_distance_pct": 1.0,
        "partial_close_enabled": false,
        "take_profit_1_pct": 1.5,
        "take_profit_2_pct": 3.0
    }'
)
ON CONFLICT (strategy_name, symbol) DO NOTHING;

-- Price History
CREATE TABLE IF NOT EXISTS price_history (
    id SERIAL PRIMARY KEY,
    symbol TEXT,
    price DOUBLE PRECISION,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Klines OHLC complete per candele stabili (come TradingView)
CREATE TABLE IF NOT EXISTS klines (
    id SERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    interval TEXT NOT NULL DEFAULT '15m',
    open_time BIGINT NOT NULL,
    open_price DOUBLE PRECISION NOT NULL,
    high_price DOUBLE PRECISION NOT NULL,
    low_price DOUBLE PRECISION NOT NULL,
    close_price DOUBLE PRECISION NOT NULL,
    volume DOUBLE PRECISION DEFAULT 0,
    close_time BIGINT NOT NULL,
    UNIQUE(symbol, interval, open_time)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_klines_lookup ON klines(symbol, interval, open_time DESC);
CREATE INDEX IF NOT EXISTS idx_klines_symbol_interval_time ON klines(symbol, interval, open_time);

-- Open Positions (MetaTrader 5 style)
CREATE TABLE IF NOT EXISTS open_positions (
    id SERIAL PRIMARY KEY,
    ticket_id TEXT UNIQUE NOT NULL,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('buy', 'sell')),
    volume DOUBLE PRECISION NOT NULL,
    entry_price DOUBLE PRECISION NOT NULL,
    current_price DOUBLE PRECISION DEFAULT 0,
    stop_loss DOUBLE PRECISION,
    take_profit DOUBLE PRECISION,
    swap DOUBLE PRECISION DEFAULT 0,
    commission DOUBLE PRECISION DEFAULT 0,
    profit_loss DOUBLE PRECISION DEFAULT 0,
    profit_loss_pct DOUBLE PRECISION DEFAULT 0,
    opened_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMPTZ,
    strategy TEXT,
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed', 'stopped', 'taken')),
    -- Trailing Stop Loss fields
    trailing_stop_enabled INTEGER DEFAULT 0,
    trailing_stop_distance_pct DOUBLE PRECISION DEFAULT 0,
    highest_price DOUBLE PRECISION DEFAULT 0,
    -- Partial Close fields
    volume_closed DOUBLE PRECISION DEFAULT 0,
    take_profit_1 DOUBLE PRECISION,
    take_profit_2 DOUBLE PRECISION,
    tp1_hit INTEGER DEFAULT 0,
    -- Signal details
    signal_details TEXT
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_open_positions_status ON open_positions(status);
CREATE INDEX IF NOT EXISTS idx_open_positions_symbol ON open_positions(symbol);

-- Backtesting Results Table
CREATE TABLE IF NOT EXISTS backtest_results (
    id SERIAL PRIMARY KEY,
    test_name TEXT,
    strategy_params TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    initial_balance DOUBLE PRECISION,
    final_balance DOUBLE PRECISION,
    total_trades INTEGER,
    winning_trades INTEGER,
    losing_trades INTEGER,
    total_pnl DOUBLE PRECISION,
    total_pnl_pct DOUBLE PRECISION,
    win_rate DOUBLE PRECISION,
    profit_factor DOUBLE PRECISION,
    max_drawdown DOUBLE PRECISION,
    max_drawdown_pct DOUBLE PRECISION,
    sharpe_ratio DOUBLE PRECISION,
    results_data TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backtest_results_created ON backtest_results(created_at DESC);

-- Performance Statistics Table for Kelly Criterion
CREATE TABLE IF NOT EXISTS performance_stats (
    id INTEGER PRIMARY KEY DEFAULT 1,
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    total_profit DOUBLE PRECISION DEFAULT 0,
    total_loss DOUBLE PRECISION DEFAULT 0,
    avg_win DOUBLE PRECISION DEFAULT 0,
    avg_loss DOUBLE PRECISION DEFAULT 0,
    win_rate DOUBLE PRECISION DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Initialize performance stats if not exists
INSERT INTO performance_stats (id, total_trades, winning_trades, losing_trades, total_profit, total_loss, avg_win, avg_loss, win_rate)
VALUES (1, 0, 0, 0, 0, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

