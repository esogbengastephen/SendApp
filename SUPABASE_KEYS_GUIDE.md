# Supabase API Keys Guide

## Understanding Your Supabase Keys

Based on the keys you're seeing, you have:

1. **Publishable Key**: `sb_publishable_H95LrMNWcl8a5sQ1HUX5eQ_fLXOBpSS`
2. **Secret Key**: `sb_secret_5CgRFiJnzyw-teKxvJ_9Pg_9snnHwec`

## Which Key to Use

For this project, you need to find the **standard Supabase anon key** (JWT format).

### Option 1: Find the Standard Anon Key

1. Go to: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/settings/api
2. Look for a section called **"Project API keys"** or **"anon public"**
3. The anon key should:
   - Start with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Be a long JWT token
   - Be labeled as "anon" or "public"

### Option 2: If You Only See the New Format

If you only see keys starting with `sb_`, you might be using a newer Supabase version. In that case:

1. **Try using the Publishable Key** as the anon key
2. **Try using the Secret Key** as the service role key

Let me know which keys you see and I'll update the code accordingly.

## Current Setup

Your `.env.local` should have:

```bash
# Supabase URL
NEXT_PUBLIC_SUPABASE_URL=https://ksdzzqdafodlstfkqzuv.supabase.co

# Anon Key (standard JWT format)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: Service Role Key (for admin operations)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Quick Test

After setting the keys, restart your server and check the console. You should see:
- `[Supabase] ✅ Anon key loaded successfully`

If you see an error, the key format might be wrong.

