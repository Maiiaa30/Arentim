import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthCard } from './AuthCard';

/**
 * Landing page for the email-confirmation link (emailRedirectTo points here).
 * Supabase verifies the token on its side and redirects here with either the
 * session in the URL (handled by detectSessionInUrl) or an error in the hash
 * (e.g. an expired or already-used link). This page turns that into clear
 * feedback instead of a silent landing on the home page, and lets the user
 * request a fresh confirmation email if the link is dead.
 */
function readError(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const code = hash.get('error_code') ?? query.get('error_code') ?? hash.get('error') ?? query.get('error');
  const desc = hash.get('error_description') ?? query.get('error_description');
  if (!code && !desc) return null;
  const d = (desc ?? '').toLowerCase();
  if (d.includes('expired') || code === 'otp_expired') {
    return 'Esta ligação expirou ou já foi usada. Pede uma nova abaixo.';
  }
  return desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : 'A ligação de confirmação não é válida.';
}

const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'working' | 'ok' | 'error'>('working');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [resent, setResent] = useState(false);

  useEffect(() => {
    const e = readError();
    if (e) { setErrMsg(e); setStatus('error'); return; }

    let done = false;
    const finish = (ok: boolean, msg?: string) => {
      if (done) return;
      done = true;
      if (ok) {
        setStatus('ok');
        setTimeout(() => navigate('/', { replace: true }), 1000);
      } else {
        setStatus('error');
        setErrMsg(msg ?? 'Não conseguimos confirmar automaticamente. Tenta entrar — se a conta já estiver confirmada, funciona.');
      }
    };

    // Branded-link flow: the email template links to OUR domain with a
    // token_hash (so the user never sees the supabase.co URL); verify it here.
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    if (tokenHash && type) {
      supabase.auth
        .verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash })
        .then(({ error }) => finish(!error, error ? 'Esta ligação expirou ou já foi usada. Pede uma nova abaixo.' : undefined))
        .catch(() => finish(false));
      return;
    }

    // Default flow: detectSessionInUrl establishes the session from the URL hash.
    supabase.auth.getSession().then(({ data }) => { if (data.session) finish(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => { if (session) finish(true); });
    const timer = setTimeout(() => finish(false), 5000);
    return () => { clearTimeout(timer); sub.subscription.unsubscribe(); };
  }, [navigate]);

  async function resend(ev: FormEvent) {
    ev.preventDefault();
    if (!validEmail(email)) { setErrMsg('Indica um email válido.'); return; }
    await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setResent(true); // neutral message regardless, so we never reveal if the email exists
  }

  if (status === 'working') {
    return (
      <AuthCard title="A confirmar…" subtitle="Um instante.">
        <p className="text-sm text-muted">A validar a tua ligação de confirmação.</p>
      </AuthCard>
    );
  }

  if (status === 'ok') {
    return (
      <AuthCard title="Email confirmado ✓" subtitle="A entrar…">
        <p className="text-sm text-positive">Conta confirmada! A redirecionar…</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Ligação inválida" subtitle="Vamos resolver isto.">
      {errMsg && <p className="text-sm text-negative">{errMsg}</p>}
      {resent ? (
        <p className="mt-4 text-sm text-positive">Se a conta existir e ainda não estiver confirmada, enviámos um novo email.</p>
      ) : (
        <form onSubmit={resend} className="mt-4 space-y-3" noValidate>
          <Input id="email" type="email" label="O teu email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" variant="primary" className="w-full">Reenviar email de confirmação</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted">
        <Link to="/login" className="font-medium text-gold hover:underline">Ir para a entrada</Link>
      </p>
    </AuthCard>
  );
}
