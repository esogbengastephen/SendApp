# Flutterwave API Credentials Setup Guide

This guide will help you add Flutterwave API keys to your `.env.local` file so your app can create NGN virtual accounts and process payments.

---

## 📋 Step-by-Step Instructions

### Step 1: Get Your Flutterwave API Keys

1. **Go to Flutterwave Dashboard**
   - Visit: https://dashboard.flutterwave.com
   - Log in to your Flutterwave account

2. **Navigate to API Keys Section**
   - Click on **"Settings"** in the left sidebar
   - Click on **"API"** or **"API Keys"**
   - You'll see two sections:
     - **Test Mode Keys** (for development/testing)
     - **Live Mode Keys** (for production)

3. **For Development/Testing (Recommended First)**
   - Use **Test Mode Keys**
   - Copy your **Secret Key** (starts with `FLWSECK_TEST_...`)
   - Copy your **Public Key** (starts with `FLWPUBK_TEST_...`)

4. **For Production (After Testing)**
   - Switch to **Live Mode** in the dashboard
   - Copy your **Secret Key** (starts with `FLWSECK_...`)
   - Copy your **Public Key** (starts with `FLWPUBK_...`)

---

### Step 2: Add Keys to Your `.env.local` File

1. **Open your `.env.local` file**
   - Location: Root of your project (same folder as `package.json`)
   - If it doesn't exist, create it

2. **Add these lines to `.env.local`:**

```env
# ============================================
# Flutterwave API Credentials
# ============================================
# Get these from: https://dashboard.flutterwave.com/settings/api
# 
# For TEST/SANDBOX mode (development):
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST_your_test_secret_key_here
NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST_your_test_public_key_here

# For PRODUCTION mode (live):
# FLUTTERWAVE_SECRET_KEY=FLWSECK_your_live_secret_key_here
# NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_your_live_public_key_here

# Optional: Force test mode (set to "true" to always use sandbox)
# FLUTTERWAVE_USE_TEST_MODE=true
```

3. **Replace the placeholder values:**
   - Replace `FLWSECK_TEST_your_test_secret_key_here` with your actual test secret key
   - Replace `FLWPUBK_TEST_your_test_public_key_here` with your actual test public key
   - **Important:** Keep the quotes if your key has special characters, or remove them if not needed

4. **Example (what it should look like):**
```env
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-1234567890abcdef1234567890abcdef-X
NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-1234567890abcdef1234567890abcdef-X
```

---

### Step 3: Verify Your Setup

1. **Restart your development server:**
   ```bash
   # Stop the server (Ctrl+C) and restart
   npm run dev
   ```

2. **Test the API connection:**
   - Visit: `http://localhost:3000/api/test/flutterwave-env`
   - Or use curl:
     ```bash
     curl http://localhost:3000/api/test/flutterwave-env
     ```

3. **Check the response:**
   - Look for `"hasSecretKey": true` ✅
   - Look for `"hasPublicKey": true` ✅
   - Look for `"tests.balanceApi.success": true` ✅
   - Look for `"summary.ready": true` ✅

---

## 🔍 Understanding the Results

### ✅ Success Indicators

```json
{
  "credentials": {
    "hasSecretKey": true,        // ✅ Key is set
    "hasPublicKey": true,         // ✅ Key is set
    "appearsToBeTestKey": true,   // ✅ Using test keys
    "useTestMode": true           // ✅ Using sandbox
  },
  "tests": {
    "balanceApi": {
      "success": true,            // ✅ API connection works!
      "message": "✅ API connection successful"
    }
  },
  "summary": {
    "ready": true                 // ✅ Everything is working!
  }
}
```

### ❌ Common Issues & Solutions

#### Issue 1: Missing Credentials
**Symptoms:**
```json
{
  "credentials": {
    "hasSecretKey": false,  // ❌
    "hasPublicKey": false   // ❌
  }
}
```

**Solution:**
1. Check that `.env.local` file exists in the project root
2. Verify the variable names are exactly:
   - `FLUTTERWAVE_SECRET_KEY` (no typos)
   - `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY` (no typos)
3. Make sure there are **no spaces** around the `=` sign:
   - ✅ Correct: `FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST_...`
   - ❌ Wrong: `FLUTTERWAVE_SECRET_KEY = FLWSECK_TEST_...`
4. **Restart your dev server** after adding keys
5. Check that `.env.local` is not in `.gitignore` (it should be ignored, but the file should exist locally)

---

#### Issue 2: Authentication Failed
**Symptoms:**
```json
{
  "tests": {
    "balanceApi": {
      "success": false,
      "error": "Unauthorized",
      "status": 401
    }
  }
}
```

**Possible Causes & Solutions:**

**A. Wrong API Keys**
- ✅ **Solution:** Double-check you copied the keys correctly from Flutterwave dashboard
- Make sure there are no extra spaces or line breaks
- Verify you're using the correct mode (test vs live)

