# Paystack Setup Guide

## Step 1: Create a Paystack Account

1. Go to [https://paystack.com](https://paystack.com)
2. Sign up for a free account
3. Complete the verification process

## Step 2: Get Your API Keys

### Test Mode Keys (for development)

1. Log in to your Paystack Dashboard
2. Go to **Settings** → **API Keys & Webhooks**
3. You'll see your **Test Secret Key** (starts with `sk_test_`) and **Test Public Key** (starts with `pk_test_`)
4. Copy both keys

### Live Mode Keys (for production)

1. Complete Paystack's compliance requirements
2. Go to **Settings** → **API Keys & Webhooks**
3. Switch to **Live Mode**
4. Copy your **Live Secret Key** (starts with `sk_live_`) and **Live Public Key** (starts with `pk_live_`)

## Step 3: Set Up Webhook URL

1. In Paystack Dashboard, go to **Settings** → **API Keys & Webhooks**
2. Scroll down to **Webhooks** section
3. Click **Add Webhook URL**
4. Enter your webhook URL:
   - **Development**: `http://localhost:3000/api/paystack/webhook` (use ngrok or similar for testing)
   - **Production**: `https://yourdomain.com/api/paystack/webhook`
5. Select events to listen for:
   - ✅ `charge.success`
   - ✅ `charge.failed`
6. Save the webhook

## Step 4: Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# Paystack Keys (Test Mode)
PAYSTACK_SECRET_KEY=sk_test_your_test_secret_key_here
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_your_test_public_key_here

# App URL (for callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Base Network
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_SEND_TOKEN_ADDRESS=0xEab49138BA2Ea6dd776220fE26b7b8E446638956

# Liquidity Pool (for token distribution)
LIQUIDITY_POOL_PRIVATE_KEY=0x_your_private_key_here

# Exchange Rate
SEND_NGN_EXCHANGE_RATE=50
```

## Step 5: Test the Integration

### Using Paystack Test Cards

Paystack provides test cards for testing payments:

**Successful Payment:**
- Card Number: `4084084084084081`
- CVV: `408`
- Expiry: Any future date (e.g., `12/25`)
- PIN: `0000` (if required)

**Failed Payment:**
- Card Number: `5060666666666666666`
- CVV: `123`
- Expiry: Any future date

### Testing Flow

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000)

3. Fill in the form:
   - Enter NGN amount (e.g., `1000`)
   - Enter a Base wallet address (e.g., `0x1234567890123456789012345678901234567890`)
   - Click "I have sent"

4. You'll be redirected to Paystack payment page

5. Use test card details to complete payment

6. After payment, you'll be redirected back to your app

7. Check the webhook logs in your terminal to see if the payment was processed

## Step 6: Monitor Transactions

- **Paystack Dashboard**: View all transactions in your Paystack dashboard
- **Application Logs**: Check your server logs for transaction processing
- **Webhook Logs**: Paystack dashboard shows webhook delivery status

## Troubleshooting

### Webhook Not Receiving Events

1. **Use ngrok for local testing:**
   ```bash
   ngrok http 3000
   ```
   Then use the ngrok URL in your webhook configuration

2. **Check webhook signature**: The webhook handler verifies Paystack signatures automatically

3. **Check logs**: Look for errors in your server console

### Payment Not Processing

1. Verify your API keys are correct
2. Check that the amount is in kobo (NGN * 100)
3. Ensure the callback URL is accessible
4. Check Paystack dashboard for transaction status

## Security Notes

- ⚠️ **Never commit your secret keys to version control**
- ⚠️ **Use test keys for development**
- ⚠️ **Switch to live keys only in production**
- ⚠️ **Keep your webhook secret secure**

