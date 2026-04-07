# US Jobs

A small Next.js app that aggregates frontend-focused remote jobs and sends new matches to Telegram every hour.

## What it does

- Collects jobs from multiple public sources:
  - Adzuna
  - Remotive
  - Arbeitnow
  - Jobicy
  - Greenhouse boards
  - Ashby boards
  - Optional Lever boards
- Filters aggressively toward frontend / React / modern web roles
- Keeps only recent jobs by default
- Sends new jobs to Telegram with inline actions:
  - `Details`
  - `Apply`
  - `Dismiss`
- Stores sent / dismissed jobs in Supabase so duplicates are not re-sent
- Runs hourly via Netlify Scheduled Functions

## Stack

- Next.js App Router
- Netlify
- Supabase Postgres via REST API
- Telegram Bot API

## Local development

Install dependencies:

```bash
npm install
```

Copy env values into `.env.local`:

```env
ADZUNA_APP_ID=
ADZUNA_APP_KEY=

# Optional source overrides
# GREENHOUSE_BOARDS=stripe,airbnb
# ASHBY_ORGS=notion,ramp
# LEVER_SITES=

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

APP_BASE_URL=http://localhost:3000
netlify=

CRON_SECRET=

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Run the app:

```bash
npm run dev
```

Build locally:

```bash
npm run build
```

## Supabase setup

Run the SQL in [supabase/schema.sql](/Users/sargin/Documents/clones/us-jobs/supabase/schema.sql).

This creates the `job_notifications` table used to track:

- first time a job was seen
- whether it was already sent
- whether it was dismissed

## Netlify deployment

Deploy the repo to Netlify, then add these environment variables in `Site configuration > Environment variables`:

- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `APP_BASE_URL`
- `netlify`
- `CRON_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Recommended values:

- `APP_BASE_URL=https://your-site.netlify.app`
- `netlify=https://your-site.netlify.app`
- `CRON_SECRET=<long-random-string>`

The scheduled function is configured in [netlify.toml](/Users/sargin/Documents/clones/us-jobs/netlify.toml) and runs hourly.

## Telegram setup

After the first successful deploy, open:

```text
https://your-site.netlify.app/api/telegram/setup
```

If setup succeeds, you should get a JSON response with `ok: true`.

That registers this webhook:

```text
https://your-site.netlify.app/api/telegram/webhook
```

## Manual testing

Trigger the job scan manually:

```text
https://your-site.netlify.app/api/cron/jobs?secret=YOUR_CRON_SECRET
```

Expected response:

```json
{
  "ok": true,
  "fetchedAt": "...",
  "fetched": 7,
  "newJobs": 7,
  "sent": 7
}
```

Useful routes:

- `/` -> web UI
- `/api/jobs` -> aggregated jobs JSON
- `/api/cron/jobs` -> protected cron endpoint
- `/api/telegram/setup` -> webhook registration
- `/api/telegram/webhook` -> Telegram callback endpoint

## Notes

- The app is tuned for frontend roles and excludes many backend / full-stack titles.
- The default feed focuses on jobs from the last 24 hours.
- Some sources do not expose full job descriptions in their listing APIs, so `Details` may show a compact summary instead of the full description.
- This project is designed for low-volume personal use and fits well within free-tier limits in typical single-user usage.

