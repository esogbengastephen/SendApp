# Flutterwave Webhook Testing Guide

This guide shows you how to test webhook endpoints without making real payments.

## Testing Methods

### Method 1: Using Browser (Easiest - GET requests only)

#### Test 1: Configuration Check
1. Open your browser
2. Go to: `https://www.flippay.app/api/test/webhook-test`
3. You'll see a JSON response showing:
   - Secret hash configuration status
   - Signature verification test results
   - Flutterwave compliance checklist

#### Test 2: Signature Verification Test
1. Go to: `https://www.flippay.app/api/test/flutterwave-webhook-simulate`
2. You'll see:
   - Signature computation details
   - Verification test results
   - Usage instructions

---

### Method 2: Using curl (Command Line)

#### Test 1: Configuration Check
```bash
curl https://www.flippay.app/api/test/webhook-test
```

#### Test 2: Signature Verification Test
```bash
curl https://www.flippay.app/api/test/flutterwave-webhook-simulate
```

#### Test 3: Simulate Full Webhook (POST)
```bash
curl -X POST https://www.flippay.app/api/test/flutterwave-webhook-simulate \
  -H "Content-Type: application/json" \
  -d '{
    "txRef": "FLW-TEST-123",
    "transactionId": "test-transaction-123",
    "amount": 1000,
    "walletAddress": "0xYourWalletAddressHere"
  }'
```

**Replace `0xYourWalletAddressHere` with an actual wallet address from your database.**

---

### Method 3: Using Postman or Insomnia (GUI Tool)

#### Setup:
1. Download [Postman](https://www.postman.com/downloads/) or [Insomnia](https://insomnia.rest/download)
2. Create a new request

#### Test 1: Configuration Check (GET)
- **Method:** GET
- **URL:** `https://www.flippay.app/api/test/webhook-test`
- Click **Send**

#### Test 2: Signature Verification (GET)
- **Method:** GET
- **URL:** `https://www.flippay.app/api/test/flutterwave-webhook-simulate`
- Click **Send**

#### Test 3: Simulate Webhook (POST)
- **Method:** POST
- **URL:** `https://www.flippay.app/api/test/flutterwave-webhook-simulate`
- **Headers:**
  - `Content-Type: application/json`
- **Body (raw JSON):**
```json
{
  "txRef": "FLW-TEST-123",
  "transactionId": "test-transaction-123",
  "amount": 1000,
  "walletAddress": "0xYourWalletAddressHere"
}
```
- Click **Send**

---

### Method 4: Using Browser Console (JavaScript)

Open browser console (F12) and run:

#### Test 1: Configuration Check
```javascript
fetch('https://www.flippay.app/api/test/webhook-test')
  .then(res => res.json())
  .then(data => console.log('Configuration:', data));
```

#### Test 2: Signature Verification
```javascript
fetch('https://www.flippay.app/api/test/flutterwave-webhook-simulate')
  .then(res => res.json())
  .then(data => console.log('Signature Test:', data));
```

#### Test 3: Simulate Webhook
```javascript
fetch('https://www.flippay.app/api/test/flutterwave-webhook-simulate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    txRef: 'FLW-TEST-123',
    transactionId: 'test-transaction-123',
    amount: 1000,
    walletAddress: '0xYourWalletAddressHere'
  })
})
  .then(res => res.json())
  .then(data => console.log('Webhook Simulation:', data));
```

---

## Step-by-Step Testing Process

### Step 1: Verify Configuration
```bash
# Browser or curl
GET https://www.flippay.app/api/test/webhook-test
```

**Expected Result:**
```json
{
  "success": true,
  "configuration": {
    "hasWebhookSecretHash": true,
    "usingSecretHash": true
  },
  "signatureVerification": {
    "success": true,
    "base64Format": true
  }
}
```

✅ **If you see `"success": true` and `"hasWebhookSecretHash": true`, configuration is correct.**

---

### Step 2: Test Signature Computation
```bash
# Browser or curl
GET https://www.flippay.app/api/test/flutterwave-webhook-simulate
```

**Expected Result:**
```json
{
  "success": true,
  "signatureVerification": {
    "secretHashConfigured": true,
    "verificationBase64": true,
    "signatureFormat": "base64"
  }
}
```

✅ **If `verificationBase64: true`, signature computation is working correctly.**

---

### Step 3: Simulate Full Webhook Call
```bash
# curl or Postman
POST https://www.flippay.app/api/test/flutterwave-webhook-simulate
Body: {
  "txRef": "FLW-TEST-123",
  "transactionId": "test-123",
  "amount": 1000,
  "walletAddress": "0xYourWalletAddress"
}
```

**Expected Result:**
```json
{
  "success": true,
  "status": 200,
  "webhookResponse": {
    "success": true,
    "message": "Transaction processed..."
  }
}
```

✅ **If `status: 200` and `webhookResponse.success: true`, the webhook is processing correctly.**

---

## Quick Test Script

Save this as `test-webhook.sh` and run: `chmod +x test-webhook.sh && ./test-webhook.sh`

```bash
#!/bin/bash

echo "🔍 Testing Flutterwave Webhook Configuration..."
echo ""

echo "1️⃣ Testing Configuration..."
curl -s https://www.flippay.app/api/test/webhook-test | jq '.configuration, .signatureVerification'

echo ""
echo "2️⃣ Testing Signature Verification..."
curl -s https://www.flippay.app/api/test/flutterwave-webhook-simulate | jq '.signatureVerification'

echo ""
echo "3️⃣ Simulating Full Webhook..."
curl -s -X POST https://www.flippay.app/api/test/flutterwave-webhook-simulate \
  -H "Content-Type: application/json" \
  -d '{
    "txRef": "FLW-TEST-'$(date +%s)'",
    "transactionId": "test-'$(date +%s)'",
    "amount": 1000,
    "walletAddress": "0x0000000000000000000000000000000000000000"
  }' | jq '.success, .status, .webhookResponse.success'

echo ""
echo "✅ Testing complete!"
```

---

## What to Look For

### ✅ Success Indicators:
- `"success": true` in all responses
- `"hasWebhookSecretHash": true`
- `"verificationBase64": true` or `"verificationHex": true`
- `"status": 200` in webhook simulation
- `"webhookResponse.success": true`

### ❌ Error Indicators:
- `"hasWebhookSecretHash": false` → Set `FLUTTERWAVE_WEBHOOK_SECRET_HASH` in Vercel
- `"verificationBase64": false` → Secret hash mismatch between Vercel and Flutterwave Dashboard
- `"status": 401` → Signature verification failed
- `"status": 404` → Transaction not found (use a real transaction ID)

---

## Troubleshooting

### If signature verification fails:
1. Check Vercel environment variable `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
2. Verify it matches Flutterwave Dashboard > Settings > Webhooks > Secret hash
3. Ensure no extra spaces or line breaks
4. Redeploy after updating environment variables

### If webhook simulation returns 404:
- Use a real `transactionId` from your database
- Or use a `txRef` that exists in your transactions table
- Check Vercel logs for detailed error messages

---

## Next Steps

After testing:
1. ✅ All tests pass → Webhook is configured correctly
2. Make a real test payment to verify end-to-end flow
3. Check Vercel logs for: `✅ Signature verification successful`
4. Verify tokens are distributed to the wallet
