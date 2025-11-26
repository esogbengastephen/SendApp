-- Create users table (supports both email and wallet-based users)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE, -- For email-based auth (nullable to support wallet-only users)
  wallet_address TEXT UNIQUE, -- For wallet-based users (nullable to support email-only users initially)
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT, -- Referral code of the user who referred them
  email_verified BOOLEAN DEFAULT false,
  -- Transaction tracking (compatible with existing lib/users.ts)
  first_transaction_at TIMESTAMP WITH TIME ZONE,
  last_transaction_at TIMESTAMP WITH TIME ZONE,
  total_transactions INTEGER DEFAULT 0,
  total_spent_ngn DECIMAL(18, 2) DEFAULT 0,
  total_received_send TEXT DEFAULT '0.00',
  sendtag TEXT, -- If user used SendTag
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure at least one identifier exists
  CONSTRAINT users_has_identifier CHECK (email IS NOT NULL OR wallet_address IS NOT NULL)
);

-- Create confirmation codes table
CREATE TABLE IF NOT EXISTS confirmation_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_confirmation_codes_email ON confirmation_codes(email);
CREATE INDEX IF NOT EXISTS idx_confirmation_codes_code ON confirmation_codes(code);
CREATE INDEX IF NOT EXISTS idx_confirmation_codes_expires ON confirmation_codes(expires_at);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmation_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
-- Allow users to read their own data (by email or wallet)
CREATE POLICY "Users can read their own data" ON users
  FOR SELECT USING (
    auth.uid()::text = id::text OR
    auth.jwt() ->> 'email' = email OR
    auth.jwt() ->> 'wallet_address' = wallet_address
  );

-- Allow public insert for signup (will be restricted by API)
CREATE POLICY "Allow public insert for signup" ON users
  FOR INSERT WITH CHECK (true);

-- Allow users to update their own data
CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (
    auth.uid()::text = id::text OR
    auth.jwt() ->> 'email' = email OR
    auth.jwt() ->> 'wallet_address' = wallet_address
  );

-- RLS Policies for confirmation codes (public for API access)
CREATE POLICY "Allow insert confirmation codes" ON confirmation_codes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow read confirmation codes" ON confirmation_codes
  FOR SELECT USING (true);

CREATE POLICY "Allow update confirmation codes" ON confirmation_codes
  FOR UPDATE USING (true);

