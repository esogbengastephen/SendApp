# KyberSwap Aggregator (On-Ramp Swap Fallback)

The app uses [KyberSwap Aggregator](https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator) as an additional swap path for **USDC → SEND** on Base. **No API key is required.** It is tried **first**; then Aerodrome, Paraswap, OKX, 0x.

## How fallback works (which API goes first)

When the app needs to swap **USDC → SEND** (e.g. after a user pays NGN and is owed a fixed amount of SEND), it tries aggregators in order until one succeeds.

### Order for “buy exact SEND” (e.g. user wants 1078.83 SEND)

1. **KyberSwap** (exactIn: get USDC needed from quote + 12% buffer, then swap that USDC → SEND)
2. **Aerodrome** (direct pool on Base)
3. **OKX DEX** (only for large orders >300 SEND: exactOut, then exactIn)
4. **Paraswap**
5. **OKX DEX** (if not tried yet)
6. **0x**
7. **USDC → WETH → SEND** (two-step fallback)

### Order for “sell USDC” (e.g. sell 31 USDC for SEND)

1. **KyberSwap**
2. **Aerodrome**
3. **Paraswap**
4. **OKX DEX**
5. **0x**
6. **USDC → WETH → SEND** (two-step fallback)

For large production amounts (e.g. 1078 SEND), the same order applies; chunked swaps are used if a single swap fails. **KyberSwap is used for real swaps** whenever the on-ramp runs and an earlier aggregator fails or isn’t used. No extra config is needed beyond the optional client ID below.

## Flow (KyberSwap’s role)

- **Buy exact SEND:** We get the USDC amount needed from other sources (Aerodrome/Paraswap/0x), add a 12% buffer, then call KyberSwap with that USDC amount (exactIn).
- **Sell USDC:** We call KyberSwap directly with the USDC amount (exactIn).

## Optional: Client ID

To avoid stricter rate limits, set a client identifier (e.g. your app name):

```env
KYBERSWAP_CLIENT_ID=SendXino
```

If unset, the code uses `SendXino` by default.

## Test

### Quote only (no swap)

With the dev server running (`npm run dev`):

```bash
curl -s "http://localhost:3000/api/test-kyberswap?amount=31" | jq .
```

Example success response:

```json
{
  "ok": true,
  "quote": {
    "amountInUsdc": "31",
    "amountOutWei": "1100506726122339617571",
    "routerAddress": "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5"
  },
  "poolAddress": "0x...",
  "testSwapHint": "POST with { \"execute\": true, \"amount\": \"0.5\" } to run a small test swap (set TEST_KYBERSWAP_SWAP=1)."
}
```

### Small real swap (optional)

To test that KyberSwap actually executes a swap (uses pool USDC and receives SEND):

1. Add to `.env.local`: `TEST_KYBERSWAP_SWAP=1`
2. Restart the dev server.
3. Run (e.g. 0.5 USDC, max 2 USDC for safety):

```bash
curl -s -X POST http://localhost:3000/api/test-kyberswap \
  -H "Content-Type: application/json" \
  -d '{"execute": true, "amount": "0.5"}' | jq .
```

On success you get `swapTxHash` and `sendAmountReceived`. The SEND stays in the pool (same as production). Remove or set `TEST_KYBERSWAP_SWAP=` when not testing.

## References

- [KyberSwap Aggregator API – EVM Swaps](https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/aggregator-api-specification/evm-swaps)
- [Execute a swap with the Aggregator API](https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/developer-guides/execute-a-swap-with-the-aggregator-api)
