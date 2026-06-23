import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthCard } from './AuthCard';

/**
 * Landing page for the password-reset email link. The branded email links here
 * with a token_hash (?token_hash=…&type=recovery), which we verify to establish
 * the recovery session; the older implicit-hash link still works via
 * detectSessionInUrl. Then updateUser({ password }) sets the new password.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  // 'verifying' only while we exchange a token_hash link; the implicit-hash link
  // skips straight to the form.
  const [phase, setPhase] = useState<'verifying' | 'form' | 'linkError'>(
    () => (new URLSearchParams(window.location.search).get('token_hash') ? 'verifying' : 'form'),
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    if (!tokenHash || !type) return; // implicit-hash link: detectSessionInUrl handles it
    supabase.auth
      .verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash })
      .then(({ error: err }) => setPhase(err ? 'linkError' : 'form'))
      .catch(() => setPhase('linkError'));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) {
      setError('A palavra-passe precisa de pelo menos 8 caracteres.');
      return;
    }
    if (pw !== pw2) {
      setError('As palavras-passe não coincidem.');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) {
      setError('O link expirou ou é inválido. Pede um novo a partir do início de sessão.');
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/', { replace: true }), 1400);
  }

  if (done) {
    return (
      <AuthCard title="Palavra-passe alterada" subtitle="Já podes jogar.">
        <p className="text-sm text-positive">Tudo certo — a entrar…</p>
      </AuthCard>
    );
  }

  if (phase === 'verifying') {
    return (
      <AuthCard title="A validar o link…" subtitle="Um instante.">
        <p className="text-sm text-muted">A confirmar a tua ligação de reposição.</p>
      </AuthCard>
    );
  }

  if (phase === 'linkError') {
    return (
      <AuthCard title="Ligação inválida" subtitle="O link expirou ou já foi usado.">
        <p className="text-sm text-negative">Pede uma nova ligação a partir do início de sessão.</p>
        <p className="mt-6 text-center text-sm text-muted">
          <Link to="/login" className="font-medium text-gold hover:underline">← Voltar ao início de sessão</Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Nova palavra-passe" subtitle="Escolhe uma palavra-passe para a tua conta.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input
          id="password"
          type="password"
          label="Nova palavra-passe"
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
        />
        <Input
          id="password2"
          type="password"
          label="Confirmar"
          autoComplete="new-password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          required
        />
        {error && <p className="text-sm text-negative">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? 'A guardar…' : 'Guardar palavra-passe'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        <Link to="/login" className="font-medium text-gold hover:underline">← Voltar ao início de sessão</Link>
      </p>
    </AuthCard>
  );
}
