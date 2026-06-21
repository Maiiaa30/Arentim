import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useChickenStart, useChickenStep, useChickenCashout } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

const DIFFS: { key: string; label: string; s: number }[] = [
  { key: 'easy', label: 'Fácil', s: 0.82 },
  { key: 'medium', label: 'Médio', s: 0.65 },
  { key: 'hard', label: 'Difícil', s: 0.45 },
];
const LANES = 12;
const CURB_W = 84;
const LANE_W = 104;
const ROAD_H = 300;
const CAR_COLORS = ['#b0303a', '#2b4a8b', '#1f8a5b', '#c97f2a', '#6a4a8b'];

function laneMult(step: number, s: number): number {
  return step <= 0 ? 1 : Math.floor(0.97 * Math.pow(1 / s, step) * 100) / 100;
}

/** A cute side-view chicken facing right. */
function ChickenSvg({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M19 37 L19 45 M27 37 L27 45" stroke="#e0902a" strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="23" cy="28" rx="14" ry="11" fill="#fdfdfb" stroke="#d8d3c4" strokeWidth="1" />
      <path d="M14 27 q7 8 15 3" fill="none" stroke="#d8d3c4" strokeWidth="1.4" />
      <circle cx="32" cy="18" r="8" fill="#fdfdfb" stroke="#d8d3c4" strokeWidth="1" />
      <path d="M29 11 q2 -4 3.5 0 q2 -4 3.5 0 q-1 3 -3.5 3 q-2.5 0 -3.5 -3" fill="#e0454f" />
      <path d="M40 17 l6 -1.5 l-6 4 z" fill="#e0902a" />
      <path d="M37 22 q1.5 4 -0.5 5.5 q-2 -1.5 -1 -5.5" fill="#e0454f" />
      <circle cx="34" cy="17" r="1.6" fill="#1a1712" />
    </svg>
  );
}

/** Top-down car. */
function CarSvg({ color, className = '' }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 32 56" className={className} aria-hidden>
      <rect x="4" y="3" width="24" height="50" rx="9" fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
      <rect x="8" y="9" width="16" height="11" rx="3" fill="#bfe3ff" opacity="0.9" />
      <rect x="8" y="36" width="16" height="10" rx="3" fill="#bfe3ff" opacity="0.6" />
      <rect x="9" y="23" width="14" height="10" rx="2" fill="rgba(255,255,255,0.18)" />
      <circle cx="9" cy="6" r="1.6" fill="#ffe9a8" />
      <circle cx="23" cy="6" r="1.6" fill="#ffe9a8" />
    </svg>
  );
}

