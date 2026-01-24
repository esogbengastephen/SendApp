# Smart Wallet Setup Guide

## Overview

This guide explains how to set up smart wallets for the crypto-to-naira off-ramp feature using Coinbase Developer Platform.

## Prerequisites

1. **Coinbase Developer Platform Account**
   - Sign up at https://portal.cdp.coinbase.com/
   - Create a new project
   - Get your API credentials

2. **Base Gasless Campaign (Optional but Recommended)**
   - Apply for Base Gasless Campaign to get $15,000/month in gas credits
   - Visit: https://docs.base.org/smart-wallet/concepts/base-gasless-campaign

## Installation

Install the required packages:

```bash
npm install @coinbase/coinbase-sdk @coinbase/onchainkit
```

## Environment Variables

Add these to your `.env.local` file:

```bash
# Coinbase Developer Platform
COINBASE_API_KEY_NAME=your_api_key_name
COINBASE_API_KEY_PRIVATE_KEY=your_private_key
COINBASE_APP_ID=your_app_id
COINBASE_PAYMASTER_ENABLED=true

# Base Network (if not already set)
NEXT_PUBLIC_BASE_RPC_URL=https://base.llamarpc.com

# Admin Wallets (for receiving USDC after swaps)
# Base Network Admin Wallet
ADMIN_WALLET_ADDRESS=your_base_admin_wallet_address
ADMIN_WALLET_PRIVATE_KEY=your_base_admin_private_key

# Solana Network Admin Wallet
SOLANA_ADMIN_WALLET_ADDRESS=your_solana_admin_wallet_address
SOLANA_ADMIN_WALLET_PRIVATE_KEY=your_solana_admin_private_key_hex

# Solana RPC (if not already set)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# App URL (for internal API calls)
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Or for production:
# NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Database Migration

Run the migration to add smart wallet fields:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Run the migration file: `supabase/migrations/024_add_smart_wallet_fields.sql`

Or use the Supabase CLI:

```bash
supabase migration up
```

## Getting Coinbase API Credentials

1. **Sign up for Coinbase Developer Platform**
   - Visit: https://portal.cdp.coinbase.com/
   - Create an account or sign in

2. **Create a New Project**
   - Click "Create Project"
   - Enter project name and description
   - Select Base network

3. **Get API Credentials**
   - Go to Project Settings
   - Navigate to API Keys section
   - Create a new API key
   - Copy:
     - API Key Name
     - API Key Private Key
     - App ID

4. **Enable Paymaster (Optional)**
   - Go to Paymaster settings
   - Enable paymaster for your project
   - Configure sponsorship rules if needed

## Base Gasless Campaign Setup

1. **Apply for Gasless Campaign**
   - Visit: https://docs.base.org/smart-wallet/concepts/base-gasless-campaign
   - Fill out the application form
   - Wait for approval (usually 1-2 business days)

2. **Benefits**
   - Up to $15,000/month in free gas credits
   - Better user experience (gasless transactions)
   - Lower operational costs

3. **Without Campaign**
   - You still get $100 in free credits when you sign up
   - You'll need to fund the paymaster yourself after credits are used

## How It Works

### Base/SEND Network (Smart Wallet)

1. **User requests off-ramp**
   - User enters bank account details
   - Selects "Base / SEND" network

2. **Smart wallet creation**
   - System checks if user has existing smart wallet
   - If not, creates new smart wallet using Coinbase SDK
   - Stores encrypted private key in database

3. **User sends tokens**
   - User sends verified tokens to smart wallet address
   - Gas fees are sponsored by paymaster (if enabled)

4. **Token processing**
   - System monitors wallet for incoming tokens
   - Verifies token is in whitelist
   - Swaps token to USDC
   - Pays user in Naira

### Solana Network (Regular Wallet)

1. **User requests off-ramp**
   - User enters bank account details
   - Selects "Solana" network

2. **Solana wallet creation**
   - System generates new Solana keypair
   - Stores encrypted private key in database

3. **User sends tokens**
   - User sends verified tokens to Solana wallet address
   - User pays gas fees (you can sponsor later)

4. **Token processing**
   - System monitors wallet for incoming tokens
   - Verifies token is in whitelist
   - Swaps token to USDC using Jupiter
   - Pays user in Naira

## Verified Tokens

The system includes a `verified_tokens` table that stores whitelisted tokens.

### Default Verified Tokens

**Base Network:**
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- SEND: `0xEab49138BA2Ea6dd776220fE26b7b8E446638956`
- WETH: `0x4200000000000000000000000000000000000006`

**Solana Network:**
- USDC: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- SOL: `So11111111111111111111111111111111111111112`

### Adding New Verified Tokens

You can add tokens via SQL:

```sql
INSERT INTO verified_tokens (network, token_address, token_symbol, token_name, token_decimals, is_verified)
VALUES ('base', '0x...', 'TOKEN', 'Token Name', 18, true);
```

Or via admin panel (if implemented).

## Testing

1. **Test Smart Wallet Creation**
   - Go to `/offramp` page
   - Enter bank account details
   - Select "Base / SEND" network
   - Click "Generate Wallet Address"
   - Verify wallet address is displayed

2. **Test Solana Wallet Creation**
   - Go to `/offramp` page
   - Enter bank account details
   - Select "Solana" network
   - Click "Generate Wallet Address"
   - Verify wallet address is displayed

3. **Test API Endpoints**
   ```bash
   # Create smart wallet
   curl -X POST http://localhost:3000/api/smart-wallet/create \
     -H "Content-Type: application/json" \
     -d '{"userId":"...","userEmail":"...","network":"base"}'

   # Get wallet address
   curl http://localhost:3000/api/smart-wallet/address?userId=...&network=base
   ```

## Troubleshooting

### Error: "@coinbase/coinbase-sdk is not installed"
- Run: `npm install @coinbase/coinbase-sdk @coinbase/onchainkit`

### Error: "Coinbase Developer Platform credentials not configured"
- Check that all three environment variables are set:
  - `COINBASE_API_KEY_NAME`
  - `COINBASE_API_KEY_PRIVATE_KEY`
  - `COINBASE_APP_ID`

### Error: "Failed to create smart wallet"
- Verify your Coinbase API credentials are correct
- Check that your project is enabled for Base network
- Ensure you have sufficient credits in your Coinbase account

### Smart wallet address not showing
- Check browser console for errors
- Verify database migration was run successfully
- Check that user exists in database

## Security Notes

1. **Private Key Encryption**
   - All private keys are encrypted before storing in database
   - Encryption uses user ID as key
   - Never store plaintext private keys

2. **API Security**
   - All API endpoints require authentication
   - Use Supabase RLS policies for additional security
   - Never expose private keys in API responses

3. **Paymaster Configuration**
   - Configure allowlists for paymaster
   - Only sponsor gas for verified operations
   - Monitor paymaster usage to prevent abuse

## Next Steps

After setting up smart wallets, you'll need to implement:

1. **Token Monitoring**
   - Background job to check wallet balances
   - Detect incoming tokens
   - Update transaction status

2. **Token Verification**
   - Check if token is in verified list
   - Verify liquidity on DEX
   - Get token price

3. **Token Swapping**
   - Base: Integrate 1inch or other DEX aggregator
   - Solana: Integrate Jupiter swap

4. **Naira Payout**
   - Integrate Paystack transfer
   - Calculate exchange rate
   - Handle fees

## Support

For issues or questions:
- Coinbase Developer Platform Docs: https://docs.cdp.coinbase.com/
- Base Smart Wallet Docs: https://docs.base.org/smart-wallet/
- Project Issues: Create an issue in your repository
