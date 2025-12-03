-- Migration 014: Delete user data for lightblockofweb3@gmail.com
-- WARNING: This is a permanent deletion and cannot be undone
-- Run this in Supabase SQL Editor

BEGIN;

-- Step 1: Verify user exists before deletion
DO $$
DECLARE
  user_record RECORD;
  transaction_count INTEGER;
  wallet_count INTEGER;
  confirmation_count INTEGER;
BEGIN
  -- Get user info
  SELECT id, email, referral_code, created_at INTO user_record
  FROM users 
  WHERE email = 'lightblockofweb3@gmail.com';
  
  IF user_record IS NULL THEN
    RAISE NOTICE 'User lightblockofweb3@gmail.com not found. Nothing to delete.';
    RETURN;
  END IF;
  
  -- Count related records
  SELECT COUNT(*) INTO transaction_count
  FROM transactions 
  WHERE user_id = user_record.id;
  
  SELECT COUNT(*) INTO wallet_count
  FROM user_wallets 
  WHERE user_id = user_record.id;
  
  SELECT COUNT(*) INTO confirmation_count
  FROM confirmation_codes 
  WHERE email = 'lightblockofweb3@gmail.com';
  
  -- Display what will be deleted
  RAISE NOTICE 'User found: % (ID: %)', user_record.email, user_record.id;
  RAISE NOTICE 'Will delete:';
  RAISE NOTICE '  - % transaction(s)', transaction_count;
  RAISE NOTICE '  - % wallet(s)', wallet_count;
  RAISE NOTICE '  - % confirmation code(s)', confirmation_count;
  RAISE NOTICE '  - 1 user record';
END $$;

-- Step 2: Delete confirmation codes for this email
DELETE FROM confirmation_codes 
WHERE email = 'lightblockofweb3@gmail.com';

-- Step 3: Delete all transactions for this user
DELETE FROM transactions 
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'lightblockofweb3@gmail.com'
);

-- Step 4: Delete all user wallets for this user
-- (This will also cascade automatically when user is deleted, but being explicit)
DELETE FROM user_wallets 
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'lightblockofweb3@gmail.com'
);

-- Step 5: Finally, delete the user from users table
-- This will cascade delete any remaining user_wallets
DELETE FROM users 
WHERE email = 'lightblockofweb3@gmail.com';

-- Step 6: Verify deletion (should return 0 rows)
DO $$
DECLARE
  remaining_users INTEGER;
  remaining_wallets INTEGER;
  remaining_transactions INTEGER;
  remaining_codes INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_users
  FROM users 
  WHERE email = 'lightblockofweb3@gmail.com';
  
  SELECT COUNT(*) INTO remaining_wallets
  FROM user_wallets 
  WHERE user_id IN (SELECT id FROM users WHERE email = 'lightblockofweb3@gmail.com');
  
  SELECT COUNT(*) INTO remaining_transactions
  FROM transactions 
  WHERE user_id IN (SELECT id FROM users WHERE email = 'lightblockofweb3@gmail.com');
  
  SELECT COUNT(*) INTO remaining_codes
  FROM confirmation_codes 
  WHERE email = 'lightblockofweb3@gmail.com';
  
  IF remaining_users = 0 AND remaining_wallets = 0 AND remaining_transactions = 0 AND remaining_codes = 0 THEN
    RAISE NOTICE '✅ SUCCESS: All data for lightblockofweb3@gmail.com has been deleted.';
  ELSE
    RAISE WARNING '⚠️ WARNING: Some data may still exist:';
    RAISE WARNING '  - Users: %', remaining_users;
    RAISE WARNING '  - Wallets: %', remaining_wallets;
    RAISE WARNING '  - Transactions: %', remaining_transactions;
    RAISE WARNING '  - Confirmation codes: %', remaining_codes;
  END IF;
END $$;

-- Commit the transaction
COMMIT;

-- Final verification query (run separately if needed)
-- SELECT 
--   (SELECT COUNT(*) FROM users WHERE email = 'lightblockofweb3@gmail.com') as users_remaining,
--   (SELECT COUNT(*) FROM user_wallets WHERE user_id IN (SELECT id FROM users WHERE email = 'lightblockofweb3@gmail.com')) as wallets_remaining,
--   (SELECT COUNT(*) FROM transactions WHERE user_id IN (SELECT id FROM users WHERE email = 'lightblockofweb3@gmail.com')) as transactions_remaining,
--   (SELECT COUNT(*) FROM confirmation_codes WHERE email = 'lightblockofweb3@gmail.com') as codes_remaining;

