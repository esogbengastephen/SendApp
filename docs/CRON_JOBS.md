# Cron Jobs – Send Xino

Vercel’s free tier allows only **1 cron execution per 24 hours**. Use an external scheduler (e.g. [cron-job.org](https://console.cron-job.org/jobs)) to trigger these API routes on the right schedule.

## Environment variables (Vercel)

| Variable | Purpose |
|----------|--------|
| `OFFRAMP_CRON_SECRET` | Optional. If set, **off-ramp** cron endpoints require `Authorization: Bearer <value>`. Use for `/api/offramp/process-payouts` and `/api/offramp/monitor-wallets`. |
| `CRON_SECRET` | Optional. If set, **admin** cron endpoints require `Authorization: Bearer <value>`. Use for cleanup and refresh-token-prices. |

Set the same secrets in cron-job.org when adding the `Authorization: Bearer <secret>` header to each job.

---

## 1. Off-ramp: process payouts (required)

- **URL:** `https://YOUR_APP.vercel.app/api/offramp/process-payouts`
- **Method:** POST
- **Schedule:** Every 5 minutes (e.g. `*/5 * * * *`)
- **Auth:** If `OFFRAMP_CRON_SECRET` is set, add header: `Authorization: Bearer <OFFRAMP_CRON_SECRET>`

Sweeps SEND from user deposit wallets to the pool and pays Naira via Flutterwave for pending off-ramps.

---

## 2. Off-ramp: monitor wallets (Option B – unified)

- **URL:** `https://YOUR_APP.vercel.app/api/offramp/monitor-wallets`
- **Method:** POST
- **Schedule:** Same as process-payouts (e.g. every 5 min), **or** use this **instead** of process-payouts (same logic).
- **Auth:** If `OFFRAMP_CRON_SECRET` is set, add header: `Authorization: Bearer <OFFRAMP_CRON_SECRET>`

Runs the same sweep + payout as process-payouts. Use either **process-payouts** or **monitor-wallets** on a schedule, not both (they do the same thing).

---

## 3. Cleanup: pending transactions

- **URL:** `https://YOUR_APP.vercel.app/api/admin/cleanup-pending`
- **Method:** POST
- **Schedule:** Daily (e.g. `0 0 * * *` = midnight UTC)
- **Auth:** None required (optional: add `CRON_SECRET` later if you add checks to this route)

Deletes pending NGN→crypto transactions whose `expires_at` has passed (e.g. 1-hour expiry).

---

## 4. Cleanup: expired invoices

- **URL:** `https://YOUR_APP.vercel.app/api/admin/cleanup-expired-invoices`
- **Method:** POST
- **Schedule:** Daily (e.g. `0 1 * * *` = 01:00 UTC)
- **Auth:** If `CRON_SECRET` is set, add header: `Authorization: Bearer <CRON_SECRET>`

Marks invoices as `expired` when `due_date` has passed and status is still `pending`.

---

## 5. Cleanup: orphaned transactions

- **URL:** `https://YOUR_APP.vercel.app/api/admin/cleanup-orphaned`
- **Method:** POST
- **Schedule:** Daily (e.g. `0 2 * * *` = 02:00 UTC)
- **Auth:** If `CRON_SECRET` is set, add header: `Authorization: Bearer <CRON_SECRET>`

Removes orphaned pending transactions (₦0, empty/placeholder wallet, or pending > 24h with very small amount).

---

## 6. Cleanup: old notifications

- **URL:** `https://YOUR_APP.vercel.app/api/admin/cleanup-old-notifications`
- **Method:** POST
- **Query (optional):** `?days=90` (default 90; max 365)
- **Schedule:** Weekly (e.g. `0 3 * * 0` = Sunday 03:00 UTC)
- **Auth:** If `CRON_SECRET` is set, add header: `Authorization: Bearer <CRON_SECRET>`

Deletes **read** notifications older than the given number of days (by `created_at`).

---

## 7. Refresh token prices (CoinGecko)

- **URL:** `https://YOUR_APP.vercel.app/api/admin/refresh-token-prices`
- **Method:** POST
- **Schedule:** Every 5–15 minutes (e.g. `*/10 * * * *` = every 10 min)
- **Auth:** If `CRON_SECRET` is set, add header: `Authorization: Bearer <CRON_SECRET>`

Fetches CoinGecko prices, applies configured profit margins, and updates platform buy rate, token buy prices (USDC/USDT), and sell rates. Keeps rates up to date when no admin is on the price-action page.

---

## cron-job.org setup (summary)

1. Go to [cron-job.org](https://console.cron-job.org/jobs) and sign in.
2. For each job above, create a new cron:
   - **Title:** e.g. “Send Xino – process payouts”
   - **URL:** as in the table (replace `YOUR_APP` with your Vercel project URL).
   - **Request method:** POST.
   - **Schedule:** as suggested (or adjust).
   - **Request headers:** If the job uses auth, add:  
     `Authorization` = `Bearer <your-secret>`  
     (use `OFFRAMP_CRON_SECRET` for off-ramp, `CRON_SECRET` for admin jobs).
3. After everything works from cron-job.org, you can remove or comment out the `crons` array in `vercel.json` so Vercel doesn’t run them (and you stay within free tier limits).

---

## vercel.json (reference only)

The following paths are the cron endpoints. On the free tier, trigger them from cron-job.org instead of relying on Vercel Cron.

```json
{
  "crons": [
    { "path": "/api/offramp/process-payouts", "schedule": "*/5 * * * *" },
    { "path": "/api/offramp/monitor-wallets", "schedule": "*/5 * * * *" },
    { "path": "/api/admin/cleanup-pending", "schedule": "0 0 * * *" },
    { "path": "/api/admin/cleanup-expired-invoices", "schedule": "0 1 * * *" },
    { "path": "/api/admin/cleanup-orphaned", "schedule": "0 2 * * *" },
    { "path": "/api/admin/cleanup-old-notifications", "schedule": "0 3 * * 0" },
    { "path": "/api/admin/refresh-token-prices", "schedule": "*/10 * * * *" }
  ]
}
```

Note: Use **either** `process-payouts` **or** `monitor-wallets` for off-ramp (same behavior); you don’t need both.
