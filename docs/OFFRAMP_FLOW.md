# Off-ramp flow (SEND → Naira)

This document explains how the **SEND → Naira** off-ramp works: user gets a **dedicated deposit address**, sends **SEND** there (no swap), and receives **Naira** in their bank account.

**Automatic flow:** User sends SEND → cron runs every few minutes → SEND is swept to the admin pool (Paymaster sponsors gas) → Flutterwave sends Naira to the user’s bank. No user action after sending is required; the “I’ve sent SEND — process now” button is optional for users who don’t want to wait for the next cron run.

---

## Overview

- **Asset:** SEND only (on Base). No swap: we receive SEND and pay out Naira.
- **Bank:** **Name verification** and **Naira transfer** (payout) both use **Flutterwave**.
- **Deposit:** The **same Coinbase Smart Wallet** the user uses for Base (receive/generate-address). Example: `0x97F92d40b1201220E4BECf129c16661e457f6147`. One Smart Wallet per user; owner key stored in `users`. We **sweep** SEND from the Smart Wallet to the pool via a **Paymaster-sponsored UserOperation** (no EOA gas funding; requires `COINBASE_BUNDLER_RPC_URL` and SEND token on CDP Paymaster allowlist).

---

## Step-by-step flow

| Step | Who / What | Action |
|------|------------|--------|
| 1 | **User** | Opens off-ramp page, selects network (SEND on Base), enters **account number** and **bank**, (optionally email). Clicks **Continue**. |
| 2 | **App** | Calls `POST /api/offramp/verify-and-create` with `accountNumber`, `bankCode`, `userEmail`. |
| 3 | **Backend** | Verifies bank with **Flutterwave** (name enquiry). Gets `accountName`. |
| 4 | **Backend** | Gets or creates user's **Smart Wallet** (same as Base receive) via `getOrCreateSmartWallet`. |
| 5 | **Backend** | Inserts a row in `offramp_transactions` with: `deposit_address` = Smart Wallet address, `user_id`, no EOA key, `account_number`, `bank_code`, `account_name`, `status: "pending"`, etc. |
| 6 | **App** | Shows user: **account name** (from verification), **deposit address** = Smart Wallet (with QR + copy). Message: “Send SEND to your Smart Wallet (same as your receive address); Naira will be sent after confirmation.” |
| 7 | **User** | Sends **SEND** (on Base) to their Smart Wallet address. |
| 8 | **System** | Cron calls `POST /api/offramp/process-payouts`. For each pending row: **sweeps** SEND from Smart Wallet to pool via **Paymaster-sponsored UserOperation** (gas paid by CDP Paymaster), then **NGN transfer** via **Flutterwave**. User receives Naira in bank. |
| 9 | **System** | DB updated: `status: completed`, `swap_tx_hash`, `token_amount`, `ngn_amount`, `paid_at`. |

---

## Diagram

```mermaid
sequenceDiagram
    participant User
    participant App as Off-ramp UI
    participant API as verify-and-create API
    participant FW as Flutterwave
    participant DB as Database
    participant Wallet as Smart Wallet (same as Base)
    participant Base as Base (SEND)
    participant Sweep as Sweep + Payout

    User->>App: Account number + Bank + Email
    App->>API: POST /api/offramp/verify-and-create

    API->>FW: Name enquiry (accountNumber, bankCode)
    FW-->>API: accountName

    API->>Wallet: getOrCreateSmartWallet (same as Base receive)
    Wallet-->>API: Smart Wallet address

    API->>DB: Insert offramp_transactions (deposit_address = Smart Wallet, user_id, ...)

    API-->>App: accountName, depositAddress, transactionId
    App-->>User: Show account name + deposit address (QR + copy)

    User->>Base: Send SEND to Smart Wallet
    Note over Base: SEND arrives at Smart Wallet

    rect rgb(240, 248, 255)
        Sweep->>DB: Find pending by deposit_address / balance
        Sweep->>Wallet: Paymaster-sponsored UserOp: sweep SEND → pool
        Sweep->>FW: Transfer NGN (account_number, bank_code, account_name)
        FW-->>User: Naira in bank account
        Sweep->>DB: Update status → completed
    end
```

---

## High-level architecture (boxes)

```mermaid
flowchart LR
    subgraph User["User"]
        A[Enter bank details]
        B[Send SEND to deposit address]
        C[Receive Naira]
    end

    subgraph Backend["Backend"]
        V[Flutterwave verify]
        G[Get/create Smart Wallet]
        DB[(offramp_transactions)]
    end

    subgraph Chain["Base"]
        D[User's SEND tx]
        E[Smart Wallet address]
        F[Pool wallet]
    end

    subgraph Payout["Payout"]
        SW[Sweep SEND to pool]
        FW[Flutterwave transfer]
    end

    A --> V
    V --> G
    G --> DB
    DB --> E
    B --> D
    D --> E
    E --> SW
    SW --> F
    SW --> FW
    FW --> C
```

---

## Important details

