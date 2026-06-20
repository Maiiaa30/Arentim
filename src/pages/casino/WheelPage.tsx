import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useWheel } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { WHEEL, wheelColor } from '@/features/casino/miniGames';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

const CARD = 124; // card width + gap, px
const CARD_W = 112;
const REPEAT = 14; // copies of the 24-segment wheel laid end to end
const LAND_COPY = 11; // which copy the reel decelerates into
const HOME_COPY = 6; // copy it resets to between spins (keeps it in range)
const STRIP = Array.from({ length: REPEAT * WHEEL.length }, (_, i) => WHEEL[i % WHEEL.length]!);

/** Centre the n-th card under the pointer for a viewport of width w. */
const centerX = (n: number, w: number) => w / 2 - (n * CARD + CARD_W / 2);

function Cell({ mult }: { mult: number }) {
  const dark = mult >= 5;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg border border-black/30 font-display font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
      style={{
        width: CARD_W,
        height: 120,
        marginRight: CARD - CARD_W,
        background: `linear-gradient(180deg, ${wheelColor(mult)}, ${wheelColor(mult)}cc)`,
        color: dark ? '#1a1712' : mult === 0 ? 'rgba(255,255,255,0.35)' : '#f3edde',
        fontSize: mult >= 5 ? 32 : 26,
      }}
    >
      {mult === 0 ? '✕' : `${mult}×`}
    </div>
  );
}

export function WheelPage() {
  const { data: profile } = useProfile();
  const wheel = useWheel();
  const [stake, setStake] = useState(25);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ mult: number; payout: number } | null>(null);
  const [winId, setWinId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState(0);
  const [animated, setAnimated] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);

  // Centre the strip on load (and ignore the very first paint width of 0).
  useLayoutEffect(() => {
    const w = viewport.current?.clientWidth ?? 0;
    if (w > 0) setTx(centerX(HOME_COPY * WHEEL.length, w));
  }, []);
  useLayoutEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const balance = profile?.balance ?? 0;
  const tooPoor = stake > balance;
  const SPIN_MS = 4500;

  async function spin() {
    if (spinning || tooPoor) return;
    setError(null);
    setResult(null);
    setSpinning(true);
    try {
      const res = await wheel.mutateAsync(stake);
      const w = viewport.current?.clientWidth ?? 0;
      const landN = LAND_COPY * WHEEL.length + res.index;
      setAnimated(true);
      setTx(centerX(landN, w));

      timer.current = window.setTimeout(() => {
        setSpinning(false);
        setResult({ mult: res.multiplier, payout: res.payout });
        if (res.payout > 0) setWinId((n) => n + 1);
        // Jump (no animation) to the same segment in the home copy so the reel
        // never drifts out of range over many spins.
        const homeN = HOME_COPY * WHEEL.length + res.index;
        setAnimated(false);
        setTx(centerX(homeN, w));
      }, SPIN_MS);
    } catch (e) {
      setSpinning(false);
      setError(e instanceof Error ? e.message : 'A roda falhou.');
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Roda da Sorte</h1>
        <p className="mt-2 font-sans text-sm text-muted">A roda corre e pára debaixo da seta. Multiplicadores até 5× — quase todas as casas pagam.</p>
      </div>

      <div className="felt felt-rail relative mx-auto max-w-2xl overflow-hidden rounded-lg px-4 py-9 text-center sm:px-8">
        {result && result.payout > 0 && <WinCelebration key={winId} jackpot={result.mult >= 5} />}

        {/* Reel */}
        <div ref={viewport} className="relative mx-auto h-[148px] w-full overflow-hidden rounded-lg border border-gold/20 bg-black/30">
          {/* Edge fades */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-bg to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-bg to-transparent" />
          {/* Centre pointer + highlight */}
          <div
            className={`pointer-events-none absolute left-1/2 top-1/2 z-20 h-[128px] -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 transition-colors ${
              result && result.payout > 0 ? 'animate-glow border-gold' : 'border-gold/70'
            }`}
            style={{ width: CARD_W + 8 }}
          />
          <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2">
            <div className="h-0 w-0 border-x-[8px] border-t-[12px] border-x-transparent border-t-gold" />
          </div>
          <div className="pointer-events-none absolute bottom-0 left-1/2 z-20 -translate-x-1/2">
            <div className="h-0 w-0 border-x-[8px] border-b-[12px] border-x-transparent border-b-gold" />
          </div>
          {/* The strip */}
          <div
            className="absolute top-1/2 flex -translate-y-1/2"
            style={{ transform: `translate3d(${tx}px,-50%,0)`, transition: animated ? `transform ${SPIN_MS}ms cubic-bezier(0.12,0.8,0.16,1)` : 'none' }}
          >
            {STRIP.map((m, i) => (
              <Cell key={i} mult={m} />
            ))}
          </div>
        </div>

        <div className="mt-6 flex min-h-[2.5rem] items-center justify-center px-2">
          {spinning ? (
            <p className="animate-pulse font-display text-lg italic text-gold-light">A rodar…</p>
          ) : result ? (
            result.payout > 0 ? (
              <p className="animate-pop font-display text-2xl font-bold text-positive">
                {result.mult}× — ganhou {formatAmount(result.payout)} tós!
              </p>
            ) : (
              <p className="font-sans text-base text-muted">Parou no vazio — gire outra vez.</p>
            )
          ) : (
            <p className="font-sans text-sm text-muted-2">Defina a aposta e gire a roda.</p>
          )}
        </div>
      </div>

      <div className="card mx-auto max-w-2xl space-y-4 p-5 sm:p-6">
        <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={spinning} />
        <Button variant="primary" onClick={spin} disabled={spinning || tooPoor} className="w-full">
          {spinning ? 'A rodar…' : tooPoor ? 'Saldo insuficiente' : `Rodar · ${formatAmount(stake)} tós`}
        </Button>
        {error && <p className="font-sans text-sm text-negative">{error}</p>}
      </div>
    </div>
  );
}
