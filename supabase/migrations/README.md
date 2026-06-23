# Migrations

This folder is the **append-only history** of the database schema. Each `*.sql`
file is applied once, in filename order, by a small custom runner
(`scripts/migrate.mjs`) that records what it has applied in the
`public.arentim_migrations` table. It is **not** the Supabase CLI migration
system — don't run `supabase db push` against these.

## Commands

| Command | What it does |
| --- | --- |
| `npm run db:status` | Read-only. Shows how many files are applied vs **pending**, and lists the pending ones. Run this first when something "isn't live yet". |
| `npm run db:migrate` | Applies every pending file, in order, each in its own transaction. Idempotent — re-running is safe. |
| `npm run db:new "short description"` | Scaffolds the next file with the correct version number + a header template. Never hand-pick a timestamp. |

## Rules

- **Write every migration idempotently** — `create or replace`, `create … if not
  exists`, `alter table … add column if not exists`, `insert … on conflict do
  nothing`, `drop policy if exists` then `create policy`. The runner and the
  "re-run is safe" guarantee depend on it. Avoid relative data mutations like
  `update x set n = n + 1` (not idempotent).
- **Never edit or delete a file that has already been applied** to prod — it's
  history. To change something, add a *new* migration that alters it.
- **New RPCs / tables must also be reflected in `src/types/db.ts`** (the
  hand-written DB types), or the frontend won't typecheck.
- **Filename = version.** `<14-digit version>_<slug>.sql`; the version is a
  `<date><6-digit-seq>` that increments by 100000 (`db:new` handles this).

## "There are so many files"

That's normal — it's a ledger, and git keeps the full history regardless. The
count isn't a problem on its own; `db:status` is how you get a quick overview of
what matters (pending vs applied).

If the folder ever genuinely needs collapsing, the safe path is a **one-time
baseline squash**: move the existing files into an `archive/` subfolder (the
runner reads this directory flat, so archived files are ignored), add a single
`…_baseline.sql` that recreates the current schema, and mark it applied on prod.
This requires auditing every migration for idempotency and a coordinated prod
step — do it deliberately, not casually.
