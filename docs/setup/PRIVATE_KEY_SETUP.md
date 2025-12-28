# Private Key Setup Guide

## Setting Up LIQUIDITY_POOL_PRIVATE_KEY

The `LIQUIDITY_POOL_PRIVATE_KEY` environment variable must be set correctly for token transfers to work.

### Format Requirements

1. **Must be a valid Ethereum private key**
   - 64 hexadecimal characters
   - Should start with `0x`
   - Total length: 66 characters (including `0x`)

2. **Example format:**
   ```
   0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
   ```

### Setting in .env.local

Add this line to your `.env.local` file:

```bash
LIQUIDITY_POOL_PRIVATE_KEY=0x_your_64_character_hex_private_key_here
```

**Important:**
- Remove any spaces or newlines
- Include the `0x` prefix
- The key should be exactly 64 hex characters after `0x`

### Common Issues

#### Error: "invalid private key, expected hex or 32 bytes, got string"
- **Cause:** Private key format is incorrect
- **Fix:** 
  1. Ensure the key starts with `0x`
  2. Ensure it's exactly 64 hex characters (after `0x`)
  3. Remove any spaces, newlines, or special characters
  4. Make sure there are no quotes around the key in `.env.local`

#### Error: "LIQUIDITY_POOL_PRIVATE_KEY is not set"
- **Cause:** Environment variable not found
- **Fix:**
  1. Check that `.env.local` exists in the project root
  2. Verify the variable name is exactly `LIQUIDITY_POOL_PRIVATE_KEY`
  3. Restart your development server after adding the variable

#### Error: "Invalid private key format"
- **Cause:** Key doesn't match the required format
- **Fix:**
  1. Verify the key is 66 characters total (0x + 64 hex)
  2. Check that all characters are valid hex (0-9, a-f, A-F)
  3. Ensure no extra characters or whitespace

### Security Notes

⚠️ **NEVER commit your private key to version control!**

- Always use `.env.local` (which should be in `.gitignore`)
- Never share your private key
- Use a dedicated wallet for the liquidity pool
- Only fund it with the minimum amount needed
- Regularly monitor the wallet balance

### Testing

After setting up the private key:

1. Restart your development server
2. Go to `/admin/test-transfer`
3. Click "Check Balance" - should show your pool balance
4. If you see an error, check the format of your private key

### Getting a Private Key

If you need to generate a new private key for testing:

**Option 1: Use MetaMask**
1. Create a new account in MetaMask
2. Go to Account Details → Show Private Key
3. Copy the private key (it should start with `0x`)

**Option 2: Use a tool like `cast` (Foundry)**
```bash
cast wallet new
```

**Option 3: Use Node.js**
```javascript
const { randomBytes } = require('crypto');
const privateKey = '0x' + randomBytes(32).toString('hex');
console.log(privateKey);
```

### Verification

To verify your private key is correct:

1. The key should be exactly 66 characters
2. It should start with `0x`
3. The remaining 64 characters should be valid hex (0-9, a-f, A-F)
4. No spaces or special characters

Example of a valid (but fake) private key:
```
0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

