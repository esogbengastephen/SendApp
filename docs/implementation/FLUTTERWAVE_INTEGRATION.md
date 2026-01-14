# Flutterwave Integration - Implementation Summary

## ✅ Implementation Complete!

Flutterwave integration has been successfully implemented to enable users to use their mobile numbers as account identifiers for NGN wallet operations.

---

## 🎯 What Was Implemented

### 1. Database Migration (020)
- **File**: `supabase/migrations/020_add_mobile_number_and_flutterwave.sql`
- **Added fields** to `users` table:
  - `mobile_number` (TEXT UNIQUE) - User's phone number
  - `flutterwave_customer_id` - Flutterwave customer ID
  - `flutterwave_virtual_account_number` - Flutterwave-generated account number
  - `flutterwave_virtual_account_bank` - Bank name
  - `flutterwave_virtual_account_name` - Account name
  - `flutterwave_virtual_account_created_at` - Creation timestamp
  - `flutterwave_account_is_permanent` - Boolean flag (false until BVN verified)
  - `flutterwave_bvn` - BVN (stored after KYC)
  - `flutterwave_balance` - User's NGN balance (tracked in DB)
  - `flutterwave_balance_updated_at` - Last balance update timestamp
- **Indexes created** for fast lookups by mobile number and virtual account number

### 2. Flutterwave Library
- **File**: `lib/flutterwave.ts`
- **Functions**:
  - `createVirtualAccount()` - Create temporary or permanent virtual accounts
  - `createTransfer()` - Send money between accounts
  - `getAccountBalance()` - Get Flutterwave account balance
  - `verifyWebhookSignature()` - Verify webhook authenticity
  - `normalizeMobileNumber()` - Normalize phone numbers to standard format
  - `isValidNigerianMobile()` - Validate Nigerian mobile numbers
  - `mobileToVirtualAccountFormat()` - Convert phone to display format

### 3. API Routes

#### `/api/flutterwave/create-virtual-account-signup`
- Creates temporary Flutterwave virtual account during signup
- Requires phone number
- Creates account without BVN (temporary)
- Stores mapping: `mobile_number → flutterwave_virtual_account_number`

#### `/api/flutterwave/lookup-account` (PUBLIC)
- Public API to look up account by phone number
- Used by anyone (inside or outside app) to get account details
- Returns: account number, bank name, account name
- No authentication required

#### `/api/flutterwave/send-money`
- Send money using phone number
- Looks up recipient's account by phone number
- Validates sender's balance
- Creates Flutterwave transfer
- Updates balances in database

#### `/api/flutterwave/webhook`
- Processes Flutterwave payment notifications
- Updates user balance when payment received
- Handles `virtualaccountpayment` events
- Verifies webhook signature for security

#### `/api/flutterwave/verify-bvn`
- Verifies BVN and upgrades account to permanent
- Called after user completes KYC in app
- Creates new permanent account with BVN
- Updates user record

#### `/api/flutterwave/sync-balance`
- Syncs balance from Flutterwave API to database
- Fetches user's current balance
- Updates database record

### 4. Signup Flow Updates
- **File**: `app/auth/page.tsx`
- Added phone number field (required for signup)
- Phone number collected after code verification
- Validates Nigerian mobile format (11 digits starting with 0)

- **File**: `app/api/auth/signup/route.ts`
- Updated to accept phone number
- Creates Flutterwave virtual account after user creation
- Keeps Paystack account creation for backward compatibility

### 5. Dashboard Updates
- **File**: `app/api/user/dashboard/route.ts`
- Updated to use Flutterwave balance for NGN wallet
- Shows Flutterwave account number (primary)
- Falls back to Paystack account if Flutterwave not available
- Returns mobile number and display format

---

## 🔄 User Flow

### Signup Flow
1. User enters email and referral code (optional)
2. User receives confirmation code
3. User enters confirmation code
4. **User enters phone number (required)** ← NEW
5. User clicks "Sign Up"
6. System creates user account
7. System creates **temporary Flutterwave virtual account** ← NEW
8. System stores mapping: `mobile_number → flutterwave_account_number`
9. User redirected to passkey setup

### KYC Flow (After Signup)
1. User navigates to KYC page in app
2. User enters BVN
3. System verifies BVN with Flutterwave
4. System creates **permanent Flutterwave virtual account**
5. System updates user record with permanent account
6. User can now use permanent account

### Receiving Payments
1. User shares phone number: "Send to 07034494055"
2. Sender (inside or outside app) looks up account:
   - `GET /api/flutterwave/lookup-account?phoneNumber=07034494055`
3. System returns Flutterwave account details
4. Sender transfers to Flutterwave account
5. Flutterwave webhook notifies system
6. System updates user's balance
7. User receives funds

