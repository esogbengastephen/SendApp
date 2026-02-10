# Off-ramp flow (SEND → Naira)

This document explains how the **SEND → Naira** off-ramp works: user gets a **dedicated deposit address**, sends **SEND** there (no swap), and receives **Naira** in their bank account.

---

## Overview

- **Asset:** SEND only (on Base). No swap: we receive SEND and pay out Naira.
- **Bank:** Flutterwave for **name verification** (account number + bank code → account name) and for **Naira transfer** (payout to user’s bank).
- **Deposit:** The **same Coinbase Smart Wallet** the user uses for Base (receive/generate-address). One Smart Wallet per user; owner key stored in `users`. We **sweep** SEND from the Smart Wallet to the pool via a **Paymaster-sponsored UserOperation** (no EOA gas funding; requires `COINBASE_BUNDLER_RPC_URL` and SEND token on CDP Paymaster allowlist).

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
| 8 | **System** | Cron calls `POST /api/offramp/process-payouts`. For each pending row: **sweeps** SEND from Smart Wallet to pool via **Paymaster-sponsored UserOperation** (gas paid by CDP Paymaster), then **Flutterwave transfer** (NGN = SEND × sell rate). User receives Naira in bank. |
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

- **Deposit = Smart Wallet only:** One Coinbase Smart Wallet per user (same as Base receive). Address in `users.smart_wallet_address`, owner key in `users.smart_wallet_owner_encrypted`. Sweep: **Paymaster-sponsored UserOperation** — the Smart Wallet (deposit address) is the UserOp sender and executes SEND.transfer(pool, amount); gas is paid by CDP Paymaster (no EOA funding). Implemented in `lib/offramp-sweep-payout.ts` with viem `toCoinbaseSmartAccount` + `createBundlerClient` + `sendUserOperation(..., paymaster: true)`. Requires `COINBASE_BUNDLER_RPC_URL` and SEND token on CDP Paymaster allowlist. Only Smart Wallet deposits are processed; no EOA path. Only one pending off-ramp per user at a time.
- **No swap:** We do not swap SEND to anything else. The pool wallet receives SEND; Naira payout is funded by your own liquidity/treasury (SEND is effectively “sold” by you off-book or later).
- **Flutterwave:** Used for (1) bank verification (name enquiry) and (2) Naira transfer (payout). No Moniepoint.
- **Sweep + payout:** The logic that “on SEND received at deposit address → sweep to pool → Flutterwave transfer” is **implemented**; the diagram marks it as “to implement.” Rate: 1 SEND = `sendToNgnSell` NGN (platform settings), or `exchangeRate` if sell rate not set.

---

## Relevant files

| Purpose | File |
|--------|------|
| Verify bank + create off-ramp + return deposit address | `app/api/offramp/verify-and-create/route.ts` |
| Smart Wallet (get/create, decrypt owner) | `lib/coinbase-smart-wallet.ts` |
| Sweep SEND to pool + Flutterwave payout | `lib/offramp-sweep-payout.ts` |
| Cron/manual trigger for payouts | `POST /api/offramp/process-payouts` |
| Flutterwave verify + transfer | `lib/flutterwave.ts`, `app/api/flutterwave/send-money/route.ts` |
| Off-ramp UI | `app/offramp/page.tsx` |
| DB schema (deposit columns) | `supabase/migrations/026_offramp_dedicated_deposit.sql` |

---

## Env / cron for sweep + payout

- **Paymaster (required):** `COINBASE_BUNDLER_RPC_URL` — CDP Portal → Paymaster → Base mainnet endpoint. Add the **SEND token contract** (`NEXT_PUBLIC_SEND_TOKEN_ADDRESS` or default) to the Paymaster allowlist so the sweep UserOperation is sponsored.
- **Sell rate:** In admin → platform settings, set **SEND sell rate** (1 SEND = X NGN). If not set, buy `exchangeRate` is used.
- **Pool:** SEND is swept to the wallet from `OFFRAMP_POOL_PRIVATE_KEY` if set, else `LIQUIDITY_POOL_PRIVATE_KEY`.
- **Cron:** Something must call `POST /api/offramp/process-payouts` every few minutes (e.g. 5). Optional: `OFFRAMP_CRON_SECRET`; `OFFRAMP_MIN_SEND_SWEEP` (default `0.01`).

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
