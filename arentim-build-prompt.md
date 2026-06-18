# Build Prompt — "Arentim" (play-money casino & sports betting)

> Paste this into Claude (Claude Code recommended) to build the app. It's a full spec — build it
> **phase by phase** using the "Build order" at the bottom, not all at once. Commit your work to
> git as you go, and finish with the mandatory testing & security gate. You may use as many
> parallel sub-agents as you need. Everything is **fake currency, no real money, no payments
> anywhere.**

---

## Role & goal
You are building **Arentim**, a play-money online casino + football-betting web app, made for fun
among a group of friends. There is **no real money and no real payments** — all balances are an
invented in-app currency. Build it like a polished social game. Keep a persistent
"Play money only — no real currency involved" note in the footer.

## Tech stack
- **Frontend:** React + Vite + TypeScript + Tailwind CSS.
- **Backend / data:** Supabase (Postgres + Auth + Realtime + Edge Functions).
- **Edge Functions (Deno):** for anything that must be trusted/secret — dealing poker cards,
  settling bets, the daily data-sync cron, and **proxying all third-party API keys** so the
  API-Football and Gemini keys never touch the browser.
- **State:** React Query (or Zustand) + Supabase Realtime for presence and live tables.
- Server-authoritative wherever money or hidden info is involved: the client never awards itself
  balance and never sees other players' hidden cards.

## Currency & branding
- App name: **Arentim** (it's a place in Portugal — keep the brand, give the currency its own
  Portuguese-flavoured name).
- Currency: **Tostões** (a historic Portuguese coin; singular *tostão*). Display amounts with a
  coin icon, e.g. `1.250 Tostões`. Use this name consistently everywhere in the UI and copy.
- New-account starting balance: **5.000 Tostões**. Animate balance changes (count up/down).

## Feature spec

### 1. Accounts & profile
Supabase Auth (email/password), unique display name, avatar, role flag (`is_admin`).
Profile shows: balance, total wagered, won, lost, **net**, win rate %, biggest win, games played,
current daily streak, join date, achievements.

### 2. Wallet & history
Every bet/win/loss/bonus/admin-adjustment writes a `transactions` row (type, game, amount,
balance_after, timestamp, note). Filterable history + a simple stats chart over time.

### 3. Daily bonus — play-gated, escalating streak
Logging in is **not** enough. A day only counts toward the streak if the player **plays at least
one round / places one bet that day** (track `last_played_date`). Escalating reward:
Day 1: 100 · Day 2: 150 · Day 3: 225 · Day 4: 325 · Day 5: 450 · Day 6: 600 · Day 7+: 800 Tostões
(capped at day 7). "Claim" button lights up after the first qualifying play; miss a played day and
the streak resets. Show a 7-pip progress bar previewing the next reward.

### 4. Casino games
Self-contained, transparent-RNG games. Start with 2–3, then add more:
- **Roulette** (European, single 0), animated wheel.
- **Blackjack** (hit/stand/double/split, dealer stands on 17).
- **Slots** (3-reel, Arentim-themed).
- **Quick games** (Dice / Crash / Coin-flip) — great for the broke-recovery loop.

### 5. Poker — bots **and** friends *(see build notes; this is the hardest feature)*
Texas Hold'em, built in two stages:
- **Stage A — vs bots (build first):** single-player table against 1–5 AI opponents with
  selectable difficulty. Bots use a heuristic engine (hand strength + position + pot odds +
  some bluff randomness). *Optionally* give bots flavour/chat lines via Gemini Flash, but never
  let the LLM decide game-legal actions — keep that in deterministic code.
- **Stage B — private tables with friends:** create a table, invite friends from the friends
  list, join via link/code. **Server-authoritative:** an Edge Function is the dealer — it holds
  the deck, deals hole cards privately to each player, runs the betting rounds with turn timers,
  and resolves the pot. Clients only ever receive their own cards + public state, synced over
  Supabase Realtime. Empty seats can be filled with bots.

