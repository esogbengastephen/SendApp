-- Off-ramp: wallet identifier columns (NOT NULL in live DB; API sends deposit address for Smart Wallet)
ALTER TABLE offramp_transactions
ADD COLUMN IF NOT EXISTS wallet_identifier TEXT,
ADD COLUMN IF NOT EXISTS unique_wallet_address VARCHAR(255);

-- Backfill from deposit_address or wallet_address
UPDATE offramp_transactions
SET wallet_identifier = COALESCE(deposit_address, wallet_address)
WHERE wallet_identifier IS NULL AND (deposit_address IS NOT NULL OR wallet_address IS NOT NULL);

UPDATE offramp_transactions
SET unique_wallet_address = COALESCE(deposit_address, wallet_address)
WHERE unique_wallet_address IS NULL AND (deposit_address IS NOT NULL OR wallet_address IS NOT NULL);
