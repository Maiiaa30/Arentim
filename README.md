# Arentim

A play-money social casino and football sportsbook, built for a group of friends.
**There is no real money and no payments anywhere** — every balance is an in-app
currency called **Tostões**. The interface is in **Português de Portugal**.

> Apenas dinheiro de brincadeira — sem moeda real.

---

## For players — start in 60 seconds

1. **Criar conta** (sign up). New accounts start with **500 Tostões**.
2. On the **Salão**, claim the **bónus diário** (it grows on a streak — but you
   have to keep playing to keep it).
3. Pick something from the **Casino**: place chips on the **Roleta**, spin a slot,
   or take on the big **Fortuna de Ouro** video slot.
4. Add an **amigo**, send them a few tós, or call a **duelo** head-to-head.

That's the whole loop — bet, win, climb the leaderboard, repeat. It's all make-believe money.

---

## What's inside

- **Casino** — **Roleta** and **Crash** as shared live rooms (one round everyone
  watches in sync), **Blackjack**, a **Slots** floor (themed machines, a
  progressive jackpot, the classic **Vegas 777** drum, the high-variance
  **Tigrinho**, and the flagship 5×3 **Fortuna de Ouro** video slot), **Plinko**,
  **Balatró** (poker-hand skill game), **Mines**, **Atravessa!**, **Corrida de
  Cavalos** (live), **Moeda**, **Dados**, **Maior ou Menor**, **Sobe e Desce**,
  **Fita da Sorte** and **Jogo dos Copos**. Every outcome is settled server-side
  with a CSPRNG — the client never decides money.
- **Sportsbook (Futebol)** — fixtures with 1·X·2 / over-under / both-teams-to-score
  markets, singles and accumulators (the **Boletim**), early cash-out, live scores,
  automatic settlement and a betting leaderboard.
- **Poker** & **Sueca** — Texas Hold'em vs bots or private friend tables, and the
  Portuguese trick-taking game vs bots or 2v2.
- **Onze de Ouro** — build a Portuguese XI from real Liga Portugal squads (2005–2026).
- **Social** — friend requests and presence, gifting/requesting tós, head-to-head
  duels, a notification bell, and realtime updates with no reloads.
- **Leaderboards & challenges** — all-time and a monthly **season** board, plus
  recovery and high-roller milestones with badges.
- **Admin** — role-gated, fully audited player / economy / sportsbook management
  with a KPI dashboard, player drill-down, odds editor and announcements.

---

## Design

Dark, gold, warm — flat near-black surfaces with gold used sparingly as ink.

- **Palette:** canvas `#0a0907`, gold accent `#C9A24B`, a gilded top-accent rule.
- **Type:** Playfair Display (headings/figures), DM Sans (UI/body), DM Mono
  (money, odds, stakes). Restrained 3–4px radii.
- **Primitives:** reusable building blocks in
  [`src/components/ui/primitives.tsx`](src/components/ui/primitives.tsx)
  (TopAccentRule, Eyebrow, SectionHeader, Card, RingAvatar, CornerBrackets,
  FramedPanel, Monogram) plus `Button`/`Input`, a bespoke SVG icon set, and the
  hand-drawn slot symbols. Build a new page from these and it matches the app.
- Currency renders as thin-space groups + `Tt` (e.g. `12 500 Tt`); prose uses the
  full word _Tostões_. Helpers in [`src/lib/format.ts`](src/lib/format.ts).

---

## For developers

**Stack:** React + Vite + TypeScript (strict) + Tailwind · Supabase (Postgres with
RLS + atomic RPCs, Auth, Realtime, Edge Functions/Deno) · React Query + Zustand ·
ESLint/Prettier, Vitest, Playwright. Money and hidden information are always
server-authoritative — the client never awards itself balance and never sees
another player's hidden cards.

```bash
npm install
cp .env.example .env       # Supabase URL + anon (publishable) key
npm run db:migrate         # apply DB migrations (reads supabase/.env)
npm run dev                # http://localhost:5173
```

To see the **Admin** area, grant yourself the role in the Supabase SQL editor:

```sql
update public.profiles set is_admin = true
 where id = (select id from auth.users where email = 'YOUR_EMAIL');
```

### Configuration

- **Frontend `.env`** (safe to expose): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
  Don't create a `.env.local` with placeholders — Vite loads it over `.env`.
- **Server secrets** (gitignored `supabase/.env`): DB URL, service key, access
  token, football + content API keys. Never `VITE_`-prefixed. See
  [`docs/SECURITY.md`](docs/SECURITY.md).
- **Edge Functions:** deploy with `npm run deploy:functions` — see
  [`docs/EDGE_FUNCTIONS.md`](docs/EDGE_FUNCTIONS.md).
- **Live football** depends on a free data tier, so some windows may have no
  upcoming fixtures; a few seeded fixtures keep the betting/settlement flow
  exercisable.

### Scripts

| Script                                  | Purpose                                       |
| --------------------------------------- | --------------------------------------------- |
| `npm run dev` / `build` / `preview`     | Vite dev / production build / serve build     |
| `npm run lint` / `typecheck` / `format` | ESLint / TypeScript / Prettier                |
| `npm test` / `test:e2e`                 | Vitest unit/integration / Playwright e2e      |
| `npm run db:migrate`                    | Apply pending SQL migrations                  |
| `npm run deploy:functions`              | Deploy Supabase Edge Functions                |
| `npm run check:secrets`                 | Fail if a secret leaked into the built bundle |
| `npm run db:reset -- --yes`             | **Wipe ALL players & gameplay data** before a fresh launch (keeps config). Irreversible. |

### Quality gate

`lint`, `typecheck`, `npm audit --audit-level=high`, the test suite, `build`, and
the bundle secret scan must all pass. CI
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) enforces this on every
push and PR to `main`; branch protection requires it before merge.

### Project layout

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
