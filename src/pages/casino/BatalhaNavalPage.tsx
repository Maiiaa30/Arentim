import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useNavalStart, useNavalFire, useNavalCurrent } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

const SALVO = 5;
const SHIPS = 5;
const PAYTABLE: { h: number; m: number }[] = [
  { h: 2, m: 2 },
  { h: 3, m: 10 },
  { h: 4, m: 80 },
  { h: 5, m: 1500 },
];

type Result = { won: boolean; payout: number; multiplier: number; hits: number };

export function BatalhaNavalPage() {
  const { data: profile } = useProfile();
  const start = useNavalStart();
  const fire = useNavalFire();
  const resume = useNavalCurrent();

  const [stake, setStake] = useState(25);
  const [phase, setPhase] = useState<'idle' | 'playing' | 'done'>('idle');
  const [hits, setHits] = useState<Set<number>>(new Set());
  const [misses, setMisses] = useState<Set<number>>(new Set());
  const [fleet, setFleet] = useState<number[]>([]); // revealed on settle
  const [result, setResult] = useState<Result | null>(null);
  const [winId, setWinId] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const balance = profile?.balance ?? 0;
  const busy = start.isPending || fire.isPending;
  const fired = hits.size + misses.size;
  const shotsLeft = SALVO - fired;

  // Resume a partially-fired salvo (the stake stays locked in it).
  useEffect(() => {
    const c = resume.data;
    if (phase === 'idle' && c) {
      setStake(c.stake);
      const h = new Set<number>();
      const m = new Set<number>();
      c.shots.forEach((cell, i) => (c.hit_flags[i] ? h : m).add(cell));
      setHits(h);
      setMisses(m);
      setPhase('playing');
    }
  }, [resume.data, phase]);

  async function begin() {
    setError(null);
    if (stake > balance) { setError('Saldo insuficiente.'); return; }
    try {
      await start.mutateAsync(stake);
      setHits(new Set());
      setMisses(new Set());
      setFleet([]);
      setResult(null);
      setPhase('playing');
    } catch {
      setError('Não foi possível começar.');
    }
  }

  async function shoot(cell: number) {
    if (phase !== 'playing' || busy || hits.has(cell) || misses.has(cell)) return;
    try {
      const r = await fire.mutateAsync(cell);
      if (r.hit) setHits((s) => new Set(s).add(cell));
      else setMisses((s) => new Set(s).add(cell));
      if (r.done) {
        setFleet(r.ships ?? []);
        const won = (r.payout ?? 0) > 0;
        setResult({ won, payout: r.payout ?? 0, multiplier: Number(r.multiplier ?? 0), hits: r.hits });
        setPhase('done');
        if (won) setWinId((n) => n + 1);
      }
    } catch {
      setError('Disparo inválido.');
    }
  }

  function tileContent(i: number) {
    if (hits.has(i)) return <span className="inline-block animate-pop">💥</span>;
    if (misses.has(i)) return <span className="inline-block animate-fade-in opacity-70">🌊</span>;
    if (phase === 'done' && fleet.includes(i)) return <span className="inline-block animate-fade-in opacity-80">🚢</span>;
    return null;
  }
  function tileCls(i: number) {
    if (hits.has(i)) return 'bg-gold/20 ring-1 ring-gold/50';
    if (misses.has(i)) return 'bg-[#0c1622] ring-1 ring-[#2b4a8b]/30';
    if (phase === 'done' && fleet.includes(i)) return 'bg-[#1a2740] ring-1 ring-gold/30';
    if (phase === 'playing') return 'bg-[#0f1c2e] ring-1 ring-[#2b4a8b]/35 hover:bg-gold/15 cursor-pointer';
    return 'bg-[#0f1c2e]/60 ring-1 ring-[#2b4a8b]/20';
  }

  return (
    <div className="animate-fade-in space-y-6">
      {result?.won && <WinCelebration key={winId} jackpot={result.multiplier >= 10} />}
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Batalha Naval</h1>
        <p className="mt-2 font-sans text-sm text-muted">
          Uma frota de {SHIPS} navios esconde-se no oceano. Dispara {SALVO} torpedos — quantos mais acertares, maior o prémio.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
        {/* Bet / controls panel */}
        <div className="card space-y-4 p-5 lg:sticky lg:top-[88px]">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Acertos</p>
              <p className="font-mono text-3xl font-bold tabular-nums text-gold">
                {result ? result.hits : hits.size}<span className="text-lg text-muted-2">/{SHIPS}</span>
              </p>
            </div>
            {phase === 'playing' && (
              <div className="text-right">
                <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Torpedos</p>
                <p className="font-mono text-base tabular-nums text-muted">{shotsLeft}</p>
              </div>
            )}
          </div>

          {/* Paytable — highlights the row you're currently on. */}
          <div className="rounded-lg border border-border bg-surface-raised/50 p-3">
            <p className="mb-2 font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Tabela de prémios</p>
            <div className="space-y-1">
              {PAYTABLE.map(({ h, m }) => {
                const hitCount = result ? result.hits : hits.size;
                const on = hitCount === h && (phase !== 'idle');
                return (
                  <div key={h} className={`flex items-center justify-between rounded px-2 py-0.5 font-mono text-sm ${on ? 'bg-gold/15 text-gold' : 'text-muted'}`}>
                    <span>{h} acertos{h === SHIPS ? ' · frota afundada' : ''}</span>
                    <span className="font-semibold">{m}×</span>
                  </div>
                );
              })}
            </div>
          </div>

          <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={phase === 'playing'} />

          {phase === 'playing' ? (
            <p className="rounded-lg border border-border bg-surface-raised/50 py-2 text-center font-sans text-sm text-muted">
              Dispara nos quadrados — {shotsLeft} torpedo{shotsLeft === 1 ? '' : 's'} {shotsLeft === 1 ? 'restante' : 'restantes'}
            </p>
          ) : (
            <Button variant="primary" onClick={begin} disabled={busy || stake > balance} className="w-full">
              {stake > balance ? 'Saldo insuficiente' : `Apostar · ${formatAmount(stake)} tós`}
            </Button>
          )}

          {phase === 'done' && result && (
            <p className={`text-center font-display text-sm font-bold ${result.won ? 'text-positive' : 'text-negative'}`}>
              {result.won
                ? `${result.hits} acertos · ${result.multiplier}× · +${formatAmount(result.payout)} tós!`
                : `${result.hits} acerto${result.hits === 1 ? '' : 's'} — a frota escapou.`}
            </p>
          )}
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>

        {/* Board */}
        <div
          className={`relative overflow-hidden rounded-lg p-4 shadow-[inset_0_0_60px_rgba(0,0,0,0.5)] sm:p-6 ${phase === 'done' && !result?.won ? 'animate-shake' : ''}`}
          style={{ background: 'linear-gradient(160deg,#0c1320,#0a0f18 60%,#070b12)' }}
        >
          {phase === 'done' && (
            <div
              className={`pointer-events-none absolute inset-0 z-0 animate-fade-in ${result?.won ? 'bg-gold/10' : 'bg-negative/12'}`}
              aria-hidden
            />
          )}
          <div className="relative z-10 mx-auto grid max-w-[560px] grid-cols-5 gap-2.5 sm:gap-3">
            {Array.from({ length: 25 }, (_, i) => (
              <button
                key={i}
                onClick={() => shoot(i)}
                disabled={phase !== 'playing' || busy || hits.has(i) || misses.has(i)}
                className={`focus-ring flex aspect-square items-center justify-center rounded-lg text-3xl shadow-[inset_0_-3px_6px_rgba(0,0,0,0.4)] transition-all hover:scale-[1.03] disabled:hover:scale-100 sm:text-4xl ${tileCls(i)}`}
              >
                {tileContent(i)}
              </button>
            ))}
          </div>

          {phase === 'done' && (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center px-4">
              {result?.won ? (
                <div className="animate-win-burst rounded-2xl border border-gold/60 bg-bg/85 px-6 py-4 text-center shadow-[0_0_30px_rgba(201,162,75,0.45)] backdrop-blur-sm">
                  <p className="font-display text-2xl font-bold text-gold">🎯 +{formatAmount(result.payout)} tós</p>
                  <p className="mt-0.5 font-mono text-sm text-gold/90">{result.hits} acertos · {result.multiplier}×</p>
                </div>
              ) : (
                <div className="animate-pop rounded-2xl border border-negative/60 bg-bg/85 px-6 py-4 text-center shadow-[0_0_30px_rgba(176,48,58,0.5)] backdrop-blur-sm">
                  <p className="font-display text-2xl font-bold text-negative">A frota escapou</p>
                  <p className="mt-0.5 font-sans text-sm text-muted">Precisas de 2+ acertos.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
