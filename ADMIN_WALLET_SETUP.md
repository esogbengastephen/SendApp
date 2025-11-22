# Admin Wallet Setup

## Your Admin Wallet Address

Add this wallet address to your `.env.local` file:

```bash
NEXT_PUBLIC_ADMIN_WALLETS=0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0
```

## Quick Setup Steps

1. Open your `.env.local` file in the project root
2. Add or update the line:
   ```bash
   NEXT_PUBLIC_ADMIN_WALLETS=0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0
   ```
3. Save the file
4. Restart your development server:
   ```bash
   npm run dev
   ```
5. Navigate to `/admin` and connect the wallet `0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0`
6. Sign the authentication message
7. You should now have access to the admin dashboard!

## Adding Multiple Admin Wallets

If you need to add multiple admin wallets, separate them with commas:

```bash
NEXT_PUBLIC_ADMIN_WALLETS=0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0,0x_another_wallet_address
```

## Verification

After adding the wallet address:
- The wallet address is case-insensitive
- Make sure there are no extra spaces
- Restart the dev server after updating `.env.local`
- The wallet must be connected to Base network

