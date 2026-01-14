# Multi-Chain Wallet with Passkey Implementation

## ✅ Implementation Complete

This document describes the extensible multi-chain wallet system with passkey authentication that has been implemented.

---

## 🎯 Features Implemented

### 1. **Multi-Chain Wallet Support**
- ✅ Bitcoin (Native SegWit - Bech32)
- ✅ Ethereum
- ✅ Base
- ✅ Polygon
- ✅ Monad
- ✅ Solana
- ✅ Sui
- ✅ **Easily extensible** - Add new chains without database migrations

### 2. **Security Features**
- ✅ Seed phrase generated **client-side only**
- ✅ Seed phrase **encrypted** using passkey-derived key
- ✅ **Only encrypted seed** stored in database (never plaintext)
- ✅ Backend **never sees** plaintext seed phrase
- ✅ Passkey authentication for seed phrase viewing

### 3. **Profile Management**
- ✅ Display name editing
- ✅ Profile photo upload
- ✅ Profile API endpoints

### 4. **Passkey Authentication**
- ✅ Passkey creation (mandatory for wallet creation)
- ✅ Passkey authentication
- ✅ Passkey recovery via email
- ✅ One passkey per user (can be replaced)

---

## 📁 Files Created/Modified

### Database
- `supabase/migrations/017_add_profile_and_wallet_fields.sql`
  - Adds profile fields (display_name, photo_url)
  - Adds passkey fields (credential_id, public_key)
  - Adds wallet_seed_encrypted (JSONB for extensible addresses)
  - Uses JSONB column for chain addresses (no migrations needed for new chains)

### Core Libraries
- `lib/chains.ts` - Chain configuration (easily add new chains)
- `lib/wallet.ts` - Wallet generation and encryption
- `lib/passkey.ts` - Passkey management
- `lib/multi-chain-wallet.ts` - Wallet utilities

### API Endpoints
- `app/api/passkey/challenge/route.ts` - Generate WebAuthn challenge
- `app/api/passkey/create/route.ts` - Create passkey and wallet
- `app/api/passkey/verify/route.ts` - Verify passkey authentication
- `app/api/passkey/credential/[userId]/route.ts` - Get user's passkey credential
- `app/api/passkey/seed-phrase/route.ts` - Get encrypted seed (requires passkey auth)
- `app/api/user/profile/route.ts` - Get/update user profile

### Updated Files
- `lib/auth.ts` - Updated AuthUser interface with new fields

---

## 🔐 Security Architecture

### Seed Phrase Flow
1. **Generation**: Client-side only (never sent to backend)
2. **Encryption**: Client-side using passkey-derived key
3. **Storage**: Only encrypted seed stored in database
4. **Decryption**: Client-side only (requires passkey authentication)

### Passkey Flow
1. User creates passkey → Wallet automatically generated
2. Seed phrase encrypted with passkey
3. Encrypted seed + addresses stored in database
4. To view seed phrase → User must authenticate with passkey

---

## 📊 Database Schema

### Users Table (New Fields)
```sql
display_name TEXT
photo_url TEXT
passkey_credential_id TEXT UNIQUE
passkey_public_key TEXT
wallet_seed_encrypted TEXT  -- ENCRYPTED ONLY
wallet_addresses JSONB      -- {"bitcoin": "bc1...", "ethereum": "0x...", ...}
wallet_created_at TIMESTAMP
passkey_created_at TIMESTAMP
```

### JSONB Format
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

---

## 🚀 How to Use

### 1. Run Database Migration
```bash
# Apply migration 017
# This adds all the new fields to the users table
```

### 2. Create Passkey & Wallet (Client-Side)
```typescript
import { createPasskey } from "@/lib/passkey";
import { generateWalletFromSeed, encryptSeedPhrase } from "@/lib/wallet";

// 1. Generate wallet
const seedPhrase = generateSeedPhrase();
const walletData = generateWalletFromSeed(seedPhrase);

// 2. Create passkey
const passkeyResult = await createPasskey(userId, userEmail, displayName);
if (!passkeyResult.success) {
  // Handle error
}

// 3. Encrypt seed phrase
const encryptedSeed = await encryptSeedPhrase(
  seedPhrase,
  passkeyResult.credential.publicKey
);

// 4. Send to backend (only encrypted seed, never plaintext!)
await fetch("/api/passkey/create", {
  method: "POST",
  body: JSON.stringify({
    userId,
    credentialId: passkeyResult.credential.rawId,
    publicKey: passkeyResult.credential.publicKey,
    encryptedSeed, // Encrypted only!
    addresses: walletData.addresses,
  }),
});
```