export function ChickenPage() {
  const { data: profile } = useProfile();
  const start = useChickenStart();
  const stepRpc = useChickenStep();
  const cashout = useChickenCashout();

  const [stake, setStake] = useState(25);
  const [diff, setDiff] = useState('easy');
  const [phase, setPhase] = useState<'idle' | 'playing' | 'done'>('idle');
  const [step, setStep] = useState(0);
  const [mult, setMult] = useState(1);
  const [deadLane, setDeadLane] = useState<number | null>(null);
  const [result, setResult] = useState<{ won: boolean; payout: number } | null>(null);
  const [winId, setWinId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const roadRef = useRef<HTMLDivElement>(null);

  const balance = profile?.balance ?? 0;
  const s = DIFFS.find((d) => d.key === diff)!.s;
  const busy = start.isPending || stepRpc.isPending || cashout.isPending;
  const pos = deadLane ?? step;
  const chickenLeft = pos === 0 ? CURB_W / 2 : CURB_W + (pos - 0.5) * LANE_W;

  useEffect(() => {
    const el = roadRef.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, chickenLeft - el.clientWidth * 0.38), behavior: 'smooth' });
  }, [chickenLeft]);

  async function begin() {
    setError(null);
    if (stake > balance) { setError('Saldo insuficiente.'); return; }
    try {
      await start.mutateAsync({ stake, difficulty: diff });
      setPhase('playing'); setStep(0); setMult(1); setDeadLane(null); setResult(null);
    } catch {
      setError('Não foi possível começar.');
    }
  }

  async function advance() {
    if (phase !== 'playing' || busy) return;
    try {
      const r = await stepRpc.mutateAsync();
      if (!r.alive) { setDeadLane(r.lane); setResult({ won: false, payout: 0 }); setPhase('done'); return; }
      setStep(r.lane); setMult(Number(r.multiplier ?? 1));
      if (r.cashed) { setResult({ won: true, payout: r.payout ?? 0 }); setPhase('done'); setWinId((n) => n + 1); }
    } catch {
      setError('Jogada inválida.');
    }
  }

  async function takeMoney() {
    if (phase !== 'playing' || step === 0) return;
    try {
      const r = await cashout.mutateAsync();
      setMult(Number(r.multiplier)); setResult({ won: true, payout: r.payout }); setPhase('done'); setWinId((n) => n + 1);
    } catch {
      setError('A retirada falhou.');
    }
  }

  const cashValue = Math.floor(stake * mult);

  return (
    <div className="animate-fade-in space-y-6">
      {result?.won && <WinCelebration key={winId} jackpot={mult >= 10} />}
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Atravessa!</h1>
        <p className="mt-2 font-sans text-sm text-muted">Atravessa as faixas para subir o prémio. Cuidado com o trânsito — retira antes de seres atropelado.</p>
      </div>

      {/* Road */}
      <div ref={roadRef} className="overflow-x-auto rounded-xl border border-black/40 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]">
        <div className="relative" style={{ width: CURB_W + LANES * LANE_W, height: ROAD_H, background: 'linear-gradient(180deg,#646464,#525252)' }}>
          {/* Sidewalk / start */}
          <div className="absolute inset-y-0 left-0 flex flex-col items-center justify-center gap-3 border-r-4 border-dashed border-white/40" style={{ width: CURB_W, background: 'repeating-linear-gradient(180deg,#8a8a76,#8a8a76 14px,#7c7c68 14px,#7c7c68 28px)' }}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/90 text-lg shadow-md">🪙</span>
            <span className="text-2xl">🚧</span>
          </div>

          {/* Lanes */}
          {Array.from({ length: LANES }, (_, k) => {
            const lane = k + 1;
            const left = CURB_W + k * LANE_W;
            const passed = lane <= step && phase !== 'idle';
            const dead = deadLane === lane;
            const decoy = !dead && lane % 3 === 0 && lane > step + 1;
            return (
              <div key={lane} className="absolute inset-y-0 border-l-2 border-dashed border-white/30" style={{ left, width: LANE_W }}>
                <div
                  className={`absolute left-1/2 top-1/2 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-mono text-[13px] font-bold shadow-[inset_0_0_0_4px_rgba(0,0,0,0.5),0_3px_6px_rgba(0,0,0,0.5)] ${passed ? 'text-positive' : 'text-white/90'}`}
                  style={{ background: passed ? 'radial-gradient(circle,#2b6f4e,#10110a)' : 'radial-gradient(circle at 40% 35%,#5a5a5a,#1c1c1c)' }}
                >
                  {passed ? '✓' : `${laneMult(lane, s).toFixed(2)}×`}
                </div>
                {dead && <CarSvg color="#1a1f4a" className="absolute left-1/2 top-2 h-16 w-9 -translate-x-1/2 drop-shadow-[0_3px_4px_rgba(0,0,0,0.6)]" />}
                {decoy && <CarSvg color={CAR_COLORS[lane % CAR_COLORS.length]!} className="absolute left-1/2 top-3 h-14 w-8 -translate-x-1/2 opacity-50" />}
              </div>
            );
          })}

          {/* Chicken + badge */}
          <div className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-300 ease-out" style={{ left: chickenLeft }}>
            <div className="flex flex-col items-center">
              {deadLane != null ? (
                <span className="text-[44px]">💥</span>
              ) : (
                <ChickenSvg className="h-16 w-16 drop-shadow-[0_3px_4px_rgba(0,0,0,0.55)]" />
              )}
              {phase !== 'idle' && deadLane == null && (
                <span className="-mt-1 rounded-md bg-[#3b5bdb] px-2.5 py-0.5 font-mono text-[12px] font-bold text-white shadow-md">{mult.toFixed(2)}×</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-[1.75rem] text-center">
        {phase === 'playing' ? (
          <p className="font-sans text-sm text-muted">Faixa {step} · <span className="font-mono text-gold">{mult.toFixed(2)}×</span> · próxima {laneMult(step + 1, s).toFixed(2)}×</p>
        ) : phase === 'done' && result ? (
          <p className={`font-display text-lg font-bold ${result.won ? 'text-positive' : 'text-negative'}`}>
            {result.won ? `Retiraste ${formatAmount(result.payout)} tós!` : 'Foste atropelado! 🚗'}
          </p>
        ) : null}
      </div>

      {phase === 'playing' ? (
        <div className="mx-auto flex max-w-md gap-3">
          <Button variant="secondary" onClick={advance} disabled={busy} className="flex-1">Atravessar →</Button>
          <Button variant="primary" onClick={takeMoney} disabled={busy || step === 0} className="flex-1">
            Retirar {formatAmount(cashValue)} tós
          </Button>
        </div>
      ) : (
        <div className="card mx-auto max-w-md space-y-4 p-5">
          <div>
            <span className="mb-2 block font-sans text-sm font-medium text-muted">Dificuldade</span>
            <div className="flex gap-2">
              {DIFFS.map((d) => (
                <button key={d.key} onClick={() => setDiff(d.key)}
                  className={`focus-ring flex-1 rounded px-3 py-1.5 font-sans text-sm ${diff === d.key ? 'bg-gold text-bg' : 'border border-border text-muted hover:text-text'}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <StakeChips stake={stake} onChange={setStake} balance={balance} />
          <Button variant="primary" onClick={begin} disabled={busy || stake > balance} className="w-full">
            {stake > balance ? 'Saldo insuficiente' : `Jogar · ${formatAmount(stake)} tós`}
          </Button>
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>
      )}
    </div>
  );
}
