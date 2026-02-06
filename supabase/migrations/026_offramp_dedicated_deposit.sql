-- Dedicated deposit address per off-ramp (SEND); encrypted key for sweep to pool
ALTER TABLE offramp_transactions
ADD COLUMN IF NOT EXISTS deposit_address TEXT,
ADD COLUMN IF NOT EXISTS deposit_private_key_encrypted TEXT;

-- Backfill: existing rows keep wallet_address as deposit_address
UPDATE offramp_transactions
SET deposit_address = wallet_address
WHERE deposit_address IS NULL AND wallet_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offramp_deposit_address ON offramp_transactions(deposit_address);
