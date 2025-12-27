# Paystack Transfer Setup Guide

## ❌ Error: "You cannot initiate third party payouts at this time"

This error means your Paystack account is not enabled for transfers yet.

## ✅ Solution: Enable Transfers in Paystack

### Step 1: Login to Paystack Dashboard
1. Go to https://dashboard.paystack.com/
2. Login with your account

### Step 2: Enable Transfer Feature
1. Navigate to **Settings** → **Preferences**
2. Look for **"Transfers"** or **"Payouts"** section
3. Click **"Enable Transfers"** or **"Request Access"**

### Step 3: Submit Required Documents
Paystack may require:
- **Business Registration Documents** (CAC certificate, etc.)
- **Bank Account Verification**
- **Identity Verification** (BVN, ID card, etc.)

### Step 4: Wait for Approval
- Paystack will review your application
- This can take 1-3 business days
- You'll receive an email when approved

### Step 5: Fund Your Paystack Balance (Important!)
Even after approval, you need to have sufficient balance in your Paystack account:

1. Go to **Balance** → **Add Money**
2. Transfer NGN from your bank to Paystack
3. Ensure you have enough to cover all transfers + fees

## 🔄 Alternative: Use Manual Bank Transfer (Temporary)

While waiting for Paystack approval, you can:

### Option A: Use Test Mode
```bash
# Set in .env.local
PAYSTACK_SECRET_KEY=sk_test_... # Use test key
```

Test mode allows transfers without approval (but doesn't send real money).

### Option B: Manual Processing
1. Process swaps normally (SEND → USDC)
2. Manually transfer NGN to users from your bank
3. Mark transactions as completed in admin panel

## 📋 Checklist

- [ ] Paystack account created
- [ ] Business documents submitted
- [ ] Transfer feature requested/enabled
- [ ] Paystack account approved for transfers
- [ ] Paystack balance funded with NGN
- [ ] Test transfer successful

## 🆘 Common Issues

### "Insufficient balance"
- Fund your Paystack account first
- Check balance: Dashboard → Balance

### "Transfer feature not available"
- Contact Paystack support: support@paystack.com
- Provide: Business name, account email, reason for transfers

### "Recipient validation failed"
- Verify bank account number is correct
- Ensure bank code matches the bank
- Check if account name matches

## 📞 Support

If you still have issues:
- **Paystack Support:** support@paystack.com
- **Paystack Twitter:** @PaystackHQ
- **Phone:** +234 (1) 700-7297-8225

## ✅ Testing After Setup

Once approved, test with a small amount:

```bash
# Test transfer API
curl -X POST https://api.paystack.co/transfer \
  -H "Authorization: Bearer YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "balance",
    "amount": 100,
    "recipient": "RCP_xxx",
    "reason": "Test transfer"
  }'
```

If successful, your off-ramp system will work! 🎉
