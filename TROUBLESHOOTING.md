# Troubleshooting Admin Authentication

## Issue: Admin wallet not working after adding to .env.local

### Step 1: Verify Environment Variable

Check that your `.env.local` file contains:
```bash
NEXT_PUBLIC_ADMIN_WALLETS=0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0
```

**Important**: 
- No spaces around the `=` sign
- No quotes around the wallet address
- Wallet address should be exactly as shown (case doesn't matter, but format matters)

### Step 2: Restart Development Server

**CRITICAL**: After updating `.env.local`, you MUST restart your development server:

1. Stop the current server (Ctrl+C or Cmd+C)
2. Start it again:
   ```bash
   npm run dev
   ```

Environment variables are only loaded when the server starts!

### Step 3: Check Debug Endpoint

Visit this URL in your browser (development only):
```
http://localhost:3000/api/admin/debug
```

This will show:
- The raw environment variable value
- Parsed wallet addresses
- Count of admin wallets

### Step 4: Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Try connecting your wallet
4. Look for debug logs that show:
   - The wallet address being checked
   - The admin wallets list
   - Whether the wallet was found

### Step 5: Check Server Logs

Look at your terminal where `npm run dev` is running. You should see logs like:
```
Checking admin wallet: 0x084dc081e43c8f36e7a8fa93228b82a40a6673d0
Admin wallets from env: [ '0x084dc081e43c8f36e7a8fa93228b82a40a6673d0' ]
Wallet found in ADMIN_WALLETS
```

### Common Issues

#### Issue: "Wallet is not authorized as admin"
- **Solution**: Make sure you restarted the dev server after adding the wallet to `.env.local`
- **Solution**: Check for typos in the wallet address
- **Solution**: Ensure no extra spaces or quotes in `.env.local`

#### Issue: Environment variable not loading
- **Solution**: Make sure the file is named exactly `.env.local` (not `.env` or `.env.local.txt`)
- **Solution**: Make sure the file is in the project root directory
- **Solution**: Restart the dev server

#### Issue: Wallet connects but verification fails
- **Solution**: Check browser console for error messages
- **Solution**: Make sure you're signing the message when prompted
- **Solution**: Check that your wallet is connected to Base network

### Still Not Working?

1. Check the debug endpoint: `http://localhost:3000/api/admin/debug`
2. Check browser console for errors
3. Check server terminal for debug logs
4. Verify wallet address matches exactly (case-insensitive, but format must be correct)
5. Try disconnecting and reconnecting your wallet
6. Clear browser localStorage and try again

