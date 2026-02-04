#!/usr/bin/env bash
# Test OKX DEX swap integration (quote and optional execute).
# Usage:
#   ./scripts/test-okx-swap.sh                    # config status
#   ./scripts/test-okx-swap.sh quote              # quote: 1 USDC -> SEND
#   ./scripts/test-okx-swap.sh quote 10 exactOut  # quote: buy 10 SEND
#   ./scripts/test-okx-swap.sh swap               # execute 0.5 USDC swap (needs TEST_OKX_SWAP=1)

set -e
BASE_URL="${BASE_URL:-http://localhost:3000}"

case "${1:-status}" in
  status)
    echo "GET $BASE_URL/api/test-okx-swap"
    curl -sS "$BASE_URL/api/test-okx-swap" | jq .
    ;;
  quote)
    AMOUNT="${2:-1}"
    MODE="${3:-exactIn}"
    echo "GET $BASE_URL/api/test-okx-swap?mode=quote&amount=$AMOUNT&swapMode=$MODE"
    curl -sS "$BASE_URL/api/test-okx-swap?mode=quote&amount=$AMOUNT&swapMode=$MODE" | jq .
    ;;
  swap)
    USDC="${2:-0.5}"
    echo "POST $BASE_URL/api/test-okx-swap (execute=true, usdcAmount=$USDC)"
    curl -sS -X POST "$BASE_URL/api/test-okx-swap" \
      -H "Content-Type: application/json" \
      -d "{\"execute\": true, \"usdcAmount\": \"$USDC\"}" | jq .
    ;;
  *)
    echo "Usage: $0 [status|quote|swap] [amount] [exactIn|exactOut]"
    echo "  status       - show OKX config and pool address"
    echo "  quote [n] [mode] - quote (default: 1 USDC exactIn; or amount and exactOut for buy SEND)"
    echo "  swap [usdc]  - run test swap (default 0.5 USDC); requires TEST_OKX_SWAP=1"
    exit 1
    ;;
esac
