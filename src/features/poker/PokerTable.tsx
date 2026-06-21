import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PokerCard } from './PokerCard';
import type { CardSize } from '@/components/PlayingCardFace';
import type { PokerView, PokerPlayerView } from './types';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount } from '@/lib/format';

/**
 * Poker table — a real oval felt with seats positioned around the rail, chip
 * stacks pushed in front of each seat, the community board + pot in the centre,
 * and the hero seat anchored at the bottom. The oval is used on tablet/desktop;
 * a refined stacked layout takes over on narrow phones. Pure presentation — all
 * game logic stays in the pages.
 */

const STATUS_LABEL: Record<string, string> = {
  active: 'ativo',
  folded: 'desistiu',
  allin: 'all-in',
  out: 'fora',
  waiting: 'à espera',
};

const STREET_LABEL: Record<string, string> = {
  idle: 'À espera de iniciar',
  preflop: 'Pré-flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
};

/** English hand names (from the engine) → Português. */
const HAND_PT: Record<string, string> = {
  'High card': 'Carta alta',
  Pair: 'Par',
  'Two pair': 'Dois pares',
  'Three of a kind': 'Trio',
  Straight: 'Sequência',
  Flush: 'Cor',
  'Full house': 'Full',
  'Four of a kind': 'Póquer',
  'Straight flush': 'Straight flush',
};
const handPt = (h: string | undefined) => (h ? HAND_PT[h] ?? h : undefined);

/** Two-letter monogram from a display name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** A little stack of chip discs representing committed chips, plus the amount. */
function ChipStack({ amount, className = '' }: { amount: number; className?: string }) {
  if (amount <= 0) return null;
  const discs = Math.min(5, 1 + Math.floor(Math.log10(amount + 1)));
  return (
    <span className={`pointer-events-none inline-flex items-center gap-1 ${className}`}>
      <span className="relative inline-block h-4 w-4" aria-hidden>
        {Array.from({ length: discs }).map((_, i) => (
          <span
            key={i}
            className="chip-disc absolute left-0 h-4 w-4 rounded-full text-chip-ruby ring-1 ring-black/30"
            style={{ bottom: `${i * 2}px` }}
          />
        ))}
      </span>
      <span className="rounded-full bg-black/55 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold tabular-nums text-gold-light shadow">
        {formatAmount(amount)}
      </span>
    </span>
  );
}

/** Dealer "D" button disc. */
function DealerButton({ className = '' }: { className?: string }) {
  return (
    <span
      className={`flex h-6 w-6 items-center justify-center rounded-full border border-gold bg-bg font-display text-[11px] font-bold text-gold shadow-[0_2px_6px_rgba(0,0,0,0.55)] ${className}`}
      title="Dealer"
      aria-label="Botão do dealer"
    >
      D
    </span>
  );
}

interface SeatProps {
  p: PokerPlayerView;
  isTurn: boolean;
  isYou: boolean;
  isButton: boolean;
  /** Bumped each new hand so dealt cards re-mount and animate in. */
  dealKey: number;
  /** Hole-card size; the hero gets bigger, easier-to-read cards. */
  cardSize?: CardSize;
  /** Made hand shown at showdown (already translated), e.g. "Full". */
  handLabel?: string | undefined;
}

