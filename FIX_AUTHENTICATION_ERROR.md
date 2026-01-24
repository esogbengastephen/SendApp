# Fix "API authentication failed" Error

## Problem
You're seeing: "API authentication failed. Please verify your API credentials and ensure your server IP is whitelisted in ClubKonnect."

## Root Causes
1. **Server IP not whitelisted** (Most Common - 90% of cases)
2. **Incorrect API credentials** (Username, API Key, or Password)
3. **IP address changed** (if using dynamic IP)

---

## Solution Step-by-Step

### Step 1: Find Your Server's Public IP Address

**Option A: Using Terminal (Recommended)**
```bash
curl https://api.ipify.org
```

**Option B: Using Browser**
1. Open a new browser tab
2. Go to: https://whatismyipaddress.com
3. Copy your **IPv4 address** (looks like: `197.210.54.110`)

**Option C: Using Command Line**
```bash
# On macOS/Linux
curl ifconfig.me

# Alternative
curl icanhazip.com
```

---

### Step 2: Whitelist Your IP in ClubKonnect

1. **Open the Whitelist Page:**
   - Go to: https://www.clubkonnect.com/APIParaWhitelistServerIPV1.asp
   - **Important:** You must be logged into your ClubKonnect account

2. **Log In (if prompted):**
   - Use your ClubKonnect account credentials
   - Phone number and password

3. **Add Your IP Address:**
   - Paste your IP address (from Step 1) into the form
   - Click "Submit" or "Whitelist" button
   - You should see a confirmation message

4. **Wait for Activation:**
   - ⏰ **Wait 2-5 minutes** for the whitelist to activate
   - Sometimes it can take up to 10 minutes
   - Don't test immediately - wait a few minutes

---

### Step 3: Verify Your API Credentials

Check your `.env.local` file has all three variables:

```env
CLUBKONNECT_API_USERNAME=CK101264658
CLUBKONNECT_API_KEY=3WV852K1T5O148SF3707NTLXT3UBM79M79P028877KRV3C1914D7C8EZTUJF7WDI
CLUBKONNECT_API_PASSWORD=uF@p394a.n#bs8H
```

**Verify:**
- ✅ No spaces around the `=` sign
- ✅ No quotes around values (unless value has spaces)
- ✅ All three variables are present
- ✅ Username starts with "CK"
- ✅ API Key is long (40+ characters)
- ✅ Password matches your ClubKonnect login password

---

### Step 4: Restart Your Server

After whitelisting IP and verifying credentials:

```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

**Why restart?** Environment variables are loaded when the server starts.

---

### Step 5: Test Again

1. Go to: http://localhost:3000/buy-airtime
2. Select network: MTN
3. Enter phone: `07034494055`
4. Enter amount: `50`
5. Click "Purchase Buy Airtime"

---

## Troubleshooting

### Still Getting "Authentication Failed"?

**Check 1: IP Address Changed**
- If you're on a dynamic IP, it may have changed
- Check your current IP again: `curl https://api.ipify.org`
- If different, whitelist the new IP

**Check 2: Wrong IP Whitelisted**
- Log into ClubKonnect
- Check your whitelisted IPs
- Make sure the current IP matches

**Check 3: Credentials Wrong**
- Double-check `.env.local` file
- Verify username matches your ClubKonnect UserID
- Verify API Key is correct (get it from: https://www.clubkonnect.com/APIParaGetAirTimeV1.asp)
- Verify password matches your login password

**Check 4: Server Not Restarted**
- Environment variables only load on server start
- Must restart after changing `.env.local`

**Check 5: Production vs Development**
- If deploying to production (Vercel, etc.), you need to:
  - Whitelist the production server IP (not your local IP)
  - Add credentials to environment variables in your hosting platform

---

## For Production Servers

If you're deploying to Vercel, Netlify, or another hosting service:

1. **Find Production Server IP:**
   - Check your hosting provider's documentation
   - Some providers have static IPs
   - Contact support if needed

2. **Whitelist Production IP:**
   - Add the production server IP to ClubKonnect
   - You may need to whitelist multiple IPs (some providers use multiple)

3. **Set Environment Variables:**
   - Add credentials in your hosting platform's dashboard
   - Don't commit `.env.local` to git

---

## Quick Checklist

- [ ] Found your public IP address
- [ ] Logged into ClubKonnect account
- [ ] Visited whitelist page: https://www.clubkonnect.com/APIParaWhitelistServerIPV1.asp
- [ ] Added your IP address
- [ ] Waited 2-5 minutes for activation
- [ ] Verified credentials in `.env.local`
- [ ] Restarted development server
- [ ] Tested purchase again

---

## Still Not Working?

1. **Check Server Logs:**
   - Look at terminal where `npm run dev` is running
   - Look for `[ClubKonnect]` messages
   - Check for specific error messages

2. **Test API Directly:**
   - Visit: http://localhost:3000/api/test/clubkonnect-credentials
   - Should show credentials are configured

3. **Contact Support:**
   - If IP is whitelisted and credentials are correct
   - Contact ClubKonnect support
   - Provide your UserID and IP address
