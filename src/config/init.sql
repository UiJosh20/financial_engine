-- 1. Users Table (Supports device-generated string IDs)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Price Alerts Table
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,              -- e.g., 'BTCUSDT', 'EURUSD'
  target_price NUMERIC(18, 6) NOT NULL,     -- High precision threshold price
  condition VARCHAR(10) NOT NULL,           -- 'ABOVE' or 'BELOW'
  status VARCHAR(20) DEFAULT 'ACTIVE',      -- 'ACTIVE', 'TRIGGERED', 'CANCELLED'
  is_triggered BOOLEAN DEFAULT FALSE,       -- Tracks trigger state
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast user queries & status filtering
CREATE INDEX IF NOT EXISTS idx_alerts_symbol_status 
ON price_alerts (symbol, status);

-- 3. Triggered Alert History Logs
CREATE TABLE IF NOT EXISTS alert_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES price_alerts(id) ON DELETE CASCADE,
  triggered_price NUMERIC(18, 6) NOT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);