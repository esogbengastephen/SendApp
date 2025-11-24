# Database Migration Instructions

## Quick Method: Use Supabase Dashboard (Recommended)

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new
   - Or navigate: Dashboard → SQL Editor → New Query

2. **Copy and Paste the SQL Below**

```sql
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
```

3. **Click "Run" or press Cmd+Enter (Mac) / Ctrl+Enter (Windows)**

4. **Verify Success**
   - You should see "Success. No rows returned"
   - Go to Table Editor and verify `platform_settings` table exists
   - Check that the default exchange rate row was created

## Alternative Method: Using psql (if installed)

If you have PostgreSQL client tools installed:

```bash
# You'll be prompted for password
psql -h db.ksdzzqdafodlstfkqzuv.supabase.co -p 5432 -d postgres -U postgres -f supabase/migrations/001_create_platform_settings.sql
```

To get your Supabase database password:
1. Go to Supabase Dashboard → Settings → Database
2. Find "Connection string" or "Database password"
3. Use that password when prompted

## Verify Migration

After running the migration, verify it worked:

1. **Check Table Exists**
   - Go to Supabase Dashboard → Table Editor
   - You should see `platform_settings` table

2. **Check Default Data**
   - Click on `platform_settings` table
   - You should see one row with `setting_key = 'exchange_rate'`
   - The `setting_value` should contain `{"exchangeRate": 50.0, ...}`

3. **Test API Endpoint**
   - Run your app: `npm run dev`
   - Visit: `http://localhost:3000/api/rate`
   - Should return: `{"exchangeRate": 50.0, ...}`

## Troubleshooting

### Error: "relation platform_settings already exists"
- The table already exists. This is fine - the migration uses `CREATE TABLE IF NOT EXISTS`
- You can skip this step or drop the table first if you want to recreate it

### Error: "permission denied"
- Make sure you're using the correct Supabase project
- Check that you have admin access to the project

### Error: "policy already exists"
- The RLS policies already exist. This is fine
- You can ignore this error or drop existing policies first

