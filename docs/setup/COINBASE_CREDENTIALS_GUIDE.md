# How to Get Coinbase Developer Platform API Credentials

## Step-by-Step Guide

### Step 1: Log in to Coinbase Developer Platform

1. Go to **https://portal.cdp.coinbase.com/**
2. Sign in with your Coinbase account

### Step 2: Navigate to Your Project

1. Once logged in, you'll see your **Dashboard**
2. Click on your **Project** (or create a new one if you don't have one)
3. If you need to create a project:
   - Click **"Create Project"** or **"New Project"**
   - Enter a project name (e.g., "Send Xino Off-Ramp")
   - Select **Base** as the network
   - Click **"Create"**

### Step 3: Find Your App ID

1. In your project dashboard, look for:
   - **App ID** or **Application ID**
   - It's usually displayed at the top of the project page
   - Format: UUID like `c015d88f-a5a6-46a3-85ef-cb79866e6f83`
   - **Copy this value** - this is your `COINBASE_APP_ID`

### Step 4: Create or View API Keys

1. In your project, look for:
   - **"API Keys"** section in the sidebar
   - Or **"Settings"** → **"API Keys"**
   - Or **"Credentials"** → **"API Keys"**

2. You'll see a list of API keys (if any exist)

### Step 5: Create a New API Key (if you don't have one)

1. Click **"Create API Key"** or **"New API Key"** button
2. Fill in the details:
   - **Name**: Give it a descriptive name (e.g., "Send Xino Production")
   - **Signature Algorithm**: Choose **Ed25519** (recommended) or **ECDSA**
   - **Permissions**: Select the permissions you need:
     - ✅ **Wallet: Read**
     - ✅ **Wallet: Write** (for creating wallets)
     - ✅ **Transaction: Read**
     - ✅ **Transaction: Write** (for sending transactions)
3. Click **"Create"** or **"Generate"**

### Step 6: Copy Your API Key Credentials

**⚠️ IMPORTANT: You can only see the Private Key ONCE when you create it!**

After creating the API key, you'll see a screen with:

1. **API Key Name** (also called **Key ID** or **Key Name**):
   - This is a UUID or alphanumeric string
   - Example: `0f39e892-6f40-4642-b028-c22e4ccf25e3` or `Ed25519`
   - **Copy this** - this is your `COINBASE_API_KEY_NAME`

2. **Private Key** (also called **Secret Key** or **API Secret**):
   - This is a long base64-encoded string
   - Example: `oVfLwPKEUGuYwthKOqzlAxv3/7MU7CPsMLly8nX6jcSS1gJbzVK6MSjRxEicjx7d0koI7j3js+vo7FtOmmXXig==`
   - **⚠️ COPY THIS IMMEDIATELY** - you won't be able to see it again!
   - This is your `COINBASE_API_KEY_PRIVATE_KEY`

3. **Download or Copy both values**:
   - Some platforms offer a "Download" button
   - Or copy them to a secure location immediately

### Step 7: If You Already Have an API Key

If you already created an API key but didn't save the Private Key:

1. **You CANNOT retrieve the Private Key again** - it's only shown once
2. You have two options:
   - **Option A**: Create a new API key (recommended)
     - Follow Step 5 above
     - Make sure to copy the Private Key this time
   - **Option B**: Use an existing key if you have the Private Key saved somewhere

### Step 8: Verify Network Settings

1. In your project settings, check:
   - **Networks**: Make sure **Base** (or **Base Mainnet**) is enabled
   - **Base Sepolia** is for testnet (you might want this for testing)

### Step 9: Update Your .env.local File

Once you have all three values, update your `.env.local` file:

```bash
# Coinbase Developer Platform
COINBASE_API_KEY_NAME=your_api_key_name_here
COINBASE_API_KEY_PRIVATE_KEY="your_private_key_here"
COINBASE_APP_ID=your_app_id_here
COINBASE_PAYMASTER_ENABLED=true
```

**Important Notes:**
- Wrap the Private Key in quotes if it contains special characters (`/`, `+`, `=`)
- No spaces before or after the `=` sign
- Restart your dev server after updating

## Visual Guide Locations

### Where to Find Each Value:

1. **App ID**:
   - Project Dashboard → Top of page
   - Or: Project Settings → General → App ID

2. **API Key Name**:
   - Project → API Keys → List of keys → Key Name/ID column
   - Or: When creating a new key, shown on the creation screen

3. **Private Key**:
   - **ONLY shown when creating a new API key**
   - Cannot be retrieved later
   - Shown on the key creation confirmation screen

## Troubleshooting

### "I can't find the API Keys section"
- Look for: **Settings**, **Credentials**, **Security**, or **API** in the sidebar
- Different projects might have slightly different layouts

### "I lost my Private Key"
- You need to create a new API key
- The old key cannot be recovered
- Delete the old key and create a new one

### "My API key doesn't work"
- Verify the API Key Name matches exactly (case-sensitive)
- Verify the Private Key matches (no extra spaces)
- Check that Base network is enabled for your project
- Ensure the API key has the correct permissions

## Security Best Practices

1. **Never commit `.env.local` to git** (it should be in `.gitignore`)
2. **Store credentials securely** - use a password manager
3. **Rotate keys regularly** - create new keys periodically
4. **Use different keys for development and production**
5. **Limit permissions** - only grant what you need

## Need Help?

- Coinbase Developer Platform Docs: https://docs.cdp.coinbase.com/
- Support: Check the Coinbase Developer Platform dashboard for support links
