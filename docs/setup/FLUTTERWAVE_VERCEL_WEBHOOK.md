# Flutterwave Webhook + Vercel: Common Problems & Fixes

You're using: **https://www.flippay.app/api/flutterwave/webhook**

Here are the main things that break webhooks when using Flutterwave with Vercel and a custom domain.

---

## 1. **Domain redirect (www vs non-www)** – most common

**What happens:**  
If Flutterwave calls one URL and Vercel redirects to another (e.g. `flippay.app` → `www.flippay.app`), the server often returns **308** or **301**. When the client follows the redirect, the **POST body is lost** (or the request becomes GET). Signature verification then fails or the webhook never runs as intended.

**What to do:**

- Use **one** canonical URL and use it everywhere.
- In **Flutterwave Dashboard** set the webhook URL to exactly:
  - **https://www.flippay.app/api/flutterwave/webhook**
- In **Vercel**:
  - Domains: add both `flippay.app` and `www.flippay.app` if you use both.
  - Set the **primary** domain to the one you use in Flutterwave (e.g. `www.flippay.app`).
  - Avoid redirects for the webhook: the URL in Flutterwave should be the **final** URL (no redirect).

**Check:**  
From a terminal, run:

```bash
curl -I -X POST https://www.flippay.app/api/flutterwave/webhook
```

- If you see **308**, **301**, or **302**, that request is being redirected; use the redirect target URL in Flutterwave (and ideally fix Vercel so that URL is the main one and doesn’t redirect).
- You want **200** or **401** (i.e. the request lands on your app, not on a redirect).

---

## 2. **Secret hash mismatch**

**What happens:**  
`verif-hash` is computed with the **secret hash** from the Flutterwave dashboard. If the value in Vercel (`FLUTTERWAVE_WEBHOOK_SECRET_HASH`) is different, verification fails.

**What to do:**

- Flutterwave: **Settings → Webhooks → Secret hash** — copy the value exactly.
- Vercel: **Project → Settings → Environment Variables** — set `FLUTTERWAVE_WEBHOOK_SECRET_HASH` to that exact value (no spaces, same case).
- Redeploy after changing env vars.

You already confirmed this works via `/api/test/webhook-test`.

---

## 3. **Slow webhook (timeouts)**

**What happens:**  
Vercel serverless has time limits (e.g. 10s on Hobby, 60s on Pro). If token distribution and DB updates take longer, the function can timeout. Flutterwave may retry; without idempotency you can double-process.

**What to do (later, if needed):**

- Prefer answering Flutterwave quickly (e.g. 200) and doing heavy work in the background (queue/job).
- Use transaction ID / `tx_ref` to make webhook handling **idempotent** so retries are safe.
- If you stay synchronous, consider increasing Vercel function max duration for the webhook route (Pro plan).

---

## 4. **Raw body and signature**

**What happens:**  
Signature must be computed on the **exact raw JSON** body. If anything (middleware, proxy, framework) parses or alters the body before your handler sees it, verification fails.

**What we do:**  
The webhook handler uses `request.text()` and verifies the signature on that string before parsing. Your middleware excludes `/api` routes, so it does not touch the webhook. This part is set up correctly.

---

## 5. **URL checklist for Flutterwave**

Use this exact URL in Flutterwave:

| Item        | Value                                                  |
|------------|---------------------------------------------------------|
| Webhook URL| `https://www.flippay.app/api/flutterwave/webhook`      |
| Method     | POST                                                    |
| Secret hash| Same as `FLUTTERWAVE_WEBHOOK_SECRET_HASH` in Vercel    |

No trailing slash, no `http`, no wrong host (e.g. `flippay.app` if your app is only on `www`).

---

## Quick debug steps

1. **Redirect check**
   ```bash
   curl -I -X POST https://www.flippay.app/api/flutterwave/webhook
   ```
   Expect **no** 301/302/308.

2. **Endpoint reachable**
   ```bash
   curl https://www.flippay.app/api/flutterwave/webhook
   ```
   Expect JSON like `"message": "Flutterwave webhook endpoint is active"`.

3. **Config and signature**
   ```bash
   curl https://www.flippay.app/api/test/webhook-test
   ```
   Expect `"signatureVerification": { "success": true }`.

4. **Vercel logs**  
   After a test payment, check Logs for:
   - `[Flutterwave Webhook] ✅ Signature verified successfully` → signature and URL are good.
   - `401` / `Invalid signature` → secret hash or body/redirect issue.
   - No log at all → Flutterwave not reaching the URL (redirect, DNS, or wrong URL).

---

## Summary

For **“webhook not working”** with Flutterwave + Vercel + **https://www.flippay.app**:

1. Use **https://www.flippay.app/api/flutterwave/webhook** in Flutterwave and make sure it’s the URL that **does not redirect** (check with `curl -I -X POST`).
2. Keep **FLUTTERWAVE_WEBHOOK_SECRET_HASH** in Vercel identical to the Secret hash in Flutterwave.
3. If it still fails, use Vercel logs and the `curl` checks above to see whether the problem is redirect, signature, or webhook never being called.
