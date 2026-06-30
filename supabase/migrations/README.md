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

## Layout: baseline + archive

The history was squashed once (2026-06-30). The active folder now holds a single
**`<version>_baseline.sql`** — the concatenation of every migration applied up to
that point — plus any newer dated migrations added since. The original per-step
files live in **`archive/`** (the runner reads this folder flat, so anything in a
subfolder is ignored) and in git history. They are never deleted.

How the runner handles the baseline (`scripts/migrate.mjs`):

- **Existing database** (`arentim_migrations` already has rows): the baseline is
  **recorded as applied without running** — the schema is already there from the
  archived steps. `db:migrate` prints `• adopt …`. Nothing in prod changes.
- **Brand-new database** (no rows yet): the baseline runs in one transaction to
  build the whole schema, then any newer dated migrations apply on top.
- **Catch-up:** if any *archived* migration was still pending when the squash
  landed (not yet applied to that DB), the runner applies those individually
  before adopting the baseline — so no pending change is ever lost to the squash.

So `npm run db:migrate` is safe to run on prod after the squash — there is no
manual step. `db:status` shows the baseline as "recorded without running" until
the first `db:migrate` adopts it, and does not flag the archived files.

### Adding migrations after the squash

Nothing changes: `npm run db:new "…"` scaffolds the next dated file (it sorts
after the baseline), you write it idempotently, and `db:migrate` applies it.

### Squashing again later

When the active folder grows large again, repeat the one-time squash: regenerate
`…_baseline.sql` from the (already-applied) dated files, move those into
`archive/`, and commit. Because the runner adopts the baseline on existing DBs,
no coordinated prod step is needed — just merge and run `db:migrate`.
