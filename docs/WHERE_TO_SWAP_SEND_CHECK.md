# Where Can I Actually Swap USDC → SEND? (Check Guide)

Use these links to check where SEND has liquidity on Base. **Uniswap is not included** (per your preference).

**In this project:** The app **confirms** swap routes on-chain and exposes the result via API:
- **GET /api/admin/check-send-routes** — Returns which Aerodrome pools exist (USDC–SEND, USDC–WETH, WETH–SEND) and whether USDC→SEND (or USDC→WETH→SEND) is possible. Same logic is used when distributing tokens (Aerodrome is tried first).

---

## 1. DexScreener (Base)

**What it shows:** All DEX pairs that include SEND on Base – which DEXes have SEND and with which tokens (USDC, WETH, etc.).

**Open in your browser:**
- **By token address:**  
  https://dexscreener.com/base/0xEab49138BA2Ea6dd776220fE26b7b8E446638956
- **Base chain overview (then search “SEND”):**  
  https://dexscreener.com/base

**What to look for:**
- Pairs like **SEND/USDC** or **SEND/WETH**
- Which **DEX** each pair is on (e.g. Aerodrome, Uniswap, etc.)
- **Liquidity (TVL)** and **volume** – very low = high slippage or no route

**Note:** DexScreener may show a “Verify you are human” (Cloudflare) screen. Complete it in your browser; automated tools cannot pass it.

---

## 2. Aerodrome (Base)

**What it shows:** Whether Aerodrome has a USDC–SEND or WETH–SEND pool, and if you can swap USDC → SEND there.

### Swap page (USDC → SEND)

**Open in your browser:**  
https://aerodrome.finance/swap?from=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&to=0xEab49138BA2Ea6dd776220fE26b7b8E446638956&chain0=8453&chain1=8453

**What to look for:**
- If Aerodrome finds a route: you’ll see a quote (e.g. “1 USDC = X SEND”) and a swap button.
- If there is **no pool**: you’ll see an error or “No liquidity” / “No route” (or the buy side stays 0).

### Liquidity page (USDC–SEND pool)

**Open in your browser:**  
https://aerodrome.finance/liquidity?token0=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&token1=0xEab49138BA2Ea6dd776220fE26b7b8E446638956&chain=8453

**What to look for:**
- **“Pools 0”** or no pools listed → there is **no USDC–SEND pool** on Aerodrome. You cannot swap USDC → SEND on Aerodrome until someone creates one.
- If a pool appears → note TVL and fees; that pool can be used for USDC → SEND.

### Check WETH–SEND on Aerodrome (for USDC→WETH→SEND)

**Liquidity page (WETH–SEND):**  
https://aerodrome.finance/liquidity?token0=0x4200000000000000000000000000000000000006&token1=0xEab49138BA2Ea6dd776220fE26b7b8E446638956&chain=8453

**What to look for:**
- If **“Pools 0”** → no WETH–SEND pool on Aerodrome, so the path **USDC → WETH → SEND** won’t work on Aerodrome.
- If a pool exists → USDC→WETH→SEND can work on Aerodrome (USDC–WETH already exists there).

---

## What was checked (summary)

| Source        | Result |
|--------------|--------|
| **DexScreener** | Page is behind Cloudflare; open the links above in your browser to see SEND pairs and DEXes. |
| **Aerodrome Swap** | Page loads with USDC and SEND; if you see no quote / “0” on buy side, there is no route. |
| **Aerodrome Liquidity (USDC–SEND)** | Shows “Pools 0” while loading → **no USDC–SEND pool** on Aerodrome at time of check. |
| **Aerodrome Liquidity (WETH–SEND)** | Use the WETH–SEND link above; if “Pools 0”, then USDC→WETH→SEND is not possible on Aerodrome. |

---

## If there is no SEND pool on Aerodrome

Your app already tries **Aerodrome first**, then Paraswap, 0x, and the WETH two-hop. If Aerodrome has no USDC–SEND and no WETH–SEND pool:

1. **Create a pool on Aerodrome**  
   Use [Aerodrome – Launch pool](https://aerodrome.finance/launch) to create USDC–SEND (or WETH–SEND) and add liquidity. Then USDC → SEND (or USDC→WETH→SEND) will work via your existing Aerodrome integration.

2. **Rely on another DEX**  
   From DexScreener, see which DEX (other than Uniswap, if you prefer) has SEND pairs; then we can add that DEX or its aggregator in code.

3. **No swap – direct SEND**  
   Keep SEND in your liquidity wallet and send it directly to users (your existing “direct transfer” path). You source SEND off-exchange or from another chain and refill the wallet.

---

**SEND token (Base):** `0xEab49138BA2Ea6dd776220fE26b7b8E446638956`  
**USDC (Base):** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`  
**WETH (Base):** `0x4200000000000000000000000000000000000006`
