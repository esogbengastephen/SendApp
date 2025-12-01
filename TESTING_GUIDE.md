# Testing Guide - Payment Flow

## Complete Payment Flow

### Step 1: User Enters Details
1. Open the app at `http://localhost:3000`
2. Enter NGN amount (e.g., `1000`)
3. Enter Base wallet address (e.g., `0x1234567890123456789012345678901234567890`)
4. The $SEND amount will be calculated automatically

### Step 2: User Sends Naira Manually
1. Copy the account details shown:
   - **Name**: FlashPhotogra/Badmus O. U
   - **Account**: 9327908332
   - **Bank**: Wema
2. Send the exact NGN amount to this account via bank transfer, USSD, or mobile banking

### Step 3: User Clicks "I have sent"
1. After sending the money, click the "I have sent" button
2. The system will:
   - Store the transaction with unique ID
   - Check Paystack for recent payments matching the amount
   - Verify the payment
   - Distribute $SEND tokens to the wallet address
   - Show success/error message

## How It Works

### Transaction Flow:
1. **Unique ID Generation**: Each user gets a unique transaction ID when the page loads
2. **Transaction Storage**: When user clicks "I have sent", transaction is stored with:
   - Transaction ID (unique)
   - NGN amount
   - $SEND amount
   - Wallet address
   - Status: "pending"

3. **Payment Check**: System checks Paystack API for:
   - Recent transactions (last 50)
   - Matching amount (exact match in kobo)
   - Successful status
   - Within last hour

4. **Token Distribution**: If payment found:
   - Verify transaction with Paystack
   - Transfer $SEND tokens from liquidity pool to user's wallet
   - Update transaction with blockchain tx hash
   - Mark transaction as "completed"

## Testing Scenarios

### Test Case 1: Successful Payment
1. Enter amount: `1000` NGN
2. Enter wallet: `0x1234567890123456789012345678901234567890`
3. Send exactly `1000` NGN to account 9327908332
4. Click "I have sent" within 1 hour
5. **Expected**: Success message, tokens distributed

### Test Case 2: Payment Not Found
1. Enter amount: `1000` NGN
2. Don't send money (or send wrong amount)
3. Click "I have sent"
4. **Expected**: Error message "Payment not found"

### Test Case 3: Wrong Amount
1. Enter amount: `1000` NGN
2. Send `500` NGN instead
3. Click "I have sent"
4. **Expected**: Error message "Payment not found"

### Test Case 4: Already Processed
1. Complete a successful transaction
2. Try to process same transaction again
3. **Expected**: Message "Transaction already processed"

## Important Notes

### Time Window
- Payments are checked within the **last 1 hour**
- If payment was sent more than 1 hour ago, it won't be found
- Make sure to click "I have sent" soon after sending money

### Amount Matching
- Amount must match **exactly** (in kobo)
- Example: If you enter `1000` NGN, system looks for `100000` kobo
- Partial payments won't match

### Token Distribution Requirements
- Liquidity pool wallet must have sufficient $SEND tokens
- Liquidity pool private key must be set in `.env.local`
- Base network RPC must be accessible

## Troubleshooting

### "Payment not found" Error
- ✅ Check that payment was sent to correct account (9327908332)
- ✅ Verify amount matches exactly
- ✅ Ensure payment was sent within last hour
- ✅ Check Paystack dashboard to confirm payment was received

### "Token distribution failed" Error
- ✅ Check liquidity pool has enough $SEND tokens
- ✅ Verify `LIQUIDITY_POOL_PRIVATE_KEY` is set correctly
- ✅ Check Base network RPC is accessible
- ✅ Verify wallet address is valid Base address

### Transaction Already Processed
- Each transaction can only be processed once
- If you need to test again, refresh the page to get a new transaction ID

## Environment Setup

Make sure `.env.local` has:
```bash
PAYSTACK_SECRET_KEY=sk_test_6918bc44cee106b588e3329d89bacc9b9d3084f1
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_91d63df93b23c78e6d62f7ae9cc77c335a1dd7a8
LIQUIDITY_POOL_PRIVATE_KEY=0x_your_private_key_here
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
```

## Monitoring

Check server logs for:
- Transaction storage
- Payment verification
- Token distribution status
- Blockchain transaction hashes

