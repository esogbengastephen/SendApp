-- Migration 021: Create token buy prices table
-- Description: Allows admins to set and manage buy prices for tokens (SEND, USDC, USDT) in NGN

-- Create token_buy_prices table
CREATE TABLE IF NOT EXISTS token_buy_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_symbol TEXT NOT NULL UNIQUE CHECK (token_symbol IN ('SEND', 'USDC', 'USDT')),
  buy_price_ngn DECIMAL(20, 2) NOT NULL CHECK (buy_price_ngn > 0),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT, -- Wallet address of admin who updated
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_token_buy_prices_symbol ON token_buy_prices(token_symbol);
CREATE INDEX IF NOT EXISTS idx_token_buy_prices_updated_at ON token_buy_prices(updated_at);

-- Add comments for documentation
COMMENT ON TABLE token_buy_prices IS 'Stores buy prices for tokens in Nigerian Naira (NGN)';
COMMENT ON COLUMN token_buy_prices.token_symbol IS 'Token symbol: SEND, USDC, or USDT';
COMMENT ON COLUMN token_buy_prices.buy_price_ngn IS 'Buy price in Nigerian Naira';
COMMENT ON COLUMN token_buy_prices.updated_by IS 'Wallet address of admin who last updated this price';

-- Enable RLS
ALTER TABLE token_buy_prices ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow public read access (for displaying prices)
CREATE POLICY "Allow public read access to token buy prices"
  ON token_buy_prices
  FOR SELECT
  USING (true);

-- RLS Policy: Allow admin write access (insert/update)
-- This will be enforced at the application level using admin_wallets table
-- For now, we'll allow authenticated admins to insert/update
CREATE POLICY "Allow admin write access to token buy prices"
  ON token_buy_prices
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_wallets
      WHERE admin_wallets.wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
      AND admin_wallets.is_active = true
    )
  );

-- Insert default prices (optional - can be set via admin panel)
-- Using reasonable defaults based on current market rates
INSERT INTO token_buy_prices (token_symbol, buy_price_ngn, updated_by)
VALUES 
  ('SEND', 43.24, NULL),
  ('USDC', 1500.00, NULL),
  ('USDT', 1500.00, NULL)
ON CONFLICT (token_symbol) DO NOTHING;
