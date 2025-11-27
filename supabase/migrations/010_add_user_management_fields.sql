-- Migration: Add User Management Fields
-- Description: Add fields for blocking users and requiring account resets

-- Add management fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
ADD COLUMN IF NOT EXISTS requires_reset BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reset_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS account_reset_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users(is_blocked);
CREATE INDEX IF NOT EXISTS idx_users_requires_reset ON users(requires_reset);

-- Add comments for documentation
COMMENT ON COLUMN users.is_blocked IS 'Whether the user is blocked from accessing the system';
COMMENT ON COLUMN users.blocked_at IS 'Timestamp when the user was blocked';
COMMENT ON COLUMN users.blocked_reason IS 'Reason for blocking the user';
COMMENT ON COLUMN users.requires_reset IS 'Whether the user needs to reset their account on next login';
COMMENT ON COLUMN users.reset_requested_at IS 'Timestamp when account reset was requested';
COMMENT ON COLUMN users.account_reset_at IS 'Timestamp when account was permanently reset (never cleared)';

-- Update RLS policies to respect blocked status
-- (Users should not be able to access their data when blocked)

-- Drop and recreate the select policy for users
DROP POLICY IF EXISTS "Users can read own data" ON users;
CREATE POLICY "Users can read own data" ON users
  FOR SELECT
  USING (
    id = auth.uid() AND is_blocked = FALSE
  );

-- Drop and recreate the update policy for users
DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE
  USING (
    id = auth.uid() AND is_blocked = FALSE
  );

