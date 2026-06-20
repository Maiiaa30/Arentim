import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useHiloDeal, useHiloBet } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { PlayingCardFace } from '@/components/PlayingCardFace';
import { hiloAdaptedMult, type HiLoPick } from '@/features/casino/miniGames';
import type { HiloDealResult } from '@/types/db';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

// hi-lo number 1..13 → card rank (2 lowest … A highest), with a cosmetic suit.
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const rankOf = (n: number) => RANKS[n - 1] ?? '?';
const randSuit = () => Math.floor(Math.random() * 4);

/** Round meta (current rung + its adapted odds) for a starting number. */
function roundFor(n: number): HiloDealResult {
  return {
    current: n,
    sobe_count: 13 - n,
    desce_count: n - 1,
    sobe_mult: hiloAdaptedMult(13 - n),
    desce_mult: hiloAdaptedMult(n - 1),
  };
}

export function SobeDescePage() {
  const { data: profile } = useProfile();
  const deal = useHiloDeal();
  const bet = useHiloBet();
  const [stake, setStake] = useState(25);
  const [round, setRound] = useState<HiloDealResult | null>(null);
  const [curSuit, setCurSuit] = useState(0);
  const [reveal, setReveal] = useState<{ n: number; suit: number; won: boolean; payout: number; mult: number; dir: 'sobe' | 'desce' } | null>(null);
  const [rolling, setRolling] = useState(false);
  const [spinId, setSpinId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const balance = profile?.balance ?? 0;
  const tooPoor = stake > balance;

  const dealNew = useCallback(async () => {
    setError(null);
    setReveal(null);
    try {
      const r = await deal.mutateAsync();
      setRound(r);
      setCurSuit(randSuit());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível baralhar.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void dealNew(); }, [dealNew]);
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  async function play(pick: HiLoPick) {
    if (rolling || tooPoor || !round) return;
    setError(null);
    setReveal(null);
    setRolling(true);
    try {
      const res = await bet.mutateAsync({ stake, pick });
      const nextSuit = randSuit();
      timers.current.push(
        window.setTimeout(() => {
          setReveal({ n: res.next, suit: nextSuit, won: res.won, payout: res.payout, mult: res.mult, dir: res.next > res.current ? 'sobe' : 'desce' });
          setRolling(false);
          if (res.won) setSpinId((n) => n + 1);
          // Chain: after a beat, the drawn card becomes the new current card.
          timers.current.push(
            window.setTimeout(() => {
              setRound(roundFor(res.next));
              setCurSuit(nextSuit);
              setReveal(null);
            }, 1900),
          );
        }, 450),
      );
    } catch (e) {
      setRolling(false);
      setError(e instanceof Error ? e.message : 'A jogada falhou.');
    }
  }

  const current = round?.current ?? 7;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Sobe e Desce</h1>
        <p className="mt-2 font-sans text-sm text-muted">Sai uma carta. Aposte se a próxima é maior ou menor — quanto mais difícil o lado, mais paga.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        {/* ---- Game ---- */}
        <div className="felt felt-rail relative overflow-hidden rounded-lg px-5 py-10 sm:px-8">
          {reveal?.won && <WinCelebration key={spinId} />}
          <div className="flex items-center justify-center gap-6 sm:gap-10">
            {/* Current card */}
            <div className="flex flex-col items-center gap-2">
              <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-2">Carta atual</span>
              <PlayingCardFace rank={rankOf(current)} suit={curSuit} size="xl" />
            </div>
            {/* Next card */}
            <div className="flex flex-col items-center gap-2">
              <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-2">Próxima</span>
              {reveal ? (
                <div className="animate-pop">
                  <PlayingCardFace rank={rankOf(reveal.n)} suit={reveal.suit} size="xl" />
                </div>
              ) : (
                <PlayingCardFace faceDown size="xl" />
              )}
            </div>
          </div>

          <div className="mt-7 flex min-h-[2.5rem] items-center justify-center px-2 text-center">
            {rolling ? (
              <p className="animate-pulse font-display text-lg italic text-gold-light">A virar…</p>
            ) : reveal ? (
              reveal.won ? (
                <p className="animate-pop font-display text-xl font-bold text-positive">
                  {reveal.dir === 'sobe' ? 'Subiu' : 'Desceu'} — ganhou {formatAmount(reveal.payout)} tós! ({reveal.mult}×)
                </p>
              ) : (
                <p className="font-sans text-sm text-muted">{reveal.dir === 'sobe' ? 'Subiu' : 'Desceu'} — não foi desta.</p>
              )
            ) : (
              <p className="font-sans text-sm text-muted-2">Maior ou menor que {rankOf(current)}?</p>
            )}
          </div>
        </div>

        {/* ---- Bet ---- */}
        <div className="card space-y-5 p-5 sm:p-6">
          <div>
            <p className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-2">Aposta</p>
            <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={rolling} />
          </div>
          <div className="space-y-2.5">
            <button
              onClick={() => play('sobe')}
              disabled={rolling || tooPoor || !round || round.sobe_count === 0}
              className="focus-ring flex w-full items-center justify-between rounded-lg border border-positive/40 bg-positive-felt/20 px-4 py-3.5 transition-colors hover:bg-positive-felt/30 disabled:opacity-40"
            >
              <span className="flex flex-col items-start">
                <span className="font-display text-lg font-bold text-positive">▲ Maior</span>
                <span className="font-sans text-[11px] text-muted-2">{round?.sobe_count ?? 0} cartas acima</span>
              </span>
              <span className="font-mono text-xl font-bold text-gold-light">{round ? round.sobe_mult : 0}×</span>
            </button>
            <button
              onClick={() => play('desce')}
              disabled={rolling || tooPoor || !round || round.desce_count === 0}
              className="focus-ring flex w-full items-center justify-between rounded-lg border border-negative/40 bg-negative/10 px-4 py-3.5 transition-colors hover:bg-negative/20 disabled:opacity-40"
            >
              <span className="flex flex-col items-start">
                <span className="font-display text-lg font-bold text-negative">▼ Menor</span>
                <span className="font-sans text-[11px] text-muted-2">{round?.desce_count ?? 0} cartas abaixo</span>
              </span>
              <span className="font-mono text-xl font-bold text-gold-light">{round ? round.desce_mult : 0}×</span>
            </button>
          </div>
          <p className="font-sans text-[11px] text-muted-2">A carta seguinte passa a ser a atual. O lado menos provável paga mais.</p>
          {tooPoor && <p className="font-sans text-sm text-negative">Saldo insuficiente para esta aposta.</p>}
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>
      </div>
    </div>
  );
}
