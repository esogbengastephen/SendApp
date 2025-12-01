# Referral Program Implementation Guide

## Overview

The referral program has been fully implemented with the following features:

1. **Automatic Referral Tracking** - Database automatically tracks referral counts
2. **Referral Code Email** - Users receive their referral code via email after signup
3. **Admin Dashboard** - Complete referral management in Settings tab
4. **Bulk Email System** - Send emails to users based on referral count

## Database Migration

### Step 1: Run the Migration

Run this SQL in your Supabase SQL Editor:
- Go to: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new
- Copy and paste the SQL from: `supabase/migrations/005_add_referral_tracking.sql`
- Click "Run"

This migration will:
- Add `referral_count` column to users table
- Create a trigger to automatically update referral counts when new users sign up
- Update existing users' referral counts based on current relationships

## How It Works

### User Signup Flow

1. User enters email and optional referral code
2. User verifies confirmation code
3. Account is created with unique referral code
4. **NEW**: User receives email with their referral code
5. If they used a referral code, the referrer's count is automatically incremented

### Referral Tracking

- Each user gets a unique referral code (8 characters, uppercase)
- When a new user signs up with a referral code:
  - The `referred_by` field stores the referrer's code
  - The referrer's `referral_count` is automatically incremented via database trigger
  - This happens instantly and automatically

## Admin Dashboard Features

### Access Referral Management

1. Go to Admin Dashboard → Settings tab
2. Scroll to "Referral Program" section

### Features Available

#### 1. Filter Users by Referral Count
- **Minimum Referrals**: Show users with at least X referrals
- **Maximum Referrals**: Show users with at most X referrals
- Click "Filter Users" to apply filters

#### 2. View Statistics
- **Total Users**: Number of users matching filters
- **Total Referrals**: Sum of all referrals from filtered users
- **Top Referrer**: User with most referrals

#### 3. View User Details
- See all users with their:
  - Email address
  - Referral code
  - Number of referrals
  - Send individual emails

#### 4. Send Bulk Emails
- **Email Subject**: Subject line for the email
- **Email Message**: Body of the email (supports plain text)
- **Send to Filtered Users**: Sends to all users matching current filters
- Emails include user's referral code and count automatically

### Example Use Cases

#### Reward Top Referrers
1. Set "Minimum Referrals" to 10
2. Click "Filter Users"
3. Fill in email subject and message
4. Click "Send to Filtered Users"
5. All users with 10+ referrals receive the reward email

#### Send Reminder to Low Performers
1. Set "Maximum Referrals" to 2
2. Click "Filter Users"
3. Send encouraging message to share their code

#### Target Specific Range
1. Set "Minimum Referrals" to 5
2. Set "Maximum Referrals" to 9
3. Filter and send targeted campaign

## API Endpoints

### Get Referral Data
```
GET /api/admin/referrals?minReferrals=5&maxReferrals=10&sortBy=referral_count&order=desc
```

### Send Bulk Email
```
POST /api/admin/referrals
{
  "minReferrals": 5,
  "maxReferrals": 10,
  "subject": "Congratulations!",
  "message": "You've referred 5+ users!",
  "emailList": ["user@example.com"] // Optional: specific emails
}
```

## Email Templates

### Referral Code Email (Automatic)
- Sent automatically after signup
- Includes user's unique referral code
- Beautiful HTML template matching platform design

### Bulk Email (Admin)
- Custom subject and message
- Automatically includes user's referral stats
- HTML formatted

## Database Schema

### Users Table (Updated)
```sql
- referral_code: TEXT UNIQUE NOT NULL (8 char code)
- referred_by: TEXT (referrer's code)
- referral_count: INTEGER DEFAULT 0 (auto-updated)
```

### Automatic Updates
- Trigger `trigger_update_referral_count` runs on user insert
- Automatically increments referrer's count
- No manual updates needed

## Testing

### Test Referral Flow
1. Sign up user A (no referral code)
2. Check email for referral code (e.g., "ABC12345")
3. Sign up user B with referral code "ABC12345"
4. Check user A's referral_count = 1
5. Check user B's referred_by = "ABC12345"

### Test Admin Dashboard
1. Go to Admin → Settings
2. Filter by referral count
3. Send test email to yourself
4. Verify email received with referral stats

## Troubleshooting

### Referral Count Not Updating
- Check if migration was run
- Verify trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_update_referral_count';`
- Manually update: Run the UPDATE query from migration

### Emails Not Sending
- Check Gmail SMTP configuration in `.env.local`
- Verify `GMAIL_USER` and `GMAIL_APP_PASSWORD` are set
- Check server logs for email errors

### Admin Dashboard Not Loading
- Verify you're logged in as admin
- Check browser console for errors
- Verify API routes are accessible

## Next Steps

### Potential Enhancements
1. **Referral Rewards**: Automatically distribute tokens based on referral count
2. **Referral Tiers**: Bronze, Silver, Gold tiers based on count
3. **Referral Analytics**: Charts and graphs for referral trends
4. **Referral Links**: Generate shareable links with referral code
5. **Referral Leaderboard**: Public leaderboard of top referrers

## Files Created/Modified

### New Files
- `supabase/migrations/005_add_referral_tracking.sql`
- `app/api/auth/send-referral-email/route.ts`
- `app/api/admin/referrals/route.ts`
- `app/api/admin/send-bulk-email/route.ts`

### Modified Files
- `app/api/auth/signup/route.ts` - Added referral email sending
- `app/admin/settings/page.tsx` - Added referral management UI

## Support

If you encounter any issues:
1. Check server logs for errors
2. Verify database migration was successful
3. Ensure Gmail SMTP is configured
4. Test with a single user first before bulk operations

