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

export function CoinflipPage() {
  const { data: profile } = useProfile();
  const coinflip = useCoinflip();
  const [stake, setStake] = useState(25);
  const [choice, setChoice] = useState<CoinSide>('heads');
  const [outcome, setOutcome] = useState<CoinSide | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [rotation, setRotation] = useState(0); // accumulated rotateX degrees
  const [spinId, setSpinId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const balance = profile?.balance ?? 0;

  async function flip() {
    if (flipping || stake > balance) return;
    setError(null);
    setOutcome(null);
    setWon(null);
    setFlipping(true);
    try {
      const res = await coinflip.mutateAsync({ stake, choice });
      // Land the coin on the real outcome: several full turns, ending on the
      // heads (0°) or tails (180°) face. Always rotate forward from here.
      setRotation((r) => {
        const base = r + 360 * 5;
        const faceTarget = res.outcome === 'heads' ? 0 : 180;
        const aligned = base - (base % 360) + faceTarget;
        return aligned <= r ? aligned + 360 : aligned;
      });
      timer.current = window.setTimeout(() => {
        setOutcome(res.outcome);
        setWon(res.won);
        setFlipping(false);
        if (res.won) setSpinId((n) => n + 1);
      }, 1000);
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
        <h1 className="mt-2 font-display text-[38px] font-medium leading-tight text-text">Moeda</h1>
        <p className="mt-2 font-sans text-sm text-muted">Dobro ou nada — acerte na chamada e dobre a aposta.</p>
      </div>

      {/* Felt stage */}
      <div className="felt felt-rail relative mx-auto max-w-md overflow-hidden rounded-lg p-8 text-center">
        {won && <WinCelebration key={spinId} />}

        <div className="flex h-36 items-center justify-center [perspective:700px]">
          <div
            className="relative h-28 w-28 [transform-style:preserve-3d]"
            style={{ transform: `rotateX(${rotation}deg)`, transition: 'transform 1s cubic-bezier(0.2,0.7,0.2,1)' }}
          >
            {/* Heads (Cara) */}
            <div
              className="absolute inset-0 flex items-center justify-center rounded-full border-4 border-gold-light font-display text-3xl font-bold text-bg [backface-visibility:hidden]"
              style={{ background: 'radial-gradient(circle at 35% 30%, #f7e4ad, #C9A24B 60%, #8a6c2c)' }}
            >
              C
            </div>
            {/* Coroa (tails) — pre-rotated to the back face */}
            <div
              className="absolute inset-0 flex items-center justify-center rounded-full border-4 border-gold-light text-4xl [backface-visibility:hidden] [transform:rotateX(180deg)]"
              style={{ background: 'radial-gradient(circle at 35% 30%, #f7e4ad, #B68A2E 60%, #6b542a)' }}
            >
              👑
            </div>
          </div>
        </div>

        <div className="mt-2 flex h-7 items-center justify-center">
          {flipping ? (
            <p className="font-sans text-sm text-muted">A girar no ar…</p>
          ) : won !== null ? (
            won ? (
              <p className="animate-pop font-display text-lg font-bold text-positive">
                {outcome && SIDE_LABEL[outcome]} — ganhou {formatAmount(stake * 2)} Tostões!
              </p>
            ) : (
              <p className="font-sans text-sm text-muted">
                Saiu {outcome && SIDE_LABEL[outcome]} — mais sorte para a próxima.
              </p>
            )
          ) : (
            <p className="font-sans text-sm text-muted-2">Escolha um lado e lance.</p>
          )}
        </div>
      </div>

      <div className="card mx-auto max-w-md space-y-5 p-6">
        <div className="flex justify-center gap-2">
          {(['heads', 'tails'] as const).map((side) => (
            <button
              key={side}
              onClick={() => setChoice(side)}
              disabled={flipping}
              className={`focus-ring flex flex-1 items-center justify-center gap-2 rounded border px-4 py-2.5 font-sans text-sm font-semibold transition-colors disabled:opacity-50 ${
                choice === side ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted hover:text-text'
              }`}
            >
              <span className="text-base">{side === 'heads' ? '🪙' : '👑'}</span>
              {SIDE_LABEL[side]}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={flipping} />
          <Button variant="primary" onClick={flip} disabled={flipping || stake > balance} className="w-full">
            {flipping ? 'A lançar…' : `Lançar · ${formatAmount(stake)}`}
          </Button>
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>
      </div>
    </div>
  );
}
