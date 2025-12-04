-- ============================================
-- COMPLETE DATA WIPE - INCLUDING REVENUE
-- Migration 018: Delete all users, transactions, revenue, and payment history
-- ============================================
-- WARNING: This will PERMANENTLY delete ALL:
--   - Users
--   - Transactions (all payment history)
--   - Revenue records
--   - User wallets
--   - Confirmation codes
-- 
-- This is IRREVERSIBLE. Make sure you have backups if needed.
-- ============================================

BEGIN;

-- Step 1: Show what will be deleted (for verification)
DO $$
DECLARE
  user_count INTEGER;
  transaction_count INTEGER;
  revenue_count INTEGER;
  wallet_count INTEGER;
  code_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM users;
  SELECT COUNT(*) INTO transaction_count FROM transactions;
  SELECT COUNT(*) INTO revenue_count FROM revenue;
  SELECT COUNT(*) INTO wallet_count FROM user_wallets;
  SELECT COUNT(*) INTO code_count FROM confirmation_codes;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PRE-DELETION SUMMARY:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Users: %', user_count;
  RAISE NOTICE 'Transactions: %', transaction_count;
  RAISE NOTICE 'Revenue Records: %', revenue_count;
  RAISE NOTICE 'User Wallets: %', wallet_count;
  RAISE NOTICE 'Confirmation Codes: %', code_count;
  RAISE NOTICE '========================================';
END $$;

-- Step 2: Delete ALL revenue records
DELETE FROM revenue;

-- Step 3: Delete ALL transactions (payment history)
DELETE FROM transactions;

-- Step 4: Delete ALL user wallets
DELETE FROM user_wallets;

-- Step 5: Delete ALL confirmation codes
DELETE FROM confirmation_codes;

-- Step 6: Delete ALL users (this will cascade delete any remaining user_wallets)
DELETE FROM users;

-- Step 7: Verify deletion
DO $$
DECLARE
  remaining_users INTEGER;
  remaining_transactions INTEGER;
  remaining_revenue INTEGER;
  remaining_wallets INTEGER;
  remaining_codes INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_users FROM users;
  SELECT COUNT(*) INTO remaining_transactions FROM transactions;
  SELECT COUNT(*) INTO remaining_revenue FROM revenue;
  SELECT COUNT(*) INTO remaining_wallets FROM user_wallets;
  SELECT COUNT(*) INTO remaining_codes FROM confirmation_codes;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'POST-DELETION VERIFICATION:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Users remaining: %', remaining_users;
  RAISE NOTICE 'Transactions remaining: %', remaining_transactions;
  RAISE NOTICE 'Revenue Records remaining: %', remaining_revenue;
  RAISE NOTICE 'User Wallets remaining: %', remaining_wallets;
  RAISE NOTICE 'Confirmation Codes remaining: %', remaining_codes;
  RAISE NOTICE '========================================';
  
  IF remaining_users = 0 AND remaining_transactions = 0 AND remaining_revenue = 0 AND remaining_wallets = 0 AND remaining_codes = 0 THEN
    RAISE NOTICE '✅ SUCCESS: All user data has been completely wiped!';
    RAISE NOTICE 'Your dashboard will now show all metrics as 0.';
  ELSE
    RAISE WARNING '⚠️ WARNING: Some data may still exist. Please check manually.';
  END IF;
END $$;

-- Commit the transaction
COMMIT;

