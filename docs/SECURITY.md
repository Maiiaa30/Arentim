# Security overview

Arentim handles **play money only** — there is no real currency and no payments
anywhere. Even so, the in-app economy is the real attack surface, so security is
built in from the first phase rather than retrofitted. We target **OWASP ASVS
Level 2** and use the **OWASP Top 10:2025** as the working risk checklist.

This document tracks the controls that are in place and where each lives. It is
updated as each build phase lands.

## Status by control (Phase 1)

| Area | Control | Where | Status |
| --- | --- | --- | --- |
| A02 Misconfiguration | CSP, HSTS, nosniff, Referrer-Policy, frame-ancestors `none` | `vercel.json` (host headers) + `index.html` meta fallback + dev middleware in `vite.config.ts` | ✅ in place |
| A02 | Anti-clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` | ✅ |
| A03 Supply chain | Lockfile committed, `npm audit --audit-level=high` gate in CI | `.github/workflows/ci.yml` | ✅ |
| A04 Crypto | HTTPS enforced via HSTS; passwords delegated to Supabase Auth (never rolled in-house) | host + Supabase | ⏳ Supabase in Phase 2 |
| A05 Injection | React auto-escaping; no `dangerouslySetInnerHTML`; Zod validation on server side of Edge Functions | code review + Phase 2+ | ⏳ |
| A06 Insecure design | Money stored as **integers**, never floats; stake/amount validation; floor-rounded payouts | `src/lib/money.ts` | ✅ foundation |
| A01 Access control | Default-deny RLS on every table; server-authoritative mutations | Phase 2+ (Supabase) | ⏳ |

Legend: ✅ implemented · ⏳ scheduled for a later phase.

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
