# Passkey Setup Flow Implementation

## ✅ Implementation Complete

This document describes the passkey setup flow that prompts users to create a passkey after email authentication.

---

## 🎯 User Flows

### 1. **New User Signup Flow**
```
User signs up with email
    ↓
Email verification
    ↓
Account created
    ↓
Redirected to /passkey-setup
    ↓
User sets up passkey (wallet auto-created)
    ↓
Redirected to dashboard
```

### 2. **Existing User Login Flow**
```
User logs in with email
    ↓
Login successful
    ↓
Check if user has passkey
    ↓
If NO passkey → Redirected to /passkey-setup
    ↓
If HAS passkey → Redirected to dashboard
```

### 3. **Protected Route Access**
```
User tries to access protected route
    ↓
AuthGuard checks authentication
    ↓
If not logged in → Redirect to /auth
    ↓
If logged in → Check for passkey
    ↓
If NO passkey → Redirect to /passkey-setup
    ↓
If HAS passkey → Allow access
```

---

## 📁 Files Created/Modified

### New Files
- `app/passkey-setup/page.tsx` - Passkey setup UI page
- `app/api/user/check-passkey/route.ts` - API to check if user has passkey

### Modified Files
- `components/AuthGuard.tsx` - Added passkey check before allowing access
- `app/auth/page.tsx` - Updated login/signup redirects to check passkey
- `app/page.tsx` - Added passkey check on home page

---

## 🔄 Implementation Details

### Passkey Setup Page (`/passkey-setup`)

**Features:**
- ✅ Checks if user is authenticated
- ✅ Checks if user already has passkey (redirects if yes)
- ✅ Shows passkey support status
- ✅ Guides user through passkey creation
- ✅ Automatically generates wallet when passkey is created
- ✅ Shows success message and redirects to dashboard
- ✅ Optional "Skip for now" button (user will be prompted again)

**Steps:**
1. User clicks "Set Up Passkey"
2. System generates seed phrase (client-side)
3. System generates wallet addresses for all chains
4. User creates passkey via WebAuthn
5. Seed phrase encrypted with passkey
6. Encrypted seed + addresses sent to backend
7. Success message shown
8. Redirect to dashboard

### API Endpoint: `/api/user/check-passkey`

**Purpose:** Check if user has a passkey set up

**Method:** GET

**Parameters:**
- `userId` (query param) - User ID to check

**Response:**
```json
{
  "success": true,
  "hasPasskey": false,
  "hasWallet": false,
  "needsPasskeySetup": true
}
```

### Auth Flow Updates

**Login Flow:**
- After successful login, checks for passkey
- If no passkey → redirects to `/passkey-setup`
- If has passkey → redirects to `/` (dashboard)

**Signup Flow:**
- After successful signup, always redirects to `/passkey-setup`
- New users must set up passkey before accessing dashboard

**AuthGuard:**
- Checks authentication first
- Then checks for passkey
- Redirects to `/passkey-setup` if missing
- Allows access if passkey exists

---

## 🎨 UI Components

### Passkey Setup Page Features

1. **Intro Screen**
   - Security benefits explanation
   - Multi-chain wallet creation info
   - Quick access benefits
   - "Set Up Passkey" button
   - "Skip for now" option

2. **Creating Screen**
   - Loading spinner
   - "Creating Your Wallet" message
   - Instructions to follow device prompts

3. **Success Screen**
   - Success checkmark
   - "Passkey Set Up Successfully!" message
   - Auto-redirect to dashboard

---

## 🔐 Security Features

- ✅ Passkey creation requires user interaction
- ✅ Seed phrase generated client-side only
- ✅ Seed phrase encrypted before sending to backend
- ✅ Wallet addresses stored in JSONB column
- ✅ User must authenticate to access setup page

---

## 🧪 Testing

### Test Scenarios

1. **New User Signup**
   - Sign up with email
   - Verify redirect to `/passkey-setup`
   - Set up passkey
   - Verify redirect to dashboard
   - Verify wallet addresses exist

2. **Existing User Without Passkey**
   - Login with email
   - Verify redirect to `/passkey-setup`
   - Set up passkey
   - Verify redirect to dashboard

3. **Existing User With Passkey**
   - Login with email
   - Verify direct redirect to dashboard
   - No passkey setup prompt

4. **Protected Route Access**
   - Try to access dashboard without passkey
   - Verify redirect to `/passkey-setup`
   - Set up passkey
   - Verify access to dashboard

---

## 🐛 Troubleshooting

### Issue: "Passkeys are not supported"
- **Cause:** Browser doesn't support WebAuthn
- **Solution:** Use Chrome, Safari, or Edge (latest versions)

### Issue: "Platform authenticator not available"
- **Cause:** Device doesn't support biometric authentication
- **Solution:** Use a device with fingerprint/face ID support

### Issue: Infinite redirect loop
- **Cause:** Passkey check failing or user stuck in setup
- **Solution:** Clear localStorage and try again

### Issue: "User ID is required"
- **Cause:** User not properly authenticated
- **Solution:** Ensure user is logged in before accessing setup page

---

## 📝 Notes

- Users can temporarily skip passkey setup, but will be prompted again
- Passkey setup is mandatory for wallet access
- Wallet is automatically created when passkey is set up
- All chain addresses are generated from single seed phrase

---

## ✅ Next Steps

1. Test the flow with real users
2. Add analytics to track passkey setup completion rate
3. Consider adding passkey recovery flow
4. Add UI for viewing seed phrase (requires passkey auth)

---

*Last updated: Passkey setup flow implemented*

