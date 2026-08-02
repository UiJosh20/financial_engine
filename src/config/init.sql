-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Price Alerts Table
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,              -- e.g., 'BTC-USD', 'ETH-USD'
  target_price NUMERIC(15, 2) NOT NULL,     -- Threshold price to trigger alert
  condition VARCHAR(10) NOT NULL,           -- 'ABOVE' or 'BELOW'
  status VARCHAR(20) DEFAULT 'ACTIVE',      -- 'ACTIVE', 'TRIGGERED', 'CANCELLED'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast user queries & status filtering
CREATE INDEX IF NOT EXISTS idx_alerts_symbol_status 
ON price_alerts (symbol, status);

-- 3. Triggered Alert History Logs
CREATE TABLE IF NOT EXISTS alert_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES price_alerts(id) ON DELETE CASCADE,
  triggered_price NUMERIC(15, 2) NOT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);