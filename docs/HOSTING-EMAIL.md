# Hosting & branded auth emails

Two separate concerns that people often conflate:

- **Web host** — serves the built static frontend (`dist/`). Vercel or Cloudflare.
- **Auth email** — who *sends* the confirmation/reset emails. This is configured
  in **Supabase**, not the web host. Supabase's built-in mailer can only send
  from a Supabase address and is heavily rate-limited; to send from **your
  domain** you point Supabase at a transactional-email provider over SMTP.

So the host choice and the email sender are independent — you can host on Vercel
and still send branded email via your domain.

## Web host — recommendation: Vercel

Recommended because the repo is already set up for it ([`vercel.json`](../vercel.json)
defines the build, SPA rewrite, and all security headers — CSP/HSTS/etc.).

| | **Vercel** (recommended) | Cloudflare Pages |
| --- | --- | --- |
| Vite zero-config | ✅ | ✅ |
| `vercel.json` headers already written | ✅ | ✗ (would need `_headers`) |
| SPA rewrite | ✅ in `vercel.json` | needs `_redirects` |
| Free tier | ✅ | ✅ (more generous bandwidth) |

**Deploy on Vercel:**
1. Push to GitHub (done). On vercel.com → **Add New → Project** → import
   `Maiiaa30/Arentim`.
2. Framework preset **Vite** (build `npm run build`, output `dist`) — picked up
   from `vercel.json`.
3. **Environment variables** → add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (the publishable key). **Never** add the service key
   or any non-`VITE_` secret here.
4. Deploy. Add your custom domain under **Project → Domains** and point its DNS
   (Vercel gives the exact records).

> If you prefer Cloudflare Pages: build `npm run build`, output `dist`, add a
> `_redirects` file with `/* /index.html 200`, and a `_headers` file mirroring
> `vercel.json`. Same env vars. Vercel is the lower-effort path here.

## Branded confirmation emails — recommendation: Resend + custom SMTP

You own the domain; pair it with a transactional-email provider and set Supabase
to send through it. **Resend** is the simplest (generous free tier, clean DNS
setup); SendGrid/Mailgun/Postmark work the same way.

1. **Verify your domain** in the provider (Resend → Domains → add `arentim.xyz`
   or whatever you own). It gives you **DNS records** — add them at your domain
   registrar:
   - **SPF** (`TXT` on the root/subdomain),
   - **DKIM** (`TXT`/`CNAME` records),
   - optionally **DMARC**.
   Wait for "verified".
2. **Create an SMTP credential / API key** in the provider. Resend SMTP:
   - host `smtp.resend.com`, port `465` (SSL) or `587` (STARTTLS),
   - username `resend`, password = your Resend API key.
3. **Supabase → Project Settings → Authentication → SMTP Settings** → enable
   **Custom SMTP** and fill in:
   - Sender email: `no-reply@your-domain` · Sender name: `Arentim`
   - Host/port/username/password from step 2.
Once custom SMTP is on, confirmation emails come **from your domain** (e.g.
`no-reply@arentim.xyz`), are not rate-limited by Supabase, and no longer
originate from a Supabase address.

## A real branded email — not "click here to verify"

The default Supabase email is one bare line + a link. To send a proper Arentim
email instead, paste the ready-made branded templates (dark/gold, PT-PT,
email-client-safe table layout) into **Supabase → Authentication → Email
Templates**:

| Supabase template | Paste this file | Suggested **Subject** |
| --- | --- | --- |
| **Confirm signup** | [`email-templates/confirm-signup.html`](email-templates/confirm-signup.html) | `Confirma a tua conta Arentim` |
| **Reset Password** | [`email-templates/reset-password.html`](email-templates/reset-password.html) | `Repor a tua palavra-passe — Arentim` |
| **Magic Link** | [`email-templates/magic-link.html`](email-templates/magic-link.html) | `O teu link de acesso ao Arentim` |

Steps:
1. Open each template file, copy the **whole** contents, and paste it into the
   matching template's **Message body (HTML)** in Supabase. Set the **Subject**.
2. Leave the `{{ .ConfirmationURL }}` placeholders untouched — Supabase fills them
   in per-recipient (it already carries the right token + redirect).
3. **Make the links point to your domain:** Supabase → **Authentication → URL
   Configuration** → set **Site URL** to your custom domain (e.g.
   `https://arentim.xyz`) and add it under **Redirect URLs**. The confirm link in
   the email then lands back on your site, not the Supabase default.
4. Send yourself a test (sign up with a real address) and confirm it arrives
   **from your domain** with the branded layout.

The templates are plain HTML with inline styles only (no external CSS/JS/fonts),
so they render consistently in Gmail/Outlook/Apple Mail. Edit the copy/colours in
the files if you want — they're the source of truth, kept in the repo.

### Summary — the two independent switches
- **Who it's *from*** → Custom SMTP (Resend) with your verified domain (the
  section above). This is the "custom domain / custom email address" part.
- **What it *looks like*** → the branded HTML templates here. This is the "not
  just click-here" part.
You need both for a polished `no-reply@your-domain` email that looks like Arentim.

## While testing (before branded email is set up)

Email confirmation is currently **on**, sent by Supabase's built-in mailer
(rate-limited). For a smooth test run you can either:

- **Confirm users in the dashboard:** Supabase → **Authentication → Users** →
  pick the user → **Confirm**. (Easiest for creating a couple of test accounts,
  e.g. for multiplayer poker.)
- **Or temporarily turn confirmation off:** Supabase → **Authentication →
  Providers → Email** → toggle **Confirm email** off. Sign-ups then log in
  instantly. Turn it back on once branded SMTP is configured.
