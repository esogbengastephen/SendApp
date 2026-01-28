# Ways to Swap USDC → SEND on Base

This doc lists **all current swap paths** your app uses and **other possible options** you can add.

---

## Current implementation (in order)

Your code tries these in order until one works.

### 1. **Aerodrome (direct DEX)**

- **What:** Router `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` on Base.
- **Paths tried:**
  - **USDC → WETH → SEND** (two-hop), then
  - **USDC → SEND** (one-hop) if a pool exists.
- **Requires:** Aerodrome pools for either:
  - USDC–WETH **and** WETH–SEND, or
  - USDC–SEND.
- **Why it can fail:** No USDC–SEND or WETH–SEND pool on Aerodrome for SEND.

### 2. **Paraswap (aggregator)**

- **What:** API `https://apiv5.paraswap.io` – aggregates multiple DEXes (including Aerodrome, Uniswap, etc.).
- **Paths:** Whatever route Paraswap finds (often USDC→SEND or USDC→WETH→SEND).
- **Requires:** Some DEX on Base that Paraswap indexes and that has a route for USDC → SEND.
- **Why it can fail:** Paraswap has no route for this pair, or build-tx fails (e.g. simulation error).

### 3. **0x (aggregator)**

- **What:** API `https://base.api.0x.org` – also aggregates DEXes on Base.
- **Paths:** Whatever 0x returns.
- **Requires:** 0x has a route for USDC → SEND on Base.
- **Why it can fail:** 0x returns 404 “no Route matched” when it has no liquidity for that pair.

### 4. **WETH fallback (two-hop via Paraswap + 0x)**

- **What:** Manually do **USDC → WETH** then **WETH → SEND** using Paraswap and/or 0x for each leg.
- **Requires:**  
  - USDC–WETH liquidity (usually exists on Base), and  
  - WETH–SEND liquidity on a DEX that Paraswap or 0x supports.
- **Why it can fail:** No WETH–SEND route on Paraswap/0x, or one of the two legs fails.

---

## Summary: what you need for a swap to work

At least one of these must be true on **Base**:

| Option | Needs |
|--------|--------|
| **Aerodrome** | USDC–WETH pool + WETH–SEND pool, **or** USDC–SEND pool |
| **Paraswap** | Any DEX it aggregates having a USDC→SEND (or multi-hop) route |
| **0x** | Any source 0x uses having a USDC→SEND route |
| **WETH fallback** | USDC–WETH (exists) + WETH–SEND on Paraswap/0x |

SEND has **low liquidity** on Base. Many aggregators won’t have a route if there’s no deep pool for SEND (e.g. SEND/USDC or SEND/WETH) on a DEX they support.

---

## Other possible ways to swap USDC → SEND

### A. **Uniswap (V2 or V3) on Base**

- **What:** Uniswap has USDC pairs on Base. If there is a **SEND/USDC** or **SEND/WETH** pool on Uniswap, you can swap there.
- **How:** Use Uniswap’s Routing API or SDK (e.g. quote + swap calldata).
- **Docs:** [Uniswap API – Quote](https://api-docs.uniswap.org/api-reference/swapping/quote) (supports Base, chain 8453).
- **Requires:** A Uniswap pool for SEND (e.g. SEND/USDC or SEND/WETH) on Base.

### B. **1inch (aggregator)**

- **What:** 1inch aggregates many DEXes. If 1inch has a route for USDC → SEND on Base, you can use their API.
- **How:** 1inch Swap API (e.g. `/swap/v5.2/8453/quote` or similar).
- **Requires:** 1inch to have liquidity for USDC→SEND on Base (they need to index a pool that has SEND).

### C. **KyberSwap (aggregator)**

- **What:** Another aggregator with an API for quotes and swap calldata.
- **Requires:** Kyber to have a route for USDC→SEND on Base.

### D. **Direct pool liquidity (your own pool)**

- **What:** Create and fund a **USDC–SEND** pool on Aerodrome, Uniswap, or another Base DEX. Your app then swaps only on that pool (or you use it so aggregators can find a route).
- **Pros:** You control liquidity; swaps can work even when others delist SEND.
- **Cons:** You need to supply both USDC and SEND and manage the pool.

### E. **Hold SEND in the liquidity wallet (no swap)**

- **What:** Don’t swap; keep a balance of SEND in the wallet that sends to users. When a user pays NGN, you send them SEND from that balance (your existing “direct transfer” path).
- **Pros:** No dependency on DEX routes or liquidity.
- **Cons:** You must source and refill SEND (e.g. buy OTC or from an exchange and withdraw to Base).

---

## Quick check: where does SEND have liquidity?

To see where USDC→SEND (or WETH→SEND) can work:

1. **DexScreener (Base):**  
   https://dexscreener.com/base  
   Search for “SEND” or the token address `0xEab49138BA2Ea6dd776220fE26b7b8E446638956` and check which DEXes and pairs exist.

2. **Aerodrome (Base):**  
   https://aerodrome.finance/  
   Search for SEND; see if there are USDC–SEND or WETH–SEND pools.

3. **Uniswap (Base):**  
   https://app.uniswap.org/  
   Select Base, then try swapping USDC → SEND (or WETH → SEND) and see if a route appears.

4. **BaseScan:**  
   On the SEND token page, check “Holders” / “Transfers” and “Contract” to see which pools hold SEND.

Once you know which DEX has a SEND pool (e.g. Uniswap V3 SEND/USDC), you can add that as an explicit path (e.g. Uniswap API) in your swap flow so USDC→SEND is possible even when Aerodrome/Paraswap/0x don’t have a route.
