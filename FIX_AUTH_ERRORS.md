# Fix Authentication Errors

## Common Error: "Invalid Supabase API key"

This error is often **misleading**. The actual issue is usually one of these:

### 1. RLS (Row Level Security) Policy Error (Most Common)

**Symptoms:**
- Error message says "Invalid API key" but your key is correct
- Error code: `42501` or message contains "row-level security" or "policy"

**Solution:**
Run the RLS fix migration in Supabase SQL Editor:

1. Go to: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new
2. Copy the SQL from: `supabase/migrations/004_complete_rls_fix.sql`
3. Paste and click "Run"

### 2. Missing Service Role Key

**Symptoms:**
- User creation fails even with correct anon key
- Server logs show "WARNING: SUPABASE_SERVICE_ROLE_KEY not set"

**Solution:**
Add service role key to `.env.local`:

```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Get it from: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/settings/api

**Note:** The service role key bypasses RLS policies. If you don't have it, make sure RLS policies allow public insert (see solution #1).

### 3. Database Tables Not Created

**Symptoms:**
- Error code: `42P01` or message contains "does not exist"

**Solution:**
Run the migration to create tables:

1. Go to: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new
2. Copy the SQL from: `supabase/migrations/002_create_auth_tables.sql`
3. Paste and click "Run"

### 4. Actual API Key Error

**Symptoms:**
- Error code: `PGRST301` or `PGRST302`
- Message explicitly says "Invalid API key"

**Solution:**
1. Check your `.env.local` file has:
   ```bash
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. Get the correct key from: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/settings/api

3. Make sure there are no quotes or spaces around the key

4. Restart your dev server after updating

## Diagnostic Steps

### Step 1: Check Server Console Logs

When you try to sign up, check your server console. You should see:

```
[Auth] ========== FULL ERROR DETAILS ==========
[Auth] Error code: ...
[Auth] Error message: ...
[Auth] ========================================
```

This will tell you the **actual error**, not the misleading "Invalid API key" message.

### Step 2: Run Diagnostic Script

```bash
node scripts/diagnose-auth-issue.js
```

This will check:
- Environment variables
- Database table access
- RLS policies
- Insert permissions

### Step 3: Verify RLS Policies

1. Go to Supabase Dashboard → Authentication → Policies
2. Check that `users` table has:
   - ✅ "Allow public read access" policy
   - ✅ "Allow public insert for signup" policy
   - ✅ "Allow public update" policy

If these are missing, run the RLS fix migration.

## Quick Fix Checklist

- [ ] Run `supabase/migrations/002_create_auth_tables.sql` (if tables don't exist)
- [ ] Run `supabase/migrations/004_complete_rls_fix.sql` (fix RLS policies)
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (optional but recommended)
- [ ] Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct in `.env.local`
- [ ] Restart dev server after changes
- [ ] Check server console for actual error details

## Still Having Issues?

1. **Check server console** - Look for the detailed error logs
2. **Run diagnostic script** - `node scripts/diagnose-auth-issue.js`
3. **Verify in Supabase** - Check tables and policies exist
4. **Test with test script** - `node scripts/test-supabase-connection.js`

The improved error handling will now show you the **actual error** instead of the misleading "Invalid API key" message.

