-- Migration 025: Add metadata column to transactions table
-- This column stores Flutterwave tx_ref and other payment metadata as JSONB
-- Needed for finding transactions by Flutterwave tx_ref before webhook processes them

-- Add metadata column if it doesn't exist
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add GIN index on entire metadata JSONB column for faster JSONB queries
CREATE INDEX IF NOT EXISTS idx_transactions_metadata_gin 
ON transactions USING GIN (metadata);

-- Add btree index on extracted flutterwave_tx_ref for exact lookups
CREATE INDEX IF NOT EXISTS idx_transactions_metadata_flutterwave_tx_ref 
ON transactions ((metadata->>'flutterwave_tx_ref'));

-- Add comment explaining the column
COMMENT ON COLUMN transactions.metadata IS 'JSONB column storing payment metadata like Flutterwave tx_ref, transaction_id, wallet_address, etc. Used for finding transactions before webhook processes them.';
