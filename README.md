# Arentim

A play-money social casino and football sportsbook, built for fun among a group
of friends. **There is no real money and no real payments anywhere** — every
balance is an in-app currency called **Tostões**.

> Play money only — no real currency involved.

## Stack

- **Frontend:** React + Vite + TypeScript (strict) + Tailwind CSS
- **Data / backend:** Supabase (Postgres + Auth + Realtime + Edge Functions)
- **State:** React Query + Zustand, with Supabase Realtime for presence and live tables
- **Tooling:** ESLint (flat config) + Prettier, Vitest (unit/integration), Playwright (e2e)

Server-authoritative wherever money or hidden information is involved: the client
never awards itself balance and never sees other players' hidden cards.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL + anon key
npm run dev
```

The app runs at http://localhost:5173.

### Environment

Only the Supabase **URL** and **anon key** belong in `.env` (they are safe to
expose). All other keys are secrets and live in Supabase Edge Function secrets —
see [`docs/SECURITY.md`](docs/SECURITY.md). Never prefix a secret with `VITE_`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run format` | Prettier write |
| `npm test` | Unit/integration tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |

## Currency

- **Tostões** (singular *tostão*) — stored as whole integers, never floats.
- New accounts start with **5.000 Tostões**.

## Quality gate

`npm run lint`, `npm run typecheck`, `npm audit`, the test suite, and `npm run
build` must all pass. CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml))
enforces this on every push and pull request to `main`.

## Project layout

```
src/
  components/      Shared UI + layout shell
  lib/             Pure domain helpers (money, formatting)
  pages/           Route screens
  test/            Test setup
e2e/               Playwright end-to-end tests
docs/              Security and architecture notes
```

Built phase by phase — see the build plan for the current roadmap.
