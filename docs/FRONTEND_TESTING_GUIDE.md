# 🧪 Frontend Testing Guide - 3-Layer Gasless Swap System

## ✅ System Status: READY FOR TESTING

The 3-layer hybrid gasless swap system is now fully operational and ready for frontend testing!

### 🎯 What's Been Implemented:

1. **Layer 1 (0x Gasless/Permit2)**: Free approval, only pay gas for swap tx
2. **Layer 2 (0x Traditional)**: Standard swap with on-chain approval
3. **Layer 3 (Aerodrome)**: Reliable DEX fallback for SEND token
4. **Automatic Cascading**: System automatically tries next layer if one fails

---

## 📋 Testing Steps

### **Step 1: Create New User & Get Wallet Address**

1. Open your app: `http://localhost:3000`
2. Navigate to the off-ramp page
3. Fill in user details:
   - **Email**: `frontend-test@example.com`
   - **Account Number**: (10 digits, e.g., `9876543210`)
   - **Account Name**: Your name
   - **Bank Code**: (e.g., `058` for GTBank)
4. Click "Generate Payment Address"
5. **COPY the generated wallet address** (should be like `0x...`)

### **Step 2: Send SEND Tokens**

Send **1-5 SEND tokens** to the generated wallet address from your personal wallet (MetaMask, Coinbase Wallet, etc.)

**Where to get SEND tokens:**
- You can buy on Aerodrome or Uniswap
- Or use existing tokens from: `0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0` (has 281 SEND)

### **Step 3: Trigger the Swap**

Once tokens are received, the system should automatically detect them and offer to swap. If not:

1. Find your transaction in the admin panel
2. Click "Swap to USDC"
3. The system will:
   - ✅ Try Layer 1 (Gasless) first
   - ⚠️ If fails, try Layer 2 (0x Traditional)
   - 🛡️ If fails, try Layer 3 (Aerodrome)
   - 💰 Swap SEND → USDC
   - 📤 Transfer USDC to receiver wallet
   - 🔄 Recover remaining ETH to master wallet

---

## 🔍 What to Watch For

### **Expected Console Logs:**

```
[Smart Swap] 🎯 3-Layer Cascade Routing
[Smart Swap] 🎯 LAYER 1: Trying 0x GASLESS (Permit2)...
```

**Best Case (Layer 1 Success):**
```
[Smart Swap] ✅ LAYER 1 SUCCESS - Gasless swap ready!
[Swap Token] 💰 Cost: Approval is free (Permit2)
[Swap Token] 📝 Signing Permit2 message...
[Swap Token] ✅ Swap completed successfully
```

**Fallback (Layer 2):**
```
[Smart Swap] ⚠️  LAYER 1 FAILED
[Smart Swap] ✅ LAYER 2 SUCCESS - 0x traditional
[Swap Token] 💰 Cost: ~$0.60 ETH
```

**Last Resort (Layer 3):**
```
[Smart Swap] ⚠️  LAYER 2 FAILED
[Smart Swap] ✅ LAYER 3 SUCCESS - Aerodrome
[Swap Token] 💰 Cost: ~$0.60 ETH
```

---

## ✅ Success Indicators

After swap completes successfully, you should see:

1. **In your wallet balances:**
   - ✅ Test wallet: 0 SEND (swapped)
   - ✅ Receiver wallet: Increased USDC balance
   - ✅ Master wallet: Recovered ETH (if any leftover)

2. **In the UI:**
   - Status: "Completed"
   - USDC amount received
   - Transaction hashes for swap and transfer

3. **In console logs:**
   - `[Swap Token] ✅ Swap successful using <provider> (Layer X)`
   - `[Swap Token] ✅ USDC transferred to receiver wallet`
   - `[Swap Token] ✅ Remaining ETH sent to master wallet`

---

## ❌ Troubleshooting

### If swap fails:

1. **Check which layer failed:**
   - Look for "LAYER X FAILED" in console
   - Did all 3 layers fail? (That's unusual)

2. **Check wallet balances:**
   - Does test wallet have SEND tokens?
   - Does master wallet have ETH for gas?

3. **Check transaction hash on BaseScan:**
   - Copy the tx hash from error message
   - Visit: `https://basescan.org/tx/<hash>`
   - Look for revert reason

4. **Common issues:**
   - **Insufficient ETH**: Master wallet needs ETH for gas
   - **Stale quote**: Price moved too much (increase slippage)
   - **Low liquidity**: Try smaller amount first

---

## 📊 Expected Costs

| Layer | Approval Cost | Swap Cost | Total |
|-------|--------------|-----------|--------|
| Layer 1 (Gasless) | $0 (signature) | ~$0.30 | ~$0.30 |
| Layer 2 (0x) | ~$0.30 | ~$0.30 | ~$0.60 |
| Layer 3 (Aerodrome) | ~$0.30 | ~$0.30 | ~$0.60 |

**Savings with Layer 1:** ~50% cheaper! ($0.30 vs $0.60)

---

## 🚀 Ready to Test!

Server is running at: `http://localhost:3000`

**When you're ready:**
1. Create a new user
2. Send SEND tokens
3. Trigger the swap
4. **Report back with:**
   - ✅ Which layer succeeded (1, 2, or 3)?
   - ✅ Did USDC arrive in receiver wallet?
   - ✅ Any error messages?

Good luck! 🎉
