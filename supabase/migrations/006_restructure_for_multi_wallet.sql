-- Migration 006: Restructure for multi-wallet support
-- One user (email) can have multiple wallets
-- Multiple users can share the same wallet address

-- 1. Create user_wallets table (one user can have multiple wallets)
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  sendtag TEXT,
  total_transactions INTEGER DEFAULT 0,
  total_spent_ngn DECIMAL(18, 2) DEFAULT 0,
  total_received_send TEXT DEFAULT '0.00',
  first_transaction_at TIMESTAMP WITH TIME ZONE,
  last_transaction_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Composite unique: same user can't add same wallet twice
  -- But different users CAN use the same wallet
  UNIQUE(user_id, wallet_address)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_wallet_address ON user_wallets(wallet_address);

-- 2. Create transactions table (move from in-memory to Supabase)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT UNIQUE NOT NULL, -- nanoid
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  wallet_address TEXT NOT NULL,
  paystack_reference TEXT,
  ngn_amount DECIMAL(18, 2) NOT NULL,
  send_amount TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  sendtag TEXT,
  exchange_rate DECIMAL(18, 4),
  error_message TEXT,
  verification_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  initialized_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  last_checked_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_address ON transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_id ON transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_paystack_ref ON transactions(paystack_reference);

-- 3. Remove wallet_address from users table (it's now in user_wallets)
-- Keep it for now to avoid breaking existing code, but it will be deprecated
-- ALTER TABLE users DROP COLUMN IF EXISTS wallet_address;

-- 4. Enable RLS
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_wallets
CREATE POLICY "Allow public read user_wallets" ON user_wallets
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert user_wallets" ON user_wallets
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update user_wallets" ON user_wallets
  FOR UPDATE USING (true);

-- RLS Policies for transactions
CREATE POLICY "Allow public read transactions" ON transactions
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert transactions" ON transactions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update transactions" ON transactions
  FOR UPDATE USING (true);

-- 5. Create function to auto-update user stats when wallet stats change
CREATE OR REPLACE FUNCTION update_user_totals_from_wallets()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate user totals from all their wallets
  UPDATE users
  SET 
    total_transactions = (
      SELECT COALESCE(SUM(total_transactions), 0)
      FROM user_wallets
      WHERE user_id = NEW.user_id
    ),
    total_spent_ngn = (
      SELECT COALESCE(SUM(total_spent_ngn), 0)
      FROM user_wallets
      WHERE user_id = NEW.user_id
    ),
    total_received_send = (
      SELECT COALESCE(SUM(total_received_send::DECIMAL), 0)::TEXT
      FROM user_wallets
      WHERE user_id = NEW.user_id
    ),
    first_transaction_at = (
      SELECT MIN(first_transaction_at)
      FROM user_wallets
      WHERE user_id = NEW.user_id
    ),
    last_transaction_at = (
      SELECT MAX(last_transaction_at)
      FROM user_wallets
      WHERE user_id = NEW.user_id
    ),
    updated_at = NOW()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update user totals when wallet stats change
DROP TRIGGER IF EXISTS trigger_update_user_totals_from_wallets ON user_wallets;
CREATE TRIGGER trigger_update_user_totals_from_wallets
  AFTER INSERT OR UPDATE ON user_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_user_totals_from_wallets();

-- Verification queries
-- SELECT COUNT(*) as user_wallets_count FROM user_wallets;
-- SELECT COUNT(*) as transactions_count FROM transactions;
-- SELECT * FROM users LIMIT 5;

