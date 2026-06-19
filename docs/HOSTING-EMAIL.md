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
4. (Optional) **Auth → Email Templates** — translate the confirmation/reset/magic
   templates to **Português de Portugal** and brand them.

Once custom SMTP is on, confirmation emails come **from your domain**, are not
rate-limited by Supabase, and no longer originate from Supabase.

## While testing (before branded email is set up)

Email confirmation is currently **on**, sent by Supabase's built-in mailer
(rate-limited). For a smooth test run you can either:

- **Confirm users in the dashboard:** Supabase → **Authentication → Users** →
  pick the user → **Confirm**. (Easiest for creating a couple of test accounts,
  e.g. for multiplayer poker.)
- **Or temporarily turn confirmation off:** Supabase → **Authentication →
  Providers → Email** → toggle **Confirm email** off. Sign-ups then log in
  instantly. Turn it back on once branded SMTP is configured.
