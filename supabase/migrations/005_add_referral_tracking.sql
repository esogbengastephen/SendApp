-- Add referral count column to track how many users each person has referred
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;

-- Create index for faster queries on referral count
CREATE INDEX IF NOT EXISTS idx_users_referral_count ON users(referral_count);

-- Create a function to automatically update referral count when a new user signs up
CREATE OR REPLACE FUNCTION update_referral_count()
RETURNS TRIGGER AS $$
BEGIN
  -- If the new user has a referred_by value, increment the referrer's count
  IF NEW.referred_by IS NOT NULL THEN
    UPDATE users
    SET referral_count = referral_count + 1,
        updated_at = NOW()
    WHERE referral_code = NEW.referred_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update referral count
DROP TRIGGER IF EXISTS trigger_update_referral_count ON users;
CREATE TRIGGER trigger_update_referral_count
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_referral_count();

-- Update existing users' referral counts based on referred_by relationships
UPDATE users u1
SET referral_count = (
  SELECT COUNT(*)
  FROM users u2
  WHERE u2.referred_by = u1.referral_code
)
WHERE EXISTS (
  SELECT 1
  FROM users u2
  WHERE u2.referred_by = u1.referral_code
);

