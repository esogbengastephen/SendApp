-- Migration 020: Add Flutterwave KYC tier to users table
-- This enables 3-tier KYC system: Tier 1 (no BVN), Tier 2 (BVN verified), Tier 3 (enhanced KYC)

-- Add flutterwave_kyc_tier column to users table
-- Values: 1 = Tier 1 (no BVN, temporary account), 2 = Tier 2 (BVN verified, permanent account), 3 = Tier 3 (enhanced KYC)
ALTER TABLE users ADD COLUMN IF NOT EXISTS 
  flutterwave_kyc_tier INTEGER DEFAULT 1 CHECK (flutterwave_kyc_tier IN (1, 2, 3));

-- Set existing users with permanent accounts to tier 2
UPDATE users 
SET flutterwave_kyc_tier = 2 
WHERE flutterwave_account_is_permanent = true 
  AND flutterwave_kyc_tier IS NULL;

-- Set existing users with temporary accounts to tier 1
UPDATE users 
SET flutterwave_kyc_tier = 1 
WHERE flutterwave_account_is_permanent = false 
  AND flutterwave_kyc_tier IS NULL;

-- Create index for faster lookups by KYC tier
CREATE INDEX IF NOT EXISTS idx_users_flutterwave_kyc_tier 
  ON users(flutterwave_kyc_tier);

-- Verification query (commented out)
-- SELECT id, email, flutterwave_kyc_tier, flutterwave_account_is_permanent, flutterwave_virtual_account_number
-- FROM users 
-- WHERE flutterwave_virtual_account_number IS NOT NULL;
