import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthCard } from './AuthCard';

/**
 * Landing page for the password-reset email link. Supabase establishes a
 * recovery session from the link (detectSessionInUrl), so updateUser({ password })
 * works here. On success the user is signed in and sent home.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

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
