import { useEffect, useState } from 'react';
import { useProfile } from '@/features/profile/useProfile';
import {
  useChallenges,
  useChallengeActions,
  useDailyChallenges,
} from '@/features/challenges/useChallenges';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount, formatTostoes } from '@/lib/format';
import { Eyebrow, SectionHeader } from '@/components/ui/primitives';
import { SpinWheel } from '@/features/bonus/SpinWheel';
import type { ChallengeRow, DailyChallengeRow } from '@/types/db';

// Must match claim_rescue's server threshold (rescaled to 10 in
// 20260619010000_rescale_economy.sql). If this is higher, the rescue card shows
// for balances that the server then rejects as "not eligible".
const RESCUE_THRESHOLD = 10;

/** Live "resets in HH:MM:SS" countdown to the next local midnight (server day). */
function ResetCountdown({ resetsAt }: { resetsAt: string }) {
  const target = new Date(resetsAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, target - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="font-mono text-xs tabular-nums text-muted-2">
      Renova em {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}

type CardChallenge = Pick<
  ChallengeRow,
  'title' | 'description' | 'reward' | 'progress' | 'target' | 'claimed'
>;

function ChallengeCard({ c, onClaim, busy }: { c: CardChallenge; onClaim: () => void; busy: boolean }) {
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
  const { data: daily } = useDailyChallenges();
  const { claim, claimDaily, rescue } = useChallengeActions();
  const [msg, setMsg] = useState<string | null>(null);

  const balance = profile?.balance ?? 0;
  const lowBalance = balance < RESCUE_THRESHOLD;
  const recovery = (challenges ?? []).filter((c) => c.track === 'recovery');
  const highroller = (challenges ?? []).filter((c) => c.track === 'highroller');
  const badges = (challenges ?? []).filter((c) => c.claimed);
  const dailyList = daily ?? [];

  async function onClaim(key: string) {
    setMsg(null);
    const res = await claim.mutateAsync(key);
    if (res.status === 'claimed') setMsg(`Resgatou +${formatTostoes(res.reward ?? 0)}!`);
    else if (res.status === 'incomplete') setMsg('Ainda não está lá. Continue a jogar.');
  }
  async function onClaimDaily(key: string) {
    setMsg(null);
    const res = await claimDaily.mutateAsync(key);
    if (res.status === 'claimed') setMsg(`Desafio diário resgatado: +${formatTostoes(res.reward ?? 0)}!`);
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

      {msg && (
        <p className="animate-fade-in font-sans text-sm font-medium text-positive">{msg}</p>
      )}

      {/* Roleta diária — um giro grátis por dia. Lead with the rewards so they're
          never buried below the rescue card. */}
      <SpinWheel />

      {/* Desafios diários — renovam todos os dias, iguais para todos */}
      {dailyList.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <SectionHeader title="Desafios diários" />
            <ResetCountdown resetsAt={dailyList[0]!.resets_at} />
          </div>
          <p className="-mt-2 font-sans text-sm text-muted-2">
            Um novo conjunto para toda a gente, todos os dias. Conta só o que jogar hoje.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dailyList.map((c: DailyChallengeRow) => (
              <ChallengeCard
                key={c.key}
                c={c}
                busy={claimDaily.isPending}
                onClaim={() => onClaimDaily(c.key)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Ajuda quando o saldo está MESMO em baixo (< 10 tós, igual ao servidor) */}
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
