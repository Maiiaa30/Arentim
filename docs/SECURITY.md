# Security overview

Arentim handles **play money only** — there is no real currency and no payments
anywhere. Even so, the in-app economy is the real attack surface, so security is
built in from the first phase rather than retrofitted. We target **OWASP ASVS
Level 2** and use the **OWASP Top 10:2025** as the working risk checklist.

This document tracks the controls that are in place and where each lives. It is
updated as each build phase lands.

## Status by control (through Phase 2)

| Area | Control | Where | Status |
| --- | --- | --- | --- |
| A02 Misconfiguration | CSP, HSTS, nosniff, Referrer-Policy, frame-ancestors `none` | `vercel.json` (host headers) + `index.html` meta fallback + dev middleware in `vite.config.ts` | ✅ |
| A02 | Anti-clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` | ✅ |
| A03 Supply chain | Lockfile committed, `npm audit --audit-level=high` gate in CI; minimal dependency set | `.github/workflows/ci.yml` | ✅ |
| A04 Crypto | HTTPS via HSTS; password hashing delegated to Supabase Auth (never rolled in-house) | host + Supabase Auth | ✅ |
| A05 Injection | React auto-escaping; no `dangerouslySetInnerHTML`; parameterized Supabase queries; Zod validation on auth inputs | `src/features/auth/schema.ts` | ✅ (server-side Zod expands with Edge Functions) |
| A06 Insecure design | Money stored as **integers**; atomic `apply_ledger_entry` with `SELECT … FOR UPDATE`, idempotency key, balance floor/ceiling; ledger reconciles via welcome-bonus seed | `supabase/migrations/*`, `src/lib/money.ts` | ✅ foundation |
| A01 Access control | Default-deny RLS on `profiles`/`transactions`; users read only their own rows; balance never client-mutable; `apply_ledger_entry` execute revoked from anon/authenticated; queries scoped to `auth.uid()` | `supabase/migrations/*` | ✅ |
| A07 AuthN | Strong password policy (length + character classes); generic login error messages; email verification flow | `src/features/auth/*` | ✅ baseline (rate-limiting/MFA later) |

Legend: ✅ implemented · ⏳ scheduled for a later phase.

## Security gate verification (Phase 15)

Active verification performed against the live project + codebase:

| Risk | Control | How verified |
| --- | --- | --- |
| A01 IDOR/BOLA | Default-deny RLS; reads scoped to `auth.uid()` | **Live probe**: anon reads of `profiles`, `transactions`, `game_rounds`, `bets`, `poker_bot_tables`, `blackjack_hands`, `admin_actions` all return `[]` |
| A01 RLS coverage | RLS enabled on **every** `public` table | **Live assertion migration** loops `pg_tables` and fails if any table lacks RLS — applied successfully |
| A01 hidden info | Poker/blackjack decks + hole cards server-only | Tables have no client SELECT policy; anon probe returns `[]`; clients get sanitized views |
| A01 SSRF | Edge fetchers use fixed allowlisted hosts | Code review: `apiFootball.ts` / `gemini.ts` build URLs from constants only, no user input |
| A02 misconfig | Security headers, CORS, RLS on | `vercel.json` headers; Edge Functions fail-closed on a shared secret |
| A04 / secrets | No secret in client bundle | **`check:secrets`** scans `dist/` for `sb_secret_`/`sbp_` (0 found); CI-enforced. Caught + fixed a stray `.env.local` shadowing the real key |
| A05 injection (SQL) | Parameterized plpgsql; no dynamic SQL | Code review: no `EXECUTE`-built SQL; `format()` used only for human-readable notes |
| A05 injection (XSS) | React auto-escaping | `grep` confirms **0** `dangerouslySetInnerHTML` / `eval` in `src/` |
| A05 prompt injection | Gemini output is data-only | System prompt ignores instructions in fixture data; output sanitized, stored, displayed — never executed |
| A06 double-spend | `SELECT … FOR UPDATE` row lock per mutation | Code review of every money RPC; poker chip-conservation simulated over 80+ hands |
| A06 replay/multi-claim | Idempotency keys + status/date guards | `game_rounds.idempotency_key` unique; daily bonus `last_claim_date`; challenge claim PK; unit tests |
| A06 bad stakes | Integer money; positive/in-range stake checks | Unit tests (`assertValidStake`) + SQL `check`s reject non-positive/oversized/float stakes |
| A03 supply chain | `npm audit --audit-level=high` clean; lockfile pinned | CI gate green |

Not exercised in automation (documented, covered by design): authenticated cross-user IDOR and concurrent double-spend require live multi-user JWT sessions; they are prevented by `auth.uid()` scoping + row locks + idempotency.

## Casino RNG & settlement (Phase 3+)

Casino rounds settle inside a single atomic `SECURITY DEFINER` RPC (e.g.
`play_roulette`) rather than an Edge Function, because the whole round —
validate → lock balance → debit → spin → credit → record — must be one
transaction so a mid-round failure rolls back cleanly (A06/A10).

- **RNG is server-side and unbiased.** Outcomes come from pgcrypto's
  `gen_random_bytes` (a CSPRNG), mapped to the outcome range with **rejection
  sampling** to avoid modulo bias. The client never supplies or influences the
  result.
- **All bet inputs are validated server-side** (kind, selection range, positive
  integer stake, bet count cap) before any money moves.
- **Idempotent:** every round carries an idempotency key; a replayed call
  returns the original settled round instead of spinning again.
- Edge Functions remain reserved for work that genuinely needs Deno/secrets:
  the API-Football proxy, live-score polling, the poker dealer, and Gemini.

## Database authorization model

- **RLS enabled** (not forced) on every table — clients connect as `anon`/`authenticated` (always subject to RLS) or `service_role` (bypasses by design for trusted server code).
- The client can read only its own `profiles`/`transactions` rows; admins (checked via the `is_admin()` SECURITY DEFINER helper) read all.
- **No direct writes** are granted on either table. Balance changes flow exclusively through `apply_ledger_entry` (SECURITY DEFINER, row-locked, idempotent), whose `EXECUTE` is revoked from `anon`/`authenticated` — only Edge Functions using the service key may call it.
- The only client-callable mutations are `update_own_profile` and `touch_last_online`, both scoped to `auth.uid()` and unable to touch balance, stats, or the admin flag.

## Secrets

- Only `VITE_`-prefixed env vars reach the browser bundle. The Supabase **anon
  key** is safe to expose; it is the only key in the frontend.
- The `service_role` key, the API-Football key, and the Gemini key are **secrets**
  and live **only** in Supabase Edge Function secrets:

  ```bash
  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
  supabase secrets set API_FOOTBALL_KEY=...
  supabase secrets set GEMINI_API_KEY=...
  ```

- `.env` is gitignored; only `.env.example` is committed. No secret ever appears
  in code, logs, URLs, or the built client bundle (verified in the Phase 15 gate).

## Content-Security-Policy notes

- `script-src 'self'` — no inline or third-party scripts.
- `style-src` allows `'unsafe-inline'` because Tailwind injects inline styles and
  Google Fonts serves a stylesheet; scripts remain locked down.
- `connect-src` is widened to `*.supabase.co` (HTTPS + WSS for Realtime).
- Tighten `img-src`/`connect-src` further once the exact asset/API origins are
  finalized.
