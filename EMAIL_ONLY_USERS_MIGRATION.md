# Email-Only Users Migration Guide

## 🎯 Overview

**Migration 009** removes the unused `wallet_address` column from the `users` table and enforces **email as the primary identifier** for all users.

This cleanup eliminates technical debt from the old design and makes the database schema clearer and more maintainable.

---

## 📊 What Changed

### Before (Mixed Design):
```
users table:
├─ email (nullable)           ← Could be NULL
├─ wallet_address (nullable)  ← Never used, always NULL
└─ CONSTRAINT: email IS NOT NULL OR wallet_address IS NOT NULL
```

### After (Clean Design):
```
users table:
├─ email (required, unique)   ← Primary identifier
└─ All wallet addresses → stored in user_wallets table
```

---

## ✅ Benefits

| Benefit | Description |
|---------|-------------|
| **Clearer Data Model** | One source of truth: `users` = email identity |
| **No Confusion** | Developers can't accidentally use old column |
| **Better Performance** | Removed unused index on `wallet_address` |
| **Multi-Wallet Support** | All wallets in `user_wallets` table (as designed) |
| **Consistent Logic** | All user operations use email, never wallet |

---

## 🔄 User Flow (Unchanged)

The user experience **remains exactly the same**:

```
1. User signs up with EMAIL
   ↓
2. Virtual account created automatically
   ↓
3. User receives unique Wema Bank account
   ↓
4. User makes transaction → enters wallet address
   ↓
5. Wallet stored in user_wallets table
   ↓
6. Stats aggregated across all user's wallets
```

---

## 📝 Migration Details

### File: `supabase/migrations/009_email_only_users.sql`

**Changes:**
1. ✅ Make `email` column required (NOT NULL)
2. ✅ Drop `users_has_identifier` constraint (obsolete)
3. ✅ Drop `idx_users_wallet_address` index (unused)
4. ✅ Remove `wallet_address` column from `users` table
5. ✅ Update RLS policies (remove `wallet_address` references)
6. ✅ Add documentation comments to tables

---

## 🚀 How to Run the Migration

### Option 1: Supabase Dashboard (Recommended)

1. Go to: https://ksdzzqdafodlstfkqzuv.supabase.co/project/ksdzzqdafodlstfkqzuv/sql

2. Copy the contents of `supabase/migrations/009_email_only_users.sql`

3. Paste into the SQL Editor

4. Click **"Run"**

5. ✅ Migration complete!

### Option 2: Supabase CLI

```bash
# From your project root
supabase db push

# Or run the specific migration
supabase migration up 009_email_only_users
```

---

## 🧪 Verification

After running the migration, verify the changes:

```sql
-- 1. Check that email is now required
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'email';
-- Expected: is_nullable = 'NO'

-- 2. Verify wallet_address column is gone
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'wallet_address';
-- Expected: 0 rows (column doesn't exist)

-- 3. Check all users have email
SELECT COUNT(*) as total_users, 
       COUNT(email) as users_with_email 
FROM users;
-- Expected: total_users = users_with_email

-- 4. View user with their wallets
SELECT 
  u.email,
  u.total_transactions as user_total_txns,
  uw.wallet_address,
  uw.total_transactions as wallet_txns
FROM users u
LEFT JOIN user_wallets uw ON uw.user_id = u.id
LIMIT 5;
```

---

## 🛠️ Code Changes

### Files Updated:

1. **`lib/auth.ts`**
   - ❌ Old `linkWalletToUser` function deprecated
   - ✅ Use `lib/supabase-users.ts` version instead

2. **`app/api/admin/users/route.ts`**
   - ❌ Removed `wallet_address` from SELECT query
   - ❌ Removed `walletAddress` field from response
   - ℹ️ Users can have multiple wallets - query `user_wallets` table to see them

3. **`supabase/migrations/009_email_only_users.sql`**
   - ✅ New migration file created

---

## 📚 Updated Data Model

### Users Table (After Migration)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,  -- ← Now required!
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT,
  email_verified BOOLEAN DEFAULT false,
  paystack_customer_code TEXT,
  default_virtual_account_number TEXT,
  default_virtual_account_bank TEXT,
  virtual_account_assigned_at TIMESTAMP,
  total_transactions INTEGER DEFAULT 0,
  total_spent_ngn DECIMAL(18, 2) DEFAULT 0,
  total_received_send TEXT DEFAULT '0.00',
  first_transaction_at TIMESTAMP,
  last_transaction_at TIMESTAMP,
  sendtag TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### User Wallets Table (Unchanged)
