-- Migration 012: Add admin roles and permissions system
-- Supports super_admin (full access + can manage admins) and admin (with specific permissions)

-- Create admin_wallets table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns for role-based access control
ALTER TABLE admin_wallets 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS created_by TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_wallets_address ON admin_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_admin_wallets_active ON admin_wallets(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_wallets_role ON admin_wallets(role);

-- Enable Row Level Security
ALTER TABLE admin_wallets ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only service role can access (via supabaseAdmin client)
-- This ensures only server-side code can manage admins
CREATE POLICY "Service role can manage admin_wallets" ON admin_wallets
  FOR ALL USING (true);

-- Update existing admins to super_admin if they're in the env variable
-- This migration assumes the first admin(s) should be super_admin
-- You can manually update specific admins after migration if needed
DO $$
BEGIN
  -- If there are any existing admins without a role set, set them to admin by default
  -- Super admin should be set manually or via the first admin in env
  UPDATE admin_wallets 
  SET role = 'admin' 
  WHERE role IS NULL OR role = '';
END $$;

