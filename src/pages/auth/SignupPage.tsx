import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { signupSchema } from '@/features/auth/schema';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthCard } from './AuthCard';

export function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = signupSchema.safeParse({ email, displayName, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setBusy(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { display_name: parsed.data.displayName } },
    });
    setBusy(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // If email confirmation is required, there is no active session yet.
    if (!data.session) {
      setNeedsConfirm(true);
      return;
    }
    navigate('/', { replace: true });
  }

  if (needsConfirm) {
    return (
      <AuthCard title="Check your email" subtitle="One more step to start playing.">
        <p className="text-sm text-muted">
          We sent a confirmation link to <span className="text-text">{email}</span>. Confirm it,
          then sign in.
        </p>
        <Link to="/login" className="mt-6 inline-block font-medium text-gold hover:underline">
          Go to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" subtitle="Start with 5.000 Tostões on the house.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input
          id="displayName"
          label="Display name"
          autoComplete="nickname"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <p className="text-xs text-muted">
          At least 10 characters with upper- and lowercase letters and a number.
        </p>
        {error && <p className="text-sm text-negative">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-gold hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
