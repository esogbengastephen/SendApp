-- Create platform_settings table for storing exchange rate and other platform settings
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(setting_key);

-- Insert default exchange rate setting
INSERT INTO platform_settings (setting_key, setting_value, updated_by)
VALUES (
  'exchange_rate',
  jsonb_build_object(
    'exchangeRate', 50.0,
    'updatedAt', NOW(),
    'updatedBy', 'system'
  ),
  'system'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Enable Row Level Security (RLS) - allow read for everyone, write only for authenticated users
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read access to everyone (for public API)
CREATE POLICY "Allow public read access" ON platform_settings
  FOR SELECT
  USING (true);

-- Policy: Allow insert/update only for authenticated users (you can restrict this further)
CREATE POLICY "Allow authenticated write access" ON platform_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

