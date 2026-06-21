import { useState, type FormEvent } from 'react';
import { useReferral } from '@/features/referrals/useReferral';
import { supabase } from '@/lib/supabase';
import { UiIcon } from '@/components/icons/UiIcon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Eyebrow } from '@/components/ui/primitives';

const REFERRER_REWARD = 250;
const FRIEND_REWARD = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "Convidar amigos" — share a personal referral link + invite by email. */
export function ConvidarCard() {
  const { data: referral } = useReferral();
  const code = referral?.code ?? null;
  const link = code ? `${window.location.origin}/signup?ref=${code}` : '';

  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);
  const [sendErr, setSendErr] = useState<string | null>(null);

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function shareLink() {
    if (!link) return;
    const text = 'Junta-te a mim no Arentim e ganha 100 tós!';
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Arentim', text, url: link });
      } catch {
        // user cancelled — ignore
      }
      return;
    }
    window.location.href = `mailto:?subject=${encodeURIComponent('Convite Arentim')}&body=${encodeURIComponent(`${text}\n\n${link}`)}`;
  }

  async function sendInvite(e: FormEvent) {
    e.preventDefault();
    setSendMsg(null);
    setSendErr(null);
    const to = email.trim();
    if (!EMAIL_RE.test(to)) {
      setSendErr('Introduz um email válido.');
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-invite', { body: { email: to } });
      if (error) throw error;
      setSendMsg(`Convite enviado para ${to}.`);
      setEmail('');
    } catch {
      setSendErr('Não foi possível enviar o convite. Tenta novamente.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card space-y-5 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-gold">
          <UiIcon name="userPlus" className="h-5 w-5" />
        </span>
        <div>
          <Eyebrow>Convidar amigos</Eyebrow>
          <p className="mt-1.5 font-sans text-sm text-muted">
            Tu ganhas <span className="font-semibold text-gold">{REFERRER_REWARD} tós</span>, o teu amigo
            ganha <span className="font-semibold text-gold">{FRIEND_REWARD} tós</span> quando ele se inscrever.
          </p>
        </div>
      </div>

      {/* Referral link */}
      <div className="space-y-2">
        <p className="font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">O teu link</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-text">
            {link || '…'}
          </code>
          <Button variant="primary" className="!px-4 !py-2" onClick={copyLink} disabled={!link}>
            {copied ? 'Copiado!' : 'Copiar'}
          </Button>
          <Button variant="ghost" className="!px-4 !py-2" onClick={shareLink} disabled={!link}>
            Partilhar
          </Button>
        </div>
        {referral && (
          <p className="font-sans text-xs text-muted-2">
            Já convidaste {referral.referred_count} {referral.referred_count === 1 ? 'amigo' : 'amigos'}.
          </p>
        )}
      </div>

      {/* Invite by email */}
      <form onSubmit={sendInvite} className="space-y-2 border-t border-border pt-4">
        <p className="font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">Enviar por email</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <Input
              id="invite-email"
              type="email"
              label="Email do amigo"
              placeholder="amigo@exemplo.pt"
              value={email}
              onChange={(ev) => { setEmail(ev.target.value); setSendErr(null); setSendMsg(null); }}
            />
          </div>
          <Button type="submit" variant="primary" className="!px-4 !py-2" disabled={sending}>
            {sending ? 'A enviar…' : 'Enviar'}
          </Button>
        </div>
        {sendMsg && <p className="font-sans text-xs text-positive">{sendMsg}</p>}
        {sendErr && <p className="font-sans text-xs text-negative">{sendErr}</p>}
      </form>
    </div>
  );
}
