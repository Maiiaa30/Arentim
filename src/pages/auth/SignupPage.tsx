import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { signupSchema } from '@/features/auth/schema';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthCard } from './AuthCard';

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  // Capture a referral code from the link (?ref=CODE) and stash it so it
  // survives the email-confirmation round-trip; it's claimed on first login.
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) localStorage.setItem('arentim:ref', ref.trim());
  }, [searchParams]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = signupSchema.safeParse({ email, displayName, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos');
      return;
    }

    setBusy(true);

    // Check the display name isn't already taken (case-insensitive).
    const { data: available, error: checkError } = await supabase.rpc('username_available', {
      p_name: parsed.data.displayName,
    });
    if (checkError) {
      setBusy(false);
      setError('Não foi possível validar o nome. Tente novamente.');
      return;
    }
    if (!available) {
      setBusy(false);
      setError('Esse nome de exibição já está em uso. Escolha outro.');
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { display_name: parsed.data.displayName } },
    });
    setBusy(false);

    if (signUpError) {
      // Supabase surfaces a duplicate email as a "registered" error.
      setError(
        /registered|already/i.test(signUpError.message)
          ? 'Este email já está registado.'
          : signUpError.message,
      );
      return;
    }

    // With confirmations on, an already-registered email returns a user with no
    // identities (Supabase obscures it) — treat that as "email in use".
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setError('Este email já está registado.');
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
      <AuthCard title="Verifique o seu email" subtitle="Falta um passo para começar a jogar.">
        <p className="text-sm text-muted">
          Enviámos uma ligação de confirmação para <span className="text-text">{email}</span>.
          Confirme-a e depois entre.
        </p>
        <Link to="/login" className="mt-6 inline-block font-medium text-gold hover:underline">
          Ir para a entrada
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Criar a sua conta" subtitle="Comece com 5 000 Tostões oferecidos.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input
          id="displayName"
          label="Nome de exibição"
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
          label="Palavra-passe"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <p className="text-xs text-muted">
          Pelo menos 10 caracteres com letras maiúsculas, minúsculas e um número.
        </p>
        {error && <p className="text-sm text-negative">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? 'A criar…' : 'Criar conta'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Já tem conta?{' '}
        <Link to="/login" className="font-medium text-gold hover:underline">
          Entrar
        </Link>
      </p>
    </AuthCard>
  );
}
