import { useState } from 'react';
import { useProfile } from '@/features/profile/useProfile';
import { useChallenges, useChallengeActions } from '@/features/challenges/useChallenges';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount, formatTostoes } from '@/lib/format';
import { Eyebrow, SectionHeader } from '@/components/ui/primitives';
import type { ChallengeRow } from '@/types/db';

const RESCUE_THRESHOLD = 100;

function ChallengeCard({ c, onClaim, busy }: { c: ChallengeRow; onClaim: () => void; busy: boolean }) {
  const pct = Math.min(100, Math.round((c.progress / c.target) * 100));
  const complete = c.progress >= c.target;
  return (
    <div className="card flex flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-sans font-medium text-text">{c.title}</p>
          <p className="mt-0.5 font-sans text-xs text-muted-2">{c.description}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 font-mono text-sm font-semibold text-gold">
          <CoinIcon className="h-3.5 w-3.5" /> {formatAmount(c.reward)}
        </span>
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Progresso de "${c.title}"`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${complete ? 'bg-positive' : 'bg-gold'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="font-mono text-xs tabular-nums text-muted-2">
          {formatAmount(c.progress)} / {formatAmount(c.target)}
        </span>
        {c.claimed ? (
          <span className="flex shrink-0 items-center gap-1 font-sans text-xs font-medium text-positive">
            ✓ Resgatado
          </span>
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
    if (res.status === 'claimed') setMsg(`Resgatou +${formatTostoes(res.reward ?? 0)}!`);
    else if (res.status === 'incomplete') setMsg('Ainda não está lá. Continue a jogar.');
  }
  async function onRescue() {
    setMsg(null);
    const res = await rescue.mutateAsync();
    if (res.status === 'granted') setMsg(`Ajuda concedida: +${formatTostoes(res.amount ?? 0)}.`);
    else if (res.status === 'already_claimed') setMsg('Já resgatou a sua ajuda de hoje. Volte amanhã.');
    else setMsg('A ajuda só está disponível quando o seu saldo está em baixo.');
  }

  const tracksInOrder = lowBalance
    ? [
        { title: 'Recuperação', items: recovery },
        { title: 'Alto rolo', items: highroller },
      ]
    : [
        { title: 'Alto rolo', items: highroller },
        { title: 'Recuperação', items: recovery },
      ];

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <Eyebrow>Progresso</Eyebrow>
        <h1 className="mt-2 font-display text-[28px] font-medium leading-tight text-text sm:text-[34px]">
          Desafios
        </h1>
        <p className="mt-1 font-sans text-sm text-muted-2">
          Complete marcos para ganhar Tostões e distinções.
        </p>
      </div>

      {/* Ajuda quando o saldo está em baixo */}
      {lowBalance && (
        <section className="card border-gold/40 p-5 sm:p-6">
          <h2 className="font-display text-lg font-medium text-text sm:text-xl">No fundo do poço?</h2>
          <p className="mt-1 font-sans text-sm text-muted-2">
            Ficou sem Tostões — aqui tem uma ajuda diária gratuita para voltar ao jogo.
          </p>
          <Button variant="primary" onClick={onRescue} disabled={rescue.isPending} className="mt-4">
            {rescue.isPending ? 'A resgatar…' : 'Resgatar ajuda gratuita'}
          </Button>
        </section>
      )}

      {msg && (
        <p className="animate-fade-in font-sans text-sm font-medium text-positive">{msg}</p>
      )}

      {tracksInOrder.map((track) => (
        <section key={track.title} className="space-y-4">
          <SectionHeader title={track.title} />
          {track.items.length === 0 ? (
            <p className="font-sans text-sm text-muted-2">Sem desafios disponíveis de momento.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {track.items.map((c) => (
                <ChallengeCard
                  key={c.key}
                  c={c}
                  busy={claim.isPending}
                  onClaim={() => onClaim(c.key)}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      {/* Distinções */}
      {badges.length > 0 && (
        <section className="space-y-4">
          <SectionHeader title="Distinções" />
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <span
                key={b.key}
                className="rounded border border-gold/40 bg-gold/10 px-3 py-1 font-sans text-xs font-medium text-gold"
              >
                🏅 {b.title}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
