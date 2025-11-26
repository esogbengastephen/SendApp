# Multi-Wallet System Implementation Guide

## 🎯 Overview

The platform now supports a unified user system where:
- **Email = Primary User Identity**
- **One User → Multiple Wallets** (one-to-many relationship)
- **Multiple Users → Same Wallet** (allowed - stats attributed to logged-in user)
- **All Data Persisted in Supabase** (no more in-memory storage)

---

## 📊 Database Structure

### `users` Table
Primary table for user accounts (email-based):
```sql
- id (UUID, primary key)
- email (unique)
- referral_code
- referred_by
- referral_count
- total_transactions (sum across ALL wallets)
- total_spent_ngn (sum across ALL wallets)
- total_received_send (sum across ALL wallets)
- first_transaction_at
- last_transaction_at
- created_at, updated_at
```

### `user_wallets` Table (NEW)
Tracks individual wallets per user:
```sql
- id (UUID, primary key)
- user_id (FK → users.id)
- wallet_address
- sendtag
- total_transactions (for THIS wallet)
- total_spent_ngn (for THIS wallet)
- total_received_send (for THIS wallet)
- first_transaction_at
- last_transaction_at
- created_at, updated_at
- UNIQUE(user_id, wallet_address) ← Same user can't add same wallet twice
```

### `transactions` Table (NEW)
All transactions now stored in Supabase:
```sql
- id (UUID, primary key)
- transaction_id (unique, nanoid)
- user_id (FK → users.id, nullable for guest users)
- wallet_address
- paystack_reference
- ngn_amount
- send_amount
- status (pending/completed/failed)
- tx_hash
- sendtag
- exchange_rate
- created_at, completed_at, etc.
```

---

## 🔄 Transaction Flow

### For Logged-In Email Users

1. **User enters wallet address** on main page
2. **System automatically links wallet** to user account
   - Checks if wallet already linked to this user
   - If not, creates new record in `user_wallets`
3. **Transaction created** with both `user_id` and `wallet_address`
4. **Payment verified** via Paystack
5. **Stats updated** in BOTH:
   - `user_wallets` table (for this specific wallet)
   - `users` table (aggregated totals - auto-updated by DB trigger)

### For Guest Users (Not Logged In)

1. **Transaction created** without `user_id`
2. **Falls back** to in-memory tracking (temporary)
3. **Recommendation**: Encourage users to create accounts for persistent tracking

---

## 🚀 Setup Instructions

### 1. Run Database Migration

In Supabase SQL Editor, run:
```bash
supabase/migrations/006_restructure_for_multi_wallet.sql
```

This creates:
- `user_wallets` table
- `transactions` table
- Database trigger to auto-update user totals

### 2. Environment Variables

Ensure these are set:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Restart Dev Server

```bash
npm run dev
```

---

## 💻 Frontend Integration

### Sending User Info with Transaction Requests

When a user is logged in, include their info in transaction API calls:

```typescript
// Example: Creating a transaction
fetch('/api/transactions/create-id', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ngnAmount: 1000,
    walletAddress: '0x123...',
    // Include user info from localStorage
    userId: userData.id,
    userEmail: userData.email,
  }),
});
```

### Checking User Session

```typescript
import { isUserLoggedIn, getUserData } from '@/lib/session';

if (isUserLoggedIn()) {
  const user = getUserData();
  console.log('Logged in as:', user.email);
}
```

---

## 📈 Admin Dashboard

The admin users page now shows:
- **Email** addresses
- **Wallet addresses** (linked to users)
- **Referral codes** and counts
- **Transaction stats** (aggregated across all wallets)

### Viewing User Wallets

```typescript
import { getUserWallets } from '@/lib/supabase-users';

const { success, wallets } = await getUserWallets(userId);
// Returns array of all wallets for this user
```

---

## 🔍 Key Functions

### Link Wallet to User

```typescript
import { linkWalletToUser } from '@/lib/supabase-users';

const result = await linkWalletToUser(
  userId,
  walletAddress,
  sendtag // optional
);
```

### Update Wallet Stats

```typescript
import { updateWalletStats } from '@/lib/supabase-users';

const result = await updateWalletStats(
  userId,
  walletAddress,
  ngnAmount,
  sendAmount,
  sendtag // optional
);
// Auto-updates both wallet AND user totals via DB trigger
```

### Create Transaction

```typescript
import { createTransaction } from '@/lib/transactions';

const transaction = await createTransaction({
  transactionId: nanoid(),
  userId: user.id, // optional
  walletAddress: '0x123...',
  ngnAmount: 1000,
  sendAmount: '50.00',
  paystackReference: 'ref_123',
});
```

---

## 🎨 Benefits

### For Users
- ✅ Track all transactions across multiple wallets
- ✅ One email account, multiple wallets
- ✅ Persistent history (not lost on server restart)
- ✅ Referral program rewards

### For Admins
- ✅ Complete user analytics
- ✅ Track wallet relationships
- ✅ Filter users by referral count
- ✅ Send targeted emails

### For Developers
- ✅ No more in-memory storage
- ✅ Scalable database structure
- ✅ Automatic stat aggregation
- ✅ Clean separation of concerns

---

## 🔐 Security Notes

- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Service role key used for server-side operations
- ✅ Anon key for client-side reads (when needed)
- ✅ User data validated before storage

---

## 📝 Migration from Old System

The old in-memory system is kept for backward compatibility:
- New transactions → Supabase
- Old transactions → In-memory (until server restart)
- Falls back to in-memory if Supabase fails

Run the migration script to check data:
```bash
npx tsx scripts/migrate-to-supabase.ts
```

---

## 🐛 Troubleshooting

### Issue: Wallet stats not updating
**Solution**: Check DB trigger `trigger_update_user_totals_from_wallets` is active

### Issue: Transactions not saving
**Solution**: Verify Supabase connection and RLS policies

### Issue: User can't link wallet
**Solution**: Ensure user is logged in and userId is passed to API

---

## 📚 References

- `lib/supabase-users.ts` - User/wallet management
- `lib/transactions.ts` - Transaction handling
- `app/api/transactions/create-id/route.ts` - Transaction creation
- `app/api/paystack/process-payment/route.ts` - Payment processing
- `supabase/migrations/006_restructure_for_multi_wallet.sql` - DB schema

---

## ✅ Testing Checklist

- [ ] Run database migration
- [ ] Restart dev server
- [ ] Sign up with email
- [ ] Make transaction with wallet A
- [ ] Check wallet linked in `user_wallets` table
- [ ] Make transaction with wallet B (same user)
- [ ] Verify both wallets linked to same user
- [ ] Check user totals include both wallets
- [ ] Log out and make transaction as guest
- [ ] Verify guest transaction uses in-memory fallback
- [ ] Check admin dashboard shows correct data

---

**Status**: ✅ Implementation Complete - Ready for Testing

