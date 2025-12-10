-- Migration 019: Create off-ramp transaction tables
-- This migration creates tables for the off-ramp solution where users can
-- convert Base tokens back to Nigerian Naira (NGN)

-- 1. Create offramp_transactions table
CREATE TABLE IF NOT EXISTS offramp_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Link to existing users table
  user_email TEXT NOT NULL, -- User's email (for quick lookup)
  user_account_number VARCHAR(50) NOT NULL, -- Where to send Naira
  user_account_name TEXT, -- Optional: account name
  user_bank_code VARCHAR(10), -- Optional: bank code
  unique_wallet_address VARCHAR(255) UNIQUE NOT NULL, -- Generated HD wallet address
  token_address VARCHAR(255), -- Which token user sent (detected)
  token_symbol VARCHAR(50), -- Token symbol (ETH, USDC, etc.)
  token_amount VARCHAR(50), -- Amount sent (detected)
  token_amount_raw VARCHAR(50), -- Raw amount (wei format)
  usdc_amount VARCHAR(50), -- After swap to USDC
  usdc_amount_raw VARCHAR(50), -- Raw USDC amount
  ngn_amount DECIMAL(18, 2), -- Final NGN to pay user (after fees)
  exchange_rate DECIMAL(18, 8), -- USDC to NGN rate
  fee_ngn DECIMAL(18, 2), -- Fee in NGN
  fee_in_send TEXT, -- Fee in $SEND (for revenue tracking)
  status VARCHAR(20) NOT NULL CHECK (status IN (
    'pending',           -- Waiting for user to send tokens
    'token_received',    -- Token detected, waiting for swap
    'swapping',         -- Swap in progress
    'usdc_received',    -- USDC received in admin wallet
    'paying',           -- Paystack payment in progress
    'completed',        -- User received Naira
    'failed',           -- Transaction failed
    'refunded'          -- Refunded to user
  )),
  swap_tx_hash VARCHAR(255), -- 1inch swap transaction hash
  swap_attempts INTEGER DEFAULT 0, -- Number of swap attempts
  paystack_reference VARCHAR(255), -- Paystack payment reference
  paystack_recipient_code VARCHAR(255), -- Paystack recipient code
  error_message TEXT, -- Error details if failed
  refund_tx_hash VARCHAR(255), -- If refunded, blockchain tx hash
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  token_received_at TIMESTAMP WITH TIME ZONE,
  usdc_received_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_transaction_id ON offramp_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_user_id ON offramp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_user_email ON offramp_transactions(user_email);
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_wallet_address ON offramp_transactions(unique_wallet_address);
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_status ON offramp_transactions(status);
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_created_at ON offramp_transactions(created_at);

-- 2. Create offramp_revenue table (similar to on-ramp revenue)
CREATE TABLE IF NOT EXISTS offramp_revenue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  fee_ngn DECIMAL(18, 2) NOT NULL,
  fee_in_send TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_offramp_revenue_transaction FOREIGN KEY (transaction_id)
    REFERENCES offramp_transactions(transaction_id) ON DELETE CASCADE
);

-- Index for revenue lookups
CREATE INDEX IF NOT EXISTS idx_offramp_revenue_transaction_id ON offramp_revenue(transaction_id);
CREATE INDEX IF NOT EXISTS idx_offramp_revenue_created_at ON offramp_revenue(created_at);

-- 3. Create offramp_swap_attempts table (for retry tracking)
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
-- Users can read their own transactions
CREATE POLICY "Users can view own offramp transactions" ON offramp_transactions
  FOR SELECT
  USING (auth.uid()::text = user_id::text OR user_email = (SELECT email FROM users WHERE id = auth.uid()::uuid));

-- System can insert/update (via service role)
CREATE POLICY "Service role can manage offramp transactions" ON offramp_transactions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for offramp_revenue (read-only for admins)
CREATE POLICY "Allow admin read access to offramp revenue" ON offramp_revenue
  FOR SELECT
  USING (true);

-- RLS Policies for offramp_swap_attempts (read for admins, write for system)
CREATE POLICY "Allow admin read access to swap attempts" ON offramp_swap_attempts
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage swap attempts" ON offramp_swap_attempts
  FOR ALL
  USING (true)
  WITH CHECK (true);

