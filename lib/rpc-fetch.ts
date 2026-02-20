/**
 * RPC fetch helper that retries on 429 (rate limit) to avoid "over rate limit" from Base RPC.
 * Use with viem http transport when BASE_RPC_URL may be mainnet.base.org or another strict RPC.
 */

const RETRY_DELAYS_MS = [2000, 4000];
const MAX_RETRIES = RETRY_DELAYS_MS.length + 1;

/**
 * Returns a fetch function that retries the request up to 3 times on HTTP 429.
 */
export function createRpcFetchWith429Retry(): (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response> {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = typeof input === "object" && "clone" in input ? input : new Request(input, init);
    for (let i = 0; i < MAX_RETRIES; i++) {
      const res = await fetch(req.clone());
      if (res.status !== 429 || i === MAX_RETRIES - 1) return res;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[i] ?? 2000));
    }
    return fetch(req.clone());
  };
}