### 6. Sportsbook — Primeira Liga + World Cup (+ configurable leagues)
- **Data source:** **API-Football** (free tier ~100 req/day; covers fixtures, odds, live scores,
  standings; Primeira Liga + World Cup included). Permanent-free fallback: football-data.org
  (fixtures/results free; odds & live scores are paid there).
- A daily **sync cron** (Supabase Edge Function on a schedule) pulls upcoming fixtures + pre-match
  odds for the configured leagues and stores them in `fixtures`. **Cache aggressively** to stay
  under the free request cap.
- Bet types: match result (1X2), over/under goals, both-teams-to-score. Decimal odds.
- Bet slip with singles + accumulators/parlays; pending bets; auto-settlement when results land.

### 7. Live scores (FlashScore-style)
- During live match windows, an Edge Function polls API-Football's livescore endpoint
  (every ~15–30s, **only while matches are actually live**, to respect the free cap) and pushes
  updates to clients via Realtime.
- Show live score, match minute, and key events (goals/cards) on each fixture card and on any
  open bet. Settle bets automatically on full-time. (Their free embeddable widgets are a quick
  fallback if you want a scoreboard without custom polling.)

### 8. The optional AI agent (be realistic about its job)
- **Do NOT use the LLM as the source of odds or scores** — that data comes from API-Football.
- Use **Gemini Flash** (free tier — Flash models only; Pro is paid) as an *optional* content layer
  in the daily cron: generate short match previews, "featured match of the day" picks, a recap
  after results, and bot personality lines. Search-grounding (5,000 free prompts/month) can add
  current-events colour. Keep the Gemini key server-side in the Edge Function only.

### 9. Friends & social
Friend requests (send/accept/decline) + friends list. Per friend show: **online status + last
online** (Supabase Realtime presence), and stats (wagered, wins, losses, net, win rate; balance
toggleable). Friends-only + global **leaderboards** (net winnings, biggest win, streak). Optional
activity feed.

### 10. Challenges — two tracks
- **Recovery (balance = 0):** a rescue loop so nobody is stuck without real money — a free daily
  "Rock Bottom" wheel for a small stake, a free coin-flip double-or-nothing on a granted micro-
  stake, or micro-quests ("win any 3 rounds") to rebuild.
- **High-roller (funded):** wager milestones, win-streak challenges, "land a 3-leg parlay",
  weekly tournaments with leaderboard prizes. Reward in Tostões, badges, or cosmetic flair.
- Surface the relevant track based on the player's balance.

### 11. Admin panel (role-gated, fully audited)
Accessible only to `is_admin` users (enforced with Supabase Row-Level Security — never expose
admin endpoints to normal users). Capabilities:
- **Players table:** search/sort everyone; see balance, online/last-online, totals (wagered/won/
  lost/net), streak, join date, recent activity.
- **Edit anything:** credit/debit a player's balance (with a required reason), adjust streak,
  grant bonuses/currency, reset-password trigger, suspend/ban, edit display name/avatar.
- **Sportsbook control:** view/override fixtures & odds, manually set match results to settle bets,
  re-run the data sync.
- **Challenges & economy:** create/edit challenges, tune bonus amounts.
- **Global logs:** full transaction log + a broadcast/announcement tool.
- **Audit:** every admin action writes an `admin_actions` row (admin id, target, change, reason,
  timestamp). Because admins can change balances, this log is mandatory.

## Design direction
Modern, dark, confident — closer to a sleek fintech app than neon casino kitsch. Restraint over
clutter.
- **Palette:** bg `#0B0C10`, surfaces `#16181F`, borders `#232733`, text `#E6E8EE`,
  muted `#8A8F9C`, brand gold `#D4A24A`, positive `#3FB97A`, negative `#E5484D`, accent
  violet `#6E56CF`.
- **Type:** clean geometric sans (Inter / Geist / Satoshi) for UI; a distinctive display face for
  the Arentim logo and big numbers.
- Rounded-2xl cards, soft shadows, subtle gradients, tasteful Framer Motion micro-animations on
  bets/wins/balance. Mobile-first, fully responsive.

