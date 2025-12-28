# Troubleshooting Authentication Issues

## Error: "Failed to generate confirmation code"

This error typically occurs when the database tables haven't been created yet. Follow these steps:

### Step 1: Run the Database Migration

1. **Go to Supabase SQL Editor**
   - Navigate to: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new
   - Or: Dashboard → SQL Editor → New Query

2. **Copy the Migration SQL**
   - Open `supabase/migrations/002_create_auth_tables.sql`
   - Copy the entire SQL content

3. **Paste and Run**
   - Paste the SQL into the Supabase SQL Editor
   - Click "Run" or press Cmd+Enter (Mac) / Ctrl+Enter (Windows)
   - Wait for "Success. No rows returned" message

4. **Verify Tables Were Created**
   - Go to Table Editor in Supabase
   - Check that these tables exist:
     - `users`
     - `confirmation_codes`

### Step 2: Check RLS Policies

If tables exist but you still get errors:

1. **Go to Authentication → Policies in Supabase**
2. **Verify policies exist for:**
   - `confirmation_codes` table
   - `users` table

3. **If policies are missing**, the migration should have created them. Re-run the migration.

### Step 3: Check Console Logs

If the error persists:

1. **Check browser console** (F12 → Console tab)
2. **Check server logs** (terminal where `npm run dev` is running)
3. **Look for specific error messages** like:
   - "Table does not exist" → Migration not run
   - "Permission denied" → RLS policy issue
   - "Connection error" → Supabase credentials issue

### Step 4: Verify Supabase Connection

Check your `.env.local` file has:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ksdzzqdafodlstfkqzuv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### Common Error Codes

- **42P01**: Table does not exist → Run migration
- **42501**: Permission denied → Check RLS policies
- **PGRST116**: Not found (this is OK for "maybeSingle" queries)
- **Connection errors**: Check Supabase URL and keys

### Still Having Issues?

1. **Restart the dev server**: `npm run dev`
2. **Clear browser cache** and try again
3. **Check Supabase dashboard** for any service issues
4. **Verify migration ran successfully** in Supabase SQL Editor history