```sql
CREATE TABLE user_wallets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),  -- ← Links to email user
  wallet_address TEXT NOT NULL,        -- ← Multiple per user
  total_transactions INTEGER DEFAULT 0,
  total_spent_ngn DECIMAL(18, 2) DEFAULT 0,
  total_received_send TEXT DEFAULT '0.00',
  first_transaction_at TIMESTAMP,
  last_transaction_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, wallet_address)  -- User can't add same wallet twice
);
```

---

## 💡 Developer Guide

### How to Query Users and Wallets

#### ❌ OLD WAY (No longer works):
```typescript
// This will fail after migration!
const user = await supabase
  .from('users')
  .select('wallet_address')  // ❌ Column doesn't exist
  .eq('email', 'alice@example.com')
  .single();
```

#### ✅ NEW WAY (Correct):
```typescript
// Get user by email
const { data: user } = await supabase
  .from('users')
  .select('*')
  .eq('email', 'alice@example.com')
  .single();

// Get all wallets for this user
const { data: wallets } = await supabase
  .from('user_wallets')
  .select('wallet_address, total_spent_ngn, total_received_send')
  .eq('user_id', user.id);

console.log(`${user.email} has ${wallets.length} wallet(s)`);
```

#### ✅ Or use the helper function:
```typescript
import { getSupabaseUserByEmail, getUserWallets } from '@/lib/supabase-users';

// Get user
const { user } = await getSupabaseUserByEmail('alice@example.com');

// Get their wallets
const { wallets } = await getUserWallets(user.id);
```

---

## 🔍 Migration Safety

### Is this migration safe?

**YES! ✅** This migration is safe because:

1. ✅ The `wallet_address` column was **never used** in production
2. ✅ All wallets are **already stored** in `user_wallets` table
3. ✅ All users are **created with email** (signup process)
4. ✅ No data is lost (column was always NULL)
5. ✅ Backward compatible (deprecated function still exists)

### Rollback Plan (if needed)

If you need to rollback, run this SQL:

```sql
-- Rollback migration 009
ALTER TABLE users 
  ADD COLUMN wallet_address TEXT UNIQUE;

CREATE INDEX idx_users_wallet_address 
  ON users(wallet_address) 
  WHERE wallet_address IS NOT NULL;

ALTER TABLE users 
  ADD CONSTRAINT users_has_identifier 
  CHECK (email IS NOT NULL OR wallet_address IS NOT NULL);

ALTER TABLE users 
  ALTER COLUMN email DROP NOT NULL;
```

---

## 📈 Expected Impact

- ✅ **Performance**: Slightly faster (removed unused index)
- ✅ **Code Quality**: Clearer, less confusing
- ✅ **Maintainability**: Easier for new developers
- ✅ **User Experience**: No change (seamless)
- ✅ **Database Size**: Slightly smaller (removed column)

---

## 🎯 Summary

| Aspect | Before | After |
|--------|--------|-------|
| User Identifier | Email OR Wallet | **Email ONLY** |
| Wallet Storage | users.wallet_address (unused) + user_wallets | **user_wallets ONLY** |
| Multi-Wallet | Supported via user_wallets | **Same (no change)** |
| Signup Process | Email → Virtual Account | **Same (no change)** |
| Code Clarity | Confusing (2 places) | **Clear (1 place)** |

---

## ✅ Post-Migration Checklist

After running the migration:

- [ ] Migration executed successfully in Supabase
- [ ] Verification queries show correct results
- [ ] Test user signup (should still work)
- [ ] Test transaction with wallet (should still work)
- [ ] Admin dashboard loads correctly
- [ ] No errors in Supabase logs
- [ ] Deploy updated code to Vercel
- [ ] Monitor for any issues

---

## 📞 Support

If you encounter any issues:

1. Check the verification queries above
2. Review the Supabase logs
3. Verify all code changes were deployed
4. Use the rollback plan if needed

---

**Migration created:** 2025-11-27  
**Status:** Ready to deploy  
**Risk Level:** Low (removing unused column)