## Data model (sketch)
`users`(id, display_name, avatar, balance, is_admin, created_at, last_online, last_played_date,
streak_count) · `transactions`(id, user_id, type, game, amount, balance_after, note, created_at) ·
`bets`(id, user_id, market, selection, stake, odds, status, payout) ·
`fixtures`(id, league, home, away, kickoff, odds_json, status, minute, score, result) ·
`friendships`(user_id, friend_id, status) ·
`poker_tables`(id, host_id, status, config) + `poker_seats`(table_id, user_id|bot, stack) ·
`challenges`(id, user_id, type, progress, target, reward, claimed) ·
`admin_actions`(id, admin_id, target_user_id, action, detail, created_at).

## Security & hardening (treat this as a hard requirement, not a polish step)

Build security in from phase 1 — it is far cheaper than retrofitting. Target **OWASP ASVS Level 2**
as the verification bar, use the **OWASP Top 10:2025** as the risk checklist, and write secure,
clean code throughout. Concrete controls, mapped to the 2025 Top 10:

**A01 Broken Access Control (now includes SSRF) — the #1 risk here.**
- **Default-deny RLS on every Postgres table.** A user can read/write only their own rows; admin-
  only tables/columns require the `is_admin` claim. Never rely on the client to hide things.
- Prevent IDOR/BOLA: every query is scoped by the authenticated `user_id` server-side; never accept
  a `user_id` from the request body to decide whose data to touch.
- Admin actions re-check the admin role **inside the Edge Function**, not just in the UI.
- Poker: validate that the acting user owns the seat and it's their turn; never send other players'
  hole cards in any Realtime payload.
- SSRF: the football/Gemini fetchers use a **fixed allowlist of domains**; no user input ever
  controls a fetch URL.

**A02 Security Misconfiguration (#2).**
- Security headers via the host/CDN: strict `Content-Security-Policy`, `Strict-Transport-Security`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `frame-ancestors 'none'` (anti-
  clickjacking). Lock CORS on every Edge Function to your own origin(s) only.
- No verbose errors or stack traces in production responses. No default/sample routes left enabled.
- Supabase: confirm RLS is ON for every table (anon role gets nothing by default), and the
  `service_role` key is used **only** server-side, never shipped to the browser.

**A03 Software Supply Chain Failures (new).**
- Pin dependency versions (lockfile committed). Run `npm audit` + enable Dependabot/Renovate.
- Add Subresource Integrity (SRI) hashes to any CDN `<script>`. Prefer a minimal dependency set;
  vet anything new before adding it.

**A04 Cryptographic Failures.**
- HTTPS everywhere (enforced by HSTS). Let Supabase handle password hashing — never roll your own.
- No secrets, tokens, or PII in logs, URLs/query strings, or the client bundle. Validate JWTs
  server-side on every protected call.

**A05 Injection (incl. prompt injection).**
- Use the Supabase client / parameterized queries only; never build SQL by string concatenation.
- React escapes output by default — avoid `dangerouslySetInnerHTML`. Validate & normalize all input
  with a schema (e.g. Zod) on the **server** side of the Edge Function, not just the client.
- **LLM prompt injection:** treat football-API data and any web-grounded text as untrusted. The
  Gemini layer may only **return text** (previews/recaps) — it can never trigger an action, a
  balance change, or a query. Keep its output out of any code/eval path.

**A06 Insecure Design — the economy is the real attack surface.**
- All money mutations run server-side in a single **atomic DB transaction** with row locking
  (`SELECT … FOR UPDATE` / an RPC function) to prevent race conditions and double-spend.
- Store currency as **integers** (never floats). Reject non-positive stakes, stakes above balance,
  and out-of-range bets. Forbid negative balances and guard against overflow.
- **Idempotent settlement:** a bet/round can pay out at most once (idempotency key + status check).
- Outcomes use a server-side CSPRNG (`crypto.getRandomValues`), never client RNG. For trust, a
  commit-reveal seed ("provably fair") is a nice optional add.
- Anti-abuse on game/business logic: daily bonus checks `last_played_date`/last-claim server-side
  (no replay, no multi-claim); rate-limit bets, logins, friend requests, and table actions.

**A07 Identification & Authentication Failures.**
- Strong password policy + email verification; throttle/lock out repeated failed logins (anti
  brute-force). Optional MFA. Secure, single-use password-reset tokens with short expiry.
- Short-lived JWTs with refresh; invalidate sessions on password change.

**A08 Software & Data Integrity Failures.**
- Verify signatures on any inbound webhook. Don't trust client-supplied results for settlement —
  re-derive them server-side from trusted data. Protect the CI/CD pipeline and its secrets.

**A09 Security Logging & Alerting Failures.**
- Log auth events, admin actions (`admin_actions` table), failed authz checks, and economy
  anomalies — **without** logging secrets or PII. Add alerting on suspicious patterns (e.g. a user
  whose balance jumps without matching transactions). Keep an immutable audit trail.

**A10 Mishandling of Exceptional Conditions (new).**
- Handle every error path explicitly: fail **closed** (deny on doubt), never leak internals to the
  user, and ensure a failed payout/deal can't leave money in an inconsistent state (wrap in the
  same DB transaction so it rolls back cleanly).

