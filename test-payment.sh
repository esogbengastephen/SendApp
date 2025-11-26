#!/bin/bash

# Test Payment Script
# Use this to simulate payments during local development

echo "🧪 Testing Payment Simulation..."
echo ""

# Get user details from arguments or use defaults
USER_ID="${1:-96e822b4-de0b-40b6-b91b-4b0fdb46b47e}"
WALLET="${2:-0xa66451D101E08cdA725EEaf2960D2515cFfc36F6}"
AMOUNT="${3:-100}"
ACCOUNT="${4:-9327981133}"

echo "📋 Details:"
echo "  User ID: $USER_ID"
echo "  Wallet: $WALLET"
echo "  Amount: $AMOUNT NGN"
echo "  Account: $ACCOUNT"
echo ""

# Make the API call
response=$(curl -s -X POST http://localhost:3000/api/test/simulate-payment \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"walletAddress\": \"$WALLET\",
    \"ngnAmount\": \"$AMOUNT\",
    \"virtualAccountNumber\": \"$ACCOUNT\"
  }")

echo "📤 Response:"
echo "$response" | jq '.' 2>/dev/null || echo "$response"
echo ""

# Check if successful
if echo "$response" | grep -q '"success":true'; then
    echo "✅ Payment simulated successfully!"
    txHash=$(echo "$response" | jq -r '.txHash' 2>/dev/null)
    if [ ! -z "$txHash" ] && [ "$txHash" != "null" ]; then
        echo "🔗 View transaction: https://basescan.org/tx/$txHash"
    fi
else
    echo "❌ Payment simulation failed"
fi

