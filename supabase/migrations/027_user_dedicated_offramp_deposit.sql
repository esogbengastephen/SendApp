-- One dedicated deposit address (EOA) per user for off-ramp; reused across requests.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS offramp_deposit_address TEXT,
ADD COLUMN IF NOT EXISTS offramp_deposit_private_key_encrypted TEXT;

CREATE INDEX IF NOT EXISTS idx_users_offramp_deposit_address ON users(offramp_deposit_address);