**Secrets & config.** API-Football and Gemini keys live only in Supabase Edge Function secrets.
Remember Vite exposes any `VITE_`-prefixed env var to the browser — never prefix a secret that way.
Rotate keys if exposed.

**On MITRE ATT&CK.** ATT&CK is an adversary tactics/techniques knowledge base meant for
detection, threat-modeling, and red-teaming — it's not a secure-coding checklist, so for *building*
this app the OWASP Top 10 + ASVS above are the directly actionable standards. The ATT&CK techniques
most relevant to a web app and already covered above: T1190 (Exploit Public-Facing Application →
input validation, patched deps), T1110 (Brute Force → login throttling/MFA), T1078 (Valid Accounts →
session/JWT hygiene), and T1213/credential access (→ secrets management). Use ATT&CK later to think
like an attacker when reviewing, not as the dev checklist.

**Clean code.** TypeScript `strict` mode, ESLint + Prettier, small pure functions, clear separation
of concerns (UI / domain logic / data access), no secrets in code, meaningful errors, and tests for
every money path (bets, settlement, bonus, transfers).

## Working style — agents & autonomy
You may use **as many sub-agents / parallel agents as you need** to build, integrate, test, and
review the project efficiently — for example, separate agents for the frontend, the backend and
Edge Functions, game/economy logic, the sportsbook/data integration, and a dedicated QA &
security-review agent. Parallelize wherever it speeds things up; just make sure the integrated
result is consistent and every phase meets this spec.

## Version control & commits
- Initialize a git repository at the start and **commit incrementally** — at least one focused
  commit per phase/feature (more when useful), so the history tells a clear story.
- Use professional **Conventional Commits** messages (`feat:`, `fix:`, `chore:`, `docs:`, `test:`,
  `refactor:`).
- The repository must read as ordinary, professional human engineering work: **no mention of any
  AI assistant, model, or tool anywhere** — not in commit messages, code comments, the README,
  docs, or co-author/trailer lines. Do **not** add "Generated with…" lines or AI co-authors.
- Remote: `https://github.com/Maiiaa30/Arentim.git`. Push using the existing local git
  authentication already configured on the machine; never ask for, store, or enter credentials.
- Never commit secrets: keep `.env` gitignored and commit only `.env.example`.

## Testing, QA & security verification (final gate — do not consider the app done until this is green)
Run this once the build is feature-complete, and after any significant change.
- **Functional tests.** Unit tests for all game/economy logic (payout math, RNG bounds,
  blackjack/roulette/poker rules, streak logic); integration tests for every Edge Function and RPC;
  and end-to-end tests (e.g. Playwright) for the critical journeys: sign-up/login, claim the daily
  bonus, place a casino bet, place **and settle** a sports bet, play a poker hand vs a bot, send and
  accept a friend request, and perform an admin balance adjustment.
- **Money-path coverage is mandatory.** Assert that balances and the ledger always reconcile, can
  never go negative, and never pay out twice.