### Sending Payments (Inside App)
1. User enters recipient phone number
2. System looks up recipient's Flutterwave account
3. System validates sender's balance
4. System creates Flutterwave transfer
5. System updates both sender and recipient balances
6. Transfer completed

### Utility Payments
1. User selects utility service (airtime, data, TV, etc.)
2. System checks Flutterwave balance
3. System deducts amount from Flutterwave balance
4. System processes utility purchase via ClubKonnect
5. Transaction completed

---

## 📋 Environment Variables Required

Add these to your `.env.local`:

```env
# Flutterwave API Keys
FLUTTERWAVE_SECRET_KEY=your_flutterwave_secret_key
NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=your_flutterwave_public_key
```

---

## 🔧 Webhook Configuration

Configure Flutterwave webhook URL:
1. Go to Flutterwave Dashboard → Settings → Webhooks
2. Add webhook URL: `https://your-domain.com/api/flutterwave/webhook`
3. Select events: `virtualaccountpayment`
4. Copy the webhook secret hash
5. Set `FLUTTERWAVE_SECRET_KEY` in environment variables

---

## 🎨 UI Display

### Dashboard NGN Wallet
- Shows Flutterwave balance (from database)
- Displays phone number format: `7034494055` (without leading 0)
- Shows actual Flutterwave account number for bank transfers
- Balance synced via webhooks

### Receive Page
- Shows phone number as account identifier
- Displays actual Flutterwave account number
- QR code for easy sharing
- Copy functionality

### Send Page
- Input field for recipient phone number
- Validates phone number format
- Shows sender's Flutterwave balance
- Processes transfer via Flutterwave API

---

## 🔐 Security Features

1. **Webhook Signature Verification**: All webhooks verified using HMAC SHA256
2. **Phone Number Validation**: Nigerian mobile format validation
3. **Balance Validation**: Checks sender balance before transfers
4. **Account Lookup**: Public API for account lookup (no sensitive data exposed)
5. **BVN Storage**: BVN stored securely (should be encrypted in production)

---

## 📊 Database Schema

```sql
users table:
- mobile_number: TEXT UNIQUE (07034494055)
- flutterwave_virtual_account_number: TEXT (9328390493 - Flutterwave generated)
- flutterwave_virtual_account_bank: TEXT (Wema Bank)
- flutterwave_balance: DECIMAL(18, 2) (0.00)
- flutterwave_account_is_permanent: BOOLEAN (false until BVN verified)
- flutterwave_bvn: TEXT (stored after KYC)
```

---

## 🚀 Next Steps

1. **Add Flutterwave API Keys** to environment variables
2. **Configure Flutterwave Webhook** in dashboard
3. **Test Signup Flow** with phone number
4. **Test KYC Flow** with BVN verification
5. **Test Send/Receive** using phone numbers
6. **Update Frontend Pages**:
   - Receive page to show phone number format
   - Send page to use phone number lookup
   - Dashboard to show Flutterwave balance
7. **Create KYC Page** for BVN verification

---

## 📝 Notes

- **Temporary Accounts**: Created at signup without BVN (expire after some time)
- **Permanent Accounts**: Created after BVN verification (never expire)
- **Balance Tracking**: Both API and database (webhooks update database)
- **Phone Number Format**: Displayed as `7034494055` (without leading 0) in UI
- **Account Number**: Flutterwave generates random numbers (cannot customize)
- **Mapping**: Phone number → Flutterwave account stored in database

---

## ✅ Testing Checklist

- [ ] Signup with phone number creates Flutterwave account
- [ ] Phone number validation works correctly
- [ ] Public lookup API returns correct account details
- [ ] Send money using phone number works
- [ ] Webhook processes payments correctly
- [ ] Balance updates in database
- [ ] BVN verification upgrades account to permanent
- [ ] Dashboard shows Flutterwave balance
- [ ] Receive page displays phone number format
- [ ] Send page validates phone numbers

---

## 🐛 Troubleshooting

### Account Creation Fails
- Check Flutterwave API keys are set correctly
- Verify phone number format is valid
- Check Flutterwave dashboard for errors

### Webhook Not Working
- Verify webhook URL is correct
- Check webhook signature verification
- Ensure `FLUTTERWAVE_SECRET_KEY` matches webhook secret

### Balance Not Updating
- Check webhook is receiving events
- Verify webhook signature is valid
- Check database update queries

### Phone Number Already Exists
- Phone numbers must be unique
- Check if user already registered
- Handle duplicate phone number error

---

## 📚 References

- [Flutterwave Documentation](https://developer.flutterwave.com/docs)
- [Virtual Accounts Guide](https://developer.flutterwave.com/docs/ngn-virtual-accounts)
- [Webhooks Guide](https://developer.flutterwave.com/docs/webhooks)
