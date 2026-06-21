import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SectionHeader } from '@/components/ui/primitives';

/**
 * Self-service account security: change the account email and password from
 * inside the app. Email changes go through Supabase's confirm-email flow (a
 * verification link is sent to the new address); password changes apply
 * immediately to the signed-in session.
 */
export function AccountSecurity() {
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  async function changeEmail(e: FormEvent) {
    e.preventDefault();
    setEmailMsg(null);
    const next = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      setEmailMsg({ ok: false, text: 'Indica um email válido.' });
      return;
    }
    if (next === user?.email?.toLowerCase()) {
      setEmailMsg({ ok: false, text: 'Esse já é o teu email atual.' });
      return;
    }
    setEmailBusy(true);
    const { error } = await supabase.auth.updateUser({ email: next });
    setEmailBusy(false);
    if (error) {
      setEmailMsg({ ok: false, text: 'Não foi possível alterar o email. Tenta novamente.' });
      return;
    }
    setEmail('');
    setEmailMsg({ ok: true, text: `Enviámos um link de confirmação para ${next}. Abre-o para concluir a alteração.` });
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (pw.length < 8) {
      setPwMsg({ ok: false, text: 'A palavra-passe precisa de pelo menos 8 caracteres.' });
      return;
    }
    if (pw !== pw2) {
      setPwMsg({ ok: false, text: 'As palavras-passe não coincidem.' });
      return;
    }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) {
      setPwMsg({ ok: false, text: 'Não foi possível alterar a palavra-passe. Volta a entrar e tenta de novo.' });
      return;
    }
    setPw('');
    setPw2('');
    setPwMsg({ ok: true, text: 'Palavra-passe alterada.' });
  }

  const note = (m: { ok: boolean; text: string } | null) =>
    m && <p className={`font-sans text-sm ${m.ok ? 'text-positive' : 'text-negative'}`}>{m.text}</p>;

  return (
    <div className="space-y-3">
      <SectionHeader title="Conta e segurança" />
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Change email */}
        <form onSubmit={changeEmail} className="card space-y-3 p-5" noValidate>
          <div>
            <p className="font-display text-base font-medium text-text">Email</p>
            <p className="font-sans text-xs text-muted-2">
              Atual: <span className="text-muted">{user?.email ?? '—'}</span>
            </p>
          </div>
          <Input
            id="newEmail"
            type="email"
            label="Novo email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={emailBusy || email.trim().length === 0}>
            {emailBusy ? 'A enviar…' : 'Alterar email'}
          </Button>
          {note(emailMsg)}
        </form>

        {/* Change password */}
        <form onSubmit={changePassword} className="card space-y-3 p-5" noValidate>
          <p className="font-display text-base font-medium text-text">Palavra-passe</p>
          <Input
            id="newPassword"
            type="password"
            label="Nova palavra-passe"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <Input
            id="newPassword2"
            type="password"
            label="Confirmar"
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={pwBusy || pw.length === 0}>
            {pwBusy ? 'A guardar…' : 'Alterar palavra-passe'}
          </Button>
          {note(pwMsg)}
        </form>
      </div>
    </div>
  );
}
