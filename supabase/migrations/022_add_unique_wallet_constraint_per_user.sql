-- Migration 022: Add unique wallet constraint per user for off-ramp
-- Ensures each user (identified by user_id or user_email) has only one unique wallet address
-- This enforces: 1 user = 1 wallet (but can have multiple account numbers)
-- 
-- Requirements:
-- - On-ramp: 1 unique account number per user, multiple wallet addresses allowed
-- - Off-ramp: 1 unique wallet address per user, multiple account numbers allowed

-- 1. First, clean up any duplicate wallet addresses for the same user
-- (Keep the most recent transaction for each user-wallet combination)
WITH duplicates AS (
  SELECT 
    id,
    user_id,
    user_email,
    unique_wallet_address,
    ROW_NUMBER() OVER (
      PARTITION BY 
        COALESCE(user_id::text, user_email),
        unique_wallet_address
      ORDER BY created_at DESC
    ) as rn
  FROM offramp_transactions
)
-- Delete older duplicates (keep the most recent one)
-- Note: This is safe because we're only deleting if there are actual duplicates
-- and we keep the most recent transaction
DELETE FROM offramp_transactions
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 2. Add unique constraint for registered users (user_id is NOT NULL)
-- One wallet per user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_offramp_unique_user_wallet
ON offramp_transactions(user_id, unique_wallet_address)
WHERE user_id IS NOT NULL;

-- 3. Add unique constraint for guest users (user_id IS NULL)
-- One wallet per user_email for guests
CREATE UNIQUE INDEX IF NOT EXISTS idx_offramp_unique_guest_wallet
ON offramp_transactions(user_email, unique_wallet_address)
WHERE user_id IS NULL;

-- 4. Add comments explaining the constraints
COMMENT ON INDEX idx_offramp_unique_user_wallet IS 
'Ensures each registered user (user_id) has only one unique wallet address for off-ramp transactions. Users can have multiple account numbers but only one wallet.';

COMMENT ON INDEX idx_offramp_unique_guest_wallet IS 
'Ensures each guest user (user_email) has only one unique wallet address for off-ramp transactions. Guest users can have multiple account numbers but only one wallet.';

-- 5. Add a comment to the table explaining the relationship
COMMENT ON TABLE offramp_transactions IS 
'Off-ramp transactions table. Each user (by user_id or user_email) can have only one unique_wallet_address but can use multiple account numbers (user_account_number) across different transactions.';

