import { useState } from 'react';
import { useProfile } from '@/features/profile/useProfile';
import { useChallenges, useChallengeActions } from '@/features/challenges/useChallenges';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount } from '@/lib/format';
import { Eyebrow, SectionHeader } from '@/components/ui/primitives';
import type { ChallengeRow } from '@/types/db';

const RESCUE_THRESHOLD = 100;

function ChallengeCard({ c, onClaim, busy }: { c: ChallengeRow; onClaim: () => void; busy: boolean }) {
  const pct = Math.min(100, Math.round((c.progress / c.target) * 100));
  const complete = c.progress >= c.target;
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-sans font-medium text-text">{c.title}</p>
          <p className="font-sans text-xs text-muted-2">{c.description}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 font-mono text-sm font-semibold text-gold">
          <CoinIcon className="h-3.5 w-3.5" /> {formatAmount(c.reward)}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full ${complete ? 'bg-positive' : 'bg-gold'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-xs tabular-nums text-muted-2">
          {formatAmount(c.progress)} / {formatAmount(c.target)}
        </span>
        {c.claimed ? (
          <span className="font-sans text-xs font-medium text-positive">✓ Resgatado</span>
        ) : (
          <Button
            variant={complete ? 'primary' : 'secondary'}
            onClick={onClaim}
            disabled={!complete || busy}
            className="!px-4 !py-2 text-xs"
          >
            {complete ? 'Resgatar' : 'Bloqueado'}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ChallengesPage() {
  const { data: profile } = useProfile();
  const { data: challenges } = useChallenges();
  const { claim, rescue } = useChallengeActions();
  const [msg, setMsg] = useState<string | null>(null);

  const balance = profile?.balance ?? 0;
  const lowBalance = balance < RESCUE_THRESHOLD;
  const recovery = (challenges ?? []).filter((c) => c.track === 'recovery');
  const highroller = (challenges ?? []).filter((c) => c.track === 'highroller');
  const badges = (challenges ?? []).filter((c) => c.claimed);

  async function onClaim(key: string) {
    setMsg(null);
    const res = await claim.mutateAsync(key);
    if (res.status === 'claimed') setMsg(`Resgatado +${formatAmount(res.reward ?? 0)} Tostões!`);
    else if (res.status === 'incomplete') setMsg('Ainda não está lá.');
  }
  async function onRescue() {
    setMsg(null);
    const res = await rescue.mutateAsync();
    if (res.status === 'granted') setMsg(`Ajuda concedida +${formatAmount(res.amount ?? 0)} Tostões.`);
    else if (res.status === 'already_claimed') setMsg('Já resgatou a sua ajuda hoje.');
    else setMsg('A ajuda só está disponível quando o seu saldo está baixo.');
  }

  const tracksInOrder = lowBalance
    ? [{ title: 'Recuperação', items: recovery }, { title: 'Alto rolo', items: highroller }]
    : [{ title: 'Alto rolo', items: highroller }, { title: 'Recuperação', items: recovery }];

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <Eyebrow>Progresso</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text">Desafios</h1>
        <p className="mt-1 font-sans text-sm text-muted-2">
          Complete marcos para ganhar Tostões e distinções.
        </p>
      </div>

      {/* Rescue loop */}
      {lowBalance && (
        <section className="card border-gold/40 p-6">
          <h2 className="font-display text-xl font-medium text-text">No fundo do poço?</h2>
          <p className="mt-1 font-sans text-sm text-muted-2">
            Sem Tostões — aqui tem uma ajuda diária gratuita para voltar ao jogo.
          </p>
          <Button variant="primary" onClick={onRescue} disabled={rescue.isPending} className="mt-4">
            {rescue.isPending ? 'A resgatar…' : 'Resgatar ajuda gratuita'}
          </Button>
        </section>
      )}

      {msg && <p className="font-sans text-sm text-positive">{msg}</p>}

      {tracksInOrder.map((track) => (
        <section key={track.title} className="space-y-4">
          <SectionHeader title={track.title} />
          <div className="grid gap-3 sm:grid-cols-2">
            {track.items.map((c) => (
              <ChallengeCard key={c.key} c={c} busy={claim.isPending} onClaim={() => onClaim(c.key)} />
            ))}
          </div>
        </section>
      ))}

      {/* Badges */}
      {badges.length > 0 && (
        <section className="space-y-4">
          <SectionHeader title="Distinções" />
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <span key={b.key} className="rounded border border-gold/40 bg-gold/10 px-3 py-1 font-sans text-xs font-medium text-gold">
                🏅 {b.title}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
