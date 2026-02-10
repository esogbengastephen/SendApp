#!/usr/bin/env node
/**
 * Off-ramp cron runner: calls POST /api/offramp/process-payouts every 5 minutes.
 * Run on Fly.io, Railway, or any host. Your Next.js app stays on Vercel.
 *
 * Env:
 *   OFFRAMP_CRON_API_URL  - e.g. https://your-app.vercel.app
 *   OFFRAMP_CRON_SECRET   - same as OFFRAMP_CRON_SECRET in Vercel (optional but recommended)
 *   OFFRAMP_CRON_INTERVAL_MS - optional, default 300000 (5 min)
 */

const INTERVAL_MS = parseInt(process.env.OFFRAMP_CRON_INTERVAL_MS || "300000", 10);
const API_URL = (process.env.OFFRAMP_CRON_API_URL || "").replace(/\/$/, "");
const SECRET = process.env.OFFRAMP_CRON_SECRET || "";

if (!API_URL) {
  console.error("Set OFFRAMP_CRON_API_URL (e.g. https://your-app.vercel.app)");
  process.exit(1);
}

const url = `${API_URL}/api/offramp/process-payouts`;

async function run() {
  const headers = { "Content-Type": "application/json" };
  if (SECRET) headers["Authorization"] = `Bearer ${SECRET}`;

  try {
    const res = await fetch(url, { method: "POST", headers });
    const body = await res.json().catch(() => ({}));
    const ok = res.ok;
    console.log(
      new Date().toISOString(),
      ok ? "OK" : "FAIL",
      res.status,
      JSON.stringify(body)
    );
  } catch (err) {
    console.error(new Date().toISOString(), "ERROR", err.message);
  }
}

console.log(
  `Off-ramp cron: POST ${url} every ${INTERVAL_MS / 1000}s (Authorization: ${SECRET ? "yes" : "no"})`
);
run();
setInterval(run, INTERVAL_MS);
