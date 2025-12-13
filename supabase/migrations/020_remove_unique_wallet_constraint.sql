-- Migration 020: Remove unique constraint on unique_wallet_address
-- This allows multiple transactions to share the same wallet address
-- (users now have persistent wallets that are reused across transactions)

-- Drop the unique constraint
ALTER TABLE offramp_transactions 
DROP CONSTRAINT IF EXISTS offramp_transactions_unique_wallet_address_key;

-- The index is still useful for lookups, so we keep it
-- (indexes don't enforce uniqueness unless explicitly created as UNIQUE)

-- Add a comment explaining the change
COMMENT ON COLUMN offramp_transactions.unique_wallet_address IS 
'User wallet address (persistent per user, can be reused across multiple transactions)';

