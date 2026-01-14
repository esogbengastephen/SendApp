-- Migration 017: Add profile fields and wallet management (Extensible Multi-Chain)
-- Description: Add display_name, photo_url, passkey support, and multi-chain wallet fields
-- SECURITY: Only encrypted seed phrase is stored, never plaintext
-- Uses JSONB column for extensible chain addresses - easily add new chains without migrations

-- Add profile fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add passkey fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS passkey_credential_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS passkey_public_key TEXT,
ADD COLUMN IF NOT EXISTS wallet_seed_encrypted TEXT, -- ENCRYPTED seed phrase ONLY (client-side encryption)
ADD COLUMN IF NOT EXISTS wallet_created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS passkey_created_at TIMESTAMP WITH TIME ZONE;

-- Use JSONB for extensible chain addresses
-- Format: {"bitcoin": "bc1...", "ethereum": "0x...", "solana": "...", etc.}
-- This allows adding new chains without database migrations
ALTER TABLE users
ADD COLUMN IF NOT EXISTS wallet_addresses JSONB DEFAULT '{}'::jsonb;

-- Add GIN index for fast JSON queries
CREATE INDEX IF NOT EXISTS idx_users_wallet_addresses ON users USING GIN (wallet_addresses);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_passkey_credential_id ON users(passkey_credential_id);
CREATE INDEX IF NOT EXISTS idx_users_wallet_created_at ON users(wallet_created_at);

-- Add comments for documentation
COMMENT ON COLUMN users.display_name IS 'User display name for profile';
COMMENT ON COLUMN users.photo_url IS 'URL to user profile photo';
COMMENT ON COLUMN users.passkey_credential_id IS 'WebAuthn credential ID for passkey authentication';
COMMENT ON COLUMN users.passkey_public_key IS 'Public key associated with passkey';
COMMENT ON COLUMN users.wallet_seed_encrypted IS 'ENCRYPTED BIP-39 seed phrase ONLY. Plaintext seed NEVER stored. Encrypted client-side with passkey.';
COMMENT ON COLUMN users.wallet_addresses IS 'JSONB object storing wallet addresses for all chains. Format: {"chainId": "address"}. Easily extensible for new chains without migrations.';
COMMENT ON COLUMN users.wallet_created_at IS 'Timestamp when wallet was created';
COMMENT ON COLUMN users.passkey_created_at IS 'Timestamp when passkey was created';

-- Security constraint: Ensure we never accidentally store plaintext seed
-- This is enforced at application level, but adding comment for documentation
-- ALWAYS encrypt seed phrase client-side before sending to backend

