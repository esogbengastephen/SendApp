# Flutterwave Production Verification Checklist

## ✅ For www.flippay.app (Production)

### 1. Vercel Environment Variables

Go to **Vercel → Your Project → Settings → Environment Variables** and verify these are set:

#### Required Variables (V3 API):
```env
NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-b2e3e0c15403769810d628759060f295-X
FLUTTERWAVE_SECRET_KEY=FLWSECK-eec53179016e3dda8741fc3298654d55-19beb4cfe0avt-X
FLUTTERWAVE_WEBHOOK_SECRET_HASH=eec53179016eef6f10dc7c97
FLUTTERWAVE_USE_TEST_MODE=false
FLUTTERWAVE_FORCE_V3=true
```

**Important:**
- ✅ Make sure all variables are set for **Production** environment
- ✅ Also set for **Preview** and **Development** if you want consistency
- ✅ After adding/updating variables, **redeploy** your application

### 2. Test Production Configuration

Visit: `https://www.flippay.app/api/test/flutterwave-env`

**Expected Results:**
- ✅ `"apiVersion": "v3 (Bearer Token)"`
- ✅ `"useTestMode": false`
- ✅ `"apiBaseUrl": "https://api.flutterwave.com/v3"`
- ✅ All API tests should pass (balance, virtual account, transfer endpoints)

### 3. Flutterwave Dashboard Configuration

#### Webhook Setup:
1. Go to: https://dashboard.flutterwave.com/settings/webhooks
2. **Live Webhooks** section:
   - ✅ URL: `https://www.flippay.app/api/flutterwave/webhook`
   - ✅ Secret Hash: `eec53179016eef6f10dc7c97` (verify this matches)
   - ✅ Events subscribed:
     - `charge.success`
     - `charge.completed`
     - `virtualaccountpayment`
     - `transfer.completed`
     - `transfer.failed`
     - `refund.completed`
   - ✅ **"Add meta to webhook"** is **CHECKED** (critical!)

#### API Keys Verification:
1. Go to: https://dashboard.flutterwave.com/settings/api-keys
2. **Live API Keys** section:
   - ✅ Verify your Public Key: `FLWPUBK-b2e3e0c15403769810d628759060f295-X`
   - ✅ Verify your Secret Key: `FLWSECK-eec53179016e3dda8741fc3298654d55-19beb4cfe0avt-X`

### 4. Test a Payment

1. Go to: https://www.flippay.app
2. Try making a small test payment
3. Check:
   - ✅ Payment link is generated
   - ✅ Redirects to Flutterwave checkout
   - ✅ After payment, redirects back to callback
   - ✅ Transaction is found and processed
   - ✅ Tokens are distributed (if payment successful)

### 5. Check Vercel Logs

After a test payment, check Vercel logs:
1. Go to: Vercel Dashboard → Your Project → Logs
2. Look for:
   - ✅ `[Flutterwave] Using v3 API (Bearer Token) - PRODUCTION`
   - ✅ `[Flutterwave Payment] Initializing payment...`
   - ✅ `[Flutterwave Webhook]` messages (if webhook received)
   - ❌ No 401 Unauthorized errors
   - ❌ No "Invalid client credentials" errors

### 6. Webhook Verification

Test webhook endpoint:
- Visit: `https://www.flippay.app/api/flutterwave/webhook-status`
- Should show webhook configuration status

## 🔧 Troubleshooting

### If you see "401 Unauthorized":
1. ✅ Verify `FLUTTERWAVE_SECRET_KEY` is correct in Vercel
2. ✅ Check for extra spaces in the key
3. ✅ Make sure `FLUTTERWAVE_USE_TEST_MODE=false`
4. ✅ Redeploy after updating environment variables

### If you see "v4 authentication failed":
1. ✅ Set `FLUTTERWAVE_FORCE_V3=true` in Vercel
2. ✅ Remove or don't set `FLW_CLIENT_ID` and `FLW_CLIENT_SECRET` if using v3
3. ✅ Redeploy after updating

### If webhook not working:
1. ✅ Verify webhook URL in Flutterwave dashboard
2. ✅ Check `FLUTTERWAVE_WEBHOOK_SECRET_HASH` matches dashboard
3. ✅ Ensure "Add meta to webhook" is checked
4. ✅ Check Vercel logs for webhook requests

## 📝 Quick Reference

**Production API Base URL:** `https://api.flutterwave.com/v3`  
**Webhook URL:** `https://www.flippay.app/api/flutterwave/webhook`  
**Test Endpoint:** `https://www.flippay.app/api/test/flutterwave-env`
