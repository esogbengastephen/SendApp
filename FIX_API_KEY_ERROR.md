# Fix "Invalid API key" Error

## Error: "Failed to create user account: Invalid API key"

This error occurs when the Supabase API key is missing, invalid, or not properly configured.

## Quick Fix

### Step 1: Get Your Supabase Anon Key

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/settings/api

2. **Copy the Anon/Public Key**
   - Look for **"anon" "public"** key
   - Copy the entire key (it's a long JWT token)

### Step 2: Add to `.env.local`

Add or update this line in your `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key_here
```

**Important:** 
- Replace `your_actual_anon_key_here` with the key you copied
- Make sure there are no quotes around the key
- Make sure there are no spaces

### Step 3: Restart Your Dev Server

```bash
# Stop the server (Ctrl+C) and restart
npm run dev
```

## Verify Your Setup

Your `.env.local` should have at minimum:

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://ksdzzqdafodlstfkqzuv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Resend Email (Required for email sending)
RESEND_API_KEY=re_your_key_here
RESEND_FROM_EMAIL=onboarding@resend.dev
```

## Common Issues

### Issue 1: Key Contains "placeholder"
**Error:** Key has "placeholder" in it
**Fix:** You're using the default placeholder key. Get your real key from Supabase dashboard.

### Issue 2: Key Not Loading
**Error:** Environment variable not found
**Fix:** 
- Make sure the file is named `.env.local` (not `.env`)
- Make sure it's in the project root directory
- Restart your dev server after adding the key

### Issue 3: Wrong Key Type
**Error:** Invalid API key format
**Fix:** Make sure you're using the **anon/public** key, not the service_role key (unless you're setting up service role separately).

## Optional: Service Role Key (For Better Security)

If you want to use a service role key (bypasses RLS):

1. **Get Service Role Key** from Supabase Dashboard → Settings → API
2. **Add to `.env.local`**:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
3. **Restart server**

**Note:** Service role key is optional. The anon key will work with the updated RLS policies.

## Still Having Issues?

1. Check that your `.env.local` file is in the project root
2. Verify the key doesn't have extra spaces or quotes
3. Make sure you restarted the dev server
4. Check the server console for detailed error messages

