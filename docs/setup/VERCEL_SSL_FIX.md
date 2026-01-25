# Fix SSL Certificate Issue on Vercel

## Problem
Your app is showing "Connection is not secure" error with certificate issued by "WE1" (not a trusted CA). This prevents the app from loading on mobile devices.

## Solution

### 1. Configure Domain on Vercel

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Domains**
4. Add your domain: `flippay.app` and `www.flippay.app`
5. Follow Vercel's DNS configuration instructions

### 2. Update DNS Records

Add these DNS records to your domain registrar:

**For flippay.app:**
- Type: `A`
- Name: `@`
- Value: `76.76.21.21` (Vercel's IP)

**For www.flippay.app:**
- Type: `CNAME`
- Name: `www`
- Value: `cname.vercel-dns.com`

### 3. Set Environment Variable

In Vercel dashboard → Settings → Environment Variables, add:

```
NEXT_PUBLIC_APP_URL=https://flippay.app
```

**Important:** Use `https://` (not `http://`) and your actual domain.

### 4. Wait for SSL Certificate

- Vercel automatically provisions SSL certificates via Let's Encrypt
- This usually takes 5-10 minutes after DNS is configured
- You can check certificate status in Vercel dashboard → Domains

### 5. Verify SSL Certificate

After configuration, verify:
1. Visit `https://flippay.app` in a browser
2. Check the padlock icon in the address bar
3. Certificate should show "Let's Encrypt" or "Vercel" (not "WE1")

### 6. Clear Browser Cache

If you still see the error:
- Clear browser cache and cookies
- Try incognito/private mode
- Wait a few minutes for DNS propagation

## Troubleshooting

### Certificate Still Shows "WE1"
- Check DNS records are correctly configured
- Wait 10-15 minutes for DNS propagation
- Verify domain is added in Vercel dashboard
- Check Vercel deployment logs for errors

### Mixed Content Warnings
- All image URLs now use `NEXT_PUBLIC_APP_URL` environment variable
- Ensure all assets are served over HTTPS
- Check browser console for mixed content errors

### Mobile Browser Issues
- Clear mobile browser cache
- Try a different mobile browser
- Check if mobile network is blocking the domain

## Testing

After fixing:
1. Visit `https://flippay.app` on desktop
2. Visit `https://flippay.app` on mobile
3. Check SSL certificate is valid
4. Verify logo loads correctly
5. Test all pages load without security warnings

## Need Help?

If issues persist:
1. Check Vercel deployment logs
2. Verify DNS records with: `dig flippay.app`
3. Check SSL certificate: `openssl s_client -connect flippay.app:443`
4. Contact Vercel support if domain configuration fails
