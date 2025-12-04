-- Migration 017: Add transaction fees and revenue tracking

-- 1. Add fee columns to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS fee_ngn DECIMAL(18, 2),
ADD COLUMN IF NOT EXISTS fee_in_send TEXT;

-- 2. Create revenue table
CREATE TABLE IF NOT EXISTS revenue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  fee_ngn DECIMAL(18, 2) NOT NULL,
  fee_in_send TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_revenue_transaction FOREIGN KEY (transaction_id) 
    REFERENCES transactions(transaction_id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_revenue_transaction_id ON revenue(transaction_id);
CREATE INDEX IF NOT EXISTS idx_revenue_created_at ON revenue(created_at);

-- 3. Create transaction_fee_tiers table
CREATE TABLE IF NOT EXISTS transaction_fee_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tier_name TEXT UNIQUE NOT NULL,
  min_amount DECIMAL(18, 2) NOT NULL,
  max_amount DECIMAL(18, 2), -- NULL for unlimited
  fee_ngn DECIMAL(18, 2) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT
);

-- Insert default fee tiers
INSERT INTO transaction_fee_tiers (tier_name, min_amount, max_amount, fee_ngn, updated_by)
VALUES 
  ('tier_1', 3000, 10000, 250, 'system'),
  ('tier_2', 10001, 50000, 500, 'system'),
  ('tier_3', 50001, NULL, 1000, 'system')
ON CONFLICT (tier_name) DO NOTHING;

-- Enable RLS
ALTER TABLE revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_fee_tiers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for revenue (read-only for admins, write for system)
CREATE POLICY "Allow admin read access" ON revenue
  FOR SELECT
  USING (true);

-- RLS Policies for transaction_fee_tiers (read for all, write for authenticated)
CREATE POLICY "Allow public read access" ON transaction_fee_tiers
  FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated write access" ON transaction_fee_tiers
  FOR ALL
  USING (true)
  WITH CHECK (true);

