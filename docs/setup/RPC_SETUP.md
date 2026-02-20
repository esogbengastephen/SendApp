# RPC Endpoint Setup Guide

## Rate Limit Issue

If you're getting "429 Too Many Requests" or "over rate limit" errors, the public Base RPC endpoint is rate-limiting your requests.

## Solution: Use a Better RPC Endpoint

### Option 1: Use LlamaRPC (Free, Better Rate Limits)

Add to your `.env.local`:
```bash
NEXT_PUBLIC_BASE_RPC_URL=https://base.llamarpc.com
```

### Option 2: Use Alchemy (Free Tier Available)

1. Sign up at [Alchemy](https://www.alchemy.com/)
2. Create a Base mainnet app
3. Get your API key
4. Add to `.env.local`:
```bash
NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

### Option 3: Use Infura (Free Tier Available)

1. Sign up at [Infura](https://www.infura.io/)
2. Create a Base mainnet project
3. Get your project ID
4. Add to `.env.local`:
```bash
NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.infura.io/v3/YOUR_PROJECT_ID
```

### Option 4: Use QuickNode (Free Tier Available)

1. Sign up at [QuickNode](https://www.quicknode.com/)
2. Create a Base mainnet endpoint
3. Get your endpoint URL
4. Add to `.env.local`:
```bash
NEXT_PUBLIC_BASE_RPC_URL=YOUR_QUICKNODE_ENDPOINT_URL
```

### Option 5: Avoid Base Public RPC (mainnet.base.org)

**Do not use** `https://mainnet.base.org` for production — it has strict rate limits and will return **429 / "over rate limit"**. If you see that error, your env is likely set to mainnet.base.org; switch to LlamaRPC or a keyed RPC above.

## Recommended Setup

For production, we recommend:
1. **Alchemy** or **Infura** - Most reliable, free tier available
2. **LlamaRPC** - App default; good free alternative with better rate limits than mainnet.base.org

## Current Configuration

The app uses:
1. `NEXT_PUBLIC_BASE_RPC_URL` from env (if set) — **set to `https://base.llamarpc.com` or Alchemy/QuickNode, not mainnet.base.org**
2. Fallback: `https://base.llamarpc.com` (in code default)

## Testing

After updating your `.env.local`:
1. Restart your development server
2. Try the transfer again
3. The rate limit error should be resolved

## Error Messages

- **429 Too Many Requests**: RPC endpoint is rate-limiting you
- **over rate limit**: Same as above, need a better RPC endpoint
- **Connection timeout**: RPC endpoint might be down, try another one

