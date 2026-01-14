# ClubKonnect Setup - Step by Step with Screenshots Guide

## 🎯 Overview

You need to complete these 4 main steps:
1. ✅ Get API Credentials (UserID, API Key, Password)
2. ⚠️ **Whitelist Your IP Address** (MOST IMPORTANT!)
3. ✅ Add Credentials to `.env.local`
4. ✅ Test the Integration

---

## Step 1: Get Your API Credentials

### 1.1 Login to ClubKonnect
1. Go to https://www.clubkonnect.com
2. Click "Log In" (top right)
3. Enter your phone number and password

### 1.2 Access API Documentation
1. After logging in, click "Developer's API" in the menu
   - OR go directly to: https://www.clubkonnect.com/APIParaGetAirTimeV1.asp

### 1.3 Get Your Credentials
On the API documentation page, you'll see a table with:

| Parameter | Value |
|-----------|-------|
| **UserID** | `CK101264658` ← Copy this |
| **APIKey** | `3WV852K1T5O...` ← Copy this |
| **Password** | Your login password ← You know this |

**Important Notes:**
- **UserID**: Usually starts with "CK" followed by numbers
- **APIKey**: Long alphanumeric string (copy it immediately!)
- **Password**: The password you use to log in

**To Generate New API Key:**
- Click "Generate New Key" link next to your APIKey
- Copy the new key immediately (you won't see it again!)

---

## Step 2: Whitelist Your IP Address ⚠️ CRITICAL STEP

**This is the #1 reason API calls fail!**

### 2.1 Find Your Public IP Address

**Option A: Using Website**
1. Open a new browser tab
2. Go to: https://whatismyipaddress.com
3. Copy your IPv4 address (looks like: `197.210.xx.xx`)

**Option B: Using Terminal**
```bash
curl https://api.ipify.org
```

### 2.2 Whitelist Your IP in ClubKonnect

1. **Go to IP Whitelist Page**
   - Visit: https://www.clubkonnect.com/APIParaWhitelistServerIPV1.asp
   - Log in if prompted

2. **Enter Your IP Address**
   - Paste your IP address in the form
   - Click submit/whitelist button

3. **Wait for Activation**
   - It may take 2-5 minutes for the whitelist to activate
   - You can test after a few minutes

**For Production:**
- Get your server's IP from your hosting provider
- Whitelist that IP as well
- Some providers have multiple IPs - whitelist all of them

---

## Step 3: Add Credentials to `.env.local`

### 3.1 Open `.env.local` File

1. In your project root directory, open `.env.local`
2. If it doesn't exist, create it

### 3.2 Add These Three Lines

Add these variables (replace with your actual values):

```env
CLUBKONNECT_API_KEY=your_actual_api_key_here
CLUBKONNECT_API_USERNAME=your_userid_here
CLUBKONNECT_API_PASSWORD=your_password_here
```

**Example (with real values):**
```env
CLUBKONNECT_API_KEY=3WV852K1T5O148SF3707NTLXT3UBM79M79P028877KRV3C1914D7C8EZTUJF7WDI
CLUBKONNECT_API_USERNAME=CK101264658
CLUBKONNECT_API_PASSWORD=uF@p394a.n#bs8H
```

**Important:**
- ✅ No spaces around the `=` sign
- ✅ No quotes needed (unless password has spaces)
- ✅ Each variable on its own line
- ✅ Save the file

### 3.3 Restart Your Development Server

**This is required for environment variables to load!**

1. Stop your server: Press `Ctrl+C` in terminal
2. Start it again: `npm run dev`
3. Wait for it to start

---

## Step 4: Test the Integration

### 4.1 Make a Test Purchase

1. **Start your dev server** (if not running):
   ```bash
   npm run dev
   ```

2. **Open your app** in browser:
   - Go to: http://localhost:3000/buy-airtime

3. **Fill in the form:**
   - **Network**: Select MTN, GLO, Airtel, or 9mobile
   - **Phone Number**: Enter a test number (format: `08123456789`)
   - **Amount**: Enter `50` (minimum amount)

4. **Click "Purchase"**

### 4.2 Check the Results

**Success Indicators:**
- ✅ Green success message appears
- ✅ Transaction recorded
- ✅ No error messages

**Check Logs:**
- **Browser Console** (F12 → Console tab):
  - Look for `[ClubKonnect]` messages
  - Check for any errors

- **Server Terminal**:
  - Look for logs like:
    ```
    [ClubKonnect] Making API call to: https://www.nellobytesystems.com/APIAirtimeV1.asp
    [ClubKonnect] Raw response: {"orderid":"789","statuscode":"100","status":"ORDER_RECEIVED"}
    ```

### 4.3 Common Responses

**✅ Success Response:**
```json
{
  "orderid": "789",
  "statuscode": "200",
  "status": "ORDER_COMPLETED"
}
```

**⏳ Pending Response:**
```json
{
  "orderid": "789",
  "statuscode": "100",
  "status": "ORDER_RECEIVED"
}
```
*(This means order was received and is processing)*

**❌ Error Response:**
```json
{
  "statuscode": "400",
  "status": "INVALID_CREDENTIALS"
}
```

---

## Troubleshooting Common Issues

### Issue 1: "API authentication failed" or HTML Response

**Cause:** IP address not whitelisted

**Solution:**
1. Verify your IP is whitelisted: https://www.clubkonnect.com/APIParaWhitelistServerIPV1.asp
2. Wait 5 minutes after whitelisting
3. Check your IP hasn't changed (if using dynamic IP)

### Issue 2: "INVALID_CREDENTIALS"

**Cause:** Wrong API key or username

**Solution:**
1. Double-check your `CLUBKONNECT_API_USERNAME` matches your UserID
2. Verify your `CLUBKONNECT_API_KEY` is correct
3. Generate a new API key if needed
4. Restart your server after changing `.env.local`

### Issue 3: "MISSING_MOBILENETWORK"

**Cause:** Network not selected

**Solution:**
- Select a network (MTN, GLO, Airtel, 9mobile) before purchasing

### Issue 4: "INVALID_RECIPIENT"

**Cause:** Wrong phone number format

**Solution:**
- Use format: `08123456789` (11 digits, starts with 0)
- Remove spaces, dashes, or country codes
- Ensure number is valid for selected network

### Issue 5: "Insufficient funds"

**Cause:** Not enough balance in ClubKonnect account

**Solution:**
- Fund your ClubKonnect wallet
- Check balance in your account dashboard

---

## Verification Checklist

Before testing, verify:

- [ ] ClubKonnect account is funded
- [ ] API credentials are correct (UserID, API Key, Password)
- [ ] IP address is whitelisted in ClubKonnect
- [ ] `.env.local` has all three variables set
- [ ] No spaces around `=` in `.env.local`
- [ ] Development server was restarted after adding variables
- [ ] Test purchase attempted
- [ ] Logs checked (browser console + server terminal)

---

## Quick Verification Commands

**Check if variables are set:**
```bash
# In your terminal (while server is running)
grep CLUBKONNECT .env.local
```

**Check your public IP:**
```bash
curl https://api.ipify.org
```

**Test API endpoint (replace with your credentials):**
```bash
curl "https://www.nellobytesystems.com/APIAirtimeV1.asp?UserID=YOUR_USERID&APIKey=YOUR_API_KEY&MobileNetwork=01&Amount=50&MobileNumber=08123456789&RequestID=TEST123"
```

---

## Next Steps After Setup

1. **Test all services:**
   - Airtime: `/buy-airtime`
   - Data: `/buy-data`
   - TV: `/tv-sub`
   - Betting: `/pay-betting`

2. **Monitor transactions:**
   - Check ClubKonnect dashboard for transaction history
   - Check your app's transaction logs

3. **Set up production:**
   - Add environment variables in your hosting platform
   - Whitelist production server IP
   - Test in production environment

---

## Need Help?

1. **Full Documentation**: See `docs/setup/CLUBKONNECT_SETUP_GUIDE.md`
2. **ClubKonnect Support**: 
   - Phone: 07080631845
   - Website: https://www.clubkonnect.com
3. **Check Logs**: Look for `[ClubKonnect]` messages in console/terminal

---

**Remember:** The most common issue is IP whitelisting. Always verify your IP is whitelisted before troubleshooting other issues!

