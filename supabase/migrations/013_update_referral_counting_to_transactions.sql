-- Migration 013: Update referral counting to only count when referred users complete transactions
-- Instead of counting on signup, referrals now only count when the referred user completes their first transaction

-- Step 1: Drop the old trigger that increments on user signup
DROP TRIGGER IF EXISTS trigger_update_referral_count ON users;

-- Step 2: Create a new function to update referral count when a transaction is completed
-- This function checks if this is the user's first completed transaction
CREATE OR REPLACE FUNCTION update_referral_count_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
  referred_user_id UUID;
  referrer_code TEXT;
  is_first_transaction BOOLEAN;
BEGIN
  -- Only process if transaction status changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Check if this transaction has a user_id
    IF NEW.user_id IS NOT NULL THEN
      -- Get the user's referred_by code
      SELECT referred_by INTO referrer_code
      FROM users
      WHERE id = NEW.user_id;
      
      -- If user was referred by someone
      IF referrer_code IS NOT NULL THEN
        -- Check if this is the user's first completed transaction
        SELECT COUNT(*) = 0 INTO is_first_transaction
        FROM transactions
        WHERE user_id = NEW.user_id
          AND status = 'completed'
          AND id != NEW.id; -- Exclude current transaction
        
        -- Only increment if this is the first completed transaction
        IF is_first_transaction THEN
          UPDATE users
          SET referral_count = referral_count + 1,
              updated_at = NOW()
          WHERE referral_code = referrer_code;
          
          RAISE NOTICE 'Incremented referral count for referrer code: %', referrer_code;
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger on transactions table
DROP TRIGGER IF EXISTS trigger_update_referral_count_on_transaction ON transactions;
CREATE TRIGGER trigger_update_referral_count_on_transaction
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_referral_count_on_transaction();

-- Step 4: Recalculate all referral counts based on completed transactions only
-- Reset all referral counts to 0 first
UPDATE users SET referral_count = 0;

-- Recalculate based on users who have completed at least one transaction
UPDATE users u1
SET referral_count = (
  SELECT COUNT(DISTINCT u2.id)
  FROM users u2
  INNER JOIN transactions t ON t.user_id = u2.id
  WHERE u2.referred_by = u1.referral_code
    AND t.status = 'completed'
    -- Only count each user once (their first completed transaction)
    AND t.id = (
      SELECT id
      FROM transactions
      WHERE user_id = u2.id
        AND status = 'completed'
      ORDER BY completed_at ASC
      LIMIT 1
    )
)
WHERE EXISTS (
  SELECT 1
  FROM users u2
  INNER JOIN transactions t ON t.user_id = u2.id
  WHERE u2.referred_by = u1.referral_code
    AND t.status = 'completed'
);

-- Add index for faster lookups when checking first transaction
CREATE INDEX IF NOT EXISTS idx_transactions_user_status_completed 
  ON transactions(user_id, status, completed_at) 
  WHERE status = 'completed';

