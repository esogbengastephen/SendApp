-- Migration 009: Email-Only Users (Clean Database Schema)
-- This migration removes the unused wallet_address column from the users table
-- and enforces email as the primary identifier for users.
--
-- Context:
-- - Users are NOW identified by EMAIL ONLY
-- - Wallet addresses are stored in user_wallets table (one user, many wallets)
-- - The old users.wallet_address column was never used after multi-wallet implementation
-- - This migration removes technical debt and makes the schema clearer
--
-- Date: 2025-11-27

-- ============================================================================
-- STEP 1: Make email required (NOT NULL)
-- ============================================================================
-- Since all users are created with email (signup process), this is safe
ALTER TABLE users 
  ALTER COLUMN email SET NOT NULL;

COMMENT ON COLUMN users.email IS 'Primary identifier for users (required, unique). Users sign up with email.';

-- ============================================================================
-- STEP 2: Drop the old constraint that allowed wallet-only users
-- ============================================================================
-- The old constraint checked: email IS NOT NULL OR wallet_address IS NOT NULL
-- Since we now require email, this constraint is obsolete
ALTER TABLE users 
  DROP CONSTRAINT IF EXISTS users_has_identifier;

-- ============================================================================
-- STEP 3: Drop the unused index on wallet_address
-- ============================================================================
-- This index was for looking up users by wallet address
-- Now we use user_wallets table for wallet lookups
DROP INDEX IF EXISTS idx_users_wallet_address;

-- ============================================================================
-- STEP 4: Remove wallet_address column from users table
-- ============================================================================
-- This column has been unused since migration 006 (multi-wallet implementation)
-- All wallet addresses are now stored in the user_wallets table
ALTER TABLE users 
  DROP COLUMN IF EXISTS wallet_address;

-- ============================================================================
-- STEP 5: Update RLS policies to remove wallet_address references
-- ============================================================================

-- Drop old policies that referenced wallet_address
DROP POLICY IF EXISTS "Users can read their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;

-- Recreate policies without wallet_address references
CREATE POLICY "Users can read their own data" ON users
  FOR SELECT USING (
    auth.uid()::text = id::text OR
    auth.jwt() ->> 'email' = email
  );

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (
    auth.uid()::text = id::text OR
    auth.jwt() ->> 'email' = email
  );

-- ============================================================================
-- STEP 6: Add documentation comments
-- ============================================================================

COMMENT ON TABLE users IS 
  'Users are identified by email only. Each user can have multiple wallet addresses stored in the user_wallets table. Signup creates a user with email + virtual bank account. Wallets are linked automatically during transactions.';

COMMENT ON TABLE user_wallets IS 
  'Stores wallet addresses linked to users. One user can have many wallets. Multiple users can share the same wallet address (different user_id). Transaction stats are tracked per wallet and aggregated per user via database trigger.';

-- ============================================================================
-- Verification Queries (uncomment to test after migration)
-- ============================================================================

-- Check that email is now required
-- SELECT column_name, is_nullable, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' AND column_name = 'email';

-- Verify wallet_address column is gone
-- SELECT column_name 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' AND column_name = 'wallet_address';

-- Check all users have email
-- SELECT COUNT(*) as total_users, 
--        COUNT(email) as users_with_email 
-- FROM users;

-- Sample user record structure
-- SELECT id, email, referral_code, total_transactions, created_at 
-- FROM users 
-- LIMIT 1;

-- Sample user with their wallets
-- SELECT 
--   u.email,
--   u.total_transactions as user_total_txns,
--   uw.wallet_address,
--   uw.total_transactions as wallet_txns
-- FROM users u
-- LEFT JOIN user_wallets uw ON uw.user_id = u.id
-- LIMIT 5;

