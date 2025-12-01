# Supabase Database Verification Guide

## What to Verify

To ensure the exchange rate persistence is working correctly, we need to verify:

1. ✅ **Table exists**: `platform_settings` table is created
2. ✅ **Data exists**: Exchange rate row is present with correct structure
3. ✅ **RLS policies**: Row Level Security policies allow read/write access
4. ✅ **Connection**: Application can connect to Supabase

## Supabase Credentials Needed

If you want me to verify the database setup, I would need:

### Option 1: Supabase Dashboard Access (Recommended)
- **Project URL**: `https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv`
- **SQL Editor Access**: To run verification queries
- **Table Editor Access**: To view the `platform_settings` table

### Option 2: Database Connection String (For Direct Verification)
- **Database Host**: `db.ksdzzqdafodlstfkqzuv.supabase.co`
- **Database Port**: `5432`
- **Database Name**: `postgres`
- **Database User**: `postgres`
- **Database Password**: (Your Supabase database password)

### Option 3: API Keys (For Application-Level Verification)
- **Supabase URL**: `https://ksdzzqdafodlstfkqzuv.supabase.co` (already in code)
- **Supabase Anon Key**: (Your anon/public key)
- **Supabase Service Role Key**: (For admin operations - keep this secret!)

## Verification Queries

### 1. Check if Table Exists
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'platform_settings'
);
```

### 2. Check Table Structure
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'platform_settings'
ORDER BY ordinal_position;
```

### 3. Check if Exchange Rate Data Exists
```sql
SELECT 
  setting_key,
  setting_value->>'exchangeRate' as exchange_rate,
  setting_value->>'updatedAt' as updated_at,
  setting_value->>'updatedBy' as updated_by,
  updated_at as db_updated_at
FROM platform_settings
WHERE setting_key = 'exchange_rate';
```

### 4. Check RLS Policies
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'platform_settings';
```

### 5. Test Read Access (Should return data)
```sql
SELECT setting_value 
FROM platform_settings 
WHERE setting_key = 'exchange_rate';
```

### 6. Test Write Access (Update exchange rate)
```sql
UPDATE platform_settings
SET 
  setting_value = jsonb_set(
    setting_value,
    '{exchangeRate}',
    '75.0'::jsonb
  ),
  updated_at = NOW(),
  updated_by = 'test'
WHERE setting_key = 'exchange_rate'
RETURNING *;
```

## What I Can Verify

With Supabase access, I can:

1. ✅ **Verify Migration**: Check if the migration script ran successfully
2. ✅ **Check Data Structure**: Ensure the JSONB structure matches expectations
3. ✅ **Test RLS Policies**: Verify read/write permissions are correct
4. ✅ **Verify Current Rate**: Check what exchange rate is currently stored
5. ✅ **Test Updates**: Verify that updates work correctly
6. ✅ **Check Indexes**: Ensure indexes are created for performance

## Security Note

⚠️ **Important**: 
- Never share your **Service Role Key** publicly
- The **Anon Key** is safe to share (it's public)
- Database password should be kept secret
- For verification, dashboard access is safest

## Current Configuration

Based on your code, you're using:
- **Supabase URL**: `https://ksdzzqdafodlstfkqzuv.supabase.co`
- **Table**: `platform_settings`
- **Setting Key**: `exchange_rate`
- **Expected Structure**: 
  ```json
  {
    "exchangeRate": 50.0,
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "updatedBy": "system"
  }
  ```

## Quick Verification Steps

1. **Go to Supabase Dashboard** → SQL Editor
2. **Run this query**:
   ```sql
   SELECT * FROM platform_settings WHERE setting_key = 'exchange_rate';
   ```
3. **Expected Result**: Should return one row with your exchange rate
4. **If empty**: Run the migration script again
5. **If error**: Check RLS policies and table permissions

## Need Help?

If you want me to verify:
1. Share your Supabase dashboard link (or give me read-only access)
2. Or share the results of the verification queries above
3. I can then confirm everything is set up correctly