/** Compact seat used on the oval (avatar + name/stack + hole cards). */
function OvalSeat({ p, isTurn, isYou, isButton, dealKey, cardSize = 'sm', handLabel }: SeatProps) {
  const folded = p.status === 'folded' || p.status === 'out';
  return (
    <div className={`relative flex ${isYou ? 'w-[136px]' : 'w-[112px]'} flex-col items-center ${folded ? 'opacity-50' : ''}`}>
      {isButton && <DealerButton className="absolute -right-1 -top-1 z-10 h-5 w-5 text-[10px]" />}
      {/* Hole cards sit just behind the plate (mucked when folded) */}
      <div className="mb-[-6px] flex gap-1">
        {folded || p.hole.length === 0
          ? null
          : p.hole.map((c, i) => (
              <span key={`${dealKey}-${i}`} className="animate-deal" style={{ animationDelay: `${i * 90}ms` }}>
                <PokerCard card={c} size={cardSize} />
              </span>
            ))}
      </div>
      <div
        className={[
          'flex w-full items-center gap-2 rounded-[8px] border px-2 py-1.5 backdrop-blur-sm transition-all duration-300',
          isTurn ? 'animate-glow border-gold bg-gold/15 ring-1 ring-gold/60' : 'border-border-strong bg-black/55',
        ].join(' ')}
    >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[12px] font-bold ${
            isYou ? 'bg-gold text-bg' : 'bg-surface text-gold ring-1 ring-gold/30'
          }`}
        >
          {initials(p.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-sans text-[11.5px] font-medium leading-tight text-text">{p.name}</span>
          <span className="flex items-center gap-1 font-mono text-[10.5px] leading-tight text-muted">
            <CoinIcon className="h-2.5 w-2.5" /> {formatAmount(p.stack)}
          </span>
        </span>
      </div>
      {handLabel ? (
        <span className="mt-0.5 rounded-full bg-gold/15 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-gold">
          {handLabel}
        </span>
      ) : (
        <span className="mt-0.5 font-sans text-[9px] uppercase tracking-[0.14em] text-muted-2">
          {STATUS_LABEL[p.status] ?? p.status}
        </span>
      )}
    </div>
  );
}

/** Fuller seat used in the mobile stacked layout. */
function StackedSeat({ p, isTurn, isYou, isButton, dealKey, cardSize = 'sm', handLabel }: SeatProps) {
  const folded = p.status === 'folded' || p.status === 'out';
  return (
    <div
      className={[
        'relative flex items-center gap-3 rounded-[8px] border px-3 py-2.5 transition-all',
        isTurn ? 'animate-glow border-gold bg-gold/10 ring-1 ring-gold/50' : 'border-border-strong bg-black/45',
        folded ? 'opacity-50' : '',
      ].join(' ')}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[13px] font-bold ${
          isYou ? 'bg-gold text-bg' : 'bg-surface text-gold ring-1 ring-gold/30'
        }`}
      >
        {initials(p.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-sans text-[13px] font-medium text-text">{p.name}</span>
          {isYou && <span className="text-[11px] text-muted">(você)</span>}
          {isButton && <DealerButton className="h-4 w-4 text-[9px]" />}
        </div>
        <span className="flex items-center gap-1 font-mono text-[11px] text-muted">
          <CoinIcon className="h-3 w-3" /> {formatAmount(p.stack)}
          {handLabel ? (
            <span className="ml-1 font-sans font-semibold uppercase tracking-wide text-gold">· {handLabel}</span>
          ) : (
            <span className="ml-1 text-muted-2">· {STATUS_LABEL[p.status] ?? p.status}</span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {p.committed > 0 && <ChipStack amount={p.committed} />}
        <div className="flex gap-0.5">
          {folded || p.hole.length === 0 ? (
            <span className="font-mono text-xs text-faint">—</span>
          ) : (
            p.hole.map((c, i) => (
              <span key={`${dealKey}-${i}`} className="animate-deal" style={{ animationDelay: `${i * 90}ms` }}>
                <PokerCard card={c} size={cardSize} />
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Pot pill with a chip + amount. */
function PotPill({ pot }: { pot: number }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-gold/30 bg-black/45 px-4 py-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
      <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Pote</span>
      <CoinIcon className="h-4 w-4" />
      <span className="font-mono text-base font-semibold tabular-nums text-gold-light">{formatAmount(pot)}</span>
    </div>
  );
}

/** Community cards row (with five dashed placeholders before the flop). */
function Board({ community, dealKey, compact }: { community: number[]; dealKey: number; compact?: boolean }) {
  const ph = compact ? 'h-[56px] w-[40px] rounded-[5px]' : 'h-[84px] w-[60px] rounded-[6px]';
  return (
    <div className="flex min-h-[60px] items-center justify-center gap-1 sm:min-h-[88px] sm:gap-2">
      {community.length === 0
        ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`${ph} border border-dashed border-gold/15`} aria-hidden />
          ))
        : community.map((c, i) => (
            <div key={`${dealKey}-${i}`} className="animate-deal" style={{ animationDelay: `${i * 80}ms` }}>
              <PokerCard card={c} small={!!compact} />
            </div>
          ))}
    </div>
  );
}

interface PokerTableProps {
  view: PokerView;
  /** The id that represents the local player ('you' for bots, user id for private). */
  youId: string;
  /** True when it is the local player's turn (drives the hero-seat highlight). */
  myTurn: boolean;
  /** Optional winner banner shown over the felt. */
  resultBanner?: ReactNode;
}

/**
 * Opponent rail positions (percent of the felt box) for 1–5 opponents. Hand-tuned
 * to spread evenly around the top arc, leaving the bottom for the hero.
 */
const RAIL: Record<number, { left: number; top: number }[]> = {
  1: [{ left: 50, top: 17 }],
  2: [{ left: 22, top: 21 }, { left: 78, top: 21 }],
  3: [{ left: 16, top: 33 }, { left: 50, top: 16 }, { left: 84, top: 33 }],
  4: [{ left: 13, top: 39 }, { left: 35, top: 18 }, { left: 65, top: 18 }, { left: 87, top: 39 }],
  5: [{ left: 11, top: 43 }, { left: 30, top: 20 }, { left: 50, top: 15 }, { left: 70, top: 20 }, { left: 89, top: 43 }],
  6: [{ left: 10, top: 46 }, { left: 24, top: 21 }, { left: 42, top: 14 }, { left: 58, top: 14 }, { left: 76, top: 21 }, { left: 90, top: 46 }],
  7: [{ left: 9, top: 50 }, { left: 18, top: 25 }, { left: 35, top: 15 }, { left: 50, top: 13 }, { left: 65, top: 15 }, { left: 82, top: 25 }, { left: 91, top: 50 }],
  8: [{ left: 9, top: 54 }, { left: 15, top: 29 }, { left: 29, top: 16 }, { left: 44, top: 13 }, { left: 56, top: 13 }, { left: 71, top: 16 }, { left: 85, top: 29 }, { left: 91, top: 54 }],
};

export function PokerTable({ view, youId, myTurn, resultBanner }: PokerTableProps) {
  const opponents = view.players.filter((p) => p.id !== youId);
  const you = view.players.find((p) => p.id === youId);
  const street = STREET_LABEL[view.street] ?? view.street;
  const rail = RAIL[Math.min(8, Math.max(1, opponents.length))] ?? RAIL[8]!;

  // At showdown the engine reveals each contender's made hand — show its name.
  const handById = new Map((view.result?.reveal ?? []).map((r) => [r.id, handPt(r.hand)]));

  // Bump a deal id whenever a fresh hand begins, so dealt cards re-mount and
  // animate in (keyed by index alone they would never re-run the animation).
  const [dealKey, setDealKey] = useState(0);
  const prevOver = useRef(true);
  useEffect(() => {
    if (!view.handOver && prevOver.current) setDealKey((d) => d + 1);
    prevOver.current = view.handOver;
  }, [view.handOver]);

  return (
    <div>
      {/* ---- Oval table (tablet / desktop) ---- */}
      <div className="hidden sm:block">
        <div className="felt felt-rail relative mx-auto aspect-[16/11] w-full max-w-3xl overflow-hidden rounded-[48%/60%] p-6">
          {/* Inner rail line for depth */}
          <div className="pointer-events-none absolute inset-4 rounded-[48%/60%] border border-gold/10" aria-hidden />
          <div className="pointer-events-none absolute inset-8 rounded-[48%/60%] border border-black/20" aria-hidden />

          {/* Centre: street label, pot, board, banner */}
          <div className="absolute left-1/2 top-1/2 flex w-[70%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2.5">
            <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-gold/80">{street}</span>
            <PotPill pot={view.pot} />
            <Board community={view.community} dealKey={dealKey} />
          </div>

          {/* Winner banner — floated in the clear band above the board so it never
              collides with the hero's hole cards (and on top of everything). */}
          {resultBanner && (
            <div className="pointer-events-none absolute left-1/2 top-[30%] z-40 -translate-x-1/2 -translate-y-1/2">
              {resultBanner}
            </div>
          )}

          {/* Opponent seats around the rail */}
          {opponents.map((p, i) => {
            const pos = rail[i] ?? rail[rail.length - 1]!;
            return (
              <div
                key={p.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
              >
                <OvalSeat p={p} isTurn={view.toActId === p.id && !view.handOver} isYou={false} isButton={view.button === p.id} dealKey={dealKey} handLabel={handById.get(p.id)} />
                {p.committed > 0 && (
                  <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2">
                    <ChipStack amount={p.committed} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Hero seat at the bottom centre */}
          {you && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
              {you.committed > 0 && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                  <ChipStack amount={you.committed} />
                </div>
              )}
              <OvalSeat p={you} isTurn={myTurn} isYou isButton={view.button === youId} dealKey={dealKey} cardSize="lg" handLabel={handById.get(you.id)} />
            </div>
          )}
        </div>
      </div>

      {/* ---- Stacked layout (phones) ---- */}
      <div className="sm:hidden">
        <div className="felt felt-rail relative space-y-2.5 overflow-hidden rounded-[18px] p-4">
          <div className="space-y-2">
            {opponents.map((p) => (
              <StackedSeat
                key={p.id}
                p={p}
                isTurn={view.toActId === p.id && !view.handOver}
                isYou={false}
                isButton={view.button === p.id}
                dealKey={dealKey}
                handLabel={handById.get(p.id)}
              />
            ))}
          </div>

          <div className="flex flex-col items-center gap-2.5 py-3">
            <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-gold/80">{street}</span>
            <PotPill pot={view.pot} />
            <Board community={view.community} dealKey={dealKey} compact />
            {resultBanner}
          </div>

          {you && <StackedSeat p={you} isTurn={myTurn} isYou isButton={view.button === youId} dealKey={dealKey} cardSize="md" handLabel={handById.get(you.id)} />}
        </div>
      </div>
    </div>
  );
}

/** Winner banner shared by both pages. */
export function ResultBanner({ view }: { view: PokerView }) {
  if (!view.result) return null;
  const text = view.result.winners
    .map((w) => {
      const name = view.players.find((p) => p.id === w.id)?.name ?? w.id;
      return `${name} ganha ${formatAmount(w.amount)}`;
    })
    .join(' · ');
  return (
    <p
      className="animate-pop whitespace-nowrap rounded-full border border-gold/50 bg-[#0c0b08] px-5 py-2 text-center font-display text-sm font-bold text-gold shadow-[0_8px_28px_rgba(0,0,0,0.6)] ring-1 ring-gold/20"
    >
      🏆 {text}
    </p>
  );
}
