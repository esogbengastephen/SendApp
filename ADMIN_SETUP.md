# Admin Dashboard Setup Guide

## Wallet Authentication

The admin dashboard uses wallet-based authentication. Admins must connect their Base wallet to access the dashboard.

## Setup Steps

### 1. Configure Admin Wallets

Add admin wallet addresses to your `.env.local` file:

```bash
# Admin Wallets (comma-separated list)
NEXT_PUBLIC_ADMIN_WALLETS=0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0
```

**Note:** Wallet addresses are case-insensitive, but it's recommended to use the exact format shown.

### 2. Supabase Configuration (Optional)

If you want to manage admin wallets through Supabase:

1. Get your Supabase anon key from [Supabase Dashboard](https://supabase.com/dashboard)
2. Add to `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://ksdzzqdafodlstfkqzuv.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

3. Create `admin_wallets` table in Supabase:
   ```sql
   CREATE TABLE admin_wallets (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     wallet_address TEXT UNIQUE NOT NULL,
     is_active BOOLEAN DEFAULT true,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE INDEX idx_admin_wallets_address ON admin_wallets(wallet_address);
   CREATE INDEX idx_admin_wallets_active ON admin_wallets(is_active);
   ```

4. Insert admin wallets:
   ```sql
   INSERT INTO admin_wallets (wallet_address, is_active)
   VALUES 
     ('0x1234567890123456789012345678901234567890', true),
     ('0x0987654321098765432109876543210987654321', true);
   ```

### 3. Access Admin Dashboard

1. Navigate to `/admin` in your browser
2. Connect your Base wallet (MetaMask, Coinbase Wallet, etc.)
3. Sign the authentication message
4. If your wallet is in the admin list, you'll be granted access

## Features

### Dashboard Overview
- Real-time statistics
- Revenue trends chart (last 30 days)
- Transaction volume chart (last 30 days)
- Quick actions and recent activity

### Transactions Management
- View all transactions
- Advanced filtering:
  - Status filter (All, Pending, Completed, Failed)
  - Date range filter
  - Amount range filter (min/max)
  - Search by Transaction ID, Reference, or Wallet Address
- Export to CSV
- View transaction details
- Link to blockchain explorer

### Payment Verification
- View all Paystack payments
- Manual payment verification
- Payment status tracking

### Token Distribution
- Monitor liquidity pool balance
- Check wallet balances
- View distribution history

### Settings
- Configure exchange rate
- View deposit account information

## Security Notes

- ⚠️ **Never commit admin wallet addresses to public repositories**
- ⚠️ **Use environment variables for admin wallet management**
- ⚠️ **Regularly review and update admin wallet list**
- ⚠️ **Session expires after 24 hours - re-authentication required**

## Troubleshooting

### "Wallet is not authorized as admin"
- Check that your wallet address is in `NEXT_PUBLIC_ADMIN_WALLETS`
- Verify wallet address is correct (case-insensitive)
- Check Supabase `admin_wallets` table if using Supabase

### Wallet Connection Issues
- Ensure you have a Base-compatible wallet installed
- Check that your wallet is connected to Base network
- Try refreshing the page and reconnecting

### Session Expired
- Admin sessions expire after 24 hours
- Simply reconnect your wallet to continue

