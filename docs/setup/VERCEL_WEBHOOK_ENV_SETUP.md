# Flutterwave Webhook Environment Variables Setup for Vercel

## ⚠️ Critical: Webhook Won't Work Without This!

The Flutterwave webhook **requires** the `FLUTTERWAVE_WEBHOOK_SECRET_HASH` environment variable to be set in Vercel. Without it, webhook signature verification will fail and payments won't be processed automatically.

---

## 🔐 Required Environment Variables

You need to add **ALL** of these to Vercel:

### 1. Flutterwave API Keys
```env
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-X
NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-X
```

### 2. **CRITICAL: Webhook Secret Hash** ⚠️
```env
FLUTTERWAVE_WEBHOOK_SECRET_HASH=your_webhook_secret_hash_here
```

**This is the most important one for webhooks!** Without this, webhook signature verification will fail.

### 3. Optional: Test Mode
```env
FLUTTERWAVE_USE_TEST_MODE=false
```

---

## 📋 Step-by-Step: Add to Vercel

### Step 1: Get Your Webhook Secret Hash

1. **Go to Flutterwave Dashboard**
   - Visit: https://dashboard.flutterwave.com
   - Log in to your account

2. **Navigate to Webhook Settings**
   - Click **"Settings"** in the left sidebar
   - Click **"Webhooks"**

3. **Find Your Webhook Secret Hash**
   - Look for the webhook you configured for `https://flippay.app/api/flutterwave/webhook`
   - You'll see a **"Secret Hash"** field
   - **Copy this value** - it looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

   ⚠️ **If you don't see it or forgot it:**
   - You may need to regenerate it
   - Or check your `FLUTTERWAVE_ENV_LIVE_KEYS.txt` file if you saved it there

### Step 2: Add to Vercel Environment Variables

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com
   - Select your project (Send Xino / FlipPay)

2. **Navigate to Settings**
   - Click on your project
   - Go to **"Settings"** tab
   - Click **"Environment Variables"** in the left sidebar

3. **Add Each Variable**

   **a) Add `FLUTTERWAVE_SECRET_KEY`:**
   - Click **"Add New"**
   - **Key:** `FLUTTERWAVE_SECRET_KEY`
   - **Value:** Your Flutterwave secret key (from `FLUTTERWAVE_ENV_LIVE_KEYS.txt`)
   - **Environment:** Select **Production**, **Preview**, and **Development**
   - Click **"Save"**

   **b) Add `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY`:**
   - Click **"Add New"**
   - **Key:** `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY`
   - **Value:** Your Flutterwave public key (from `FLUTTERWAVE_ENV_LIVE_KEYS.txt`)
   - **Environment:** Select **Production**, **Preview**, and **Development**
   - Click **"Save"**

   **c) Add `FLUTTERWAVE_WEBHOOK_SECRET_HASH` (CRITICAL!):**
   - Click **"Add New"**
   - **Key:** `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
   - **Value:** Your webhook secret hash from Step 1
   - **Environment:** Select **Production**, **Preview**, and **Development**
   - Click **"Save"**

   **d) Add `FLUTTERWAVE_USE_TEST_MODE` (if needed):**
   - Click **"Add New"**
   - **Key:** `FLUTTERWAVE_USE_TEST_MODE`
   - **Value:** `false` (for production) or `true` (for testing)
   - **Environment:** Select **Production**, **Preview**, and **Development**
   - Click **"Save"**

### Step 3: Redeploy Your Application

After adding all environment variables:

1. **Go to Deployments tab**
2. **Click the three dots (⋯) on the latest deployment**
3. **Select "Redeploy"**
4. **Wait for deployment to complete**

---

## ✅ Verify Webhook is Working

### Check Webhook Logs

1. **Go to Vercel Dashboard**
2. **Click on your project**
3. **Go to "Logs" tab**
4. **Filter by:** `/api/flutterwave/webhook`
5. **Look for:**
   - ✅ `[Flutterwave Webhook] Event received: charge.success`
   - ✅ `[Flutterwave Webhook] Charge successful`
   - ❌ `[Flutterwave Webhook] Invalid signature` (means webhook secret is wrong)

### Test with a Payment

1. Make a test payment through your app
2. Check Vercel logs for webhook events
3. Check your database to see if transaction was updated

---

## 🔍 Troubleshooting

### Problem: "Invalid signature" in webhook logs

**Solution:**
- Check that `FLUTTERWAVE_WEBHOOK_SECRET_HASH` is set correctly in Vercel
- Make sure it matches the secret hash in Flutterwave dashboard
- Redeploy after adding the variable

### Problem: Webhook not receiving events

**Solution:**
1. Check Flutterwave dashboard → Settings → Webhooks
2. Verify webhook URL is: `https://flippay.app/api/flutterwave/webhook`
3. Make sure webhook is **enabled** (not paused)
4. Check that events are subscribed: `charge.success`, `virtualaccountpayment`, etc.

### Problem: Webhook returns 401 Unauthorized

**Solution:**
- This means signature verification failed
- Check that `FLUTTERWAVE_WEBHOOK_SECRET_HASH` is set in Vercel
- Verify the secret hash matches Flutterwave dashboard

---

## 📝 Quick Checklist

- [ ] `FLUTTERWAVE_SECRET_KEY` added to Vercel
- [ ] `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY` added to Vercel
- [ ] `FLUTTERWAVE_WEBHOOK_SECRET_HASH` added to Vercel ⚠️ **CRITICAL**
- [ ] `FLUTTERWAVE_USE_TEST_MODE` added to Vercel (if needed)
- [ ] All variables set for **Production**, **Preview**, and **Development**
- [ ] Application redeployed after adding variables
- [ ] Webhook URL configured in Flutterwave dashboard
- [ ] Webhook events subscribed in Flutterwave dashboard

---

## 💡 Important Notes

1. **Webhook Secret Hash is Different from API Secret Key**
   - The webhook secret hash is configured in Flutterwave dashboard (Settings → Webhooks)
   - It's used specifically for webhook signature verification
   - It's NOT the same as your API secret key

2. **Environment Variables Must Match**
   - The `FLUTTERWAVE_WEBHOOK_SECRET_HASH` in Vercel must match the one in Flutterwave dashboard
   - If they don't match, webhook signature verification will fail

3. **Redeploy After Adding Variables**
   - Vercel only reads environment variables during build/deployment
   - You must redeploy after adding new environment variables

---

## 🆘 Still Not Working?

If webhooks still don't work after following this guide:

1. **Check Vercel Logs:**
   - Look for webhook requests in the logs
   - Check for error messages

2. **Check Flutterwave Dashboard:**
   - Go to Settings → Webhooks
   - Check webhook delivery status
   - Look for failed deliveries

3. **Test Webhook Endpoint:**
   - Visit: `https://flippay.app/api/flutterwave/webhook`
   - Should return an error (not 404) - this confirms the route exists

4. **Contact Support:**
   - If still not working, check the webhook route code in `app/api/flutterwave/webhook/route.ts`
   - Verify signature verification logic in `lib/flutterwave.ts`
