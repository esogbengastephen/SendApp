# ClubKonnect API Setup Guide

This guide will walk you through setting up ClubKonnect API integration for utility services (Airtime, Data, TV, Betting) step by step.

## Prerequisites

- A ClubKonnect account (register at https://www.clubkonnect.com)
- Your server's public IP address
- Access to your `.env.local` file

---

## Step 1: Create/Login to ClubKonnect Account

1. **Visit ClubKonnect Website**
   - Go to https://www.clubkonnect.com
   - Click "Register" if you don't have an account
   - Fill in your details and complete registration

2. **Fund Your Account**
   - Log in to your ClubKonnect account
   - Navigate to "Fund Account" or "Deposit"
   - Add funds to your wallet (minimum amount varies)
   - You'll need funds to test purchases

---

## Step 2: Get Your API Credentials

1. **Access API Documentation**
   - Log in to your ClubKonnect account
   - Navigate to "Developer's API" or go to: https://www.clubkonnect.com/APIDocs.asp

2. **Get Your UserID**
   - Your UserID is your ClubKonnect username
   - It usually starts with "CK" followed by numbers (e.g., `CK101264658`)
   - You can find it in your account dashboard or API documentation page

3. **Generate API Key**
   - Go to any API documentation page (e.g., https://www.clubkonnect.com/APIParaGetAirTimeV1.asp)
   - You'll see a table showing your UserID and APIKey
   - If you need a new key, click "Generate New Key" link
   - **Important**: Copy and save your API key immediately - you may not be able to see it again!

4. **Get Your Password**
   - Your password is the password you use to log in to ClubKonnect
   - This is used for API authentication

---

## Step 3: Whitelist Your Server IP Address

**CRITICAL**: ClubKonnect requires your server's IP address to be whitelisted before API calls will work.

1. **Find Your Server's Public IP Address**
   
   **For Local Development:**
   - Visit https://whatismyipaddress.com or https://api.ipify.org
   - Copy your public IP address
   - **Note**: If your IP changes (dynamic IP), you'll need to update it in ClubKonnect

   **For Production (Vercel/Netlify/etc):**
   - Check your hosting provider's documentation for outbound IP addresses
   - Some providers have static IPs, others use dynamic IPs
   - You may need to contact support for your server's IP range

2. **Whitelist Your IP in ClubKonnect**
   - Visit: https://www.clubkonnect.com/APIParaWhitelistServerIPV1.asp
   - Log in if prompted
   - Enter your server's public IP address
   - Submit to whitelist
   - **Note**: It may take a few minutes for the whitelist to take effect

---

## Step 4: Configure Environment Variables

1. **Open Your `.env.local` File**
   - Located in your project root directory
   - If it doesn't exist, create it

2. **Add ClubKonnect Credentials**
   Add these three environment variables:

   ```env
   # ClubKonnect API Credentials
   CLUBKONNECT_API_KEY=your_api_key_here
   CLUBKONNECT_API_USERNAME=your_userid_here
   CLUBKONNECT_API_PASSWORD=your_password_here
   ```

   **Example:**
   ```env
   CLUBKONNECT_API_KEY=3WV852K1T5O148SF3707NTLXT3UBM79M79P028877KRV3C1914D7C8EZTUJF7WDI
   CLUBKONNECT_API_USERNAME=CK101264658
   CLUBKONNECT_API_PASSWORD=uF@p394a.n#bs8H
   ```

3. **Save the File**
   - Make sure there are no spaces around the `=` sign
   - Don't use quotes unless the value contains spaces
   - Don't commit this file to git (it should be in `.gitignore`)

4. **Restart Your Development Server**
   - Stop your Next.js server (Ctrl+C)
   - Start it again: `npm run dev`
   - Environment variables are loaded when the server starts

---

## Step 5: Verify Configuration

1. **Check Environment Variables are Loaded**
   - The app will log errors if credentials are missing
   - Check your terminal/console for any credential-related errors

2. **Test API Connection**
   - Try making a small test purchase (e.g., ₦50 airtime)
   - Check the browser console (F12) for `[ClubKonnect]` logs
   - Check your server terminal for API call logs

---

## Step 6: Test a Purchase

1. **Start Your Development Server**
   ```bash
   npm run dev
   ```

2. **Navigate to Utility Service**
   - Go to `/buy-airtime` for airtime
   - Go to `/buy-data` for data bundles
   - Go to `/tv-sub` for TV subscriptions
   - Go to `/pay-betting` for betting wallet funding

3. **Make a Test Purchase**
   - Select a network (MTN, GLO, Airtel, 9mobile)
   - Enter a test phone number
   - Enter a small amount (minimum ₦50 for airtime)
   - Click "Purchase"

4. **Check the Response**
   - **Success**: You'll see a success message and the transaction will be recorded
   - **Error**: Check the error message and logs

---

## Step 7: Monitor API Calls

### Check Server Logs

When you make a purchase, you'll see logs like:

```
[ClubKonnect] Making API call to: https://www.nellobytesystems.com/APIAirtimeV1.asp
[ClubKonnect] Full URL: https://www.nellobytesystems.com/APIAirtimeV1.asp?UserID=CK101264658&APIKey=***&...
[ClubKonnect] Parameters: { UserID: 'CK101264658', APIKey: '***', ... }
[ClubKonnect] Raw response: {"orderid":"789","statuscode":"100","status":"ORDER_RECEIVED"}
[ClubKonnect] Parsed response: { orderid: '789', statuscode: '100', status: 'ORDER_RECEIVED' }
```

### Check Browser Console

Open browser DevTools (F12) → Console tab to see:
- API request/response details
- Error messages
- Transaction status

---

## Troubleshooting

### Error: "API authentication failed"

**Possible Causes:**
1. ❌ IP address not whitelisted
2. ❌ Incorrect API credentials
3. ❌ API key expired or regenerated

**Solutions:**
- Verify IP is whitelisted: https://www.clubkonnect.com/APIParaWhitelistServerIPV1.asp
- Double-check credentials in `.env.local`
- Generate a new API key if needed
- Restart your development server after changing `.env.local`

### Error: "INVALID_CREDENTIALS"

**Solution:**
- Verify your `CLUBKONNECT_API_USERNAME` matches your UserID (usually starts with "CK")
- Verify your `CLUBKONNECT_API_KEY` is correct
- Check that there are no extra spaces in your `.env.local` file

### Error: "MISSING_MOBILENETWORK"

**Solution:**
- Ensure you select a network before making a purchase
- Network is required for airtime and data purchases

### Error: "INVALID_RECIPIENT"

**Solution:**
- Phone number should be in format: `08123456789` (11 digits, starting with 0)
- Remove any spaces, dashes, or country codes
- Ensure the phone number is valid for the selected network

### Error: "MINIMUM_50"

**Solution:**
- Minimum purchase amount is ₦50 for airtime
- Check the minimum amount for other services

### Error: "Insufficient funds"

**Solution:**
- Fund your ClubKonnect wallet
- Check your balance in your ClubKonnect account dashboard

### HTML Response Instead of JSON

**Possible Causes:**
1. IP not whitelisted (redirects to login page)
2. Invalid endpoint URL
3. API credentials incorrect

**Solution:**
- Check server logs for the actual response
- Verify IP whitelisting
- Verify API credentials

---

## Network Codes Reference

ClubKonnect uses numeric codes for networks:

| Network | Code |
|---------|------|
| MTN     | 01   |
| GLO     | 02   |
| 9mobile | 03   |
| Airtel  | 04   |

The app automatically converts network names to codes, so you don't need to worry about this.

---

## API Endpoints Reference

The app uses these ClubKonnect API endpoints:

- **Airtime**: `https://www.nellobytesystems.com/APIAirtimeV1.asp`
- **Data**: `https://www.nellobytesystems.com/APIDatabundleV1.asp`
- **TV**: `https://www.nellobytesystems.com/APICableTVV1.asp`
- **Betting**: `https://www.nellobytesystems.com/APIBettingV1.asp`

---

## Status Codes Reference

ClubKonnect returns these status codes:

| Status Code | Meaning | Action |
|-------------|---------|--------|
| 100 | ORDER_RECEIVED | Order received, processing |
| 200 | ORDER_COMPLETED | Order completed successfully |
| Other | Error | Check error message |

---

## Production Deployment

When deploying to production (Vercel, Netlify, etc.):

1. **Add Environment Variables in Hosting Platform**
   - Go to your hosting platform's dashboard
   - Navigate to Settings → Environment Variables
   - Add the three ClubKonnect variables:
     - `CLUBKONNECT_API_KEY`
     - `CLUBKONNECT_API_USERNAME`
     - `CLUBKONNECT_API_PASSWORD`

2. **Whitelist Production IP**
   - Get your production server's IP address from your hosting provider
   - Whitelist it in ClubKonnect: https://www.clubkonnect.com/APIParaWhitelistServerIPV1.asp

3. **Redeploy**
   - After adding environment variables, redeploy your application
   - Test a purchase to verify it works

---

## Support

If you continue to have issues:

1. **Check ClubKonnect Documentation**
   - https://www.clubkonnect.com/APIDocs.asp

2. **Contact ClubKonnect Support**
   - Phone: 07080631845
   - Email: Check their contact page

3. **Check Application Logs**
   - Server terminal logs
   - Browser console logs
   - Look for `[ClubKonnect]` prefixed messages

---

## Quick Checklist

- [ ] ClubKonnect account created and funded
- [ ] API credentials obtained (UserID, API Key, Password)
- [ ] Server IP address whitelisted in ClubKonnect
- [ ] Environment variables added to `.env.local`
- [ ] Development server restarted
- [ ] Test purchase attempted
- [ ] Logs checked for errors
- [ ] Production environment variables configured (if deploying)

---

**Last Updated**: December 2024

