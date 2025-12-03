# Delete User Data Script

## User to Delete
**Email**: `lightblockofweb3@gmail.com`

## What Will Be Deleted

1. ✅ **Confirmation Codes** - All email confirmation codes
2. ✅ **Transactions** - All transactions linked to this user
3. ✅ **User Wallets** - All wallet addresses linked to this user
4. ✅ **User Record** - The main user account

## How to Run

### Option 1: Supabase SQL Editor (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to: **SQL Editor** → **New Query**
3. Copy the entire contents of `supabase/migrations/014_delete_user_lightblockofweb3.sql`
4. Paste into the SQL Editor
5. Click **Run** to execute

### Option 2: Direct SQL (Quick)

If you prefer a simpler script, use this:

```sql
BEGIN;

-- Delete all data for lightblockofweb3@gmail.com
DELETE FROM confirmation_codes WHERE email = 'lightblockofweb3@gmail.com';
DELETE FROM transactions WHERE user_id IN (SELECT id FROM users WHERE email = 'lightblockofweb3@gmail.com');
DELETE FROM user_wallets WHERE user_id IN (SELECT id FROM users WHERE email = 'lightblockofweb3@gmail.com');
DELETE FROM users WHERE email = 'lightblockofweb3@gmail.com';

COMMIT;
```

## Verification

After running, verify deletion with:

```sql
SELECT 
  (SELECT COUNT(*) FROM users WHERE email = 'lightblockofweb3@gmail.com') as users_remaining,
  (SELECT COUNT(*) FROM user_wallets WHERE user_id IN (SELECT id FROM users WHERE email = 'lightblockofweb3@gmail.com')) as wallets_remaining,
  (SELECT COUNT(*) FROM transactions WHERE user_id IN (SELECT id FROM users WHERE email = 'lightblockofweb3@gmail.com')) as transactions_remaining,
  (SELECT COUNT(*) FROM confirmation_codes WHERE email = 'lightblockofweb3@gmail.com') as codes_remaining;
```

All counts should be **0**.

## ⚠️ Important Notes

- **This is PERMANENT** - Data cannot be recovered after deletion
- **Transactions are deleted** - Transaction history will be lost
- **Referral relationships** - If this user referred others, their `referred_by` field will still reference a non-existent referral code (you may want to clean this up separately)
- **If this user was a referrer** - Their referral count will be removed, but users they referred will still have `referred_by` set

## Rollback

There is **no rollback** for this operation. Make sure you have backups if needed.

