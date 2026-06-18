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
