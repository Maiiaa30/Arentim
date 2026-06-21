# Going live — Cloudflare + Vercel + Supabase + Resend

End-to-end production setup for the exact stack you're using:

- **Cloudflare** — your domain's DNS (registrar/nameservers).
- **Vercel** — hosts the built frontend.
- **Supabase** — backend (DB, auth, edge functions) + sends auth emails.
- **Resend** — the transactional email provider that lets Supabase send from
  **your** domain with the branded templates in [`email-templates/`](email-templates/).

Replace `arentim.xyz` / `yourdomain.com` with your real domain throughout. None of
this needs a code change — it's all dashboard + DNS.

> **Security:** every secret below lives only in a provider's dashboard. Never put
> the Resend API key, Supabase service key, or SMTP password in the repo, in
> `VITE_*` env vars, or in chat. If one ever leaks, rotate it.

---

## 0. Order of operations (10-minute version)

1. **Vercel** — import the repo, add the two `VITE_` env vars, deploy.
2. **Cloudflare** — point your domain at Vercel (2 DNS records).
3. **Vercel** — add the custom domain.
4. **Resend** — add + verify your domain (3–4 DNS records in Cloudflare).
5. **Supabase** — Custom SMTP (Resend), paste the branded email templates, set
   the Site URL to your domain.
6. Test a real sign-up end to end.

---

## 1. Deploy the frontend on Vercel

1. vercel.com → **Add New → Project** → import `Maiiaa30/Arentim`.
2. Framework preset **Vite** (build `npm run build`, output `dist`) — already
   defined in [`../vercel.json`](../vercel.json), which also carries the CSP/HSTS
   security headers and the SPA rewrite.