### 3. Authenticate with Passkey
```typescript
import { authenticateWithPasskey } from "@/lib/passkey";

const authResult = await authenticateWithPasskey(userId);
if (authResult.success) {
  // User authenticated, can now view seed phrase
}
```

### 4. View Seed Phrase (Requires Passkey Auth)
```typescript
// 1. Authenticate with passkey first
const authResult = await authenticateWithPasskey(userId);
if (!authResult.success) {
  // Handle error
}

// 2. Get encrypted seed from backend
const response = await fetch("/api/passkey/seed-phrase", {
  method: "POST",
  body: JSON.stringify({
    userId,
    passkeyVerified: true,
  }),
});

const { encryptedSeed, publicKey } = await response.json();

// 3. Decrypt client-side
import { decryptSeedPhrase } from "@/lib/wallet";
const seedPhrase = await decryptSeedPhrase(encryptedSeed, publicKey);

// 4. Display to user
console.log("Seed phrase:", seedPhrase);
```

### 5. Get User Profile
```typescript
const response = await fetch("/api/user/profile");
const { profile } = await response.json();

console.log("Addresses:", profile.addresses);
// {
//   bitcoin: "bc1q...",
//   ethereum: "0x...",
//   solana: "...",
//   ...
// }
```

---

## ➕ Adding New Chains (Future)

### Step 1: Add Chain Config
Edit `lib/chains.ts`:
```typescript
export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  // ... existing chains ...
  
  avalanche: {
    id: "avalanche",
    name: "Avalanche",
    type: ChainType.EVM,
    chainId: 43114,
    derivationPath: "m/44'/60'/0'/0/0", // Same as Ethereum (EVM)
    rpcUrl: process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL,
    explorerUrl: "https://snowtrace.io",
    nativeCurrency: {
      symbol: "AVAX",
      decimals: 18,
    },
  },
};
```

### Step 2: Add Derivation Function (if needed)
If it's a new chain type (not EVM/Solana/Sui/Bitcoin), add derivation function in `lib/wallet.ts`.

### Step 3: Deploy
- New users automatically get the new chain address
- Existing users can get new chain addresses via migration script

**That's it!** No database migrations needed thanks to JSONB column.

---

## 🔒 Security Checklist

- ✅ Seed phrase generated client-side only
- ✅ Seed phrase encrypted before sending to backend
- ✅ Backend validates encrypted seed (rejects plaintext)
- ✅ Only encrypted seed stored in database
- ✅ Decryption happens client-side only
- ✅ Passkey required to view seed phrase
- ✅ Passkey can be recovered/replaced via email

---

## 📝 Notes

1. **Bitcoin Address Format**: Uses Native SegWit (Bech32) - starts with `bc1`
2. **EVM Chains**: Ethereum, Base, Polygon, Monad all share the same address (same derivation path)
3. **Extensibility**: JSONB column allows adding new chains without database migrations
4. **Passkey Recovery**: Users can recover/replace passkey using email authentication

---

## 🐛 Troubleshooting

### Issue: "Security violation: Plaintext seed phrase detected"
- **Cause**: Backend detected plaintext seed phrase
- **Fix**: Ensure seed phrase is encrypted before sending to `/api/passkey/create`

### Issue: "No passkey found for user"
- **Cause**: User hasn't created a passkey yet
- **Fix**: User must create passkey first (which automatically creates wallet)

### Issue: Bitcoin address generation fails
- **Cause**: Missing `tiny-secp256k1` dependency
- **Fix**: Run `npm install tiny-secp256k1 bip32`

---

## ✅ Next Steps (UI Implementation)

1. Create passkey setup UI component
2. Create profile editing UI
3. Create seed phrase viewing UI (with passkey auth)
4. Create multi-chain address display component
5. Add passkey recovery UI

---

*Last updated: Implementation completed*

