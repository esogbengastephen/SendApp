# Vercel Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Database Setup
- [ ] Create Supabase project (if not already done)
- [ ] Run migration script: `supabase/migrations/001_create_platform_settings.sql`
- [ ] Verify `platform_settings` table exists in Supabase
- [ ] Verify default exchange rate was inserted

### 2. Environment Variables
- [ ] `PAYSTACK_SECRET_KEY` - Your Paystack secret key
- [ ] `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` - Your Paystack public key
- [ ] `LIQUIDITY_POOL_PRIVATE_KEY` - Private key for token distribution
- [ ] `NEXT_PUBLIC_SEND_TOKEN_ADDRESS` - SEND token contract address
- [ ] `NEXT_PUBLIC_BASE_RPC_URL` - Base network RPC URL
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- [ ] `NEXT_PUBLIC_ADMIN_WALLETS` - Comma-separated admin wallet addresses
- [ ] `SEND_NGN_EXCHANGE_RATE` - Default exchange rate (optional, defaults to 50)

### 3. Code Changes
- [x] Settings now use Supabase instead of file system
- [x] All API routes updated to use async functions
- [x] Migration script created
- [x] Deployment guide created

### 4. Testing
- [ ] Test exchange rate API: `/api/rate`
- [ ] Test admin dashboard: `/admin`
- [ ] Test updating exchange rate in admin dashboard
- [ ] Verify rate persists after page refresh
- [ ] Test payment flow end-to-end

## 🚀 Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "feat: Migrate settings to Supabase for Vercel deployment"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Add all environment variables
   - Deploy

3. **Run Database Migration**
   - Go to Supabase SQL Editor
   - Run `supabase/migrations/001_create_platform_settings.sql`

4. **Verify Deployment**
   - Check `/api/rate` endpoint
   - Test admin dashboard
   - Verify settings persist

## 📝 Post-Deployment

- [ ] Update Paystack webhook URL to point to Vercel domain
- [ ] Test webhook integration
- [ ] Set up monitoring/alerts
- [ ] Configure custom domain (optional)

## 🔧 Troubleshooting

### Settings not persisting?
- Check Supabase connection
- Verify table exists
- Check Vercel logs for errors

### Build failing?
- Check all environment variables are set
- Verify Supabase credentials are correct
- Check build logs in Vercel dashboard

