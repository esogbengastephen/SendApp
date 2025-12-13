-- Migration 021: Add wallet emptying fields to offramp_transactions
-- This migration adds fields to support complete wallet emptying functionality

-- Add all_tokens_detected field to store JSON array of all tokens found
ALTER TABLE offramp_transactions 
ADD COLUMN IF NOT EXISTS all_tokens_detected JSONB;

-- Add wallet_emptied field to track if wallet has been completely emptied
ALTER TABLE offramp_transactions 
ADD COLUMN IF NOT EXISTS wallet_emptied BOOLEAN DEFAULT FALSE;

-- Add index on wallet_emptied for faster queries
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_wallet_emptied 
ON offramp_transactions(wallet_emptied) 
WHERE wallet_emptied = FALSE;

-- Add comment to document the new fields
COMMENT ON COLUMN offramp_transactions.all_tokens_detected IS 'JSON array of all tokens detected in wallet (for complete wallet emptying)';
COMMENT ON COLUMN offramp_transactions.wallet_emptied IS 'Whether the wallet has been completely emptied (all tokens swapped, ETH recovered)';