- **Security verification** against OWASP Top 10:2025 + ASVS L2 — actively attempt and confirm you
  prevent: IDOR/BOLA (reading or altering another user's data), privilege escalation to admin
  endpoints, double-spend via concurrent bets, replay/multi-claim of the daily bonus,
  negative/oversized stakes, SQL injection, XSS, SSRF on the data fetchers, and prompt injection on
  the AI layer. Confirm RLS is on for **every** table, CORS is locked to your origin, and **no
  secret appears in the built client bundle** (`npm run build`, then search the output).
- **Tooling gate.** `npm run lint`, `npm run typecheck`, `npm audit` (fix findings), and the full
  test suite must all pass clean.
- **Manual smoke test** of every feature end-to-end. Fix every bug and vulnerability found, then
  re-run until everything is green. Wire the suite into CI if a pipeline is present.
- Realistic bar: no software is provably free of every bug, so the target is **all tests green, no
  known vulnerabilities, and every money path covered and reconciling** — not an empty promise of
  perfection.

## Continuous integration (CI)
Add a **GitHub Actions** workflow at `.github/workflows/ci.yml` from the very first phase, so the
quality gate is enforced automatically on every push and pull request — not just at the end.
- **Triggers:** `push` and `pull_request` targeting `main`.
- **Job steps:** checkout → set up Node 20 with npm cache → `npm ci` → `npm run lint` →
  `npm run typecheck` → `npm audit --audit-level=high` → `npm test` (unit/integration) →
  `npm run build`. Add a separate job for Playwright e2e tests (it needs
  `npx playwright install --with-deps`); keep it required but allow it to run after the unit job.
- **No production secrets in CI.** Tests run against mocks or a disposable test database, never the
  live Supabase project or real API keys.
- **Fail the build on any error or lint/type/audit finding.** Then enable branch protection on
  `main` so the workflow must pass before anything merges.

Reference skeleton (the agent should flesh this out to match the real scripts):
```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm audit --audit-level=high
      - run: npm test
      - run: npm run build
```

## Build order (commit after each phase)
> Apply the Security & hardening section in **every** phase — enable RLS and input validation the
> moment a table or endpoint is created, never afterwards.
1. Scaffold: Vite + React + TS (strict mode) + Tailwind, ESLint/Prettier, dark theme tokens,
   layout shell, routing, security headers/CSP, dependency scanning, and the GitHub Actions CI
   workflow (lint + typecheck + audit + tests + build) enabled from the start.
2. Supabase auth + wallet: profile, balance, transactions, stats page, `is_admin` flag,
   **default-deny RLS on every table**, server-side atomic balance mutations.
3. First game (Roulette) end-to-end (bet → result → transaction → stats), server-side CSPRNG.
4. Daily play-gated streak bonus (server-validated, no replay/multi-claim).
5. Blackjack + Slots + a quick game (Crash/Coin-flip).
6. Sportsbook with API-Football daily sync (Primeira Liga + World Cup) + bet slip; keys in Edge
   Functions, domain allowlist.
7. Live scores (live polling + Realtime push + idempotent auto-settlement).
8. Poker Stage A (vs bots).
9. Friends + presence + leaderboards.
10. Poker Stage B (private friend tables, server-authoritative dealer; no card leakage).
11. Challenges (recovery + high-roller).
12. Admin panel (role-gated server-side + full audit log).
13. Optional Gemini content layer (text-only, treated as untrusted; no actions).
14. Polish: animations, sounds, achievements, responsive pass.
15. **Testing, QA & security gate (see section above):** full functional + e2e tests, money-path
    coverage, active security testing (IDOR, double-spend, replay, injection, SSRF, prompt
    injection), `npm audit` / lint / typecheck clean, manual smoke test, and confirm no secret is
    in the client bundle. Fix everything found and re-run until green.
16. **Finalize:** ensure all work is committed with clean professional messages and pushed to the
    remote, the CI workflow is green, and branch protection requires it to pass before merging.

Build phase 1 first, commit it, then continue through the phases — committing as you go and
finishing with the testing & security gate before considering the app complete.
