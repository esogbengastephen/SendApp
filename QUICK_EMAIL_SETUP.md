# Quick Email Setup (5 Minutes)

## Step 1: Get Resend API Key

1. Go to [resend.com](https://resend.com) and sign up (free)
2. Go to **API Keys** → **Create API Key**
3. Copy the key (starts with `re_`)

## Step 2: Add to Environment Variables

Add these lines to your `.env.local` file:

```bash
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=onboarding@resend.dev
```

## Step 3: Restart Server

```bash
# Stop the server (Ctrl+C) and restart
npm run dev
```

## Step 4: Test

1. Go to `/auth`
2. Enter your email
3. Check your inbox for the confirmation code!

**That's it!** 🎉

---

**Troubleshooting:**
- Not receiving emails? Check spam folder
- Still not working? See [EMAIL_SETUP.md](./EMAIL_SETUP.md) for detailed guide

