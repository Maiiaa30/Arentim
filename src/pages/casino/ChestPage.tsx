import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useCupsStart, useCupsPick } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';
import type { CupsPickResult } from '@/types/db';

type Phase = 'ready' | 'shuffle' | 'pick' | 'reveal';
const SLOT = 33.34;

function Cup({ lifted }: { lifted: boolean }) {
  return (
    <div
      className="mx-auto h-24 w-20 transition-transform duration-300"
      style={{
        transform: lifted ? 'translateY(-46px)' : 'none',
        background: 'linear-gradient(180deg, #c9952f, #7a5320)',
        clipPath: 'polygon(18% 0, 82% 0, 100% 100%, 0 100%)',
        boxShadow: 'inset 0 3px 6px rgba(255,255,255,0.25), 0 8px 14px rgba(0,0,0,0.5)',
      }}
    />
  );
}

export function ChestPage() {
  const { data: profile } = useProfile();
  const cupsStart = useCupsStart();
  const cupsPick = useCupsPick();
  const [stake, setStake] = useState(25);
  const [phase, setPhase] = useState<Phase>('ready');
  const [pos, setPos] = useState([0, 1, 2]); // pos[cupId] = screen position
  const [result, setResult] = useState<CupsPickResult | null>(null);
  const [winId, setWinId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const balance = profile?.balance ?? 0;
  const tooPoor = stake > balance;

  async function begin() {
    if (phase !== 'ready' || tooPoor) return;
    setError(null);
    setResult(null);
    setPos([0, 1, 2]);
    try {
      const res = await cupsStart.mutateAsync(stake);
      // Shuffle the cups (cosmetic — the winning cup is hidden server-side and
      // isn't sent here, so it can't be read from the response/devtools).
      setPhase('shuffle');
      let p = [0, 1, 2];
      res.swaps.forEach(([a, b], i) => {
        timers.current.push(
          window.setTimeout(() => {
            const ca = p.indexOf(a);
            const cb = p.indexOf(b);
            p = p.slice();
            [p[ca], p[cb]] = [p[cb]!, p[ca]!];
            setPos(p);
            if (i === res.swaps.length - 1) timers.current.push(window.setTimeout(() => setPhase('pick'), 360));
          }, i * 360),
        );
      });
    } catch (e) {
      setPhase('ready');
      setError(e instanceof Error ? e.message : 'Não foi possível começar.');
    }
  }

  async function pickAt(position: number) {
    if (phase !== 'pick') return;
    try {
      const res = await cupsPick.mutateAsync(position);
      setResult(res);
      setPhase('reveal');
      if (res.payout > 0) setWinId((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'A escolha falhou.');
    }
  }

  function reset() {
    setPhase('ready');
    setPos([0, 1, 2]);
    setResult(null);
    setError(null);
  }

  const ballPos = result?.prize ?? 0; // screen position of the ball (revealed at the end)
  const ballVisible = phase === 'reveal';

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Jogo dos Copos</h1>
        <p className="mt-2 font-sans text-sm text-muted">Os copos baralham com a joia escondida. Adivinha debaixo de qual está para levar 2.85×.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        {/* ---- Game ---- */}
        <div className="felt felt-rail relative overflow-hidden rounded-lg px-5 py-12 text-center sm:px-8">
          {phase === 'reveal' && result && result.payout > 0 && <WinCelebration key={winId} jackpot />}

          <div className="relative mx-auto h-36 w-full max-w-[420px]">
            {/* The ball (joia), shown only when a cup is lifted */}
            {ballVisible && (
              <div
                className="absolute bottom-2 flex h-20 items-end justify-center transition-all duration-300"
                style={{ left: `${ballPos * SLOT}%`, width: `${SLOT}%` }}
              >
                <span className="text-3xl drop-shadow-[0_0_10px_rgba(201,162,75,0.7)]">💎</span>
              </div>
            )}
            {/* The three cups */}
            {[0, 1, 2].map((cupId) => {
              const p = pos[cupId]!;
              const lifted = phase === 'reveal' && result != null && p === result.prize;
              const pickedHere = phase === 'reveal' && result?.picked === p;
              return (
                <button
                  key={cupId}
                  onClick={() => pickAt(p)}
                  disabled={phase !== 'pick'}
                  style={{ left: `${p * SLOT}%`, width: `${SLOT}%` }}
                  className={`absolute bottom-0 flex h-28 items-end justify-center rounded transition-[left] duration-300 ease-out ${
                    phase === 'pick' ? 'cursor-pointer hover:-translate-y-1' : ''
                  } ${pickedHere ? (result?.won ? 'ring-2 ring-gold rounded-xl' : 'ring-2 ring-negative/70 rounded-xl') : ''}`}
                >
                  <Cup lifted={lifted} />
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex min-h-[2.5rem] items-center justify-center px-2">
            {phase === 'shuffle' ? (
              <p className="animate-pulse font-display text-lg italic text-gold-light">A baralhar…</p>
            ) : phase === 'pick' ? (
              <p className="font-sans text-sm text-gold-light">Onde está a joia? Escolha um copo.</p>
            ) : phase === 'reveal' && result ? (
              result.payout > 0 ? (
                <p className="animate-pop font-display text-xl font-bold text-positive">
                  Encontrou! Ganhou {formatAmount(result.payout)} tós ({result.multiplier}×)
                </p>
              ) : (
                <p className="font-sans text-sm text-muted">Copo errado — a joia estava ali.</p>
              )
            ) : (
              <p className="font-sans text-sm text-muted-2">Defina a aposta e comece.</p>
            )}
          </div>
        </div>

        {/* ---- Bet ---- */}
        <div className="card space-y-5 p-5 sm:p-6">
          <div>
            <p className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-2">Aposta</p>
            <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={phase !== 'ready'} />
          </div>
          {phase === 'ready' ? (
            <Button variant="primary" onClick={begin} disabled={tooPoor} className="w-full">Começar · {formatAmount(stake)} tós</Button>
          ) : phase === 'reveal' ? (
            <Button variant="primary" onClick={reset} className="w-full">Outra vez</Button>
          ) : (
            <p className="font-sans text-[12px] text-muted">{phase === 'pick' ? 'Escolha um copo na mesa.' : 'A baralhar os copos…'}</p>
          )}
          {tooPoor && phase === 'ready' && <p className="font-sans text-sm text-negative">Saldo insuficiente para esta aposta.</p>}
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>
      </div>
    </div>
  );
}
