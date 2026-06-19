# Arentim

A play-money social casino and football sportsbook, built for fun among a group
of friends. **There is no real money and no real payments anywhere** — every
balance is an in-app currency called **Tostões**. The interface is in
**Português de Portugal**.

> Apenas dinheiro de brincadeira — sem moeda real.

## Features

- **Accounts & wallet** — email/password auth, profile with lifetime stats, an
  integer-only Tostões ledger where every bet/win/bonus/adjustment reconciles.
- **Daily bonus** — play-gated, escalating streak (must play to keep the streak).
- **Casino** — Roleta, Blackjack (pedir/ficar/dobrar/dividir), Slots, and Moeda
  (coin-flip), all settled server-side with a CSPRNG.
- **Sportsbook (Futebol)** — Primeira Liga & World Cup fixtures, 1·X·2 /
  over-under / both-teams-to-score markets, singles + accumulators (the
  **Boletim** bet slip), live scores, and automatic settlement.
- **Poker (Póquer)** — Texas Hold'em vs AI bots and private multiplayer tables
  with friends (invite codes, bot-fill), with a server-authoritative dealer.
- **Social** — friend requests, online presence, and global/friends leaderboards.
- **Challenges (Desafios)** — recovery (anti-stuck rescue) and high-roller
  milestones + badges.
- **Admin** — role-gated, fully audited player/economy/sportsbook management.
- **AI content** — optional Gemini Flash match previews (text-only, untrusted).

## Design

Dark, gold, warm — the **Aretim** look (a dark casino built on HMG Watches'
type/gold foundations).

- **Palette:** near-black warm canvas `#0a0907`, gold accent `#C9A24B`, soft warm
  shadows, a gilded top-accent rule.
- **Type:** Playfair Display (headings/figures), DM Sans (UI/body), DM Mono
  (money, odds, stakes). Restrained 3–4px radii.
- **Primitives:** eight reusable building blocks live in
  [`src/components/ui/primitives.tsx`](src/components/ui/primitives.tsx)
  (TopAccentRule, Eyebrow, SectionHeader, Card, RingAvatar, CornerBrackets,
  FramedPanel, Monogram) plus a restyled ghost/solid-gold `Button` and `Input`.
  Build any new page from these and it matches the rest of the app.
- Currency renders as thin-space groups + `Tt` (e.g. `12 500 Tt`); prose uses the
  full word *Tostões*. Helpers in [`src/lib/format.ts`](src/lib/format.ts).

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
  Do **not** create a `.env.local` with placeholder values — Vite loads it over
  `.env` and would ship a broken key.
- **Server secrets** (gitignored `supabase/.env`): DB URL, service key, access
  token, API-Football & Gemini keys. Never prefixed `VITE_`. See
  [`docs/SECURITY.md`](docs/SECURITY.md).
- **Database:** apply migrations with `npm run db:migrate` (or the Supabase
  dashboard) — see [`supabase/README.md`](supabase/README.md). Then grant
  yourself admin with the snippet there.
- **Edge Functions:** deploy with the Supabase CLI — see
  [`docs/EDGE_FUNCTIONS.md`](docs/EDGE_FUNCTIONS.md).

## Testing the app end-to-end

Everything below already runs against the live Supabase project (migrations
applied, Edge Functions deployed). To exercise it yourself:

1. `npm run dev`, open the app, and **Criar conta** (sign up). New accounts start
   with **5 000 Tostões**. If email confirmation is on, confirm via the link (or
   the Supabase dashboard), then **Entrar**.
2. **Make yourself admin** to see the Admin tab — in the Supabase SQL Editor:
   ```sql
   update public.profiles set is_admin = true
    where id = (select id from auth.users where email = 'YOUR_EMAIL');
   ```
3. **What to try:**
   - **Salão** — daily bonus claim, the game grid, High Rollers + Círculo rails.
   - **Casino** — Roleta (place chips → Rodar), Slots, Moeda, Blackjack
     (pedir/ficar/dobrar/dividir). Watch the **Saldo** in the header update.
   - **Futebol** — tap odds to build the **Boletim**, stake, **Apostar**; then
     settle a fixture from **Admin → Futebol** and watch the bet resolve.
   - **Póquer** — vs bots, or create a **Mesa privada**, add a bot, and play a hand
     (open a second account in another browser to play multiplayer).
   - **Amigos / Desafios / Carteira / Perfil** — friend requests + presence,
     claim challenge rewards, the transaction ledger, and your stats/badges.
   - **Admin** — adjust a balance (reason required), suspend a player, broadcast
     an announcement (appears as a banner), tune challenges.

> **Live football data:** API-Football's free plan only covers seasons
> 2022–2024, so there are no *current* upcoming fixtures — the sportsbook runs on
> a few **seeded** Primeira Liga fixtures until the plan is upgraded. The betting,
> bet slip and settlement all work on those.

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
  components/  Shared UI + layout shell + ui/primitives (the design system)
  features/    Domain logic + hooks (auth, casino, poker, sportsbook, friends, …)
  lib/         Money + formatting helpers
  pages/       Route screens (Português de Portugal)
supabase/
  migrations/  Versioned SQL (schema, RLS, atomic RPCs)
  functions/   Edge Functions (Deno) + shared engines (poker, API clients)
e2e/           Playwright tests
docs/          Security & Edge Function docs
```