**B. Test Keys in Production Mode (or vice versa)**
- ✅ **Solution:** Make sure your keys match the environment:
  - Test keys should start with `FLWSECK_TEST_` and `FLWPUBK_TEST_`
  - Live keys should start with `FLWSECK_` and `FLWPUBK_` (no TEST)

**C. Keys from Wrong Account**
- ✅ **Solution:** Ensure you're using keys from the correct Flutterwave account

**D. Keys Have Expired or Been Regenerated**
- ✅ **Solution:** 
  1. Go to Flutterwave Dashboard → Settings → API
  2. Check if keys are still active
  3. If needed, regenerate keys and update `.env.local`

---

#### Issue 3: Network Errors
**Symptoms:**
```json
{
  "tests": {
    "balanceApi": {
      "success": false,
      "error": "Network Error" or "timeout"
    }
  }
}
```

**Solutions:**

**A. Check Internet Connection**
- ✅ Make sure you're connected to the internet
- Try visiting https://api.flutterwave.com in your browser

**B. Firewall/Proxy Issues**
- ✅ Check if your firewall is blocking outbound connections
- If using a corporate network, check proxy settings
- Try from a different network (mobile hotspot)

**C. Flutterwave API Status**
- ✅ Check Flutterwave status page: https://status.flutterwave.com
- The API might be temporarily down

---

## 🔑 Key Format Reference

### Test/Sandbox Keys Format:
```
Secret Key: FLWSECK_TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-X
Public Key: FLWPUBK_TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-X
```

### Production/Live Keys Format:
```
Secret Key: FLWSECK-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-X
Public Key: FLWPUBK-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-X
```

**Note:** The actual keys are much longer (usually 50+ characters)

---

## 📝 Complete `.env.local` Example

Here's what a complete `.env.local` file might look like with Flutterwave keys:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Flutterwave Configuration
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-1234567890abcdef1234567890abcdef-X
NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-1234567890abcdef1234567890abcdef-X

# Optional: Force test mode
FLUTTERWAVE_USE_TEST_MODE=true

# Other configurations...
# PAYSTACK_SECRET_KEY=...
# GMAIL_USER=...
# etc.
```

---

## 🚨 Security Best Practices

1. **Never commit `.env.local` to Git**
   - It should already be in `.gitignore`
   - Never share your secret keys publicly

2. **Use Test Keys for Development**
   - Always test with sandbox/test keys first
   - Only use live keys in production

3. **Rotate Keys Regularly**
   - Regenerate keys if you suspect they're compromised
   - Update `.env.local` immediately after regeneration

4. **For Production (Vercel/Deployment)**
   - Add keys in Vercel Dashboard → Project Settings → Environment Variables
   - Use production keys (not test keys)
   - Set `FLUTTERWAVE_USE_TEST_MODE=false` or remove it

---

## ✅ Verification Checklist

After adding your keys, verify:

- [ ] `.env.local` file exists in project root
- [ ] `FLUTTERWAVE_SECRET_KEY` is set (no quotes needed unless key has spaces)
- [ ] `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY` is set
- [ ] Keys are copied correctly (no extra spaces/characters)
- [ ] Dev server has been restarted
- [ ] Test endpoint shows `hasSecretKey: true`
- [ ] Test endpoint shows `hasPublicKey: true`
- [ ] Test endpoint shows `balanceApi.success: true`
- [ ] No authentication errors (401/403)

---

## 🆘 Still Having Issues?

1. **Check the test endpoint:**
   ```
   http://localhost:3000/api/test/flutterwave-env
   ```
   Look at the detailed error messages

2. **Check server console:**
   - Look for warnings like: `"FLUTTERWAVE_SECRET_KEY is not set"`
   - Check for any error messages

3. **Verify file location:**
   - `.env.local` must be in the **root** of your project
   - Same folder as `package.json`, `next.config.mjs`, etc.

4. **Check for typos:**
   - Variable names are case-sensitive
   - Must be exactly: `FLUTTERWAVE_SECRET_KEY` and `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY`

5. **Restart everything:**
   - Stop the dev server completely
   - Start it again: `npm run dev`

---

## 📚 Additional Resources

- **Flutterwave Dashboard:** https://dashboard.flutterwave.com
- **Flutterwave API Docs:** https://developer.flutterwave.com/docs
- **Flutterwave Support:** https://support.flutterwave.com

---

## 🎯 Quick Reference

**Where to get keys:**
→ https://dashboard.flutterwave.com/settings/api

**Test endpoint:**
→ http://localhost:3000/api/test/flutterwave-env

**Required variables:**
- `FLUTTERWAVE_SECRET_KEY`
- `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY`

**Optional variable:**
- `FLUTTERWAVE_USE_TEST_MODE=true` (forces test mode)
