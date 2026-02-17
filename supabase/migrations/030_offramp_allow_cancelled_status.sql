-- Allow "cancelled" status for offramp_transactions (e.g. when user cancels pending off-ramp).
-- If the table has a check constraint on status, replace it to include 'cancelled'.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'offramp_transactions_status_check'
    AND conrelid = 'offramp_transactions'::regclass
  ) THEN
    ALTER TABLE offramp_transactions DROP CONSTRAINT offramp_transactions_status_check;
  END IF;
END $$;

ALTER TABLE offramp_transactions
  ADD CONSTRAINT offramp_transactions_status_check
  CHECK (status IN (
    'pending',
    'token_received',
    'verified',
    'swapped',
    'payment_sent',
    'completed',
    'failed',
    'cancelled'
  ));
