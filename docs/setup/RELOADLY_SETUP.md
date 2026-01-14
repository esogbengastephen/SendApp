# Reloadly Gift Card API Setup Guide

## Overview

This guide explains how to configure Reloadly's Gift Card API for gift card redemption in the Send Xino platform.

**Documentation**: https://developers.reloadly.com/

---

## Step 1: Create a Reloadly Account

1. Go to [https://www.reloadly.com](https://www.reloadly.com)
2. Sign up for an account
3. Complete the verification process
4. Fund your account (if required for your use case)

---

## Step 2: Get Your API Credentials

1. Log in to your Reloadly Dashboard
2. Navigate to **Developers** → **API Settings**
3. You'll see your credentials for both **Sandbox** and **Live** environments:
   - **Client ID** (`client_id`)
   - **Client Secret** (`client_secret`)
4. Use the toggle in the sidebar to switch between Sandbox and Live modes

**Note**: 
- **Sandbox** credentials are for testing
- **Live** credentials are for production
- Keep these credentials secure and never commit them to git

---

## Step 3: Configure Environment Variables

1. **Open your `.env.local` file** in the project root directory
2. **Add Reloadly credentials:**

```env
# Reloadly Gift Card API Configuration
RELOADLY_CLIENT_ID=your_client_id_here
RELOADLY_CLIENT_SECRET=your_client_secret_here
RELOADLY_USE_SANDBOX=true  # Set to false for production
```

**Example:**
```env
RELOADLY_CLIENT_ID=abc123xyz789
RELOADLY_CLIENT_SECRET=secret_key_here_keep_secure
RELOADLY_USE_SANDBOX=true
```

3. **Save the file**
4. **Restart your development server** for changes to take effect

---

## Step 4: Update Product ID Mapping

The gift card network names need to be mapped to Reloadly product IDs. 

1. **Get available products from Reloadly:**
   - Use Reloadly's API or dashboard to get product IDs
   - Or use the `getGiftCardProducts()` function in `lib/reloadly.ts`

2. **Update the product mapping** in `lib/reloadly.ts`:

```typescript
const GIFT_CARD_PRODUCT_MAP: Record<string, number> = {
  Amazon: 123,      // Replace with actual Reloadly product ID
  iTunes: 456,      // Replace with actual Reloadly product ID
  "Google Play": 789,
  Steam: 101,
  Xbox: 202,
  PlayStation: 303,
  Netflix: 404,
  Spotify: 505,
};
```

**To get product IDs:**
- Check Reloadly's product catalog in their dashboard
- Or call the `/products` endpoint (see `getGiftCardProducts()` function)

---

## Step 5: Verify the API Endpoint

**Important**: Reloadly's API primarily focuses on **purchasing** gift cards, not redeeming user-provided codes.

The current implementation attempts to validate/redeem gift card codes. You may need to:

1. **Check Reloadly's actual API endpoints** for gift card validation/redemption
2. **Adjust the endpoint** in `lib/reloadly.ts` if Reloadly uses a different structure
3. **Verify the request/response format** matches Reloadly's documentation

**Current implementation tries:**
- `/validate` endpoint
- `/redeem` endpoint (alternative)

**You may need to:**
- Use a different service for validating gift card codes
- Or adjust the implementation to match Reloadly's actual API structure

---

## Step 6: Test the Integration

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to the gift card redeem page:**
   - Go to `/gift-card-redeem`
   - Select a gift card network (Amazon, iTunes, etc.)
   - Enter a gift card code
   - Enter an amount
   - Submit the form

3. **Check the logs:**
   - Look for `[Reloadly]` messages in your terminal
   - Check browser console (F12) for any errors
   - Verify the transaction in your database

---

## API Endpoints Reference

### Authentication
- **URL**: `https://auth.reloadly.com/oauth/token`
- **Method**: POST
- **Audience (Sandbox)**: `https://giftcards-sandbox.reloadly.com`
- **Audience (Live)**: `https://giftcards.reloadly.com`

### Gift Card Products
- **URL**: `https://giftcards.reloadly.com/products` (or sandbox equivalent)
- **Method**: GET
- **Headers**: `Authorization: Bearer {ACCESS_TOKEN}`
- **Accept**: `application/com.reloadly.giftcards-v1+json`

### Redeem Codes (for purchased cards)
- **URL**: `https://giftcards.reloadly.com/orders/transactions/{transactionId}/cards`
- **Method**: POST
- **Headers**: `Authorization: Bearer {ACCESS_TOKEN}`
- **Accept**: `application/com.reloadly.giftcards-v1+json`

---

## Troubleshooting

### Error: "Reloadly API credentials not configured"
**Solution**: Add `RELOADLY_CLIENT_ID` and `RELOADLY_CLIENT_SECRET` to your `.env.local` file

### Error: "Failed to authenticate with Reloadly"
**Possible causes:**
- Invalid client ID or secret
- Wrong environment (sandbox vs live)
- Network connectivity issues

**Solution**: 
- Verify your credentials in Reloadly dashboard
- Check that `RELOADLY_USE_SANDBOX` matches your credentials' environment

### Error: "Gift card network is not supported"
**Solution**: Update the `GIFT_CARD_PRODUCT_MAP` in `lib/reloadly.ts` with correct Reloadly product IDs

### Error: "Redemption failed" or "Invalid endpoint"
**Solution**: 
- Check Reloadly's documentation for the correct redemption/validation endpoint
- Reloadly may not support direct gift card code redemption
- You may need to use a different service or adjust the implementation

---

## Important Notes

1. **Reloadly's Primary Function**: Reloadly's API is designed for **purchasing** gift cards, not redeeming user-provided codes. You may need to:
   - Use a different service for code validation
   - Or adjust your business logic to match Reloadly's capabilities

2. **Token Caching**: Access tokens are cached for efficiency. Tokens expire after:
   - 24 hours (sandbox)
   - 60 days (live)

3. **Product IDs**: The product ID mapping in `lib/reloadly.ts` uses placeholder values. You **must** update these with actual Reloadly product IDs.

4. **API Endpoints**: The redemption endpoint may need adjustment based on Reloadly's actual API structure. Check their documentation: https://developers.reloadly.com/

---

## Next Steps

1. ✅ Configure environment variables
2. ✅ Update product ID mapping
3. ✅ Test with sandbox credentials
4. ⚠️ Verify/update the redemption endpoint based on Reloadly's actual API
5. ✅ Switch to live credentials for production
6. ✅ Monitor transactions and error logs

---

## Additional Resources

- **Reloadly Documentation**: https://developers.reloadly.com/
- **Reloadly Support**: https://support.reloadly.com/
- **API Reference**: Check Reloadly's API documentation for the latest endpoints

---

## Support

If you encounter issues:
1. Check Reloadly's documentation for API changes
2. Verify your credentials are correct
3. Check server logs for detailed error messages
4. Contact Reloadly support if needed
