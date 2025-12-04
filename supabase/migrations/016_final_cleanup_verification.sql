-- ============================================
-- VERIFICATION & FINAL CLEANUP SCRIPT
-- Migration 016: Verify and clean any remaining data
-- ============================================
-- This script:
-- 1. Verifies what data remains in the database
-- 2. Cleans any orphaned records
-- 3. Ensures database is completely clean for fresh start
-- ============================================

BEGIN;

-- Step 1: Check current state
DO $$
DECLARE
  user_count INTEGER;
  transaction_count INTEGER;
  wallet_count INTEGER;
  code_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM users;
  SELECT COUNT(*) INTO transaction_count FROM transactions;
  SELECT COUNT(*) INTO wallet_count FROM user_wallets;
  SELECT COUNT(*) INTO code_count FROM confirmation_codes;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CURRENT DATABASE STATE:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Users: %', user_count;
  RAISE NOTICE 'Transactions: %', transaction_count;
  RAISE NOTICE 'User Wallets: %', wallet_count;
  RAISE NOTICE 'Confirmation Codes: %', code_count;
  RAISE NOTICE '========================================';
END $$;

-- Step 2: Clean up any remaining data (in case migration 015 wasn't run or new data was added)
DELETE FROM transactions WHERE id IS NOT NULL;
DELETE FROM user_wallets WHERE id IS NOT NULL;
DELETE FROM confirmation_codes WHERE id IS NOT NULL;
DELETE FROM users WHERE id IS NOT NULL;

-- Step 3: Verify everything is clean
DO $$
DECLARE
  remaining_users INTEGER;
  remaining_transactions INTEGER;
  remaining_wallets INTEGER;
  remaining_codes INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_users FROM users;
  SELECT COUNT(*) INTO remaining_transactions FROM transactions;
  SELECT COUNT(*) INTO remaining_wallets FROM user_wallets;
  SELECT COUNT(*) INTO remaining_codes FROM confirmation_codes;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'POST-CLEANUP VERIFICATION:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Users remaining: %', remaining_users;
  RAISE NOTICE 'Transactions remaining: %', remaining_transactions;
  RAISE NOTICE 'User Wallets remaining: %', remaining_wallets;
  RAISE NOTICE 'Confirmation Codes remaining: %', remaining_codes;
  RAISE NOTICE '========================================';
  
  IF remaining_users = 0 AND remaining_transactions = 0 AND remaining_wallets = 0 AND remaining_codes = 0 THEN
    RAISE NOTICE '✅ SUCCESS: Database is completely clean!';
    RAISE NOTICE 'Ready for fresh start.';
  ELSE
    RAISE WARNING '⚠️ WARNING: Some data still exists.';
  END IF;
END $$;

COMMIT;

-- Note: Paystack transactions shown in the admin dashboard are fetched
-- directly from Paystack's API and cannot be deleted. They are permanent
-- records in Paystack's system. The updated API will now filter to only
-- show Paystack transactions that have matching database records.

