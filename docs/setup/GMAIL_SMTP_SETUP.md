# Gmail SMTP Setup Guide

This guide will help you set up Gmail SMTP for sending confirmation codes.

## Step 1: Enable 2-Step Verification

1. Go to your Google Account: https://myaccount.google.com/
2. Click **Security** in the left sidebar
3. Under "Signing in to Google", click **2-Step Verification**
4. Follow the steps to enable 2-Step Verification (if not already enabled)

## Step 2: Generate Gmail App Password

1. Go to: https://myaccount.google.com/apppasswords
   - Or: Google Account → Security → 2-Step Verification → App passwords

2. **Select app**: Choose "Mail"
3. **Select device**: Choose "Other (Custom name)"
4. **Enter name**: Type "Send Token Platform" (or any name you prefer)
5. Click **Generate**

6. **Copy the 16-character password** (it will look like: `abcd efgh ijkl mnop`)
   - Remove spaces when using it: `abcdefghijklmnop`

## Step 3: Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Gmail SMTP Configuration
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
GMAIL_FROM_EMAIL=your-email@gmail.com
```

**Important:**
- `GMAIL_USER`: Your Gmail address (e.g., `youremail@gmail.com`)
- `GMAIL_APP_PASSWORD`: The 16-character app password you generated (no spaces)
- `GMAIL_FROM_EMAIL`: Usually the same as GMAIL_USER (optional, defaults to GMAIL_USER)

## Step 4: Restart Your Dev Server

```bash
# Stop the server (Ctrl+C) and restart
npm run dev
```

## Step 5: Test Email Sending

1. Go to `/auth` and try to sign up
2. Enter your email address
3. Check your inbox for the confirmation code
4. Check the server console for any errors

## Troubleshooting

### "Invalid login" or "Authentication failed"

- **Check App Password**: Make sure you're using the App Password, not your regular Gmail password
- **Verify 2-Step Verification**: Make sure 2-Step Verification is enabled
- **Check for spaces**: Remove any spaces from the app password
- **Regenerate password**: Try generating a new app password

### "Less secure app access" error

- Gmail no longer supports "less secure apps"
- You **must** use an App Password (not your regular password)
- Make sure 2-Step Verification is enabled

### Email not received

1. **Check Spam Folder**: Sometimes emails go to spam initially
2. **Check Console Logs**: Look for error messages in the terminal
3. **Verify Configuration**: Make sure all environment variables are set correctly
4. **Test with test endpoint**: Use `/api/auth/test-email` to test independently

### Rate Limits

Gmail has sending limits:
- **Free Gmail**: 500 emails per day
- **Google Workspace**: 2,000 emails per day

For higher limits, consider:
- Using a dedicated email service (SendGrid, Mailgun, etc.)
- Using multiple Gmail accounts
- Upgrading to Google Workspace

## Security Notes

⚠️ **Important Security Tips:**

1. **Never commit `.env.local`** to version control
2. **Keep App Password secret** - treat it like a regular password
3. **Use different App Passwords** for different applications
4. **Revoke App Passwords** if you suspect they're compromised

## Alternative: Use Multiple Gmail Accounts

If you need to send more emails, you can:
1. Create multiple Gmail accounts
2. Generate app passwords for each
3. Rotate between them in your code

## Production Considerations

For production:
- Consider using a dedicated email service (SendGrid, Mailgun, AWS SES)
- Gmail is fine for development and low-volume production
- Monitor your sending limits
- Set up email delivery monitoring

## Quick Test

Test your Gmail SMTP setup:

```bash
curl -X POST http://localhost:3000/api/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"your-test@email.com"}'
```

You should receive a test email if everything is configured correctly!

