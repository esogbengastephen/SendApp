-- Off-ramp: payment_reference (Flutterwave transfer ref), paid_at (set by webhook when transfer.completed)
ALTER TABLE offramp_transactions
ADD COLUMN IF NOT EXISTS payment_reference TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS token_received_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_offramp_payment_reference ON offramp_transactions(payment_reference) WHERE payment_reference IS NOT NULL;
