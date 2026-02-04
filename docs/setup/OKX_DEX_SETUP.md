# OKX DEX Setup (On-Ramp Swap Fallback)

The app can use [OKX Web3 DEX API](https://web3.okx.com/build) as an additional swap path for **USDC → SEND** on Base. When configured, it is tried after Aerodrome/Paraswap (and for large orders >300 SEND, OKX is tried right after Aerodrome).

## 1. Get API credentials

1. Go to [OKX Web3 Build](https://web3.okx.com/build) and sign in / register.
2. Create an API key (or use an existing project).
3. Note:
   - **API Key** → `OKX_API_KEY`
   - **Secret Key** → `OKX_SECRET_KEY`
   - **Passphrase** → `OKX_API_PASSPHRASE`
   - **Project ID** (if required) → `OKX_PROJECT_ID`

## 2. Add to `.env.local`

```env
OKX_API_KEY=your_api_key
OKX_SECRET_KEY=your_secret_key
OKX_API_PASSPHRASE=your_passphrase
# Optional if your project uses it:
# OKX_PROJECT_ID=your_project_id
```

Do not commit these values. Restart the dev server after adding them.

## 3. Test (no real swap)

With the dev server running (`npm run dev`):

**Config status**

```bash
curl -s http://localhost:3000/api/test-okx-swap | jq .
```

Expect `okxConfigured: true` when keys are set.

**Quote (1 USDC → SEND)**

```bash
curl -s "http://localhost:3000/api/test-okx-swap?mode=quote&amount=1&swapMode=exactIn" | jq .
```

**Quote (buy 10 SEND)** — OKX exactOut on Base often has no route for USDC→SEND (Uni V3 only). If this fails, use exactIn with estimated USDC:

```bash
curl -s "http://localhost:3000/api/test-okx-swap?mode=quote&amount=10&swapMode=exactOut" | jq .
# If that fails, try exactIn (e.g. ~31 USDC for ~1078 SEND):
curl -s "http://localhost:3000/api/test-okx-swap?mode=quote&amount=31&swapMode=exactIn" | jq .
```

Or use the script:

```bash
./scripts/test-okx-swap.sh quote
./scripts/test-okx-swap.sh quote 10 exactOut
```

## 4. Optional: real test swap

To run a small real swap (e.g. 0.5 USDC → SEND) from the liquidity pool wallet:

1. Set in `.env.local`:
   ```env
   TEST_OKX_SWAP=1
   ```
2. Ensure the pool has USDC on Base.
3. Call:

```bash
curl -s -X POST http://localhost:3000/api/test-okx-swap \
  -H "Content-Type: application/json" \
  -d '{"execute": true, "usdcAmount": "0.5"}' | jq .
```

Or:

```bash
./scripts/test-okx-swap.sh swap 0.5
```

4. Remove or set `TEST_OKX_SWAP=0` after testing so production cannot trigger test swaps via this endpoint.

## 5. Production behavior

- With OKX env vars set, **buy** flow (e.g. 1078 SEND) tries: **Aerodrome** → (if >300 SEND) **OKX** (exactOut, then if no route **OKX exactIn** using USDC from other quoters) → **Paraswap** → **OKX** (same) → **0x** → USDC→WETH→SEND.
- OKX **exactOut** on Base supports only Uniswap V3; USDC→SEND may have no exactOut route. The app falls back to **OKX exactIn**: it gets the required USDC amount from Aerodrome/Paraswap/0x, then runs OKX “sell that USDC” so the swap still goes through OKX when possible.
- With OKX env vars set, **sell** flow (sell X USDC) tries: **Aerodrome** → **Paraswap** → **OKX** → **0x** → WETH path.
- If OKX keys are not set, the OKX step is skipped with no error.

## References

- [OKX DEX API – Get Quote](https://web3.okx.com/build/dev-docs/dex-api/dex-get-quote)
- [OKX DEX – Build Swap on EVM](https://web3.okx.com/build/dev-docs/dex-api/dex-use-swap-quick-start)
- [OKX Labs DEX Router (Base)](https://github.com/okxlabs/DEX-Router-EVM-V1) (contracts; we use the Web3 API for quote/swap)
