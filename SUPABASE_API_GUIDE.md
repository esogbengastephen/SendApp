# Supabase API Integration Guide

Based on the [Supabase API documentation](https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/api), this guide explains how to properly configure and use the Supabase REST API with Row Level Security (RLS).

## Understanding Supabase API Keys

According to Supabase documentation, the API is configured to work with PostgreSQL's Row Level Security (RLS). You have two types of keys:

### 1. Anon Key (Public Key)
- **Purpose**: Client-side operations, respects RLS policies
- **Location**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Format**: JWT token starting with `eyJ...`
- **Security**: Subject to RLS policies - can only do what policies allow

### 2. Service Role Key (Secret Key)
- **Purpose**: Server-side operations, bypasses RLS policies
- **Location**: `SUPABASE_SERVICE_ROLE_KEY`
- **Format**: JWT token starting with `eyJ...`
- **Security**: ⚠️ **Never expose this key** - it bypasses all RLS policies

## Current Issue: RLS Policy Blocking Insert

Your diagnostic shows:
- ✅ Read works (anon key can read)
- ❌ Insert fails (RLS blocks insert with anon key)

This is **expected behavior** when RLS policies don't allow public insert.

## Solution Options

### Option 1: Fix RLS Policies (Recommended for Public Signup)

Allow public insert through RLS policies:

1. **Go to Supabase SQL Editor**
   - https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new

2. **Run the RLS Fix Migration**
   - Copy SQL from: `supabase/migrations/004_complete_rls_fix.sql`
   - Paste and click "Run"
   - This creates policies that allow:
     - Public read access
     - Public insert (for signup)
     - Public update (for transaction tracking)

3. **Verify Policies**
   - Go to: Authentication → Policies
   - Check that `users` table has the new policies

**Why this works**: The anon key will now be able to insert users because RLS policies explicitly allow it.

### Option 2: Use Service Role Key (Recommended for Production)

Bypass RLS entirely using the service role key:

1. **Get Service Role Key**
   - Go to: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/settings/api
   - Copy the **Service Role Key** (keep it secret!)

2. **Add to `.env.local`**
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **Restart Server**
   ```bash
   npm run dev
   ```

**Why this works**: Service role key bypasses all RLS policies, allowing direct database access.

## How Our Code Handles This

The code in `lib/supabase.ts` automatically:

1. **Creates two clients**:
   - `supabase`: Uses anon key (respects RLS)
   - `supabaseAdmin`: Uses service role key if available, otherwise falls back to anon key

2. **Uses the right client**:
   - `lib/auth.ts` uses `supabaseAdmin` for user creation
   - If service role key is set → bypasses RLS ✅
   - If service role key is not set → uses anon key (needs RLS policies) ⚠️

## Best Practice Recommendation

For your use case (public signup), use **Option 1** (RLS policies):

✅ **Pros**:
- More secure (RLS still enforces rules)
- Works with anon key (no secret keys needed)
- Follows Supabase best practices
- API validates all inputs before database operations

❌ **Cons**:
- Requires RLS policies to be set up correctly

## Quick Fix Steps

1. **Run Diagnostic** (to confirm issue):
   ```bash
   node scripts/diagnose-auth-issue.js
   ```

2. **Fix RLS Policies**:
   - Go to: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new
   - Run: `supabase/migrations/004_complete_rls_fix.sql`

3. **Test Again**:
   ```bash
   node scripts/diagnose-auth-issue.js
   ```
   Should now show: ✅ Users table is accessible (insert)

4. **Try Signup**:
   - Go to `/auth`
   - Try signing up
   - Should work now!

## References

- [Supabase API Documentation](https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/api)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase API Keys](https://supabase.com/docs/guides/api/api-keys)

