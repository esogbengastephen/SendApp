# ClubKonnect Quick Setup Checklist

## ✅ Step-by-Step Setup

### 1. Get ClubKonnect Account & Credentials
- [ ] Register/Login at https://www.clubkonnect.com
- [ ] Fund your account (minimum for testing)
- [ ] Get your **UserID** (starts with "CK", e.g., `CK101264658`)
- [ ] Get your **API Key** from https://www.clubkonnect.com/APIParaGetAirTimeV1.asp
- [ ] Note your **Password** (your login password)

### 2. Whitelist Your IP Address ⚠️ CRITICAL
- [ ] Find your public IP: https://whatismyipaddress.com
- [ ] Whitelist it: https://www.clubkonnect.com/APIParaWhitelistServerIPV1.asp
- [ ] Wait a few minutes for activation

### 3. Configure Environment Variables
Open `.env.local` in your project root and add:

```env
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

### 4. Restart Server
- [ ] Stop your dev server (Ctrl+C)
- [ ] Start again: `npm run dev`

### 5. Test Purchase
- [ ] Go to `/buy-airtime`
- [ ] Select network (MTN, GLO, Airtel, 9mobile)
- [ ] Enter phone number (format: 08123456789)
- [ ] Enter amount (minimum ₦50)
- [ ] Click "Purchase"
- [ ] Check browser console (F12) for logs

---

## 🔍 Verify Your Current Setup

Check if your credentials are set correctly:

1. **Check `.env.local` file exists** in project root
2. **Verify all three variables are present:**
   - `CLUBKONNECT_API_KEY`
   - `CLUBKONNECT_API_USERNAME`
   - `CLUBKONNECT_API_PASSWORD`

3. **Check format:**
   - No spaces around `=`
   - No quotes (unless value has spaces)
   - Values are on the same line

4. **Test API connection:**
   - Make a test purchase
   - Check terminal logs for `[ClubKonnect]` messages
   - Check browser console (F12) for errors

---

## 🚨 Common Issues

| Error | Solution |
|-------|----------|
| "API authentication failed" | Whitelist your IP address |
| "INVALID_CREDENTIALS" | Check API key and username are correct |
| "MISSING_MOBILENETWORK" | Select a network before purchase |
| "INVALID_RECIPIENT" | Use format: 08123456789 (11 digits, starts with 0) |
| HTML response instead of JSON | IP not whitelisted or wrong credentials |

---

## 📞 Need Help?

1. Check full guide: `docs/setup/CLUBKONNECT_SETUP_GUIDE.md`
2. Check ClubKonnect docs: https://www.clubkonnect.com/APIDocs.asp
3. Contact ClubKonnect: 07080631845

---

**Quick Test:**
```bash
# Check if environment variables are loaded (in your terminal)
echo $CLUBKONNECT_API_USERNAME
```

If nothing shows, restart your server after adding variables to `.env.local`.

