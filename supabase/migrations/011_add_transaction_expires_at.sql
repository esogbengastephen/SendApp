-- Migration 011: Add expires_at column to transactions table
-- Each pending transaction will have its own 1-hour expiration timer

-- Add expires_at column
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Set expires_at for existing pending transactions (created_at + 1 hour)
UPDATE transactions
SET expires_at = created_at + INTERVAL '1 hour'
WHERE status = 'pending' AND expires_at IS NULL;

-- Set expires_at for existing completed/failed transactions (use created_at as fallback)
UPDATE transactions
SET expires_at = created_at + INTERVAL '1 hour'
WHERE expires_at IS NULL;

-- Create index for performance (only on pending transactions)
CREATE INDEX IF NOT EXISTS idx_transactions_expires_at 
ON transactions(expires_at) 
WHERE status = 'pending';

-- Add comment
COMMENT ON COLUMN transactions.expires_at IS 'Timestamp when pending transaction expires (1 hour after creation). Used for automatic cleanup.';


