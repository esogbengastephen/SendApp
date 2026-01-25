# Flutterwave Webhook Setup Verification Checklist

Based on [Flutterwave's official documentation](https://developer.flutterwave.com/docs/webhooks), use this checklist to verify your webhook is configured correctly.

## ✅ Critical Requirements

### 1. Webhook URL Configuration
- [ ] Webhook URL is set in Flutterwave Dashboard → Settings → Webhooks
- [ ] URL is: `https://www.flippay.app/api/flutterwave/webhook` (or `https://flippay.app/api/flutterwave/webhook`)
- [ ] URL uses HTTPS (required by Flutterwave)
- [ ] URL is publicly accessible (not localhost)

### 2. Event Subscriptions
According to Flutterwave docs, you must subscribe to these events:
- [ ] `charge.completed` - Payment successful (ON-RAMP payments)
- [ ] `charge.failed` - Payment failed
- [ ] `virtualaccountpayment` - Virtual account payment received (NGN wallet deposits)
- [ ] `transfer.completed` - Transfer completed successfully
- [ ] `transfer.failed` - Transfer failed
- [ ] `refund.completed` - Refund completed

**Important:** Make sure ALL boxes are checked in Flutterwave Dashboard → Settings → Webhooks

### 3. Metadata Configuration
- [ ] **"Add meta to webhook"** is ENABLED in Flutterwave Dashboard
- [ ] This ensures `transaction_id`, `wallet_address`, and `user_id` are included in webhook payload
- [ ] Without this, the webhook won't have the metadata needed to find transactions

### 4. Webhook Secret Hash
- [ ] Secret hash is set in Flutterwave Dashboard → Settings → Webhooks
- [ ] Same secret hash is set in Vercel environment variables as `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
- [ ] Secret hash matches between Flutterwave dashboard and Vercel

### 5. Environment Variables in Vercel
Verify these are set in Vercel → Settings → Environment Variables:
- [ ] `FLUTTERWAVE_SECRET_KEY` - Your Flutterwave secret key
- [ ] `FLUTTERWAVE_WEBHOOK_SECRET_HASH` - **CRITICAL** - Must match Flutterwave dashboard
- [ ] `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY` - Your Flutterwave public key
- [ ] `FLUTTERWAVE_USE_TEST_MODE` - Set to `false` for production

## 🔍 How to Verify Webhook is Working

### Step 1: Check Webhook Endpoint is Accessible
Visit in browser:
```
https://www.flippay.app/api/flutterwave/webhook
```

You should see a JSON response indicating the endpoint is active (GET handler returns info).

### Step 2: Check Vercel Logs
1. Go to Vercel Dashboard → Your Project → Logs
2. Filter for `/api/flutterwave/webhook`
3. Look for:
   - `[Flutterwave Webhook] Event received: charge.completed`
   - `[Flutterwave Webhook] ✅ Signature verified successfully`
   - `[Flutterwave Webhook] On-ramp payment detected`

### Step 3: Test Payment Flow
1. Make a test payment
2. Check Vercel logs for webhook receipt
3. Check if transaction status updates to "completed"
4. Check if tokens are distributed

## 🚨 Common Issues

### Issue 1: Webhook Not Receiving Events
**Symptoms:**
- Payment successful on Flutterwave but not processed in app
- No webhook logs in Vercel

**Solutions:**
1. Verify webhook URL is correct in Flutterwave dashboard
2. Verify events are subscribed (all boxes checked)
3. Check if webhook URL is accessible (visit in browser)
4. Verify webhook retries are enabled in Flutterwave dashboard

### Issue 2: Signature Verification Failing
**Symptoms:**
- `[Flutterwave Webhook] Invalid signature` in logs
- Webhook returns 401

**Solutions:**
1. Verify `FLUTTERWAVE_WEBHOOK_SECRET_HASH` matches Flutterwave dashboard
2. Check if secret hash is set in both places
3. Redeploy after adding environment variable

### Issue 3: Transaction Not Found
**Symptoms:**
- `Transaction not found` error
- Webhook receives event but can't find transaction

**Solutions:**
1. Enable "Add meta to webhook" in Flutterwave dashboard
2. Verify metadata includes `transaction_id`, `wallet_address`, `user_id`
3. Check if transaction was created before payment (should be in database)

### Issue 4: Webhook Timeout
**Symptoms:**
- Webhook takes longer than 60 seconds
- Flutterwave retries webhook

**Solutions:**
1. Ensure webhook responds quickly (return 200 immediately)
2. Process token distribution asynchronously if needed
3. Check for slow database queries or API calls

## 📋 Quick Verification Commands

### Check Webhook Endpoint
```bash
curl https://www.flippay.app/api/flutterwave/webhook
```

Should return JSON with endpoint info.

### Check Environment Variables (via API)
Visit: `https://www.flippay.app/api/test/flutterwave-env`

Shows which environment variables are configured (without exposing values).

## 🔗 Flutterwave Dashboard Links

- **Webhook Settings:** https://dashboard.flutterwave.com/settings/webhooks
- **API Keys:** https://dashboard.flutterwave.com/settings/api-keys
- **Transactions:** https://dashboard.flutterwave.com/transactions

## 📚 References

- [Flutterwave Webhook Documentation](https://developer.flutterwave.com/docs/webhooks)
- [Flutterwave Best Practices](https://developer.flutterwave.com/docs/best-practices)
- [Flutterwave Idempotency](https://developer.flutterwave.com/docs/idempotency)
