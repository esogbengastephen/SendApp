# Flutterwave Webhook Setup Guide

This guide will help you configure Flutterwave webhooks so your application can receive payment notifications automatically.

## 📋 Prerequisites

- Flutterwave account with API credentials
- Your application deployed and accessible via HTTPS (required for webhooks)
- Admin access to Flutterwave Dashboard

---

## 🔗 Step 1: Determine Your Webhook URL

Your webhook URL depends on where your application is hosted:

### If deployed on Vercel:
```
https://your-domain.vercel.app/api/flutterwave/webhook
```
or if you have a custom domain:
```
https://yourdomain.com/api/flutterwave/webhook
```

### If deployed elsewhere:
```
https://your-domain.com/api/flutterwave/webhook
```

**Important:** 
- ✅ Must use HTTPS (Flutterwave requires secure connections)
- ✅ Must be publicly accessible (no localhost)
- ✅ Must point to `/api/flutterwave/webhook` endpoint

---

## 🎯 Step 2: Configure Webhook in Flutterwave Dashboard

1. **Log in to Flutterwave Dashboard**
   - Go to [https://dashboard.flutterwave.com](https://dashboard.flutterwave.com)
   - Log in with your credentials

2. **Navigate to Webhooks Settings**
   - Click on **Settings** (gear icon) in the left sidebar
   - Click on **Webhooks** from the settings menu

3. **Add New Webhook**
   - Click **"Add Webhook"** or **"Create Webhook"** button
   - Enter your webhook URL (from Step 1)
   - Example: `https://your-domain.vercel.app/api/flutterwave/webhook`

4. **Select Events to Subscribe To**
   
   Your application handles the following events. **Select all of these:**
   
   ✅ **`charge.success`** - Payment successful (for on-ramp checkout payments)
   
   ✅ **`charge.failed`** - Payment failed
   
   ✅ **`virtualaccountpayment`** - Virtual account payment received (for NGN wallet deposits)
   
   ✅ **`transfer.completed`** - Transfer completed successfully
   
   ✅ **`transfer.failed`** - Transfer failed
   
   ✅ **`refund.completed`** or **`refund`** - Refund completed

5. **Set Webhook Secret Hash**
   - In the webhook settings, you'll see a field for **"Secret Hash"**
   - **Generate a strong random string** (at least 32 characters)
   - You can use an online generator or run this command:
     ```bash
     openssl rand -hex 32
     ```
   - **Save this secret hash** - you'll need it for Step 3
   - **Important:** Copy it immediately - Flutterwave won't show it again!

6. **Save the Webhook**
   - Click **"Save"** or **"Create Webhook"**
   - Flutterwave will send a test webhook to verify the URL is accessible

---

## 🔐 Step 3: Add Webhook Secret to Environment Variables

1. **Add to your `.env.local` file** (or your deployment platform's environment variables):

   ```bash
   FLUTTERWAVE_WEBHOOK_SECRET_HASH=your_secret_hash_from_step_2
   ```

   **Example:**
   ```bash
   FLUTTERWAVE_WEBHOOK_SECRET_HASH=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
   ```

2. **If deploying on Vercel:**
   - Go to your project settings
   - Navigate to **Environment Variables**
   - Add `FLUTTERWAVE_WEBHOOK_SECRET_HASH` with the value from Step 2
   - Make sure it's available for **Production**, **Preview**, and **Development** environments

3. **Redeploy your application** after adding the environment variable

---

## ✅ Step 4: Verify Webhook Setup

### Test the Webhook Endpoint

1. **Check if webhook is accessible:**
   ```bash
   curl -X POST https://your-domain.com/api/flutterwave/webhook \
     -H "Content-Type: application/json" \
     -H "verif-hash: test" \
     -d '{"event":"test","data":{}}'
   ```
   
   You should get a response (even if it's an error about invalid signature - that's expected without proper signature).

2. **Test with a real payment:**
   - Make a small test payment through your application
   - Check your application logs for webhook events
   - The webhook should automatically update the transaction status

### Check Webhook Logs in Flutterwave Dashboard

1. Go to **Settings → Webhooks**
2. Click on your webhook
3. View **"Webhook Logs"** or **"Event History"**
4. You should see:
   - ✅ **200 OK** responses for successful webhook deliveries
   - ❌ **4xx/5xx** errors if there are issues

---

## 🐛 Troubleshooting

### Webhook Not Receiving Events

1. **Check webhook URL is correct:**
   - Must be HTTPS (not HTTP)
   - Must be publicly accessible (test with curl or browser)
   - Must point to `/api/flutterwave/webhook`

2. **Check webhook secret hash:**
   - Ensure `FLUTTERWAVE_WEBHOOK_SECRET_HASH` is set correctly
   - Must match the secret hash in Flutterwave dashboard
   - Check for typos or extra spaces

3. **Check application logs:**
   - Look for `[Flutterwave Webhook]` log messages
   - Check for signature verification errors
   - Check for database connection errors

4. **Check Flutterwave webhook logs:**
   - Go to Flutterwave Dashboard → Settings → Webhooks
   - Check the webhook event history
   - Look for failed delivery attempts

### "Invalid Signature" Errors

- Ensure `FLUTTERWAVE_WEBHOOK_SECRET_HASH` matches the secret hash in Flutterwave dashboard
- The secret hash must be the same in both places
- If not set, the system falls back to `FLUTTERWAVE_SECRET_KEY`, but using a dedicated webhook secret is recommended

### "Transaction Not Found" Errors

- This usually means the webhook is working, but the transaction ID in metadata doesn't match
- Check that `transaction_id` is being sent correctly in the payment metadata
- Verify the transaction exists in your database before payment

### Webhook Receiving Events But Not Processing

1. **Check event types:**
   - Ensure you subscribed to the correct events in Flutterwave dashboard
   - Check that `event.event` matches what your code expects

2. **Check application logs:**
   - Look for `[Flutterwave Webhook] Event received:` messages
   - Check for any errors during processing

---

## 📝 Events Your Application Handles

| Event | Purpose | When It Fires |
|-------|---------|---------------|
| `charge.success` | On-ramp payment successful | User completes checkout payment |
| `charge.failed` | Payment failed | Payment attempt fails |
| `virtualaccountpayment` | Virtual account deposit | User deposits to their NGN wallet |
| `transfer.completed` | Transfer successful | Admin-initiated transfer completes |
| `transfer.failed` | Transfer failed | Admin-initiated transfer fails |
| `refund.completed` | Refund processed | Refund is completed |

---

## 🔒 Security Best Practices

1. **Always use HTTPS** for webhook URLs
2. **Use a dedicated webhook secret hash** (not your API secret key)
3. **Keep your secret hash secure** - never commit it to version control
4. **Verify webhook signatures** - your code already does this automatically
5. **Monitor webhook logs** regularly for suspicious activity
6. **Use environment variables** for all secrets

---

## 📚 Additional Resources

- [Flutterwave Webhooks Documentation](https://developer.flutterwave.com/docs/webhooks)
- [Flutterwave Dashboard](https://dashboard.flutterwave.com)
- [Webhook Signature Verification Guide](https://developer.flutterwave.com/docs/webhooks#verifying-webhook-signatures)

---

## ✅ Quick Checklist

- [ ] Webhook URL is HTTPS and publicly accessible
- [ ] Webhook URL points to `/api/flutterwave/webhook`
- [ ] All required events are subscribed in Flutterwave dashboard
- [ ] Webhook secret hash is generated and saved
- [ ] `FLUTTERWAVE_WEBHOOK_SECRET_HASH` is added to environment variables
- [ ] Application is redeployed with new environment variable
- [ ] Test payment confirms webhook is working
- [ ] Webhook logs show successful deliveries

---

**Need Help?** Check your application logs for `[Flutterwave Webhook]` messages to see what's happening.
