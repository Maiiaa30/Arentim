# Edge Functions

Trusted server code that needs Deno or third-party secrets lives in
`supabase/functions/`. These are **not** applied by the migration runner — they
deploy with the Supabase CLI, which needs a Supabase **access token**
(supabase.com → Account → Access Tokens).

## One-time setup

```bash
# Authenticate the CLI (uses your access token)
export SUPABASE_ACCESS_TOKEN=...           # or: supabase login
supabase link --project-ref kactlxdjoxjrqhmkjtfj
```

## sync-fixtures

Pulls upcoming fixtures + pre-match odds for the configured leagues
(`supabase/functions/_shared/apiFootball.ts` → Primeira Liga, World Cup) from
API-Football and upserts them into `public.fixtures`. The API-Football key stays
in the function's secrets and never reaches the browser; fetches are locked to a
fixed allowlisted host (SSRF-safe). Invocation requires a shared `SYNC_SECRET`.

### Secrets

```bash
supabase secrets set API_FOOTBALL_KEY=<your-api-football-key>
supabase secrets set SYNC_SECRET=<a-long-random-string>
# Optional: pin the season (defaults to the current UTC year)
supabase secrets set FOOTBALL_SEASON=2026
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### Deploy

```bash
supabase functions deploy sync-fixtures
```

### Run it

Manually (also good for the first population):

```bash
curl -X POST \
  -H "x-sync-secret: <SYNC_SECRET>" \
  https://kactlxdjoxjrqhmkjtfj.functions.supabase.co/sync-fixtures
```

Daily schedule — in the Supabase Dashboard → **Database → Cron** (or
`Integrations → Cron`), create a job that POSTs to the function URL with the
`x-sync-secret` header, e.g. every day at 06:00:

```sql
select cron.schedule(
  'sync-fixtures-daily', '0 6 * * *',
  $$ select net.http_post(
       url := 'https://kactlxdjoxjrqhmkjtfj.functions.supabase.co/sync-fixtures',
       headers := jsonb_build_object('x-sync-secret', '<SYNC_SECRET>')
     ); $$
);
```

> Keep request volume under the API-Football free tier (~100/day): the daily
> sync makes a couple of requests per league. Don't schedule it more often than
> needed.

## poll-live-scores

Polls API-Football's live feed and writes score/minute/events into
`public.fixtures` (which streams to clients over Realtime). On full-time it
records the final score and auto-settles the fixture's bets via the idempotent
`settle_fixture` RPC. Only updates fixtures already in the DB, so off-window
runs are cheap no-ops.

Uses the same `API_FOOTBALL_KEY` / `SYNC_SECRET` secrets as `sync-fixtures`.

```bash
supabase functions deploy poll-live-scores
```

Schedule it more frequently during live windows (cron's minimum is 1 minute):

```sql
select cron.schedule(
  'poll-live-scores', '* * * * *',
  $$ select net.http_post(
       url := 'https://kactlxdjoxjrqhmkjtfj.functions.supabase.co/poll-live-scores',
       headers := jsonb_build_object('x-sync-secret', '<SYNC_SECRET>')
     ); $$
);
```

## generate-content (optional AI)

Generates short, plain-text match previews (`fixtures.preview`) and a "featured
match of the day" blurb (`daily_content`) with Gemini Flash. The model output is
treated as untrusted **data** — only stored and displayed (React escapes it),
never executed or used to drive a query/action/balance.

```bash
supabase secrets set GEMINI_API_KEY=<your-gemini-flash-key>
# optional: supabase secrets set GEMINI_MODEL=gemini-flash-latest
supabase functions deploy generate-content
```

Run it after the daily fixtures sync (same `x-sync-secret` header). Needs
upcoming fixtures to write previews, so it depends on the API-Football coverage
above.

### Free-tier coverage caveat

The API-Football **Free plan only covers seasons 2022–2024** — current/future
seasons return `{"errors":{"plan":"Free plans do not have access to this
season…"}}` and therefore **no upcoming fixtures**. The function is verified
working (e.g. Primeira Liga 2023 returns 308 fixtures), but until the plan
covers the current season the sportsbook runs on the **seeded fixtures** from
Phase 6a. Upgrade the API-Football plan (or set `FOOTBALL_SEASON` to a covered
season for testing) to pull live data.
