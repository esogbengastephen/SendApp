-- Migration 024: Rebuild offramp tables with improvements
-- This migration drops and recreates offramp tables with:
-- 1. wallet_identifier column (CRITICAL for consistent wallet derivation)
-- 2. Removed unique constraint on unique_wallet_address (allow multiple transactions per wallet)
-- 3. Compound unique index for pending transactions (only 1 pending per wallet+account combo)
-- 4. Better support for multiple account numbers per wallet

-- Drop existing tables (in reverse dependency order)
DROP TABLE IF EXISTS offramp_swap_attempts CASCADE;
DROP TABLE IF EXISTS offramp_revenue CASCADE;
DROP TABLE IF EXISTS offramp_transactions CASCADE;

-- Recreate offramp_transactions table with improvements
CREATE TABLE IF NOT EXISTS offramp_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  user_account_number VARCHAR(50) NOT NULL,
  user_account_name TEXT,
  user_bank_code VARCHAR(10),
  
  -- CRITICAL: Store wallet identifier for consistent wallet derivation
  wallet_identifier TEXT NOT NULL, -- The exact identifier used to generate the wallet (user_id, email, or guest_{accountNumber})
  unique_wallet_address VARCHAR(255) NOT NULL, -- Generated HD wallet address (NO UNIQUE CONSTRAINT - allows multiple transactions)
  
  token_address VARCHAR(255),
  token_symbol VARCHAR(50),
  token_amount VARCHAR(50),
  token_amount_raw VARCHAR(50),
  usdc_amount VARCHAR(50),
  usdc_amount_raw VARCHAR(50),
  ngn_amount DECIMAL(18, 2),
  exchange_rate DECIMAL(18, 8),
  fee_ngn DECIMAL(18, 2),
  fee_in_send TEXT,
  status VARCHAR(20) NOT NULL CHECK (status IN (
    'pending',           -- Waiting for user to send tokens
    'token_received',    -- Token detected, waiting for swap
    'swapping',         -- Swap in progress
    'usdc_received',    -- USDC received in receiver wallet
    'paying',           -- Paystack payment in progress
    'completed',        -- User received Naira
    'failed',           -- Transaction failed
    'refunded'          -- Refunded to user
  )),
  swap_tx_hash VARCHAR(255),
  swap_attempts INTEGER DEFAULT 0,
  paystack_reference VARCHAR(255),
  paystack_recipient_code VARCHAR(255),
  error_message TEXT,
  refund_tx_hash VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  token_received_at TIMESTAMP WITH TIME ZONE,
  usdc_received_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  all_tokens_detected JSONB, -- Store all detected tokens for wallet emptying
  wallet_emptied BOOLEAN DEFAULT FALSE -- Track if wallet was emptied after swap
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_transaction_id ON offramp_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_user_id ON offramp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_user_email ON offramp_transactions(user_email);
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_wallet_address ON offramp_transactions(unique_wallet_address);
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_wallet_identifier ON offramp_transactions(wallet_identifier);
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_status ON offramp_transactions(status);
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_created_at ON offramp_transactions(created_at);

-- CRITICAL: Compound unique index - Only 1 pending transaction per wallet+account combo
-- This ensures users can have multiple transactions with different account numbers,
-- but only 1 pending transaction at a time per wallet+account combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_tx_per_wallet_account 
ON offramp_transactions (unique_wallet_address, user_account_number)
WHERE status IN ('pending', 'token_received', 'swapping');

-- Recreate offramp_revenue table
CREATE TABLE IF NOT EXISTS offramp_revenue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  fee_ngn DECIMAL(18, 2) NOT NULL,
  fee_in_send TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_offramp_revenue_transaction FOREIGN KEY (transaction_id)
    REFERENCES offramp_transactions(transaction_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_offramp_revenue_transaction_id ON offramp_revenue(transaction_id);
CREATE INDEX IF NOT EXISTS idx_offramp_revenue_created_at ON offramp_revenue(created_at);

-- Recreate offramp_swap_attempts table
CREATE TABLE IF NOT EXISTS offramp_swap_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES offramp_transactions(transaction_id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  swap_tx_hash VARCHAR(255),
  status VARCHAR(20), -- pending, success, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offramp_swap_attempts_transaction_id ON offramp_swap_attempts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_offramp_swap_attempts_status ON offramp_swap_attempts(status);

-- Enable RLS on all tables
ALTER TABLE offramp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE offramp_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE offramp_swap_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for offramp_transactions
CREATE POLICY "Users can view own offramp transactions" ON offramp_transactions
  FOR SELECT
  USING (auth.uid()::text = user_id::text OR user_email = (SELECT email FROM users WHERE id = auth.uid()::uuid));

CREATE POLICY "Service role can manage offramp transactions" ON offramp_transactions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for offramp_revenue
CREATE POLICY "Allow admin read access to offramp revenue" ON offramp_revenue
  FOR SELECT
  USING (true);

-- RLS Policies for offramp_swap_attempts
CREATE POLICY "Allow admin read access to swap attempts" ON offramp_swap_attempts
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage swap attempts" ON offramp_swap_attempts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comments for documentation
COMMENT ON COLUMN offramp_transactions.wallet_identifier IS 'The exact identifier used to generate the wallet (user_id, email, or guest_{accountNumber}). CRITICAL for consistent wallet derivation.';
COMMENT ON COLUMN offramp_transactions.unique_wallet_address IS 'Generated HD wallet address. Multiple transactions can share the same wallet address (same user, different account numbers).';
COMMENT ON INDEX idx_one_pending_tx_per_wallet_account IS 'Ensures only 1 pending transaction per wallet+account combo. Users can create multiple transactions with different account numbers, but only 1 pending at a time per combo.';
