# Off-ramp flow explained (CDP vs non-CDP)

## What you asked for

- **Static smart wallet per user** – each user gets one fixed deposit address.
- **Auto-transfer to offramp pool** – when they send SEND to that address, it is swept to **OFFRAMP_ADMIN_WALLET_ADDRESS**.
- **Paymaster** – gas for the sweep is still sponsored (no user gas).

---

## Two ways it can run

### Path A: CDP configured (recommended)

**Env:** `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`, `COINBASE_BUNDLER_RPC_URL`, `OFFRAMP_ADMIN_WALLET_ADDRESS`.

1. **Verify-and-create**
   - We call CDP: “get or create” an **owner** account named `offramp-owner-{userId}` and a **smart account** named `offramp-smart-{userId}`.
   - The **smart account address** is the user’s static deposit address (same every time).
   - We store that address in `offramp_transactions.deposit_address`.
   - We do **not** store any private key; CDP holds the keys.

2. **User sends SEND**
   - User sends SEND to that deposit address (e.g. from Coinbase app or another wallet).

3. **Sweep (cron / process-payouts)**
   - We see a pending row with that `deposit_address` and `user_id`.
   - We check: is CDP configured and does `deposit_address` match this user’s CDP smart wallet?
   - If yes: we use **CDP** to run a **transfer** from that smart wallet to **OFFRAMP_ADMIN_WALLET_ADDRESS**, with **Paymaster** paying gas.
   - Then we pay out NGN via Flutterwave as before.

**Pool address:** `getOfframpPoolAddress()` uses **OFFRAMP_ADMIN_WALLET_ADDRESS** first, then other env vars.

---

### Path B: CDP not configured (fallback)

**Env:** No `CDP_API_KEY_*` / `CDP_WALLET_SECRET` (or only some of them).

1. **Verify-and-create**
   - We use the **existing** flow: get/create the user’s **owner key** (stored encrypted in `users`), and derive the **smart wallet address** locally (Coinbase factory 1.1, nonce 0).
   - That address is the deposit address; we may update `users.smart_wallet_address` and `smart_wallet_owner_encrypted`.

2. **Sweep**
   - We use **viem** (not CDP): load owner key from `users`, build the smart account, send a **UserOperation** (SEND transfer to pool) with **Paymaster**.
   - Pool is still from `getOfframpPoolAddress()` (OFFRAMP_ADMIN_WALLET_ADDRESS first if set).

So: same behaviour (static address, sweep to pool, paymaster), but keys live in your DB and sweep is done with viem instead of CDP.

---

## Possible “mess” and fixes

1. **Pool address**
   - **Before:** Pool was OFFRAMP_RECEIVER_WALLET_ADDRESS or OFFRAMP_POOL_PRIVATE_KEY, etc.
   - **Now:** **OFFRAMP_ADMIN_WALLET_ADDRESS** is used **first**; others are fallbacks.
   - If you expected a different pool, set `OFFRAMP_ADMIN_WALLET_ADDRESS` to the correct admin/pool address.

2. **Which path runs?**
   - **CDP path** only if **all three** are set: `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`.
   - If any is missing, we use the **non-CDP** path (owner key in DB, viem sweep).

3. **Same user, two different addresses?**
   - If you **turn on CDP later**, new off-ramps get the **CDP** static address.
   - Old pending rows that were created **before** CDP have the **old** (locally derived) address; for those we still use the **viem** sweep (owner key from `users`), not CDP transfer.
   - So one user can have one CDP address and one legacy address until old pending rows are done.

4. **Sweep logic bug (fixed)**
   - When a row had `deposit_private_key_encrypted` set (EOA path), the code wrongly called the Smart Wallet sweep. The cron only selects rows where `deposit_private_key_encrypted` is null, so this branch wasn’t used. It’s fixed so that branch doesn’t call the wrong function.

---

## Env checklist (CDP path)

| Variable | Purpose |
|----------|---------|
| `CDP_API_KEY_ID` | CDP API auth |
| `CDP_API_KEY_SECRET` | CDP API auth |
| `CDP_WALLET_SECRET` | Needed for CDP to create/hold wallets |
| `COINBASE_BUNDLER_RPC_URL` | Paymaster (gas sponsor) for the sweep |
| `OFFRAMP_ADMIN_WALLET_ADDRESS` | Pool that receives swept SEND (used first) |

---

## Short summary

- **Static smart wallet:** per user, one address (CDP: from CDP API; non-CDP: from your stored owner key).
- **Auto-transfer to pool:** sweep sends SEND to **OFFRAMP_ADMIN_WALLET_ADDRESS** (or fallback pool).
- **Paymaster:** still used for gas in both CDP and viem sweep.

If something still looks wrong (e.g. wrong pool, wrong path, or “no sweep”), say what you see (and which env you have set) and we can narrow it down.
