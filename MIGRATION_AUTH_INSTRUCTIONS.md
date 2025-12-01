# Email Authentication Migration Instructions

## Step 1: Run the Database Migration

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new
   - Or navigate: Dashboard → SQL Editor → New Query

2. **Copy and Paste the SQL from `supabase/migrations/002_create_auth_tables.sql`**

3. **Click "Run" or press Cmd+Enter (Mac) / Ctrl+Enter (Windows)**

4. **Verify Success**
   - You should see "Success. No rows returned"
   - Go to Table Editor and verify:
     - `users` table exists
     - `confirmation_codes` table exists
   - Check that indexes were created

## Step 2: Set Up Email Service (Required for Production)

Email sending is now integrated with Resend SMTP. Follow these steps:

**Quick Setup (5 minutes):**
1. Sign up at [resend.com](https://resend.com) (free tier: 100 emails/day)
2. Get your API key from Resend dashboard → API Keys
3. Add to `.env.local`:
   ```bash
   RESEND_API_KEY=re_your_api_key_here
   RESEND_FROM_EMAIL=onboarding@resend.dev
   ```
4. Restart your dev server: `npm run dev`

**For detailed instructions, see [EMAIL_SETUP.md](./EMAIL_SETUP.md) or [QUICK_EMAIL_SETUP.md](./QUICK_EMAIL_SETUP.md)**

**Note:** If `RESEND_API_KEY` is not set, codes will be logged to console for development purposes.

## Step 3: Test the Authentication Flow

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to `/auth`**
   - Test signup with email
   - Test with optional referral code
   - Test login flow
   - Check console for confirmation codes (until email service is configured)

3. **Verify in Supabase:**
   - Check `users` table for new accounts
   - Check `confirmation_codes` table for generated codes

## Features Implemented

✅ Email-based authentication (no passwords)
✅ 6-digit confirmation codes (expires in 10 minutes)
✅ Referral code system (optional during signup)
✅ Clean, modern UI matching your design system
✅ Dark mode support
✅ Responsive design
✅ Integration with existing Supabase database
✅ Compatible with existing wallet-based user system

## Next Steps

- Configure email service for production
- Link email users with wallet addresses (when users connect wallets)
- Add user profile page
- Add referral tracking and rewards system

