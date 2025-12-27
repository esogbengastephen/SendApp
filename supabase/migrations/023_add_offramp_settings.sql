-- Migration 023: Add off-ramp specific settings and fee tiers
-- This migration creates settings for off-ramp (USDC → NGN) separate from on-ramp (NGN → SEND)

-- 1. Insert default off-ramp exchange rate setting (USDC → NGN)
INSERT INTO platform_settings (setting_key, setting_value, updated_by)
VALUES (
  'offramp_exchange_rate',
  jsonb_build_object(
    'exchangeRate', 1650.0,
    'transactionsEnabled', true,
    'minimumAmount', 500,
    'maximumAmount', 5000000,
    'updatedAt', NOW(),
    'updatedBy', 'system'
  ),
  'system'
)
ON CONFLICT (setting_key) DO NOTHING;

-- 2. Create off-ramp fee tiers table (separate from on-ramp)
CREATE TABLE IF NOT EXISTS offramp_fee_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tier_name TEXT UNIQUE NOT NULL,
  min_amount DECIMAL(18, 2) NOT NULL, -- Minimum NGN amount
  max_amount DECIMAL(18, 2), -- NULL for unlimited
  fee_percentage DECIMAL(5, 2) NOT NULL, -- Fee as percentage (e.g., 2.0 for 2%)
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT
);

-- Insert default off-ramp fee tiers (percentage-based like on-ramp)
INSERT INTO offramp_fee_tiers (tier_name, min_amount, max_amount, fee_percentage, updated_by)
VALUES 
  ('tier_1', 0, 1000, 2.0, 'system'),
  ('tier_2', 1000, 5000, 1.5, 'system'),
  ('tier_3', 5000, 20000, 1.0, 'system'),
  ('tier_4', 20000, NULL, 0.5, 'system')
ON CONFLICT (tier_name) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_offramp_fee_tiers_min_amount ON offramp_fee_tiers(min_amount);

-- Enable RLS
ALTER TABLE offramp_fee_tiers ENABLE ROW LEVEL SECURITY;

-- RLS Policies (read for all, write for authenticated)
CREATE POLICY "Allow public read access" ON offramp_fee_tiers
  FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated write access" ON offramp_fee_tiers
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Add comment for clarity
COMMENT ON TABLE offramp_fee_tiers IS 'Fee tiers for off-ramp transactions (USDC → NGN). Uses percentage-based fees.';
COMMENT ON COLUMN offramp_fee_tiers.fee_percentage IS 'Fee as percentage (e.g., 2.0 = 2%, 1.5 = 1.5%)';
