import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useChest } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';
import type { ChestResult } from '@/types/db';

type Phase = 'ready' | 'shuffle' | 'pick' | 'reveal';
const SLOT = 33.34; // % of the row per chest position

export function ChestPage() {
  const { data: profile } = useProfile();
  const chest = useChest();
  const [stake, setStake] = useState(25);
  const [phase, setPhase] = useState<Phase>('ready');
  const [slots, setSlots] = useState([0, 1, 2]); // slots[position] = chest id
  const [pickedPos, setPickedPos] = useState<number | null>(null);
  const [result, setResult] = useState<ChestResult | null>(null);
  const [winId, setWinId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const balance = profile?.balance ?? 0;
  const tooPoor = stake > balance;

  function start() {
    if (phase !== 'ready' || tooPoor) return;
    setError(null);
    setResult(null);
    setPickedPos(null);
    setPhase('shuffle');
    // Cosmetic shuffle: swap two positions a handful of times.
    let arr = [0, 1, 2];
    let i = 0;
    const step = () => {
      const a = Math.floor(Math.random() * 3);
      let b = Math.floor(Math.random() * 3);
      if (b === a) b = (b + 1) % 3;
      arr = arr.slice();
      [arr[a], arr[b]] = [arr[b]!, arr[a]!];
      setSlots(arr);
      i += 1;
      if (i < 7) timers.current.push(window.setTimeout(step, 280));
      else timers.current.push(window.setTimeout(() => setPhase('pick'), 320));
    };
    timers.current.push(window.setTimeout(step, 200));
  }

  async function pickPosition(pos: number) {
    if (phase !== 'pick') return;
    setPickedPos(pos);
    try {
      const res = await chest.mutateAsync({ stake, pick: pos });
      setResult(res);
      setPhase('reveal');
      if (res.payout > 0) setWinId((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível abrir o baú.');
      setPhase('pick');
      setPickedPos(null);
    }
  }

  function reset() {
    setPhase('ready');
    setSlots([0, 1, 2]);
    setResult(null);
    setPickedPos(null);
    setError(null);
  }

  const revealing = phase === 'reveal' && result;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Baú do Tesouro</h1>
        <p className="mt-2 font-sans text-sm text-muted">O tesouro está num dos três baús. Eles baralham — encontre-o e leve 2.85× a aposta.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        {/* ---- Game ---- */}
        <div className="felt felt-rail relative overflow-hidden rounded-lg px-5 py-12 text-center sm:px-8">
          {revealing && result.payout > 0 && <WinCelebration key={winId} jackpot />}

          {/* The three chests, positioned by `slots`. */}
          <div className="relative mx-auto h-32 w-full max-w-[420px]">
            {[0, 1, 2].map((id) => {
              const pos = slots.indexOf(id);
              const atPrize = revealing && result.prize_index === pos;
              const picked = pickedPos === pos;
              return (
                <button
                  key={id}
                  onClick={() => pickPosition(pos)}
                  disabled={phase !== 'pick'}
                  style={{ left: `${pos * SLOT}%`, width: `${SLOT - 4}%` }}
                  className={`absolute top-0 flex h-32 flex-col items-center justify-center rounded-xl border-2 text-5xl transition-all duration-300 ${
                    phase === 'pick' ? 'cursor-pointer border-gold/40 bg-black/20 hover:-translate-y-2 hover:border-gold' : 'border-gold/25 bg-black/20'
                  } ${revealing && picked ? (result.won ? 'border-gold bg-gold/20 shadow-[0_0_24px_rgba(201,162,75,0.5)]' : 'border-negative/60') : ''} ${
                    phase === 'shuffle' ? 'animate-floaty' : ''
                  }`}
                >
                  {revealing ? (
                    atPrize ? (
                      <span className="flex flex-col items-center">
                        <span>🏆</span>
                        <span className="font-mono text-sm font-bold text-gold-light">{result.multiplier}×</span>
                      </span>
                    ) : (
                      <span className="opacity-50">📦</span>
                    )
                  ) : (
                    <span>🧰</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-7 flex min-h-[2.5rem] items-center justify-center px-2">
            {phase === 'shuffle' ? (
              <p className="animate-pulse font-display text-lg italic text-gold-light">A baralhar…</p>
            ) : phase === 'pick' ? (
              <p className="font-sans text-sm text-gold-light">Onde está o tesouro? Escolha um baú.</p>
            ) : revealing ? (
              result.payout > 0 ? (
                <p className="animate-pop font-display text-xl font-bold text-positive">
                  Encontrou! Ganhou {formatAmount(result.payout)} tós ({result.multiplier}×)
                </p>
              ) : (
                <p className="font-sans text-sm text-muted">Baú errado — o tesouro estava ao lado.</p>
              )
            ) : (
              <p className="font-sans text-sm text-muted-2">Defina a aposta e baralhe os baús.</p>
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
            <Button variant="primary" onClick={start} disabled={tooPoor} className="w-full">Baralhar · {formatAmount(stake)} tós</Button>
          ) : phase === 'reveal' ? (
            <Button variant="primary" onClick={reset} className="w-full">Outra vez</Button>
          ) : (
            <p className="font-sans text-[12px] text-muted">{phase === 'shuffle' ? 'A baralhar os baús…' : 'Escolha um baú na mesa.'}</p>
          )}
          {tooPoor && phase === 'ready' && <p className="font-sans text-sm text-negative">Saldo insuficiente para esta aposta.</p>}
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>
      </div>
    </div>
  );
}
