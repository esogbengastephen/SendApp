# Off-ramp cron runner (Fly.io / Railway / any host)

Calls `POST /api/offramp/process-payouts` on your Vercel app every 5 minutes so SEND → Naira payouts run without using Vercel’s limited cron.

## Env vars

| Variable | Required | Description |
|----------|----------|-------------|
| `OFFRAMP_CRON_API_URL` | Yes | Base URL of your app, e.g. `https://your-app.vercel.app` |
| `OFFRAMP_CRON_SECRET` | Recommended | Same value as `OFFRAMP_CRON_SECRET` in Vercel (so the endpoint accepts the request) |
| `OFFRAMP_CRON_INTERVAL_MS` | No | Interval in ms (default `300000` = 5 min) |

## Run locally (test)

```bash
cd scripts/offramp-cron
OFFRAMP_CRON_API_URL=https://your-app.vercel.app OFFRAMP_CRON_SECRET=your-secret node index.js
```

## Fly.io

1. From the **Send Xino** repo root (or from `scripts/offramp-cron` if you use the Dockerfile there):

   ```bash
   cd scripts/offramp-cron
   fly launch --name send-xino-offramp-cron --no-deploy
   ```

2. Set secrets:

   ```bash
   fly secrets set OFFRAMP_CRON_API_URL=https://your-app.vercel.app
   fly secrets set OFFRAMP_CRON_SECRET=your-cron-secret
   ```

3. Deploy:

   ```bash
   fly deploy
   ```

4. The Dockerfile runs `node index.js` and keeps the process alive; Fly will keep the machine running and the script will hit your API every 5 minutes.

If you don’t use the Dockerfile, run the script with Node on a Fly machine (e.g. `fly run node index.js` or use a `fly.toml` that runs `node index.js`).

## Railway

1. New project → “Deploy from GitHub” and choose the repo, or “Empty project” and deploy from CLI.

2. Root directory: set to `scripts/offramp-cron` (or deploy only that folder).

3. Build: no build step needed if you only run `node index.js`. If you use the Dockerfile, set Railway to use Dockerfile.

4. Start command: `node index.js`

5. Env in Railway dashboard:
   - `OFFRAMP_CRON_API_URL` = `https://your-app.vercel.app`
   - `OFFRAMP_CRON_SECRET` = same as in Vercel

Railway will keep the process running and the script will call your API every 5 minutes.

## Vercel

- In your Vercel project, set **OFFRAMP_CRON_SECRET** to a long random string.
- Use that same value as `OFFRAMP_CRON_SECRET` in Fly.io/Railway (or in cron-job.org header) so `POST /api/offramp/process-payouts` only runs for your cron.

## No Docker (plain Node on Fly.io/Railway)

- **Fly.io:** Use a `Dockerfile` that installs Node and runs `node index.js`, or use `fly run node index.js` with a machine that has Node.
- **Railway:** Set start command to `node index.js` and ensure `scripts/offramp-cron` has `index.js` (no Docker required if Node is available).
