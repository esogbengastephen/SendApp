-- Migration 008: Add Paystack customer fields to users table
-- This allows us to track Paystack customer code and virtual account assignment time at user level

-- Add paystack_customer_code to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS 
  paystack_customer_code TEXT;

-- Add virtual_account_assigned_at to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS 
  virtual_account_assigned_at TIMESTAMP WITH TIME ZONE;

-- Add index for fast lookups by customer code
CREATE INDEX IF NOT EXISTS idx_users_paystack_customer 
  ON users(paystack_customer_code);

-- Add index for virtual account number lookups
CREATE INDEX IF NOT EXISTS idx_users_virtual_account 
  ON users(default_virtual_account_number);

-- Verification query (commented out)
-- SELECT id, email, paystack_customer_code, default_virtual_account_number, virtual_account_assigned_at 
-- FROM users 
-- WHERE default_virtual_account_number IS NOT NULL;

