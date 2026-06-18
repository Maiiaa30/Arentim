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
