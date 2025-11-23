# SendTag API Setup Guide

## Overview

SendTags allow users to send tokens using human-readable tags (e.g., `/lightblock`) instead of long wallet addresses. This guide explains how to configure SendTag resolution.

## Current Implementation

The SendTag resolver tries multiple API patterns to find the wallet address associated with a SendTag:

1. **Send's Public API** (if configured)
2. **Supabase PostgREST** (if Supabase is configured)

## Configuration Options

### Option 1: Send's Public API (Recommended if available)

If Send provides a public API endpoint, configure it in `.env.local`:

```bash
# Send API Configuration
SEND_API_URL=https://api.send.it  # Replace with actual Send API URL
SEND_API_KEY=your_api_key_here    # If authentication is required
```

**Note**: The actual Send API endpoint URL needs to be obtained from Send's documentation or support team.

### Option 2: Supabase Integration

If you have access to Send's Supabase database, you can query it directly:

```bash
# Supabase Configuration (already in use for admin features)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

The resolver will query the database using the following structure:
1. **tags** table: Find tag by `name` (e.g., "lightblock")
2. **send_account_tags** table: Get `send_account_id` linked to the tag
3. **send_accounts** table: Get `wallet_address` from the send account

This matches the database schema from the official SendApp repository.

## Testing SendTag Resolution

1. **Test with a known SendTag**:
   - Example: `/lightblock`
   - Enter it in the payment form
   - The system will attempt to resolve it to a wallet address

2. **Check server logs**:
   - Look for console logs showing which endpoints were tried
   - Check for error messages indicating configuration issues

## Troubleshooting

### Error: "SendTag API is not configured"

**Solution**: Add either `SEND_API_URL` or Supabase credentials to `.env.local`

### Error: "SendTag not found"

**Possible causes**:
1. The SendTag doesn't exist
2. The API endpoint URL is incorrect
3. Authentication is required but not configured
4. The database table structure is different than expected

**Solutions**:
1. Verify the SendTag format: `/username` (with forward slash)
2. Check that the SendTag exists in Send's system
3. Verify API endpoint URL and authentication
4. Use a wallet address (0x...) as a fallback

### Error: "Failed to resolve SendTag"

**Possible causes**:
1. Network timeout
2. API endpoint is down
3. Rate limiting

**Solutions**:
1. Check your internet connection
2. Verify the API endpoint is accessible
3. Wait a moment and try again
4. Use a wallet address instead

## Current Status

⚠️ **The Send API endpoint is not yet publicly documented.**

The implementation uses best-practice assumptions:
- Tries common REST API patterns
- Supports Supabase PostgREST queries
- Handles multiple response formats
- Provides helpful error messages

**Next Steps**:
1. Contact Send team for API documentation
2. Obtain the correct API endpoint URL
3. Configure authentication if required
4. Test with known SendTags

## Fallback Option

If SendTag resolution is not available, users can always use wallet addresses directly:
- Format: `0x` followed by 40 hexadecimal characters
- Example: `0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0`

