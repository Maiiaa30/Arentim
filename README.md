# Arentim

A play-money social casino and football sportsbook, built for fun among a group
of friends. **There is no real money and no real payments anywhere** — every
balance is an in-app currency called **Tostões**.

> Play money only — no real currency involved.

## Features

- **Accounts & wallet** — email/password auth, profile with lifetime stats, an
  integer-only Tostões ledger where every bet/win/bonus/adjustment reconciles.
- **Daily bonus** — play-gated, escalating streak (must play to keep the streak).
- **Casino** — Roulette, Blackjack (hit/stand/double/split), Slots, and Coin-flip,
  all settled server-side with a CSPRNG.
- **Sportsbook** — Primeira Liga & World Cup fixtures, 1X2 / over-under / BTTS
  markets, singles + parlays, live scores, and automatic settlement.
- **Poker** — Texas Hold'em vs AI bots and private multiplayer tables with
  friends (invite codes, bot-fill), with a server-authoritative dealer.
- **Social** — friend requests, online presence, and global/friends leaderboards.
- **Challenges** — recovery (anti-stuck rescue) and high-roller milestones + badges.
- **Admin** — role-gated, fully audited player/economy/sportsbook management.
- **AI content** — optional Gemini Flash match previews (text-only, untrusted).

## Stack

- **Frontend:** React + Vite + TypeScript (strict) + Tailwind CSS
- **Backend:** Supabase — Postgres (RLS + atomic RPCs), Auth, Realtime, Edge Functions (Deno)
- **State:** React Query + Zustand
- **Tooling:** ESLint + Prettier, Vitest (unit), Playwright (e2e)

Server-authoritative wherever money or hidden information is involved: the client
never awards itself balance and never sees other players' hidden cards.

## Getting started

```bash
npm install
cp .env.example .env       # fill in your Supabase URL + anon (publishable) key
npm run db:migrate         # apply DB migrations (reads supabase/.env)
npm run dev
```

App runs at http://localhost:5173.

### Configuration

- **Frontend `.env`** (safe to expose): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
  Do **not** create a `.env.local` with placeholder values — it shadows `.env`.
- **Server secrets** (gitignored `supabase/.env`): DB URL, service key, access
  token, API-Football & Gemini keys. Never prefixed `VITE_`. See
  [`docs/SECURITY.md`](docs/SECURITY.md).
- **Database:** apply migrations with `npm run db:migrate` (or the Supabase
  dashboard) — see [`supabase/README.md`](supabase/README.md). Then grant
  yourself admin with the snippet there.
- **Edge Functions:** deploy with the Supabase CLI — see
  [`docs/EDGE_FUNCTIONS.md`](docs/EDGE_FUNCTIONS.md).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `preview` | Vite dev / production build / serve build |
| `npm run lint` / `typecheck` / `format` | ESLint / TypeScript / Prettier |
| `npm test` / `test:e2e` | Vitest unit/integration / Playwright e2e |
| `npm run db:migrate` | Apply pending SQL migrations |
| `npm run check:secrets` | Fail if a secret leaked into the built bundle |

## Quality gate

`lint`, `typecheck`, `npm audit --audit-level=high`, the test suite, `build`, and
the bundle secret scan must all pass. CI
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) enforces this on every
push and PR to `main`, and branch protection requires it before merge. Security
posture and verification are documented in [`docs/SECURITY.md`](docs/SECURITY.md).

## Project layout

```
src/
  components/  Shared UI + layout shell
  features/    Domain logic + hooks (auth, casino, poker, sportsbook, friends, …)
  lib/         Money + formatting helpers
  pages/       Route screens
supabase/
  migrations/  Versioned SQL (schema, RLS, atomic RPCs)
  functions/   Edge Functions (Deno) + shared engines (poker, API clients)
e2e/           Playwright tests
docs/          Security & Edge Function docs
```
