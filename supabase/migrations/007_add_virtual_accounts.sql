-- Migration 007: Add Paystack Dedicated Virtual Account fields
-- This enables each user to have their own unique bank account number

-- 1. Add virtual account fields to user_wallets table
ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS 
  paystack_customer_code TEXT;

ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS 
  paystack_dedicated_account_id TEXT;

ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS 
  virtual_account_number TEXT;

ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS 
  virtual_account_bank TEXT;

ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS 
  virtual_account_bank_name TEXT;

ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS 
  virtual_account_assigned_at TIMESTAMP WITH TIME ZONE;

-- Index for fast lookups by virtual account number (webhook needs this)
CREATE INDEX IF NOT EXISTS idx_user_wallets_virtual_account 
  ON user_wallets(virtual_account_number);

CREATE INDEX IF NOT EXISTS idx_user_wallets_paystack_customer 
  ON user_wallets(paystack_customer_code);

-- 2. Add default virtual account fields to users table for quick reference
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  default_virtual_account_number TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS
  default_virtual_account_bank TEXT;

-- 3. Add unique constraint on virtual account number (each account is unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_virtual_account_number 
  ON user_wallets(virtual_account_number) 
  WHERE virtual_account_number IS NOT NULL;

-- Verification queries
-- SELECT user_id, wallet_address, virtual_account_number, virtual_account_bank_name 
-- FROM user_wallets 
-- WHERE virtual_account_number IS NOT NULL;

