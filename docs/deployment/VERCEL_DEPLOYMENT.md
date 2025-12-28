# Vercel Deployment Guide

This guide will help you deploy the Send Token Platform to Vercel.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. A Supabase project (sign up at [supabase.com](https://supabase.com))
3. All environment variables configured

## Step 1: Set Up Supabase Database

### 1.1 Create the Platform Settings Table

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the migration script from `supabase/migrations/001_create_platform_settings.sql`:

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

-- Enable Row Level Security (RLS)
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read access to everyone (for public API)
CREATE POLICY "Allow public read access" ON platform_settings
  FOR SELECT
  USING (true);

-- Policy: Allow insert/update only for authenticated users
CREATE POLICY "Allow authenticated write access" ON platform_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

### 1.2 Verify Table Creation

1. Go to **Table Editor** in Supabase
2. Verify that `platform_settings` table exists
3. Check that the default exchange rate was inserted

## Step 2: Configure Environment Variables in Vercel

### 2.1 Deploy to Vercel

1. Push your code to GitHub (if not already done)
2. Go to [vercel.com](https://vercel.com)
3. Click **Add New Project**
4. Import your GitHub repository
5. Configure the project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (or leave default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

### 2.2 Add Environment Variables

In your Vercel project settings, go to **Settings > Environment Variables** and add:

#### Required Variables:

```bash
# Paystack
PAYSTACK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...

# Blockchain
LIQUIDITY_POOL_PRIVATE_KEY=0x...
NEXT_PUBLIC_SEND_TOKEN_ADDRESS=0xEab49138BA2Ea6dd776220fE26b7b8E446638956
NEXT_PUBLIC_BASE_RPC_URL=https://base.llamarpc.com

# Supabase (for settings storage)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Admin
NEXT_PUBLIC_ADMIN_WALLETS=0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0

# Exchange Rate (default, can be overridden in admin dashboard)
SEND_NGN_EXCHANGE_RATE=50
```

#### Optional Variables:

```bash
# SendTag API (if using)
SEND_API_URL=https://api.send.it
SEND_API_KEY=your_api_key_here
```

### 2.3 Set Environment Variables for All Environments

Make sure to set these variables for:
- **Production**
- **Preview**
- **Development**

## Step 3: Deploy

1. Click **Deploy** in Vercel
2. Wait for the build to complete
3. Your app will be live at `https://your-project.vercel.app`

## Step 4: Verify Deployment

### 4.1 Test the Exchange Rate API

Visit: `https://your-project.vercel.app/api/rate`

You should see:
```json
{
  "success": true,
  "rate": 50,
  "currency": "NGN",
  "token": "SEND"
}
```

### 4.2 Test Admin Dashboard

1. Visit: `https://your-project.vercel.app/admin`
2. Connect your wallet
3. Verify you can access the settings page
4. Try updating the exchange rate
5. Verify it persists (refresh the page)

### 4.3 Check Supabase

1. Go to your Supabase dashboard
2. Check the `platform_settings` table
3. Verify the exchange rate was saved after updating in admin dashboard

## Important Notes

### Why Supabase Instead of File Storage?

- **Vercel is serverless**: Each function invocation runs on a different instance
- **File system is ephemeral**: Files written in one invocation won't exist in the next
- **Supabase is persistent**: Database storage works across all serverless invocations
- **Better performance**: Database queries are faster than file I/O in serverless

### Caching Strategy

The settings system uses in-memory caching (5 minutes) to reduce database calls:
- First request: Loads from Supabase
- Subsequent requests: Uses cached value
- After 5 minutes: Refreshes from Supabase

### Troubleshooting

#### Issue: Exchange rate not persisting

**Solution**: 
1. Check Supabase connection (verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
2. Verify `platform_settings` table exists
3. Check Vercel function logs for errors

#### Issue: "Table not found" error

**Solution**: Run the migration SQL script in Supabase SQL Editor

#### Issue: Rate limit errors from Supabase

**Solution**: 
- Upgrade your Supabase plan
- Or implement additional caching
- Or use Vercel KV (Redis) as an alternative

## Alternative: Using Vercel KV (Optional)

If you prefer not to use Supabase, you can use Vercel KV (Redis):

1. Install Vercel KV in your Vercel project
2. Update `lib/settings.ts` to use KV instead of Supabase
3. KV provides similar persistence with Redis backend

## Next Steps

1. Set up custom domain (optional)
2. Configure webhook URLs in Paystack to point to your Vercel domain
3. Set up monitoring and alerts
4. Configure CI/CD for automatic deployments