- **Deposit = Smart Wallet only:** One Coinbase Smart Wallet per user (same as Base receive). Example deposit address: `0x97F92d40b1201220E4BECf129c16661e457f6147`. Address in `users.smart_wallet_address`, owner key in `users.smart_wallet_owner_encrypted`. Sweep: **Paymaster-sponsored UserOperation** — the Smart Wallet (deposit address) is the UserOp sender and executes SEND.transfer(pool, amount); gas is paid by CDP Paymaster (no EOA funding). Implemented in `lib/offramp-sweep-payout.ts` with viem `toCoinbaseSmartAccount` + `createBundlerClient` + `sendUserOperation(..., paymaster: true)`. Requires `COINBASE_BUNDLER_RPC_URL` and SEND token on CDP Paymaster allowlist. Only Smart Wallet deposits are processed; no EOA path. Only one pending off-ramp per user at a time.
- **No swap:** We do not swap SEND to anything else. The pool wallet receives SEND; Naira payout is funded by your own liquidity/treasury (SEND is effectively “sold” by you off-book or later).
- **Bank verification and Naira transfer (payout):** Flutterwave (name verification; NIBSS optional). Naira payout is always via **Flutterwave**.
- **Sweep + payout:** The logic that “on SEND received at deposit address → sweep to pool → NGN transfer” is **implemented**. Rate: 1 SEND = `sendToNgnSell` NGN (platform settings), or `exchangeRate` if sell rate not set.

---

## Relevant files

| Purpose | File |
|--------|------|
| Verify bank + create off-ramp + return deposit address | `app/api/offramp/verify-and-create/route.ts` |
| Smart Wallet (get/create, decrypt owner) | `lib/coinbase-smart-wallet.ts` |
| Sweep SEND to pool + Flutterwave payout | `lib/offramp-sweep-payout.ts` |
| Cron/manual trigger for payouts | `POST /api/offramp/process-payouts` |
| CDP webhook (instant deposit detection) | `POST /api/offramp/webhook` |
| Flutterwave verify + transfer | `lib/flutterwave.ts`, `app/api/flutterwave/send-money/route.ts` |
| Off-ramp UI | `app/offramp/page.tsx` |
| DB schema (deposit columns) | `supabase/migrations/026_offramp_dedicated_deposit.sql` |

---

## Env / cron for sweep + payout

- **Paymaster (required):** `COINBASE_BUNDLER_RPC_URL` — CDP Portal → Paymaster → Base mainnet endpoint. Add the **SEND token contract** to the Paymaster allowlist (see below) so the sweep UserOperation is sponsored.
- **Sell rate:** In admin → platform settings, set **SEND sell rate** (1 SEND = X NGN). If not set, buy `exchangeRate` is used.
- **Pool:** SEND is swept to: `OFFRAMP_RECEIVER_WALLET_ADDRESS` if set (exact address), else the wallet from `OFFRAMP_POOL_PRIVATE_KEY`, else `LIQUIDITY_POOL_PRIVATE_KEY`.
- **Cron:** Something must call `POST /api/offramp/process-payouts` (or `POST /api/offramp/monitor-wallets`, same logic) every few minutes (e.g. 5). Optional: `OFFRAMP_CRON_SECRET`; `OFFRAMP_MIN_SEND_SWEEP` (default `0.01`).
- **CDP webhook (optional, for instant payout):** Set `CDP_WEBHOOK_SECRET` (or `OFFRAMP_WEBHOOK_SECRET`) to the signing secret from CDP Portal → Webhooks. Register your webhook URL `https://your-domain.com/api/offramp/webhook` and subscribe to onchain activity (Base). When a deposit is detected, the webhook triggers the same sweep + payout immediately; cron remains as fallback.
- **Flutterwave:** Configure Flutterwave for both bank verification and NGN payouts (no Zainpay/Zainbox in off-ramp).

### Adding SEND token to the Paymaster allowlist

The off-ramp sweep calls the SEND token’s `transfer(address,uint256)` so the Paymaster will only sponsor that call if the SEND contract and function are allowlisted.

1. Open the [CDP Portal](https://portal.cdp.coinbase.com/) and sign in.
2. Go to **Onchain Tools** → **[Bundler and Paymaster](https://portal.cdp.coinbase.com/products/bundler-and-paymaster)**.
3. In the top-right, set the network to **Base Mainnet** (not Base Sepolia).
4. Open the **Configuration** tab.
5. Under the contract allowlist, click **Add** (or **Enable Paymaster** then add a contract).
6. **Contract address:** Use your SEND token address.  
   - If you use the app default: `0xEab49138BA2Ea6dd776220fE26b7b8E446638956`  
   - If you set `NEXT_PUBLIC_SEND_TOKEN_ADDRESS` in env, use that value instead.
7. **Function:** Add the ERC-20 transfer function so the Paymaster can sponsor the sweep:
   - Function signature: `transfer(address,uint256)`  
   (Some UIs ask for the full signature; use that exact string.)
8. Save. Ensure Paymaster is **enabled** (toggle on).
9. Copy your **Paymaster/Bundler endpoint URL** (Base Mainnet) and set it as `COINBASE_BUNDLER_RPC_URL` in your app env.

If the function is not allowlisted, the Paymaster will reject the UserOperation and the sweep will fail with a policy/allowlist error.

### Running the cron outside Vercel (Fly.io, Railway, or free cron services)

Vercel free tier allows only 1 cron per 24 hours. To run off-ramp payouts every 5 minutes you can:

1. **Free HTTP cron services**  
   Use [cron-job.org](https://cron-job.org), [EasyCron](https://www.easycron.com), or similar:
   - **URL:** `https://YOUR_APP.vercel.app/api/offramp/process-payouts`
   - **Method:** POST
   - **Schedule:** Every 5 minutes
   - **Header:** `Authorization: Bearer YOUR_OFFRAMP_CRON_SECRET` (set `OFFRAMP_CRON_SECRET` in Vercel env)

2. **Fly.io or Railway**  
   Deploy the small cron runner in `scripts/offramp-cron/` so a process on Fly.io or Railway calls your API every 5 minutes. See `scripts/offramp-cron/README.md`.
