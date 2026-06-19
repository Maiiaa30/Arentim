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

Pulls upcoming fixtures for the configured competitions
(`supabase/functions/_shared/footballData.ts` → Liga Portugal, Champions League,
Premier League, La Liga, Serie A, Bundesliga) from **Football-Data.org (free
tier)** and upserts them into `public.fixtures`. The free plan has no odds, so we
**generate realistic odds** with a Poisson model fed by each team's live form
from the league standings (see `computeOdds`). The token stays in the function's
secrets and never reaches the browser; fetches are locked to a fixed allowlisted
host (SSRF-safe). Invocation requires a shared `SYNC_SECRET`.

Get a **free** API token at https://www.football-data.org/client/register.
The free tier covers the major competitions (incl. Liga Portugal) — no payment,
no card. Rate limit is 10 req/min, so the function spaces its calls (~6.5s).

### Secrets

```bash
supabase secrets set FOOTBALL_DATA_TOKEN=<your-football-data-token>
supabase secrets set SYNC_SECRET=<a-long-random-string>
```

(The legacy API-Football integration is still in the repo at
`_shared/apiFootball.ts` if you ever want to switch to a paid live provider.)

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### Deploy

```bash
supabase functions deploy sync-fixtures
```

### Run it

The functions are deployed with JWT verification on, so the **Supabase gateway**
also needs the project's **publishable (anon) key** as `apikey` + `Authorization`
— on top of the function's own `x-sync-secret`. (Without the apikey you get
`UNAUTHORIZED_NO_AUTH_HEADER` from the gateway before your code runs.)

Manually (also good for the first population):

```bash
curl -X POST \
  -H "apikey: <VITE_SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <VITE_SUPABASE_ANON_KEY>" \
  -H "x-sync-secret: <SYNC_SECRET>" \
  https://kactlxdjoxjrqhmkjtfj.functions.supabase.co/sync-fixtures
```

Daily schedule — in the Supabase Dashboard → **Database → Cron** (or
`Integrations → Cron`), create a job that POSTs to the function URL with the
three headers, e.g. every day at 06:00:

```sql
select cron.schedule(
  'sync-fixtures-daily', '0 6 * * *',
  $$ select net.http_post(
       url := 'https://kactlxdjoxjrqhmkjtfj.functions.supabase.co/sync-fixtures',
       headers := jsonb_build_object(
         'apikey', '<VITE_SUPABASE_ANON_KEY>',
         'Authorization', 'Bearer <VITE_SUPABASE_ANON_KEY>',
         'x-sync-secret', '<SYNC_SECRET>')
     ); $$
);
```

> Football-Data.org free tier allows 10 req/min; the daily sync spaces ~2
> requests per competition. Keep `poll-live-scores` at ~1–2 min.

## poll-live-scores

Polls Football-Data.org for today's matches and writes score/minute/status into
`public.fixtures` (which streams to clients over Realtime). On full-time it
records the final score and auto-settles the fixture's bets via the idempotent
`settle_fixture` RPC. Only updates fixtures already in the DB, so off-window
runs are cheap no-ops (one API call per run).

Uses the same `FOOTBALL_DATA_TOKEN` / `SYNC_SECRET` secrets as `sync-fixtures`.

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
