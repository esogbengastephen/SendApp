# Testing the off-ramp (SEND → Naira)

## Quick: Test Flutterwave transfer only (no sweep)

To verify that **NGN payouts** work (Flutterwave keys and bank transfer):

```bash
# Default: ₦100 to 0218921864, GTBank (058)
npx tsx scripts/test-flutterwave-transfer.ts

# Custom: account number, bank code, amount (NGN)
npx tsx scripts/test-flutterwave-transfer.ts 0218921864 058 500
```

Requires Flutterwave env in `.env.local`. Bank code examples: `058` = GTBank, `011` = First Bank, `035` = Wema.

---

## Prerequisites

1. **Dev server running:** `npm run dev` (default http://localhost:3000)
2. **Env set:**
   - Flutterwave (bank verification): `FLW_CLIENT_ID`, `FLW_CLIENT_SECRET` (or v3 keys)
   - Coinbase Smart Wallet: `COINBASE_API_KEY_NAME`, `COINBASE_API_KEY_PRIVATE_KEY`, `COINBASE_APP_ID`
   - **Paymaster (required for sweep):** `COINBASE_BUNDLER_RPC_URL` — get from [CDP Portal](https://portal.cdp.coinbase.com/) → Paymaster → Base mainnet (copy endpoint). Add the SEND token contract to the allowlist.
   - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
3. **Off-ramp enabled:** In admin → Settings, ensure "Sell (off-ramp) transactions" is enabled.
4. **A user in the DB** with the email you use (sign up once via the app so the user exists).

---

## Test 1: Verify-and-create (get deposit address)

This verifies a Nigerian bank account and returns the user’s **Smart Wallet** address as the deposit address.

### Option A: In the app (recommended)

1. Log in with an email that exists in your DB.
2. Go to **Crypto to Naira** (off-ramp page). Ensure the flow is **SEND** (not BASE/SOLANA).
3. Enter a valid **10-digit Nigerian account number** and **bank**.
4. Click **Continue**.
5. You should see:
   - Verified **account name**
   - **Deposit address** (Smart Wallet) and QR code
   - Message: “Send SEND to your Smart Wallet (same as your receive address)…”

### Option B: Script (no UI)

```bash
# Set in .env.local (or pass as args):
# OFFRAMP_TEST_EMAIL=your@email.com
# OFFRAMP_TEST_ACCOUNT=0123456789
# OFFRAMP_TEST_BANK_CODE=058

npx tsx scripts/test-offramp.ts
# Or with args:
npx tsx scripts/test-offramp.ts --email your@email.com --account 0123456789 --bank 058
```

Bank code examples: `058` = GTBank, `011` = First Bank, `044` = Access Bank (see `lib/nigerian-banks.ts`).

### Option C: curl

```bash
curl -X POST http://localhost:3000/api/offramp/verify-and-create \
  -H "Content-Type: application/json" \
  -d '{"accountNumber":"0123456789","bankCode":"058","userEmail":"your@email.com","network":"base"}'
```

Expected: `success: true`, `accountName`, `depositAddress` (0x…), `transactionId`.

---

## Test 2: Full flow (sweep + payout)

1. **Create an off-ramp** (Test 1) and note the `depositAddress` (e.g. `0x97F92d40b1201220E4BECf129c16661e457f6147`).
2. **Send a small amount of SEND** (on Base) to that address from another wallet. Ensure balance ≥ `OFFRAMP_MIN_SEND_SWEEP` (default 0.01).
3. **Trigger sweep + payout:**
   - **Cron:** Wait for the next run (every 5 minutes) of `POST /api/offramp/process-payouts`, or
   - **Manual:**  
     `curl -X POST http://localhost:3000/api/offramp/process-payouts`  
     (If you use `OFFRAMP_CRON_SECRET`, add `Authorization: Bearer <secret>` or the header you use.)
4. **Check result:** The row in `offramp_transactions` should move to `status: completed`; Flutterwave sends NGN to the account you verified.

**Note:** Sweep uses the Smart Wallet’s **owner** key and a **Paymaster-sponsored UserOperation** (gas paid by CDP Paymaster; no EOA funding). The Smart Wallet executes `SEND.transfer(pool, amount)`. If that fails (e.g. wrong ABI or SEND not on Paymaster allowlist), check logs and `COINBASE_BUNDLER_RPC_URL`.

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| "Sell (off-ramp) is currently disabled" | Admin → Settings → enable off-ramp |
| "User not found" | Ensure the email exists in `users` (sign up via app first) |
| "Could not verify bank account" | Flutterwave env; use a real test account in sandbox or live |
| "Coinbase Developer Platform credentials not configured" | Set `COINBASE_*` in .env.local |
| "Smart wallet owner key not found" | User should have been given a Smart Wallet by verify-and-create; check `users.smart_wallet_owner_encrypted` |
| Sweep fails (execute / gas) | Ensure pool has BASE to fund owner EOA; check Smart Wallet contract supports `execute(address,uint256,bytes)` |
