-- Off-ramp: user bank detail columns (required by API insert; NOT NULL where needed)
ALTER TABLE offramp_transactions
ADD COLUMN IF NOT EXISTS user_account_number TEXT,
ADD COLUMN IF NOT EXISTS user_account_name TEXT,
ADD COLUMN IF NOT EXISTS user_bank_code TEXT;

-- Backfill from existing columns so existing rows are consistent
UPDATE offramp_transactions
SET user_account_number = account_number
WHERE user_account_number IS NULL AND account_number IS NOT NULL;

UPDATE offramp_transactions
SET user_account_name = account_name
WHERE user_account_name IS NULL AND account_name IS NOT NULL;

UPDATE offramp_transactions
SET user_bank_code = bank_code
WHERE user_bank_code IS NULL AND bank_code IS NOT NULL;

-- Enforce NOT NULL for user_account_number on new inserts (optional; uncomment if desired)
-- ALTER TABLE offramp_transactions ALTER COLUMN user_account_number SET NOT NULL;
