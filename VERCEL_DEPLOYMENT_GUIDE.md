# Vercel Deployment Guide - Send Xino

## 🚀 Quick Deployment Steps

### Step 1: Deploy to Vercel

#### Option A: Using Vercel CLI (Recommended)

1. **Install Vercel CLI** (if not installed):
```bash
npm install -g vercel
```

2. **Login to Vercel**:
```bash
vercel login
```

3. **Deploy**:
```bash
cd "/Users/flash/Desktop/Send Xino"
vercel
```

4. **Follow the prompts**:
   - Link to existing project? → Choose existing or create new
   - Project name? → `send-xino` (or your preferred name)
   - Deploy? → Yes

5. **Deploy to Production**:
```bash
vercel --prod
```

#### Option B: Using Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Import from GitHub:
   - Repository: `esogbengastephen/SendApp`
   - Click "Import"
4. Configure project (see settings below)
5. Click "Deploy"

---

## ⚙️ Environment Variables (CRITICAL!)

After deployment, add these environment variables in Vercel:

### Go to: Project Settings → Environment Variables

**Add these one by one:**

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://ksdzzqdafodlstfkqzuv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Paystack Configuration
PAYSTACK_SECRET_KEY=your_paystack_secret_key

# Email Configuration (Gmail SMTP)
GMAIL_USER=lightblockofweb3@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
FROM_EMAIL=lightblockofweb3@gmail.com

# Blockchain Configuration
PRIVATE_KEY=your_private_key_here
NEXT_PUBLIC_RPC_URL=https://mainnet.base.org
TOKEN_CONTRACT_ADDRESS=0xBa5B9B2D2d06a9021EB3190ea5Fb0e02160839A4

# Admin Configuration
ADMIN_SECRET_KEY=your_admin_secret_key

# Node Environment
NODE_ENV=production
```

**Where to find these values:**
- Supabase keys: From your `.env.local` file
- Paystack key: Paystack Dashboard → Settings → API Keys
- Gmail password: From your `.env.local` file (app password)
- Private key: From your `.env.local` file
- Admin key: From your `.env.local` file

---

## 🔔 Step 2: Configure Paystack Webhook

### After deployment is complete:

1. **Get your Vercel URL** (e.g., `https://send-xino.vercel.app`)

2. **Go to Paystack Dashboard**:
   - URL: https://dashboard.paystack.com/#/settings/webhooks

3. **Add Webhook URL**:
   ```
   https://your-app-name.vercel.app/api/paystack/webhook
   ```
   Replace `your-app-name` with your actual Vercel domain

4. **Copy the Webhook Secret** (if shown) and add to Vercel env vars:
   ```bash
   PAYSTACK_WEBHOOK_SECRET=your_webhook_secret
   ```

5. **Test the webhook**:
   - Click "Test" in Paystack dashboard
   - Check Vercel logs for webhook events

---

## 📊 Step 3: Verify Deployment

### Check these in order:

1. **Visit your app**: `https://your-app-name.vercel.app`
   - Should load the main page ✅

2. **Test signup**:
   - Create a new account
   - Check if virtual account is created
   - Check Vercel logs for any errors

3. **Test payment flow**:
   - Enter wallet address + amount
   - Click "Generate Payment"
   - Send small test payment (e.g., 50 NGN)
   - Click "I have sent"
   - **Webhook should detect payment automatically** 🎉

4. **Check Vercel Logs**:
   - Go to Vercel Dashboard → Your Project → Logs
   - Look for webhook events
   - Check for any errors

---

## 🔍 Vercel Build Settings

### Framework Preset: `Next.js`

### Build Command:
```bash
npm run build
```

### Output Directory:
```
.next
```

### Install Command:
```bash
npm install
```

### Node Version: `18.x` or higher

---

## 🐛 Troubleshooting

### Issue: Build Fails

**Check:**
1. All environment variables are set in Vercel
2. Dependencies are in `package.json`
3. TypeScript compiles locally with `npm run build`

**Fix:**
- Check Vercel build logs
- Ensure `.env.local` values match Vercel env vars

---

### Issue: Webhook Not Receiving Events

**Check:**
1. Webhook URL is correct in Paystack
2. URL format: `https://your-domain.vercel.app/api/paystack/webhook`
3. Paystack webhook is active
4. Check Vercel function logs

**Test:**
```bash
# Test webhook manually from Paystack dashboard
# Or send test payment and check logs
```

---

### Issue: Environment Variables Not Working

**Fix:**
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Make sure all required variables are set
3. Redeploy after adding variables: `vercel --prod`

---

### Issue: Database Connection Fails

**Check:**
1. Supabase URL and keys are correct
2. Supabase project is active
3. RLS policies allow access

**Test:**
```bash
# Check Supabase connection in Vercel logs
# Look for "Supabase" or "database" errors
```

---

## 📝 Post-Deployment Checklist

- [ ] App deployed successfully to Vercel
- [ ] All environment variables added
- [ ] Webhook URL configured in Paystack
- [ ] Tested signup flow
- [ ] Tested virtual account creation
- [ ] Sent test payment (50 NGN)
- [ ] Webhook received payment
- [ ] Tokens distributed successfully
- [ ] Checked Vercel logs for errors
- [ ] Verified all features work

---

## 🎯 Expected Vercel URL Structure

After deployment:
```
Production: https://send-xino.vercel.app
Webhook:    https://send-xino.vercel.app/api/paystack/webhook
Admin:      https://send-xino.vercel.app/admin
Auth:       https://send-xino.vercel.app/auth
```

---

## 💡 Useful Vercel Commands

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs

# List projects
vercel ls

# Link to existing project
vercel link

# Pull environment variables
vercel env pull

# Check deployment status
vercel inspect [deployment-url]
```

---

## 🔐 Security Checklist

Before going live:

- [ ] Change all default passwords
- [ ] Rotate API keys if exposed
- [ ] Set up custom domain (optional)
- [ ] Enable Vercel authentication for admin routes
- [ ] Review RLS policies in Supabase
- [ ] Test with small amounts first
- [ ] Monitor webhook logs regularly

---

## 📞 Support

If deployment issues persist:
1. Check Vercel logs: Dashboard → Logs
2. Check Supabase logs: Supabase Dashboard → Logs
3. Check Paystack logs: Paystack Dashboard → Logs
4. Review error messages in browser console

---

## ✅ Success Indicators

Your deployment is successful when:

1. ✅ App loads at Vercel URL
2. ✅ Users can sign up and get virtual accounts
3. ✅ Payments to virtual accounts are detected
4. ✅ Tokens are distributed automatically
5. ✅ Admin dashboard is accessible
6. ✅ No errors in Vercel logs

---

**🎉 Once deployed, webhooks will work and payments will be processed automatically!**

**Deployment Date**: November 26, 2025  
**Status**: Ready to Deploy  
**Estimated Time**: 10-15 minutes

