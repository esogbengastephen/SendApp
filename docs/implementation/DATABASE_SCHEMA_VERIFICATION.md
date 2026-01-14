# Database Schema Verification

## ✅ Current Database Structure

### Users Table (Current State)

Based on migrations 002, 006, 009, 010, and 017:

#### Core Fields (Migration 002)
- `id` UUID PRIMARY KEY
- `email` TEXT UNIQUE NOT NULL (required after migration 009)
- `referral_code` TEXT UNIQUE NOT NULL
- `referred_by` TEXT
- `referral_count` INTEGER (added in migration 005)
- `email_verified` BOOLEAN DEFAULT false

#### Transaction Stats (Migration 002)
- `first_transaction_at` TIMESTAMP WITH TIME ZONE
- `last_transaction_at` TIMESTAMP WITH TIME ZONE
- `total_transactions` INTEGER DEFAULT 0
- `total_spent_ngn` DECIMAL(18, 2) DEFAULT 0
- `total_received_send` TEXT DEFAULT '0.00'
- `sendtag` TEXT

#### User Management (Migration 010)
- `is_blocked` BOOLEAN DEFAULT FALSE
- `blocked_at` TIMESTAMP WITH TIME ZONE
- `blocked_reason` TEXT
- `requires_reset` BOOLEAN DEFAULT FALSE
- `reset_requested_at` TIMESTAMP WITH TIME ZONE
- `account_reset_at` TIMESTAMP WITH TIME ZONE

#### Paystack Integration (Migration 008)
- `default_virtual_account_number` TEXT
- `default_virtual_account_name` TEXT
- `default_virtual_account_bank` TEXT

#### Profile & Wallet Fields (Migration 017) ⭐ NEW
- `display_name` TEXT
- `photo_url` TEXT
- `passkey_credential_id` TEXT UNIQUE
- `passkey_public_key` TEXT
- `wallet_seed_encrypted` TEXT (ENCRYPTED ONLY)
- `wallet_addresses` JSONB DEFAULT '{}' (Extensible multi-chain addresses)
- `wallet_created_at` TIMESTAMP WITH TIME ZONE
- `passkey_created_at` TIMESTAMP WITH TIME ZONE

#### Timestamps
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()

---

### Related Tables

#### user_wallets (Migration 006)
- Legacy multi-wallet support
- One user can have multiple wallets
- Used for transaction tracking per wallet

#### transactions (Migration 006)
- All transaction records
- Linked to users and wallets

---

## 🔍 Migration 017 Compatibility Check

### ✅ Compatibility Status: READY TO APPLY

Migration 017 is **fully compatible** with the existing schema:

1. **Uses `IF NOT EXISTS`** - Safe to run multiple times
2. **No conflicts** - All new columns don't conflict with existing ones
3. **RLS Policies** - Existing permissive policies (from migration 004) will work
4. **Indexes** - Properly indexed for performance
5. **JSONB Column** - Extensible design for future chains

### Fields Added by Migration 017

| Field | Type | Purpose | Indexed |
|-------|------|---------|---------|
| `display_name` | TEXT | User's display name | ❌ |
| `photo_url` | TEXT | Profile photo URL | ❌ |
| `passkey_credential_id` | TEXT UNIQUE | WebAuthn credential ID | ✅ |
| `passkey_public_key` | TEXT | Passkey public key | ❌ |
| `wallet_seed_encrypted` | TEXT | Encrypted seed phrase | ❌ |
| `wallet_addresses` | JSONB | Multi-chain addresses | ✅ (GIN) |
| `wallet_created_at` | TIMESTAMP | Wallet creation time | ✅ |
| `passkey_created_at` | TIMESTAMP | Passkey creation time | ❌ |

---

## 📊 JSONB Structure (wallet_addresses)

```json
{
  "bitcoin": "bc1q...",
  "ethereum": "0x...",
  "base": "0x...",
  "polygon": "0x...",
  "monad": "0x...",
  "solana": "...",
  "sui": "0x..."
}
```

**Benefits:**
- ✅ No migrations needed for new chains
- ✅ Fast queries with GIN index
- ✅ Flexible schema
- ✅ Easy to extend

---

## 🔐 Security Considerations

### Seed Phrase Storage
- ✅ **ONLY encrypted seed** stored in `wallet_seed_encrypted`
- ✅ **NEVER plaintext** - Backend validates and rejects plaintext
- ✅ **Client-side encryption** - Uses passkey-derived key
- ✅ **Client-side decryption** - Backend never sees plaintext

### RLS Policies
Current policies (from migration 004):
- ✅ Public read access (for API operations)
- ✅ Public insert (for signup)
- ✅ Public update (for profile/wallet updates)

**Note:** Migration 010 tried to add restrictive policies, but migration 004's permissive policies are in effect, which is correct for API-based authentication.

---

## ✅ Verification Checklist

Before applying migration 017:

- [x] Migration file exists: `supabase/migrations/017_add_profile_and_wallet_fields.sql`
- [x] Uses `IF NOT EXISTS` for safety
- [x] No conflicts with existing columns
- [x] Proper indexes created
- [x] JSONB column for extensibility
- [x] Security comments added
- [x] Compatible with existing RLS policies

---

## 🚀 Next Steps

1. **Apply Migration 017** in Supabase Dashboard:
   - Go to SQL Editor
   - Copy contents of `supabase/migrations/017_add_profile_and_wallet_fields.sql`
   - Run the migration

2. **Verify Migration**:
   ```sql
   -- Check if columns exist
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'users' 
   AND column_name IN (
     'display_name', 
     'photo_url', 
     'passkey_credential_id',
     'wallet_addresses',
     'wallet_seed_encrypted'
   );
   
   -- Check indexes
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE tablename = 'users' 
   AND indexname LIKE '%wallet%' OR indexname LIKE '%passkey%';
   ```

3. **Test API Endpoints**:
   - `/api/passkey/create` - Create passkey and wallet
   - `/api/user/profile` - Get/update profile
   - `/api/passkey/seed-phrase` - View seed phrase (requires auth)

---

## 📝 Notes

- **Migration 017 is idempotent** - Safe to run multiple times
- **No data loss** - Only adds new columns
- **Backward compatible** - Existing code continues to work
- **Extensible** - Easy to add new chains without migrations

---

*Last verified: Database structure confirmed compatible with migration 017*

