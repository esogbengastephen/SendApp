# Testing Flutterwave API Connection

## ✅ Quick Test Steps

### Step 1: Restart Your Server
After adding the API keys to `.env.local`, you **must** restart your development server:

```bash
# Stop the server (press Ctrl+C)
# Then start it again:
npm run dev
```

### Step 2: Test the API Connection

**Option A: Using Browser (Easiest)**
1. Open your browser
2. Visit: `http://localhost:3000/api/test/flutterwave-env`
3. You should see a JSON response with test results

**Option B: Using Terminal**
```bash
curl http://localhost:3000/api/test/flutterwave-env
```

**Option C: Using Browser DevTools**
1. Open browser console (F12)
2. Run:
```javascript
fetch('http://localhost:3000/api/test/flutterwave-env')
  .then(r => r.json())
  .then(console.log)
```

---

## 📊 What to Look For

### ✅ Success Response Example:
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "credentials": {
    "hasSecretKey": true,        // ✅ Key is set
    "hasPublicKey": true,         // ✅ Key is set
    "appearsToBeTestKey": true,   // ✅ Using test keys
    "useTestMode": true           // ✅ Using sandbox
  },
  "allSet": true,                 // ✅ Both keys configured
  "tests": {
    "balanceApi": {
      "success": true,            // ✅ API connection works!
      "message": "✅ API connection successful - Balance retrieved",
      "balance": {
        "currency": "NGN",
        "availableBalance": "0.00",
        "ledgerBalance": "0.00"
      }
    },
    "webhookSignature": {
      "success": true,            // ✅ Webhook verification works!
      "message": "✅ Webhook signature verification working"
    },
    "virtualAccountEndpoint": {
      "success": true,            // ✅ Virtual account API accessible
      "message": "✅ Virtual account endpoint accessible"
    },
    "transferEndpoint": {
      "success": true,            // ✅ Transfer API accessible
      "message": "✅ Transfer endpoint accessible"
    }
  },
  "summary": {
    "totalTests": 5,
    "passedTests": 5,
    "overallStatus": "✅ All tests passed",
    "ready": true                  // ✅ Everything is working!
  }
}
```

---

## ❌ Common Issues & Quick Fixes

### Issue: `hasSecretKey: false` or `hasPublicKey: false`

**Problem:** Keys not found in `.env.local`

**Fix:**
1. Check `.env.local` file exists in project root
2. Verify variable names are exactly:
   - `FLUTTERWAVE_SECRET_KEY` (no typos, case-sensitive)
   - `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY` (no typos, case-sensitive)
3. Make sure no spaces around `=`
4. **Restart server** after adding keys

---

### Issue: `balanceApi.success: false` with error "Unauthorized" or status 401/403

**Problem:** API keys are wrong or don't match the environment

**Fix:**
1. **Double-check keys:**
   - Go to Flutterwave Dashboard → Settings → API
   - Copy keys again (they're long - make sure you got everything)
   - Paste into `.env.local` (no extra spaces)

2. **Match test vs production:**
   - Test keys should start with: `FLWSECK_TEST_` and `FLWPUBK_TEST_`
   - Live keys should start with: `FLWSECK_` and `FLWPUBK_` (no TEST)
   - Make sure keys match the mode you're using

3. **Check if keys are active:**
   - In Flutterwave Dashboard, verify keys haven't been revoked
   - If you regenerated keys, use the new ones

---

### Issue: Network Error or Timeout

**Problem:** Can't reach Flutterwave servers

**Fix:**
1. Check internet connection
2. Try visiting https://api.flutterwave.com in browser
3. Check firewall/proxy settings
4. Check Flutterwave status: https://status.flutterwave.com

---

## 🎯 Expected Results After Adding Keys

Once you've added the keys correctly and restarted the server, you should see:

- ✅ `hasSecretKey: true`
- ✅ `hasPublicKey: true`
- ✅ `balanceApi.success: true`
- ✅ `summary.ready: true`

If all these are `true`, your Flutterwave API is working! 🎉

---

## 📝 Your Current Status

After adding your keys, test now:

1. **Restart server** (if you haven't already)
2. **Visit:** `http://localhost:3000/api/test/flutterwave-env`
3. **Share the results** - I can help interpret them!

---

## 🔍 Debugging Tips

If something's not working:

1. **Check server console:**
   - Look for warnings like: `"FLUTTERWAVE_SECRET_KEY is not set"`
   - Check for any error messages

2. **Verify file location:**
   - `.env.local` must be in project root
   - Same folder as `package.json`

3. **Check for typos:**
   - Variable names are case-sensitive
   - Must be exactly: `FLUTTERWAVE_SECRET_KEY` and `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY`

4. **Restart everything:**
   - Stop server completely
   - Start again: `npm run dev`
