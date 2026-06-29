// Supabase Edge Function: send-invite
//
// Sends a branded "join Arentim" email on behalf of the signed-in user. The
// caller is authenticated (bearer token → getUser); we look up their referral
// code + display name with the service role, build the referral signup link,
// inline the invite template, and hand it to Resend. The recipient address is
// untrusted DATA — only validated and placed in the `to` field, never executed.
//
// Required secrets: RESEND_API_KEY, MAIL_DOMAIN (e.g. arentim.app). Optional:
// SITE_URL (origin for the signup link; falls back to https://${MAIL_DOMAIN}).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const MAIL_DOMAIN = Deno.env.get('MAIL_DOMAIN') ?? '';
const SITE_URL = Deno.env.get('SITE_URL') ?? (MAIL_DOMAIN ? `https://${MAIL_DOMAIN}` : '');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders },
  });

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );

// Branded invite email (mirrors docs/email-templates/invite.html). Inlined so
// the function never reads a file at runtime. {{REF_LINK}} / {{SENDER}} get
// substituted below.
const TEMPLATE = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0907;margin:0;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
      <tr><td style="height:3px;background:linear-gradient(90deg,#0a0907,#C9A24B,#0a0907);font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td align="center" style="padding:28px 0 8px;">
        <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;letter-spacing:8px;color:#C9A24B;">ARENTIM</span>
        <div style="font-size:10px;letter-spacing:3px;color:#9d927a;text-transform:uppercase;margin-top:4px;">Casa de Jogos</div>
      </td></tr>
      <tr><td style="padding:8px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#100e09;border:1px solid rgba(201,162,75,0.22);border-radius:8px;">
          <tr><td style="padding:34px 34px 28px;">
            <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:normal;color:#f3edde;">{{SENDER}} convidou-te</h1>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#b7ad95;">
              Junta-te ao Arentim — uma casa de jogos só a brincar. Inscreve-te pelo link abaixo e recebes logo
              <strong style="color:#f3edde;">100 Tostões</strong> para começar a jogar.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;">
              <tr><td align="center" style="border-radius:6px;background:#C9A24B;">
                <a href="{{REF_LINK}}" target="_blank" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:bold;color:#0a0907;text-decoration:none;letter-spacing:0.5px;">Aceitar convite</a>
              </td></tr>
            </table>
            <p style="margin:0 0 6px;font-size:12px;color:#9d927a;">Se o botão não funcionar, copia este link para o navegador:</p>
            <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;"><a href="{{REF_LINK}}" style="color:#C9A24B;">{{REF_LINK}}</a></p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:18px 12px 0;">
        <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#6b6149;">É tudo a brincar — o Arentim usa <strong style="color:#9d927a;">Tostões</strong>, uma moeda de mentira. Sem dinheiro real, sem pagamentos.</p>
        <p style="margin:0;font-size:12px;line-height:1.5;color:#6b6149;">Não conheces {{SENDER}}? Ignora este email — não acontece nada.</p>
      </td></tr>
    </table>
  </td></tr>
</table>`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  if (!RESEND_API_KEY || !MAIL_DOMAIN) {
    return json({ error: 'email not configured' }, 500);
  }

  // Authenticate the caller.
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth } = await userClient.auth.getUser();
  const user = auth?.user;
  if (!user) return json({ error: 'unauthorized' }, 401);

  // Parse + validate the recipient.
  let body: { email?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'bad request' }, 400); }
  const to = typeof body.email === 'string' ? body.email.trim() : '';
  if (!EMAIL_RE.test(to) || to.length > 254) {
    return json({ error: 'invalid email' }, 400);
  }

  // Look up the sender's referral code + name with the service role.
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // Anti-spam: cap invites per sender (10/hour). Fail-open if the limiter isn't
  // available yet, fail-closed once over the cap.
  const { data: allowed } = await db.rpc('rate_limit_hit', {
    p_user: user.id, p_action: 'invite', p_max: 10, p_window_secs: 3600,
  });
  if (allowed === false) return json({ error: 'demasiados convites — tenta mais tarde' }, 429);

  const { data: profile, error: pErr } = await db
    .from('profiles')
    .select('referral_code, display_name')
    .eq('id', user.id)
    .single();
  if (pErr || !profile?.referral_code) {
    return json({ error: 'no referral code' }, 500);
  }

  const origin = SITE_URL.replace(/\/+$/, '');
  const refLink = `${origin}/signup?ref=${encodeURIComponent(profile.referral_code)}`;
  const sender = escapeHtml(profile.display_name || 'Um amigo');
  const html = TEMPLATE
    .replaceAll('{{REF_LINK}}', refLink)
    .replaceAll('{{SENDER}}', sender);

  // Hand off to Resend.
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: `Arentim <no-reply@${MAIL_DOMAIN}>`,
      to: [to],
      subject: `${profile.display_name || 'Um amigo'} convidou-te para o Arentim`,
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return json({ error: 'send failed', detail: detail.slice(0, 200) }, 502);
  }

  return json({ ok: true });
});
