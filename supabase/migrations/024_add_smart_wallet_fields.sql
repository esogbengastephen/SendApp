-- Add smart wallet fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS smart_wallet_address TEXT,
ADD COLUMN IF NOT EXISTS smart_wallet_owner_encrypted TEXT,
ADD COLUMN IF NOT EXISTS smart_wallet_salt TEXT,
ADD COLUMN IF NOT EXISTS smart_wallet_created_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS solana_wallet_address TEXT,
ADD COLUMN IF NOT EXISTS solana_wallet_private_key_encrypted TEXT,
ADD COLUMN IF NOT EXISTS solana_wallet_created_at TIMESTAMP;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_smart_wallet_address 
ON users(smart_wallet_address);

CREATE INDEX IF NOT EXISTS idx_users_solana_wallet_address 
ON users(solana_wallet_address);

-- Create offramp_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS offramp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  user_email TEXT,
  wallet_address TEXT NOT NULL,
  smart_wallet_address TEXT,
  solana_wallet_address TEXT,
  account_number TEXT NOT NULL,
  account_name TEXT,
  bank_code TEXT,
  bank_name TEXT,
  network TEXT NOT NULL, -- 'base' or 'solana'
  token_contract_address TEXT,
  token_symbol TEXT,
  token_amount TEXT,
  usdc_amount TEXT,
  ngn_amount NUMERIC,
  exchange_rate NUMERIC,
  fee_amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, token_received, verified, swapped, payment_sent, completed, failed
  swap_tx_hash TEXT,
  paystack_reference TEXT,
  paystack_transfer_code TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_offramp_user_id ON offramp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_offramp_status ON offramp_transactions(status);
CREATE INDEX IF NOT EXISTS idx_offramp_wallet ON offramp_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_offramp_transaction_id ON offramp_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_offramp_network ON offramp_transactions(network);

-- Create verified tokens table
CREATE TABLE IF NOT EXISTS verified_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network TEXT NOT NULL, -- 'base' or 'solana'
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_name TEXT,
  token_decimals INTEGER,
  is_verified BOOLEAN DEFAULT true,
  min_liquidity_usd NUMERIC,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(network, token_address)
);

-- Insert default verified tokens for Base
INSERT INTO verified_tokens (network, token_address, token_symbol, token_name, token_decimals, is_verified)
VALUES 
  ('base', '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 'USDC', 'USD Coin', 6, true),
  ('base', '0xEab49138BA2Ea6dd776220fE26b7b8E446638956', 'SEND', 'Send Token', 18, true),
  ('base', '0x4200000000000000000000000000000000000006', 'WETH', 'Wrapped Ether', 18, true)
ON CONFLICT (network, token_address) DO NOTHING;

-- Insert default verified tokens for Solana
INSERT INTO verified_tokens (network, token_address, token_symbol, token_name, token_decimals, is_verified)
VALUES 
  ('solana', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'USDC', 'USD Coin', 6, true),
  ('solana', 'So11111111111111111111111111111111111111112', 'SOL', 'Solana', 9, true)
ON CONFLICT (network, token_address) DO NOTHING;
