# 🔧 Fix Flutterwave Authentication Error (401 Unauthorized)

## Problem
You have **production keys** but the system is trying to use them with the **sandbox/test API**, causing authentication failures.

## ✅ Solution: Use Test Keys (Recommended for Development)

### Step 1: Get Test Keys from Flutterwave Dashboard

1. Go to: https://dashboard.flutterwave.com
2. Log in to your account
3. Click **"Settings"** → **"API"** or **"API Keys"**
4. Make sure you're viewing **"Test Mode Keys"** (not Live Mode)
5. Copy your **Test Secret Key** (should start with `FLWSECK_TEST_...`)
6. Copy your **Test Public Key** (should start with `FLWPUBK_TEST_...`)

### Step 2: Update Your `.env.local` File

Open your `.env.local` file and replace your current keys with the TEST keys:

```env
# Replace these with your TEST keys from Flutterwave dashboard
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST_your_actual_test_secret_key_here
NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST_your_actual_test_public_key_here

# Optional: Explicitly set test mode (already defaults to true in development)
FLUTTERWAVE_USE_TEST_MODE=true
```

**Important:**
- Make sure the keys start with `FLWSECK_TEST_` and `FLWPUBK_TEST_`
- No quotes needed around the keys
- No spaces around the `=` sign

### Step 3: Restart Your Server

```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 4: Test Again

Visit: `http://localhost:3002/api/test/flutterwave-env`

You should now see:
- ✅ `"appearsToBeTestKey": true`
- ✅ `"tests.balanceApi.success": true`
- ✅ `"summary.ready": true`

---

## Alternative Solution: Use Production API with Production Keys

If you want to use your production keys (not recommended for development):

1. Add this to your `.env.local`:
```env
FLUTTERWAVE_USE_TEST_MODE=false
```

2. Restart your server

**⚠️ Warning:** Only do this if you're ready for production. Test keys are safer for development.

---

## Quick Checklist

- [ ] Got test keys from Flutterwave dashboard (with "TEST" in the name)
- [ ] Updated `.env.local` with test keys
- [ ] Keys start with `FLWSECK_TEST_` and `FLWPUBK_TEST_`
- [ ] Restarted the dev server
- [ ] Test endpoint shows `"appearsToBeTestKey": true`
- [ ] Test endpoint shows `"balanceApi.success": true`

---

## Still Having Issues?

If you still see 401 errors after using test keys:

1. **Double-check the keys:**
   - Copy them again from the dashboard
   - Make sure you got the complete key (they're long!)
   - No extra spaces or characters

2. **Verify test mode:**
   - In Flutterwave dashboard, make sure you're viewing "Test Mode" keys
   - Not "Live Mode" keys

3. **Check server logs:**
   - Look for any error messages when the server starts
   - Should see: `[Flutterwave] Using TEST/SANDBOX API: ...`
