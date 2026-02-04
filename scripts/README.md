# Scripts Directory

## test-okx-swap.sh

Tests the OKX DEX swap integration (quote and optional execute). Requires the dev server running and, for quotes/swap, OKX API keys in `.env.local`.

### Usage

```bash
# Config status (no keys needed)
./scripts/test-okx-swap.sh

# Quote: 1 USDC → SEND (exactIn)
./scripts/test-okx-swap.sh quote

# Quote: buy 10 SEND (exactOut)
./scripts/test-okx-swap.sh quote 10 exactOut

# Execute test swap 0.5 USDC → SEND (requires TEST_OKX_SWAP=1 and OKX keys)
./scripts/test-okx-swap.sh swap 0.5
```

Override base URL: `BASE_URL=https://your-app.vercel.app ./scripts/test-okx-swap.sh quote`

---

## verify-supabase.js

Verifies that the Supabase database is properly configured for exchange rate persistence.

### Usage

```bash
# Using environment variable
SUPABASE_SERVICE_ROLE_KEY=your_key_here node scripts/verify-supabase.js

# Or add to .env.local
echo "SUPABASE_SERVICE_ROLE_KEY=your_key_here" >> .env.local
node scripts/verify-supabase.js
```

### What it checks

1. ✅ Table exists (`platform_settings`)
2. ✅ Table structure is correct
3. ✅ Exchange rate data exists
4. ✅ Read access works
5. ✅ Write access works

### Security Note

⚠️ **Never commit your Service Role Key to Git!**

The Service Role Key has admin privileges and should be kept secret. Always use environment variables.

