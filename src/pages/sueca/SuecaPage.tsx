import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayingCardFace, type CardSize } from '@/components/PlayingCardFace';
import {
  deal,
  playTurn,
  collectTrick,
  legalMoves,
  suitOf,
  rankOf,
  cardLabel,
  SUIT_SYMBOLS,
  type SuecaState,
} from '@/features/sueca/sueca';

const HUMAN = 0;
const NAMES = ['Você', 'Bruno', 'Parceiro', 'Inês'];
const rng = () => Math.random();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Varied pause so the bots don't all play in lockstep (like the poker bots). */
const botDelay = () => 480 + Math.random() * 900;

/** A face-up card. */
function Card({ card, size = 'md' }: { card: number; size?: CardSize }) {
  return <PlayingCardFace rank={cardLabel(card)} suit={suitOf(card)} size={size} />;
}

/** Opponent's hidden hand as a little fan of backs. */
function Backs({ n }: { n: number }) {
  return (
    <div className="flex">
      {Array.from({ length: Math.min(n, 10) }).map((_, i) => (
        <span key={i} style={{ marginLeft: i === 0 ? 0 : -26 }}>
          <PlayingCardFace faceDown size="sm" />
        </span>
      ))}
    </div>
  );
}

function SeatTag({ seat, turn }: { seat: number; turn: number }) {
  const active = turn === seat;
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 font-sans text-[11px] font-medium transition-colors ${
        active ? 'animate-glow border-gold bg-gold/15 text-gold' : 'border-border-strong bg-black/45 text-muted'
      }`}
    >
      {NAMES[seat]}
    </span>
  );
}

export function SuecaPage() {
  const [state, setState] = useState<SuecaState>(() => deal(rng, 3));
  const [match, setMatch] = useState<[number, number]>([0, 0]);
  const stateRef = useRef(state);
  const running = useRef(false);
  const mounted = useRef(true);

  const apply = (s: SuecaState) => { stateRef.current = s; setState(s); };

  // Drive bot turns + trick collection with pauses until it's the human's turn.
  async function runLoop() {
    if (running.current) return;
    running.current = true;
    try {
      while (mounted.current) {
        const s = stateRef.current;
        if (s.done) break;
        if (s.trickComplete) { await sleep(1150); if (!mounted.current) break; apply(collectTrick(stateRef.current)); continue; }
        if (s.turn === HUMAN) break;
        await sleep(botDelay());
        if (!mounted.current) break;
        apply(playTurn(stateRef.current, HUMAN));
      }
    } finally {
      running.current = false;
    }
  }

  useEffect(() => {
    mounted.current = true;
    void runLoop();
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPlay(card: number) {
    const s = stateRef.current;
    if (s.turn !== HUMAN || s.trickComplete || s.done) return;
    const ledSuit = s.trick.length ? suitOf(s.trick[0]!.card) : null;
    if (!legalMoves(s.hands[HUMAN]!, ledSuit).includes(card)) return;
    apply(playTurn(s, HUMAN, card));
    void runLoop();
  }

  function nextHand() {
    const prev = stateRef.current;
    if (prev.result?.winner != null) {
      const w = prev.result.winner;
      setMatch((m) => { const nm: [number, number] = [m[0], m[1]]; nm[w] += prev.result!.games; return nm; });
    }
    apply(deal(rng, (prev.dealer + 1) % 4));
    void runLoop();
  }

  const ledSuit = state.trick.length ? suitOf(state.trick[0]!.card) : null;
  const myLegal = state.turn === HUMAN && !state.done ? legalMoves(state.hands[HUMAN]!, ledSuit) : [];
  const myHand = [...state.hands[HUMAN]!].sort((a, b) => suitOf(a) - suitOf(b) || rankOf(a) - rankOf(b));
  const trickCard = (seat: number) => state.trick.find((t) => t.player === seat)?.card;
  const myTurn = state.turn === HUMAN && !state.done && !state.trickComplete;

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link to="/sueca" className="font-sans text-sm text-muted-2 hover:text-text">← Sueca</Link>
          <h1 className="mt-1 font-display text-[28px] font-medium text-text sm:text-[32px]">Sueca · Contra bots</h1>
        </div>
        <div className="text-right">
          <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-2">Nós–Eles · Mão · Jogo</p>
          <p className="font-mono text-base text-text">
            <span className="text-positive">{state.captured[0]}</span>–<span className="text-negative">{state.captured[1]}</span>
            <span className="mx-1.5 text-muted-2">·</span>
            <span className="text-positive">{match[0]}</span>–<span className="text-negative">{match[1]}</span> jogos
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="felt felt-rail relative mx-auto h-[540px] w-full max-w-4xl overflow-hidden rounded-[28px] p-4 sm:h-[580px]">
        {/* Trump card on the felt */}
        <div className="absolute left-3 top-3 flex flex-col items-center gap-1">
          <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-gold-light">Trunfo {SUIT_SYMBOLS[state.trump]}</span>
          <span className="rotate-[-8deg] drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
            <Card card={state.trumpCard} size="lg" />
          </span>
        </div>

        {/* Partner (seat 2) top */}
        <div className="absolute left-1/2 top-3 -translate-x-1/2 flex flex-col items-center gap-1.5">
          <SeatTag seat={2} turn={state.turn} />
          <Backs n={state.hands[2]!.length} />
        </div>
        {/* Right opponent (seat 1) */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5">
          <SeatTag seat={1} turn={state.turn} />
          <Backs n={state.hands[1]!.length} />
        </div>
        {/* Left opponent (seat 3) */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5">
          <SeatTag seat={3} turn={state.turn} />
          <Backs n={state.hands[3]!.length} />
        </div>
        {/* You (seat 0) tag */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <SeatTag seat={0} turn={state.turn} />
        </div>

        {/* Trick — one slot per seat around the centre */}
        <div className="absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2">{trickCard(0) != null && <Card card={trickCard(0)!} size="lg" />}</div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2">{trickCard(1) != null && <Card card={trickCard(1)!} size="lg" />}</div>
          <div className="absolute left-1/2 top-0 -translate-x-1/2">{trickCard(2) != null && <Card card={trickCard(2)!} size="lg" />}</div>
          <div className="absolute left-0 top-1/2 -translate-y-1/2">{trickCard(3) != null && <Card card={trickCard(3)!} size="lg" />}</div>
        </div>

        {/* Result banner */}
        {state.done && state.result && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gold bg-bg/90 px-6 py-4 text-center shadow-[0_12px_50px_rgba(0,0,0,0.6)]">
            <p className="font-display text-2xl font-bold text-gold">
              {state.result.winner === null ? 'Empate (60–60)' : state.result.winner === 0 ? 'Ganhámos!' : 'Perdemos.'}
            </p>
            <p className="mt-1 font-sans text-sm text-muted">
              {state.result.teamAPoints}–{state.result.teamBPoints}
              {state.result.margin !== 'normal' && ` · ${state.result.margin === 'capote' ? 'Capote!' : 'Dupla'}`}
            </p>
            <button onClick={nextHand} className="focus-ring mt-3 rounded-full border border-gold px-4 py-1.5 font-sans text-sm text-gold hover:bg-gold hover:text-bg">
              Próxima mão
            </button>
          </div>
        )}
      </div>

      {/* Your hand */}
      <div className="mx-auto max-w-3xl">
        <p className="mb-2 text-center font-sans text-[11px] uppercase tracking-[0.2em] text-muted-2">
          {myTurn ? 'A sua vez — jogue uma carta' : state.done ? 'Mão terminada' : 'À espera…'}
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {myHand.map((card) => {
            const legal = myLegal.includes(card);
            return (
              <button
                key={card}
                onClick={() => onPlay(card)}
                disabled={!myTurn || !legal}
                className={`focus-ring rounded-md transition-transform ${
                  myTurn && legal ? 'hover:-translate-y-2 cursor-pointer' : 'cursor-not-allowed opacity-45'
                }`}
              >
                <Card card={card} size="lg" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
