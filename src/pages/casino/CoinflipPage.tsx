import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useCoinflip } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import type { CoinSide } from '@/features/casino/coinflip';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

const SIDE_LABEL: Record<CoinSide, string> = { heads: 'Cara', tails: 'Coroa' };

/** A gilded coin face with a milled rim, inner ring and a crest motif. */
function CoinFace({ side }: { side: CoinSide }) {
  const heads = side === 'heads';
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id={`cf-fill-${side}`} cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fbeec0" />
          <stop offset="42%" stopColor="#e7c573" />
          <stop offset="74%" stopColor={heads ? '#C9A24B' : '#b78c34'} />
          <stop offset="100%" stopColor={heads ? '#7d6228' : '#6b542a'} />
        </radialGradient>
        <linearGradient id={`cf-rim-${side}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f7e4ad" />
          <stop offset="50%" stopColor="#C9A24B" />
          <stop offset="100%" stopColor="#6b542a" />
        </linearGradient>
      </defs>

      {/* Milled outer rim */}
      <circle cx="50" cy="50" r="49" fill={`url(#cf-rim-${side})`} />
      {[...Array(48)].map((_, i) => (
        <rect
          key={i}
          x="49.2"
          y="0.5"
          width="1.6"
          height="6"
          rx="0.6"
          fill="rgba(60,42,12,0.45)"
          transform={`rotate(${i * 7.5} 50 50)`}
        />
      ))}

      {/* Coin field */}
      <circle cx="50" cy="50" r="43" fill={`url(#cf-fill-${side})`} />
      <circle cx="50" cy="50" r="43" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
      <circle cx="50" cy="50" r="35" fill="none" stroke="rgba(80,58,18,0.55)" strokeWidth="1.4" />
      <circle cx="50" cy="50" r="32.5" fill="none" stroke="rgba(255,243,210,0.55)" strokeWidth="0.6" />

      {/* Crest */}
      <g fill="rgba(70,50,16,0.78)">
        {heads ? (
          // Cara — laurel-framed monogram
          <>
            <path
              d="M30 58c-6-6-6-16 0-23M70 58c6-6 6-16 0-23"
              fill="none"
              stroke="rgba(70,50,16,0.7)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <text
              x="50"
              y="55"
              textAnchor="middle"
              fontFamily="'Playfair Display', Georgia, serif"
              fontSize="30"
              fontWeight="700"
              fill="rgba(70,50,16,0.85)"
            >
              C
            </text>
          </>
        ) : (
          // Coroa — a crown crest
          <>
            <path
              d="M30 62h40l-3-22-9 9-8-13-8 13-9-9z"
              stroke="rgba(70,50,16,0.55)"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <rect x="30" y="64" width="40" height="5" rx="1.5" />
            <circle cx="50" cy="33" r="3.4" />
            <circle cx="30" cy="38" r="2.6" />
            <circle cx="70" cy="38" r="2.6" />
          </>
        )}
      </g>

      {/* Glossy highlight */}
      <ellipse cx="38" cy="32" rx="20" ry="12" fill="rgba(255,255,255,0.28)" />
    </svg>
  );
}

export function CoinflipPage() {
  const { data: profile } = useProfile();
  const coinflip = useCoinflip();
  const [stake, setStake] = useState(25);
  const [choice, setChoice] = useState<CoinSide>('heads');
  const [outcome, setOutcome] = useState<CoinSide | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [spinId, setSpinId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [restAngle, setRestAngle] = useState(0); // resting rotateX (face shown when idle)
  const timer = useRef<number | null>(null);
  const coinRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0); // the coin's current resting rotateX, in degrees

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const balance = profile?.balance ?? 0;
  const tooPoor = stake > balance;

  const FLIP_MS = 1200;

  async function flip() {
    if (flipping || stake > balance) return;
    setError(null);
    setOutcome(null);
    setWon(null);
    setFlipping(true);
    try {
      const res = await coinflip.mutateAsync({ stake, choice });

      // Land on the real outcome. Heads shows at a multiple of 360°, tails at
      // 180°. We animate with the Web Animations API (NOT a CSS transition):
      // transitions interpolate between computed *matrices*, so a whole-turn
      // rotation (1800°) collapses to identity and the coin never spins. WAAPI
      // interpolates the angle itself, so every turn is visible.
      const prev = angleRef.current;
      const faceTarget = res.outcome === 'heads' ? 0 : 180;
      let target = prev + 360 * 6; // six full tumbles for drama
      target += (((faceTarget - (target % 360)) % 360) + 360) % 360; // align to face
      const mid = prev + (target - prev) / 2;
      angleRef.current = target;

      const el = coinRef.current;
      el?.getAnimations().forEach((a) => a.cancel()); // clear any stale fills
      const anim = el?.animate?.(
        [
          { transform: `translateY(0px) scale(1) rotateX(${prev}deg)` },
          { transform: `translateY(-96px) scale(1.12) rotateX(${mid}deg)`, offset: 0.5 },
          { transform: `translateY(0px) scale(1) rotateX(${target}deg)` },
        ],
        { duration: FLIP_MS, easing: 'cubic-bezier(0.33,0.0,0.2,1)', fill: 'forwards' },
      );

      timer.current = window.setTimeout(() => {
        // Bake the landing pose into the inline transform and hand off from the
        // animation, so the resting face is correct (and reliable even if the
        // tab was backgrounded and the spin animation was throttled).
        setRestAngle(target);
        anim?.cancel();
        setOutcome(res.outcome);
        setWon(res.won);
        setFlipping(false);
        if (res.won) setSpinId((n) => n + 1);
      }, FLIP_MS);
    } catch (e) {
      setFlipping(false);
      setError(e instanceof Error ? e.message : 'O lançamento falhou.');
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Moeda</h1>
        <p className="mt-2 font-sans text-sm text-muted">Dobro ou nada — acerte na chamada e dobre a aposta.</p>
      </div>

      {/* Felt stage */}
      <div className="felt felt-rail relative mx-auto max-w-md overflow-hidden rounded-lg px-5 py-10 text-center sm:px-8">
        {won && <WinCelebration key={spinId} />}

        {/* The call the player has live on the table */}
        <p className="mb-6 font-sans text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-light/80">
          A sua chamada · {SIDE_LABEL[choice]}
        </p>

        {/* Coin + its cast shadow */}
        <div className="relative flex h-44 items-center justify-center [perspective:900px] sm:h-52">
          <div
            ref={coinRef}
            className="relative h-32 w-32 [transform-style:preserve-3d] will-change-transform sm:h-40 sm:w-40"
            style={{ transform: `rotateX(${restAngle}deg)`, filter: 'drop-shadow(0 14px 18px rgba(0,0,0,0.55))' }}
          >
            {/* Cara (heads) */}
            <div className="absolute inset-0 [backface-visibility:hidden]">
              <CoinFace side="heads" />
            </div>
            {/* Coroa (tails) — pre-rotated to the back face */}
            <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateX(180deg)]">
              <CoinFace side="tails" />
            </div>
          </div>

          {/* Soft cast shadow on the felt */}
          <div
            className={`pointer-events-none absolute bottom-3 left-1/2 h-3 w-24 -translate-x-1/2 rounded-[50%] bg-black/45 blur-md transition-all duration-1000 sm:w-28 ${
              flipping ? 'scale-75 opacity-40' : 'opacity-70'
            }`}
            aria-hidden
          />
        </div>

        {/* Status line */}
        <div className="mt-5 flex min-h-[2.75rem] items-center justify-center px-2">
          {flipping ? (
            <p className="animate-pulse font-display text-lg italic text-gold-light">A girar no ar…</p>
          ) : won !== null ? (
            won ? (
              <p className="animate-pop font-display text-xl font-bold text-positive">
                Saiu {outcome && SIDE_LABEL[outcome]} — ganhou {formatAmount(stake * 2)} tós!
              </p>
            ) : (
              <p className="font-sans text-sm text-muted">
                Saiu {outcome && SIDE_LABEL[outcome]} — mais sorte para a próxima.
              </p>
            )
          ) : (
            <p className="font-sans text-sm text-muted-2">Escolha um lado e lance a moeda.</p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="card mx-auto max-w-md space-y-5 p-5 sm:p-6">
        <div>
          <p className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-2">
            Escolha o lado
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {(['heads', 'tails'] as const).map((side) => {
              const active = choice === side;
              return (
                <button
                  key={side}
                  onClick={() => setChoice(side)}
                  disabled={flipping}
                  aria-pressed={active}
                  className={`focus-ring flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded border px-3 py-3 font-sans transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    active
                      ? 'border-gold bg-gold/10 text-gold shadow-[inset_0_0_0_1px_rgba(201,162,75,0.4)]'
                      : 'border-border text-muted hover:border-border-strong hover:text-text'
                  }`}
                >
                  <span className={`h-9 w-9 ${active ? '' : 'opacity-70'}`}>
                    <CoinFace side={side} />
                  </span>
                  <span className="text-[13px] font-semibold">{SIDE_LABEL[side]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={flipping} />
          <Button variant="primary" onClick={flip} disabled={flipping || tooPoor} className="w-full">
            {flipping ? 'A lançar…' : tooPoor ? 'Saldo insuficiente' : `Lançar · ${formatAmount(stake)} tós`}
          </Button>
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>
      </div>
    </div>
  );
}