3. **Settings → Environment Variables** (Production + Preview):
   - `VITE_SUPABASE_URL` = `https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = your **publishable** key (`sb_publishable_…`)
   - **Never** add the service key or any non-`VITE_` secret here — those ship to
     the browser.
4. **Deploy.** You'll get a `*.vercel.app` URL — confirm the app loads there
   before wiring the domain.

---

## 2. Point the domain at Vercel (Cloudflare DNS)

Keep Cloudflare as your DNS. In **Vercel → Project → Settings → Domains**, add
`yourdomain.com` (and `www.yourdomain.com`). Vercel shows the exact records to
create — typically:

| Type | Name | Value | Cloudflare proxy |
| --- | --- | --- | --- |
| `A` | `@` (apex) | the IP Vercel shows (e.g. `76.76.21.21`) | **DNS only (grey cloud)** |
| `CNAME` | `www` | `cname.vercel-dns.com` | **DNS only (grey cloud)** |

In **Cloudflare → DNS → Records**, add exactly what Vercel shows. **Critical
Cloudflare gotchas:**

- Set those two records to **DNS only** (click the orange cloud so it turns
  **grey**). Proxying Vercel through Cloudflare's orange cloud often causes
  redirect loops unless SSL is configured perfectly.
- If you *do* want the orange cloud (Cloudflare CDN in front), then go to
  **Cloudflare → SSL/TLS → Overview** and set the mode to **Full** or **Full
  (strict)** — never **Flexible** (Flexible + Vercel = infinite redirect).
- Recommended for simplicity: **grey cloud (DNS only)**. Vercel issues + renews
  the TLS cert itself.

Back in Vercel, the domain flips to **Valid Configuration** once DNS propagates
(usually minutes). Set `yourdomain.com` as the **Primary** domain.

---

## 3. Verify your domain in Resend (so email can come *from* it)

1. resend.com → **Domains → Add Domain** → `yourdomain.com`. Pick the region
   closest to you (e.g. `eu-west-1`); it affects the record values.
2. Resend shows a set of DNS records — **copy them exactly**. They look like
   (values will differ — use Resend's, not these):

   | Type | Name (host) | Value | Purpose |
   | --- | --- | --- | --- |
   | `MX` | `send` | `feedback-smtp.<region>.amazonses.com` (priority `10`) | bounce handling |
   | `TXT` | `send` | `v=spf1 include:amazonses.com ~all` | SPF |
   | `TXT` | `resend._domainkey` | `p=MIGfMA0GCSq…` (long key) | DKIM |
   | `TXT` | `_dmarc` | `v=DMARC1; p=none;` | DMARC (recommended) |

3. In **Cloudflare → DNS → Records**, add each one:
   - Cloudflare auto-appends your domain — enter the **Name** as just `send`,
     `resend._domainkey`, `_dmarc` (not the full `send.yourdomain.com`).
   - `MX`/`TXT` records are **never proxied** (no cloud toggle to worry about). If
     Resend gives any `CNAME`, set it to **DNS only (grey cloud)**.
   - If you use **Cloudflare Email Routing**, it owns the apex `MX`. Resend's `MX`
     is on the `send` subdomain, so they don't clash — but don't delete your
     existing apex MX if you receive mail there.
4. Back in Resend, click **Verify**. It can take a few minutes; all rows should go
   green. (Until verified, Supabase SMTP sends will fail.)
5. Resend → **API Keys → Create** (scope: *Sending access*). Copy the `re_…` key
   **once** — you'll paste it into Supabase next and never again.

---

## 4. Supabase — send branded email from your domain

### 4a. Custom SMTP (the "from your domain" switch)
Supabase → **Project Settings → Authentication → SMTP Settings** → enable
**Custom SMTP**:

- **Sender email:** `no-reply@yourdomain.com` (must be on the verified domain)
- **Sender name:** `Arentim`
- **Host:** `smtp.resend.com`
- **Port:** `465` (SSL) — or `587` (STARTTLS) if 465 is blocked
- **Username:** `resend`
- **Password:** your Resend `re_…` API key

Save. (Custom SMTP also removes Supabase's built-in rate limit.)

### 4b. Branded templates (the "not just click-here" switch)
Supabase → **Authentication → Email Templates**. For each, paste the matching
file from this repo into **Message body (HTML)** and set the subject:

| Template | File | Subject |
| --- | --- | --- |
| Confirm signup | [`email-templates/confirm-signup.html`](email-templates/confirm-signup.html) | `Confirma a tua conta Arentim` |
| Reset Password | [`email-templates/reset-password.html`](email-templates/reset-password.html) | `Repor a tua palavra-passe — Arentim` |
| Magic Link | [`email-templates/magic-link.html`](email-templates/magic-link.html) | `O teu link de acesso ao Arentim` |

Leave the `{{ .ConfirmationURL }}` placeholders as-is.

### 4c. Make the links land on your domain
Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://yourdomain.com`
- **Redirect URLs:** add `https://yourdomain.com/**` (and, if you want preview
  deploys to work, `https://*.vercel.app/**`).

This makes the confirm/reset links in the email return to *your* site.

---

## 5. Apply migrations + (re)deploy edge functions

From your machine, with `supabase/.env` filled in:

```bash
npm run db:migrate                                   # applies all pending SQL
npm run deploy:functions poker-bots poker-table      # the poker cash-out fix
```

(The new games / fixes are inert until `db:migrate` runs — this is also what
makes Plinko pay.)

---

## 6. Test it end to end

1. Open `https://yourdomain.com`, **Criar conta** with a real address you control.
2. You should get the **branded Arentim email**, **from `no-reply@yourdomain.com`**.
   - Not arriving? Check **Resend → Logs** (shows accepted/bounced) and that the
     domain is **verified**.
   - Arriving from a Supabase address? Custom SMTP isn't enabled/saved (step 4a).
   - Link 404s or goes to localhost? Fix **Site URL** (step 4c).
3. Confirm → you land back on your site, logged in, with 500 Tostões.

---

## Before a public launch

- Rotate any secret that was ever shared in plain text (anon key is fine to be
  public; the **SYNC_SECRET** and any service key are not).
- `npm run db:reset -- --yes` wipes test players/gameplay but keeps config
  (catalogs, slot machines, fixtures) — run it once before opening to friends.
- Grant yourself admin (see [`../README.md`](../README.md)).
