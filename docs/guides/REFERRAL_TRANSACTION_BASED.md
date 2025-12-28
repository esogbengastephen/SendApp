# Referral System Update: Transaction-Based Counting

## Overview

The referral system has been updated so that referral codes only count when the referred user **completes a transaction** (makes a payment), not just when they sign up.

## What Changed

### Before
- Referral count incremented immediately when a new user signs up with a referral code
- Trigger: `trigger_update_referral_count` on `users` table (on INSERT)

### After
- Referral count increments only when the referred user completes their **first transaction**
- Trigger: `trigger_update_referral_count_on_transaction` on `transactions` table (on INSERT/UPDATE when status becomes 'completed')
- Each referred user counts only once (on their first completed transaction)

## Database Migration

**File**: `supabase/migrations/013_update_referral_counting_to_transactions.sql`

### Changes Made:
1. **Dropped old trigger** that incremented on user signup
2. **Created new function** `update_referral_count_on_transaction()` that:
   - Checks if transaction status changed to 'completed'
   - Verifies if user was referred (has `referred_by` code)
   - Checks if this is the user's first completed transaction
   - Increments referrer's count only if it's the first transaction
3. **Created new trigger** on `transactions` table
4. **Recalculated existing referral counts** based on completed transactions only

### To Apply Migration:

Run the SQL in your Supabase SQL Editor:
1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
2. Copy and paste the contents of `supabase/migrations/013_update_referral_counting_to_transactions.sql`
3. Click "Run"

## Code Changes

### 1. Helper Function (`lib/supabase.ts`)
- Added `updateReferralCountOnTransaction()` function
- Called as a backup to ensure referral counting works even if trigger fails
- Checks if transaction is user's first completed transaction before incrementing

### 2. Process Payment Route (`app/api/paystack/process-payment/route.ts`)
- Added call to `updateReferralCountOnTransaction()` after transaction is marked as completed
- Ensures referral count is updated when payment is verified

### 3. Webhook Route (`app/api/paystack/webhook/route.ts`)
- Added call to `updateReferralCountOnTransaction()` after transaction is marked as completed
- Ensures referral count is updated when webhook confirms payment

## How It Works

### Flow:
1. User A signs up with User B's referral code
   - User A's `referred_by` field is set to User B's referral code
   - **No referral count increment yet**

2. User A makes their first payment
   - Transaction is created with status 'pending'
   - Payment is verified via Paystack
   - Transaction status changes to 'completed'

3. Database trigger fires automatically:
   - Checks if User A has `referred_by` set
   - Checks if this is User A's first completed transaction
   - If yes, increments User B's `referral_count` by 1

4. Subsequent transactions by User A:
   - Do NOT increment User B's referral count again
   - Each referred user counts only once

## Benefits

1. **More Accurate**: Only counts users who actually make payments
2. **Prevents Gaming**: Users can't just sign up with referral codes without making transactions
3. **Better Metrics**: Referral counts reflect actual paying customers
4. **Automatic**: Database trigger handles it automatically, no manual intervention needed

## Testing

To test the new system:

1. **Create a test user with a referral code**
   - Sign up User A with User B's referral code
   - Verify User B's referral count is still 0

2. **Complete a transaction**
   - User A makes a payment
   - Payment is verified
   - Check that User B's referral count is now 1

3. **Verify no double counting**
   - User A makes another payment
   - Verify User B's referral count remains 1 (not 2)

## Migration Notes

- Existing referral counts will be **recalculated** based on completed transactions only
- Users who signed up with referral codes but never made a transaction will no longer count
- The migration is safe to run multiple times (idempotent)

## Rollback

If you need to rollback to the old system:

1. Drop the new trigger: `DROP TRIGGER IF EXISTS trigger_update_referral_count_on_transaction ON transactions;`
2. Recreate the old trigger from migration `005_add_referral_tracking.sql`
3. Recalculate referral counts based on signups (not transactions)

