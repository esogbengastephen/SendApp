#!/bin/bash

echo "🚀 Triggering swap..."
echo ""

curl -X POST http://localhost:3000/api/offramp/swap-token \
  -H "Content-Type: application/json" \
  -d '{"transactionId":"offramp_5xXSFS-w56w-"}' \
  2>&1 | python3 -m json.tool 2>/dev/null || cat

echo ""
echo ""
echo "📊 Checking balances..."
cd "/Users/user/Documents/Softwaer development /Send Xino"
npx tsx scripts/check-test-wallet.ts
