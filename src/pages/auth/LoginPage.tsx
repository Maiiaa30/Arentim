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
      setError('Incorrect email or password.');
      return;
    }
    navigate(from, { replace: true });
  }

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your Arentim account.">
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
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-negative">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{' '}
        <Link to="/signup" className="font-medium text-gold hover:underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
