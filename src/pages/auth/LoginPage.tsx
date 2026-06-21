import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { loginSchema } from '@/features/auth/schema';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthCard } from './AuthCard';

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from?.pathname ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  async function onReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResetMsg(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Indica um email válido.');
      return;
    }
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/redefinir-palavra-passe`,
    });
    setBusy(false);
    // Never reveal whether the email exists — always show the same message.
    setResetMsg('Se essa conta existir, enviámos um link para repor a palavra-passe.');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);

    if (signInError) {
      // Generic message — never reveal whether the email exists (A07).
      setError('Email ou palavra-passe incorretos.');
      return;
    }
    navigate(from, { replace: true });
  }

  if (mode === 'reset') {
    return (
      <AuthCard title="Repor palavra-passe" subtitle="Enviamos-te um link por email.">
        <form onSubmit={onReset} className="space-y-4" noValidate>
          <Input
            id="email"
            type="email"
            label="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && <p className="text-sm text-negative">{error}</p>}
          {resetMsg && <p className="text-sm text-positive">{resetMsg}</p>}
          <Button type="submit" variant="primary" className="w-full" disabled={busy}>
            {busy ? 'A enviar…' : 'Enviar link'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          <button onClick={() => { setMode('login'); setError(null); setResetMsg(null); }} className="font-medium text-gold hover:underline">
            ← Voltar ao início de sessão
          </button>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Bem-vindo de volta" subtitle="Entre na sua conta Arentim.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input
          id="email"
          type="email"
          label="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          id="password"
          type="password"
          label="Palavra-passe"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-negative">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? 'A entrar…' : 'Entrar'}
        </Button>
      </form>
      <div className="mt-4 text-center">
        <button onClick={() => { setMode('reset'); setError(null); }} className="font-sans text-sm text-muted-2 hover:text-text">
          Esqueceste-te da palavra-passe?
        </button>
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        Novo por aqui?{' '}
        <Link to="/signup" className="font-medium text-gold hover:underline">
          Criar conta
        </Link>
      </p>
    </AuthCard>
  );
}
