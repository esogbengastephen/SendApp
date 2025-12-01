# Email Setup Guide (Resend SMTP)

This guide will help you set up email sending using Resend for the authentication system.

## Step 1: Create a Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account (100 emails/day free tier)
3. Verify your email address

## Step 2: Get Your API Key

1. After logging in, go to **API Keys** in the dashboard
2. Click **Create API Key**
3. Give it a name (e.g., "Send Token Platform")
4. Copy the API key (starts with `re_`)

## Step 3: Verify Your Domain (Optional but Recommended)

For production, you should verify your domain:

1. Go to **Domains** in Resend dashboard
2. Click **Add Domain**
3. Enter your domain (e.g., `yourdomain.com`)
4. Add the DNS records Resend provides to your domain's DNS settings
5. Wait for verification (usually takes a few minutes)

**Note:** For development/testing, you can use Resend's default domain `onboarding@resend.dev` without verification.

## Step 4: Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Resend Email Service
RESEND_API_KEY=re_G4cFsDNC_BNZQzb8W9tNhDcyDwuPaDsKq
RESEND_FROM_EMAIL=onboarding@resend.dev
```

### For Production (with verified domain):

```bash
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

## Step 5: Test Email Sending

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Go to `/auth` and try to sign up
3. Enter your email address
4. Check your email inbox for the confirmation code
5. Check the server console for any errors

## Troubleshooting

### Email Not Received

1. **Check Spam Folder**: Sometimes emails go to spam initially
2. **Check Console Logs**: Look for error messages in the terminal
3. **Verify API Key**: Make sure `RESEND_API_KEY` is set correctly
4. **Check Resend Dashboard**: Go to Resend dashboard → Emails to see delivery status

### Common Errors

**"RESEND_API_KEY not configured"**
- Add `RESEND_API_KEY` to your `.env.local` file
- Restart your development server

**"Invalid API key"**
- Verify your API key in Resend dashboard
- Make sure there are no extra spaces in `.env.local`

**"Domain not verified"**
- For production, verify your domain in Resend
- For development, use `onboarding@resend.dev`

### Rate Limits

Resend free tier includes:
- 100 emails per day
- 3,000 emails per month

For higher limits, upgrade your Resend plan.

## Alternative Email Services

If you prefer a different email service, you can modify `app/api/auth/send-email/route.ts`:

### SendGrid
```typescript
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
await sgMail.send({
  to: email,
  from: 'noreply@yourdomain.com',
  subject: 'Your Confirmation Code',
  html: htmlEmail,
});
```

### AWS SES
```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
const ses = new SESClient({ region: 'us-east-1' });
await ses.send(new SendEmailCommand({
  Source: 'noreply@yourdomain.com',
  Destination: { ToAddresses: [email] },
  Message: {
    Subject: { Data: 'Your Confirmation Code' },
    Body: { Html: { Data: htmlEmail } },
  },
}));
```

## Email Template Customization

The email template is in `app/api/auth/send-email/route.ts`. You can customize:
- Colors (currently uses your primary green `#34ff4d`)
- Logo/branding
- Text content
- Layout

## Production Checklist

- [ ] Resend account created
- [ ] API key added to environment variables
- [ ] Domain verified (for production)
- [ ] `RESEND_FROM_EMAIL` set to your verified domain
- [ ] Test emails sent successfully
- [ ] Email template customized with your branding
- [ ] Environment variables added to Vercel (if deploying)

