import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useHorse } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';
import type { HorseResult } from '@/types/db';

const ODDS = [2.4, 4, 6, 9, 14, 28];
const COLORS = ['#C9A24B', '#b0303a', '#2b6f4e', '#2b4a8b', '#9a5cc2', '#c97f2a'];

export function HorsePage() {
  const { data: profile } = useProfile();
  const play = useHorse();
  const [stake, setStake] = useState(25);
  const [horse, setHorse] = useState(0);
  const [racing, setRacing] = useState(false);
  const [pos, setPos] = useState<number[]>(Array(6).fill(0));
  const [durs, setDurs] = useState<number[]>(Array(6).fill(3));
  const [result, setResult] = useState<HorseResult | null>(null);
  const [winId, setWinId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const balance = profile?.balance ?? 0;

  async function race() {
    if (racing) return;
    setError(null);
    if (stake > balance) { setError('Saldo insuficiente.'); return; }
    setResult(null);
    try {
      const r = await play.mutateAsync({ stake, horse });
      // Winner gets the shortest run; others trail. Deterministic-ish per race.
      const d = Array.from({ length: 6 }, (_, i) => (i === r.winner ? 2.6 : 2.9 + ((i * 7 + r.winner * 3) % 9) / 10));
      setDurs(d);
      setPos(Array(6).fill(0));
      setRacing(true);
      // next frame → trigger the transition to the finish line
      requestAnimationFrame(() => requestAnimationFrame(() => setPos(Array(6).fill(88))));
      timer.current = window.setTimeout(() => {
        setRacing(false);
        setResult(r);
        if (r.won) setWinId((n) => n + 1);
      }, 4000);
    } catch {
      setError('A corrida falhou.');
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      {result?.won && <WinCelebration key={winId} jackpot={ODDS[horse]! >= 10} />}
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Corrida de Cavalos</h1>
        <p className="mt-2 font-sans text-sm text-muted">Escolhe um cavalo e aposta. Quanto maior a cota, menor a hipótese — maior o prémio.</p>
      </div>

      {/* Track */}
      <div className="felt felt-rail mx-auto max-w-2xl space-y-1.5 rounded-lg p-4 sm:p-5">
        {ODDS.map((odd, i) => {
          const isWin = result?.winner === i;
          return (
            <div key={i} className={`relative flex h-9 items-center overflow-hidden rounded border-l-2 ${isWin ? 'border-l-gold bg-gold/10' : 'border-l-border bg-black/20'}`}>
              <span className="absolute right-1.5 font-mono text-[10px] text-muted-2">{odd}×</span>
              <span className="absolute left-1.5 font-mono text-[10px]" style={{ color: COLORS[i] }}>{i + 1}</span>
              <span
                className="absolute text-xl"
                style={{ left: `${pos[i]}%`, transition: racing ? `left ${durs[i]}s cubic-bezier(0.4,0,0.5,1)` : 'none', filter: `drop-shadow(0 0 2px ${COLORS[i]})` }}
              >
                🏇
              </span>
            </div>
          );
        })}
      </div>

      <div className="min-h-[1.75rem] text-center">
        {racing ? (
          <p className="font-sans text-sm text-gold-light animate-floaty">E partem…</p>
        ) : result ? (
          <p className={`font-display text-lg font-bold ${result.won ? 'text-positive' : 'text-negative'}`}>
            Venceu o cavalo {result.winner + 1} — {result.won ? `ganhaste ${formatAmount(result.payout)} tós!` : 'desta vez não.'}
          </p>
        ) : null}
      </div>

      <div className="card mx-auto max-w-2xl space-y-4 p-5">
        <div>
          <span className="mb-2 block font-sans text-sm font-medium text-muted">O teu cavalo</span>
          <div className="flex flex-wrap gap-2">
            {ODDS.map((odd, i) => (
              <button
                key={i}
                onClick={() => setHorse(i)}
                disabled={racing}
                className={`focus-ring flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-sm disabled:opacity-50 ${horse === i ? 'bg-gold text-bg' : 'border border-border text-muted hover:text-text'}`}
              >
                <span style={{ color: horse === i ? undefined : COLORS[i] }}>#{i + 1}</span>
                <span className="text-[11px] opacity-80">{odd}×</span>
              </button>
            ))}
          </div>
        </div>
        <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={racing} />
        <Button variant="primary" onClick={race} disabled={racing || stake > balance} className="w-full">
          {racing ? 'A correr…' : stake > balance ? 'Saldo insuficiente' : `Apostar no #${horse + 1} · ${formatAmount(stake)} tós`}
        </Button>
        {error && <p className="font-sans text-sm text-negative">{error}</p>}
      </div>
    </div>
  );
}
