# Passkey Production Migration Guide

## Problem

Passkeys created on `localhost` during development **will not work** on the production domain `flippay.app`. This is a security feature of WebAuthn - passkeys are bound to the domain where they were created.

## Why This Happens

WebAuthn (the standard behind passkeys) requires that:
- The **RP ID** (Relying Party ID) matches the domain where the passkey was created
- A passkey created on `localhost` can only be used on `localhost`
- A passkey created on `flippay.app` can only be used on `flippay.app`

## Solution

Users who created passkeys on `localhost` need to **recreate their passkeys** on the production domain.

### For End Users

1. **Log in to the production app** at `https://flippay.app`
2. **Go to Settings** → **Security** (or `/passkey-setup` page)
3. **Delete your old passkey** (if there's an option) or just create a new one
4. **Create a new passkey** - this will be bound to `flippay.app`
5. Your wallet addresses will remain the same (they're stored separately)

### For Developers

The code has been updated to:
- ✅ Use `window.location.hostname` for RP ID (works for both localhost and production)
- ✅ Validate origin on the server side
- ✅ Provide clear error messages when domain mismatch is detected
- ✅ Guide users to recreate passkeys when needed

## Technical Details

### RP ID Configuration

The RP ID is set in `lib/passkey.ts`:

```typescript
rp: {
  name: "SendApp",
  id: typeof window !== "undefined" ? window.location.hostname : "flippay.app",
}
```

This means:
- On `localhost:3000` → RP ID = `localhost`
- On `flippay.app` → RP ID = `flippay.app`
- On `www.flippay.app` → RP ID = `www.flippay.app`

### Origin Validation

The server validates the origin in `app/api/passkey/verify/route.ts`:
- Extracts origin from `clientDataJSON`
- Compares with expected production origin
- Allows both `flippay.app` and `www.flippay.app`
- In development, also allows `localhost`

### Error Handling

When a domain mismatch is detected:
1. Client-side: Shows error message with `requiresRecreate: true`
2. Server-side: Returns error with guidance to recreate passkey
3. User is prompted to recreate passkey on the correct domain

## Migration Steps

### Option 1: Automatic (Recommended)

1. Users will see an error when trying to use a localhost passkey on production
2. Error message guides them to recreate the passkey
3. They can click through to `/passkey-setup` to recreate

### Option 2: Manual Cleanup

If you want to force all users to recreate passkeys:

1. **Database Migration** (Optional):
   ```sql
   -- Clear all passkeys created before production launch
   -- Only do this if you're sure all users need to recreate
   UPDATE users 
   SET passkey_credential_id = NULL, 
       passkey_public_key = NULL 
   WHERE passkey_created_at < '2026-01-24';
   ```

2. **Redirect Logic**:
   - Check if user has passkey but it's from localhost
   - Redirect to `/passkey-setup` with a message

## Testing

### Test Passkey Creation

1. **On Production**:
   - Visit `https://flippay.app/passkey-setup`
   - Create a passkey
   - Verify it works for login

2. **On Localhost**:
   - Visit `http://localhost:3000/passkey-setup`
   - Create a passkey
   - Verify it works for login on localhost
   - Verify it does NOT work on production (expected)

### Test Passkey Authentication

1. **Valid Passkey**:
   - Login with passkey created on the same domain
   - Should work seamlessly

2. **Invalid Passkey (Domain Mismatch)**:
   - Try to use localhost passkey on production
   - Should show error message
   - Should guide user to recreate

## Environment Variables

Ensure these are set in production:

```env
NEXT_PUBLIC_APP_URL=https://flippay.app
```

This is used for:
- Origin validation
- Email templates
- Redirect URLs

## FAQ

### Q: Will users lose their wallets if they recreate passkeys?

**A:** No. Wallet addresses are stored separately in the database. Only the passkey credential is recreated. The encrypted seed phrase remains the same.

### Q: Can we support both localhost and production passkeys?

**A:** No. WebAuthn security model requires exact domain match. Users need separate passkeys for each domain.

### Q: What if a user has multiple devices?

**A:** Each device can have its own passkey. When recreating on production, they'll need to create a new passkey on each device they want to use.

### Q: How do we prevent this in the future?

**A:** 
- Always test passkey creation on a staging domain that matches production
- Use environment-specific domains for development (e.g., `dev.flippay.app`)
- Document the domain requirement for passkeys

## Summary

✅ **Code is fixed** - Uses current domain automatically  
✅ **Error handling improved** - Clear messages for users  
✅ **Migration path clear** - Users can recreate passkeys easily  
⚠️ **Action required** - Users with localhost passkeys need to recreate them on production
