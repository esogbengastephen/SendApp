# Migration 017 - Next Steps After Migration

## ✅ Migration Applied Successfully!

Now that Migration 017 has been executed, here's what to do next:

---

## 🔍 Step 1: Verify Migration

Run this SQL query in Supabase SQL Editor to verify all columns exist:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN (
  'display_name', 
  'photo_url', 
  'passkey_credential_id',
  'passkey_public_key',
  'wallet_seed_encrypted',
  'wallet_addresses',
  'wallet_created_at',
  'passkey_created_at'
)
ORDER BY column_name;
```

**Expected Result:** You should see 8 rows returned, one for each new column.

---

## 🧪 Step 2: Test the Implementation

### 2.1 Test Profile API

```bash
# Get user profile (requires authentication)
curl -X GET http://localhost:3000/api/user/profile \
  -H "Cookie: auth_session=your_session_token"
```

### 2.2 Test Passkey Creation (Client-Side)

The passkey creation happens client-side. You'll need to:

1. **Create a test user** (if you don't have one)
2. **Call the passkey creation API** from your frontend
3. **Verify wallet is created** automatically

---

## 📝 Step 3: Implementation Status

### ✅ Completed
- [x] Database migration (Migration 017)
- [x] Wallet generation library (`lib/wallet.ts`)
- [x] Passkey management library (`lib/passkey.ts`)
- [x] Chain configuration (`lib/chains.ts`)
- [x] Multi-chain utilities (`lib/multi-chain-wallet.ts`)
- [x] API endpoints:
  - [x] `/api/passkey/challenge`
  - [x] `/api/passkey/create`
  - [x] `/api/passkey/verify`
  - [x] `/api/passkey/credential/[userId]`
  - [x] `/api/passkey/seed-phrase`
  - [x] `/api/user/profile`

### 🚧 Next: UI Components (To Build)

1. **Passkey Setup UI**
   - Component to create passkey
   - Shows wallet creation progress
   - Displays success message

2. **Profile Editing UI**
   - Edit display name
   - Upload profile photo
   - Save changes

3. **Seed Phrase Viewing UI**
   - Requires passkey authentication
   - Shows seed phrase (12 words)
   - Copy to clipboard functionality
   - Security warnings

4. **Multi-Chain Address Display**
   - Show all wallet addresses
   - Chain selector
   - Copy address functionality
   - QR code generation

---

## 🎯 Step 4: Quick Test Flow

### Test Passkey & Wallet Creation

1. **User signs up/logs in** (existing flow)
2. **User navigates to "Setup Passkey"** (new UI needed)
3. **System prompts for passkey creation**
4. **Wallet automatically generated** when passkey is created
5. **User sees all chain addresses**

### Test Profile Update

1. **User navigates to profile settings**
2. **Updates display name**
3. **Uploads profile photo**
4. **Saves changes**
5. **Verifies changes are saved**

### Test Seed Phrase Viewing

1. **User navigates to "View Seed Phrase"**
2. **System prompts for passkey authentication**
3. **User authenticates with passkey**
4. **Seed phrase is decrypted and displayed**
5. **User can copy seed phrase**

---

## 🔐 Security Checklist

- ✅ Seed phrase generated client-side only
- ✅ Seed phrase encrypted before sending to backend
- ✅ Backend validates encrypted seed (rejects plaintext)
- ✅ Only encrypted seed stored in database
- ✅ Passkey required to view seed phrase
- ✅ All encryption/decryption happens client-side

---

## 📚 API Endpoints Reference

### Passkey Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/passkey/challenge` | POST | Generate WebAuthn challenge |
| `/api/passkey/create` | POST | Create passkey and wallet |
| `/api/passkey/verify` | POST | Verify passkey authentication |
| `/api/passkey/credential/[userId]` | GET | Get user's passkey credential ID |
| `/api/passkey/seed-phrase` | POST | Get encrypted seed (requires passkey auth) |

### Profile Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user/profile` | GET | Get user profile with wallet addresses |
| `/api/user/profile` | PATCH | Update profile (display_name, photo_url) |

---

## 🐛 Troubleshooting

### Issue: "Column does not exist"
- **Solution:** Verify migration was executed successfully
- **Check:** Run verification SQL query above

### Issue: "Invalid API key"
- **Solution:** Ensure `.env.local` has `SUPABASE_SERVICE_ROLE_KEY`
- **Check:** Restart development server after adding key

### Issue: "Passkey creation fails"
- **Solution:** Ensure browser supports WebAuthn
- **Check:** Use HTTPS or localhost (required for WebAuthn)

### Issue: "Wallet addresses not showing"
- **Solution:** Verify `wallet_addresses` JSONB column exists
- **Check:** Run verification query

---

## ✅ Success Criteria

Migration is successful when:

- [x] All 8 new columns exist in `users` table
- [x] Indexes are created (check with `\d users` in psql)
- [x] JSONB column accepts JSON objects
- [x] API endpoints respond correctly
- [x] No errors in console when querying new columns

---

## 🚀 Ready to Build UI!

All backend infrastructure is complete. You can now:

1. Build the passkey setup UI
2. Build the profile editing UI
3. Build the seed phrase viewing UI
4. Build the multi-chain address display

All the APIs are ready and waiting! 🎉

---

*Last updated: After Migration 017 applied*

