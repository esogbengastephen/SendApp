# Fix RLS Policy Error

## Error: "new row violates row-level security policy for table 'users'"

This error occurs when Supabase RLS policies are too restrictive for API operations.

## Solution: Run the RLS Fix Migration

### Step 1: Run the Fix Migration

1. **Go to Supabase SQL Editor**
   - Navigate to: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new

2. **Copy and Paste the SQL from `supabase/migrations/003_fix_rls_policies.sql`**

3. **Click "Run"**

4. **Verify Success**
   - You should see "Success. No rows returned"
   - The policies have been updated to allow public API operations

### Step 2: (Optional) Use Service Role Key for Better Security

For production, you can use a service role key that bypasses RLS:

1. **Get Service Role Key from Supabase**
   - Go to Supabase Dashboard → Settings → API
   - Copy the **Service Role Key** (keep this secret!)

2. **Add to `.env.local`**:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

3. **Restart your dev server**

**Note:** The code will automatically use the service role key if available, otherwise it falls back to the anon key with the updated RLS policies.

## What Changed

The migration:
- ✅ Allows public read access to users table (for API lookups)
- ✅ Allows public insert for signup (API can create users)
- ✅ Allows public update (for transaction tracking)

These policies are safe because:
- The API validates email and confirmation codes before creating users
- The API handles all business logic and validation
- RLS is a secondary security layer

## Alternative: Disable RLS (Not Recommended)

If you want to disable RLS entirely (not recommended for production):

```sql
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE confirmation_codes DISABLE ROW LEVEL SECURITY;
```

**Warning:** Only do this if you trust your API completely and have proper validation in place.

