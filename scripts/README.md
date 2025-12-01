# Scripts Directory

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

