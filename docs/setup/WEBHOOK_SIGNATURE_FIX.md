# Fix Flutterwave Webhook Signature Mismatch

## Problem
You're seeing this error in Vercel logs:
```
[Flutterwave] Signature mismatch. Expected (base64): ..., Received: X65zrW7VKNK+DyfwFFsZ...
[Flutterwave Webhook] Invalid signature
```

This means Flutterwave IS sending webhooks to your server, but the signature verification is failing.

## Root Cause
The `FLUTTERWAVE_WEBHOOK_SECRET_HASH` in Vercel environment variables doesn't match the secret hash configured in your Flutterwave Dashboard.

## Solution

### Step 1: Get the Secret Hash from Flutterwave Dashboard

1. Log in to [Flutterwave Dashboard](https://dashboard.flutterwave.com)
2. Go to **Settings** → **Webhooks**
3. Find your webhook URL: `https://www.flippay.app/api/flutterwave/webhook`
4. Look for the **"Secret hash"** field (it's usually shown when you click on the webhook or in webhook settings)
5. **Copy the entire secret hash** (it's a long string)

### Step 2: Update Vercel Environment Variable

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (`flippay.app` or similar)
3. Go to **Settings** → **Environment Variables**
4. Find `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
5. **Update it** with the exact secret hash from Flutterwave Dashboard
   - ⚠️ **Important**: Copy it exactly - no extra spaces, no line breaks
   - The secret hash should be a single continuous string
6. Click **Save**
7. **Redeploy** your application (or wait for automatic redeploy)

### Step 3: Verify the Fix

1. Make a test payment
2. Check Vercel logs for:
   - ✅ `[Flutterwave] ✅ Signature verification successful`
   - ❌ Should NOT see `Signature mismatch` errors

### Step 4: Test Webhook Processing

After fixing the signature, test with a real payment or use the test endpoint:

```bash
POST https://www.flippay.app/api/test/flutterwave-webhook
Body: {"txRef": "FLW-xxx-xxx-xxx"}
```

## Common Mistakes

1. **Extra spaces**: Secret hash has leading/trailing spaces
   - Fix: Trim the secret hash before pasting

2. **Wrong secret hash**: Using API secret key instead of webhook secret hash
   - Fix: Use the webhook-specific secret hash from Dashboard > Settings > Webhooks

3. **Different environments**: Secret hash in test mode vs live mode
   - Fix: Ensure you're using the live mode secret hash for production

4. **Not redeploying**: Updated env var but didn't redeploy
   - Fix: Redeploy after updating environment variables

## Verification Checklist

- [ ] Secret hash copied from Flutterwave Dashboard > Settings > Webhooks
- [ ] `FLUTTERWAVE_WEBHOOK_SECRET_HASH` updated in Vercel
- [ ] No extra spaces or line breaks in the secret hash
- [ ] Application redeployed after updating env var
- [ ] Test payment made and webhook processed successfully
- [ ] Vercel logs show "Signature verification successful"

## Still Having Issues?

If signature verification still fails after following these steps:

1. **Double-check the secret hash**:
   - In Flutterwave Dashboard, regenerate the secret hash if needed
   - Copy it fresh and update Vercel again

2. **Check Vercel logs** for the exact error:
   - Look for the "Expected" vs "Received" signature comparison
   - Verify the secret hash length matches

3. **Test with diagnostic endpoint**:
   ```
   GET https://www.flippay.app/api/test/webhook-test
   ```
   This will show if the secret hash is configured correctly

4. **Contact Flutterwave support** if the secret hash in dashboard seems incorrect

## Related Files

- Webhook handler: `app/api/flutterwave/webhook/route.ts`
- Signature verification: `lib/flutterwave.ts` → `verifyWebhookSignature()`
- Test endpoint: `app/api/test/flutterwave-webhook/route.ts`
- Diagnostic endpoint: `app/api/test/webhook-test/route.ts`
