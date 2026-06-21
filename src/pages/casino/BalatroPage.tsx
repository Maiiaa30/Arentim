import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useBalatroStart, useBalatroPlay, useBalatroDiscard, useBalatroCurrent } from '@/features/casino/useBalatro';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';
import { PlayingCardFace } from '@/components/PlayingCardFace';
import { HAND_TABLE, scorePlay, cardRank, cardSuit, type HandType } from '@/features/casino/balatro';

const RANK_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const HAND_NAMES: Record<HandType, string> = {
  high_card: 'Carta Alta',
  pair: 'Par',
  two_pair: 'Dois Pares',
  three_of_a_kind: 'Trio',
  straight: 'Sequência',
  flush: 'Cor',
  full_house: 'Full House',
  four_of_a_kind: 'Póquer',
  straight_flush: 'Sequência de Cor',
};

const LEGEND_ORDER: HandType[] = [
  'high_card', 'pair', 'two_pair', 'three_of_a_kind', 'straight',
  'flush', 'full_house', 'four_of_a_kind', 'straight_flush',
];

type Round = {
  hand: number[];
  target: number;
  score: number;
  handsLeft: number;
  discardsLeft: number;
};

export function BalatroPage() {
  const { data: profile } = useProfile();
  const start = useBalatroStart();
  const play = useBalatroPlay();
  const discard = useBalatroDiscard();
  const current = useBalatroCurrent();

  const [stake, setStake] = useState(25);
  const [phase, setPhase] = useState<'idle' | 'playing' | 'done'>('idle');
  const [round, setRound] = useState<Round | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [pop, setPop] = useState<{ type: string; gained: number; id: number } | null>(null);
  const [result, setResult] = useState<{ won: boolean; payout: number; score: number; target: number } | null>(null);
  const [winId, setWinId] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const balance = profile?.balance ?? 0;
  const busy = start.isPending || play.isPending || discard.isPending;

  // Resume an in-progress round on mount.
  useEffect(() => {
    const s = current.data;
    if (phase === 'idle' && s) {
      setRound({ hand: s.hand, target: s.target, score: s.score, handsLeft: s.hands_left, discardsLeft: s.discards_left });
      setPhase('playing');
    }
  }, [current.data, phase]);

  // Live preview of the currently-selected hand.
  const preview = selected.length > 0 ? scorePlay(selected) : null;

  function toggle(card: number) {
    if (phase !== 'playing' || busy) return;
    setSelected((cur) => {
      if (cur.includes(card)) return cur.filter((c) => c !== card);
      if (cur.length >= 5) return cur;
      return [...cur, card];
    });
  }

  async function begin() {
    setError(null);
    if (stake > balance) { setError('Saldo insuficiente.'); return; }
    try {
      const s = await start.mutateAsync(stake);
      setRound({ hand: s.hand, target: s.target, score: s.score, handsLeft: s.hands_left, discardsLeft: s.discards_left });
      setSelected([]); setPop(null); setResult(null); setPhase('playing');
    } catch {
      setError('Não foi possível começar.');
    }
  }

  async function playSelected() {
    if (phase !== 'playing' || busy || selected.length === 0) return;
    try {
      const r = await play.mutateAsync(selected);
      setPop({ type: r.hand_type, gained: r.gained, id: Date.now() });
      setSelected([]);
      if (r.status === 'won') {
        setResult({ won: true, payout: r.payout, score: r.score, target: round?.target ?? 0 });
        setPhase('done'); setWinId((n) => n + 1);
        return;
      }
      if (r.status === 'lost') {
        setResult({ won: false, payout: 0, score: r.score, target: round?.target ?? 0 });
        setPhase('done');
        return;
      }
      setRound((cur) => cur && { ...cur, hand: r.hand, score: r.score, handsLeft: r.hands_left, discardsLeft: r.discards_left });
    } catch {
      setError('Jogada inválida.');
    }
  }

  async function discardSelected() {
    if (phase !== 'playing' || busy || selected.length === 0) return;
    if ((round?.discardsLeft ?? 0) <= 0) return;
    try {
      const r = await discard.mutateAsync(selected);
      setSelected([]); setPop(null);
      setRound((cur) => cur && { ...cur, hand: r.hand, discardsLeft: r.discards_left });
    } catch {
      setError('Descarte inválido.');
    }
  }

  function reset() {
    setPhase('idle'); setRound(null); setSelected([]); setPop(null); setResult(null); setError(null);
  }

  const pct = round ? Math.min(100, Math.round((round.score / round.target) * 100)) : 0;

  return (
    <div className="animate-fade-in space-y-6">
      {result?.won && <WinCelebration key={winId} jackpot={result.payout >= stake * 2} />}

      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Balatró</h1>
        <p className="mt-2 font-sans text-sm text-muted">
          Forma a melhor mão de póquer com as cartas que escolheres. Tens 4 mãos para chegar à pontuação-alvo
          e 3 descartes para melhorar o teu baralho. Cada mão pontua{' '}
          <span className="text-gold">(chips base + cartas que formam a mão) × multiplicador</span> — só contam as
          cartas que fazem a combinação.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
        {/* Side panel: score / controls / legend */}
        <div className="card space-y-4 p-5 lg:sticky lg:top-[88px]">
          {round ? (
            <>
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Pontuação</p>
                  <p className="font-mono text-3xl font-bold tabular-nums text-gold">{round.score}</p>
                </div>
                <div className="text-right">
                  <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Alvo</p>
                  <p className="font-mono text-xl tabular-nums text-muted">{round.target}</p>
                </div>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold transition-[width] duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between font-sans text-sm text-muted">
                <span>Mãos: <span className="font-mono text-text">{round.handsLeft}</span></span>
                <span>Descartes: <span className="font-mono text-text">{round.discardsLeft}</span></span>
              </div>
            </>
          ) : (
            <>
              <StakeChips stake={stake} onChange={setStake} balance={balance} />
              <Button variant="primary" onClick={begin} disabled={busy || stake > balance} className="w-full">
                {stake > balance ? 'Saldo insuficiente' : `Jogar mão · ${formatAmount(stake)} tós`}
              </Button>
            </>
          )}

          {phase === 'done' && result && (
            <div className="text-center">
              <p className={`font-display text-sm font-bold ${result.won ? 'text-positive' : 'text-negative'}`}>
                {result.won
                  ? `Ganhaste ${formatAmount(result.payout)} tós!`
                  : `Não chegaste — ${result.score} / ${result.target}.`}
              </p>
              <Button variant="primary" onClick={reset} className="mt-3 w-full">Nova mão</Button>
            </div>
          )}

          {error && <p className="font-sans text-sm text-negative">{error}</p>}

          {/* Legend */}
          <div className="border-t border-border/60 pt-3">
            <p className="mb-2 font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Como pontua</p>
            <ul className="space-y-1">
              {LEGEND_ORDER.map((h) => (
                <li key={h} className="flex items-center justify-between font-sans text-[12px] text-muted">
                  <span>{HAND_NAMES[h]}</span>
                  <span className="font-mono tabular-nums text-text/80">
                    {HAND_TABLE[h].base} <span className="text-muted-2">×</span> {HAND_TABLE[h].mult}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Table */}
        <div className="felt felt-rail relative space-y-5 rounded-lg p-4 sm:p-6">
          {/* Score pop */}
          {pop && (
            <div key={pop.id} className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
              <span className="animate-fade-in rounded-full bg-bg/80 px-4 py-1.5 font-display text-lg font-bold text-gold shadow-lg ring-1 ring-gold/40">
                {HAND_NAMES[pop.type as HandType] ?? pop.type} · +{pop.gained}
              </span>
            </div>
          )}

          {round ? (
            <>
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                {round.hand.map((card) => {
                  const isSel = selected.includes(card);
                  return (
                    <button
                      key={card}
                      onClick={() => toggle(card)}
                      disabled={phase !== 'playing' || busy || (!isSel && selected.length >= 5)}
                      className={`focus-ring rounded-md transition-transform ${isSel ? '-translate-y-3 ring-2 ring-gold' : 'hover:-translate-y-1.5'} disabled:cursor-not-allowed`}
                      aria-pressed={isSel}
                    >
                      <PlayingCardFace rank={RANK_LABELS[cardRank(card)]} suit={cardSuit(card)} size="xl" />
                    </button>
                  );
                })}
              </div>

              <div className="min-h-[1.5rem] text-center">
                {preview ? (
                  <p className="font-sans text-sm text-muted">
                    {HAND_NAMES[preview.type]} · <span className="font-mono text-gold">+{preview.gained}</span>
                  </p>
                ) : phase === 'playing' ? (
                  <p className="font-sans text-sm text-muted-2">Escolhe 1 a 5 cartas.</p>
                ) : null}
              </div>

              {phase === 'playing' && (
                <div className="mx-auto flex max-w-md gap-3">
                  <Button
                    variant="secondary"
                    onClick={discardSelected}
                    disabled={busy || selected.length === 0 || round.discardsLeft <= 0}
                    className="flex-1"
                  >
                    Descartar ({round.discardsLeft})
                  </Button>
                  <Button variant="primary" onClick={playSelected} disabled={busy || selected.length === 0} className="flex-1">
                    Jogar
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-[180px] items-center justify-center text-center font-sans text-sm text-muted-2">
              Faz a tua aposta para receber 8 cartas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
