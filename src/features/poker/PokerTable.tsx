import type { ReactNode } from 'react';
import { PokerCard } from './PokerCard';
import type { PokerView, PokerPlayerView } from './types';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount } from '@/lib/format';

/**
 * Presentational poker table — a green felt oval with opponent seats arranged
 * around the top/sides, the community board + pot in the centre, and the
 * player's seat below. Pure JSX/style; all game logic stays in the pages.
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

/** A bet/commit chip badge — small disc + amount, shown when a seat has chips in. */
function CommitChip({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-black/40 px-2 py-0.5 font-mono text-[11px] tabular-nums text-gold-light">
      <span
        className="chip-disc inline-block h-3 w-3 shrink-0 rounded-full text-chip-ruby"
        aria-hidden
      />
      {formatAmount(amount)}
    </span>
  );
}

interface SeatProps {
  p: PokerPlayerView;
  isTurn: boolean;
  isYou: boolean;
  isButton: boolean;
  big?: boolean;
}

export function Seat({ p, isTurn, isYou, isButton, big = false }: SeatProps) {
  const folded = p.status === 'folded';
  return (
    <div
      className={[
        'relative rounded-[6px] border px-3 py-2.5 backdrop-blur-sm transition-all duration-300',
        isTurn
          ? 'animate-glow border-gold bg-gold/10 ring-1 ring-gold/60'
          : 'border-border-strong bg-black/45',
        folded ? 'opacity-45' : '',
        big ? 'w-full' : '',
      ].join(' ')}
    >
      {isButton && (
        <span
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-gold bg-bg font-display text-[11px] font-bold text-gold shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
          title="Dealer"
          aria-label="Botão do dealer"
        >
          D
        </span>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-sans text-[13px] font-medium text-text">
          {p.name}
          {isYou && <span className="text-muted"> (você)</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-muted">
          <CoinIcon className="h-3 w-3" /> {formatAmount(p.stack)}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <div className="flex gap-1">
          {p.hole.length === 0 ? (
            <span className="font-mono text-xs text-faint">—</span>
          ) : (
            p.hole.map((c, i) => <PokerCard key={i} card={c} small />)
          )}
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <span className="font-sans text-[10px] uppercase tracking-[0.12em] text-muted-2">
            {STATUS_LABEL[p.status] ?? p.status}
          </span>
          {p.committed > 0 && <CommitChip amount={p.committed} />}
        </div>
      </div>
    </div>
  );
}

interface PokerTableProps {
  view: PokerView;
  /** The id that represents the local player ('you' for bots, user id for private). */
  youId: string;
  /** True when it is the local player's turn (drives the bottom-seat highlight). */
  myTurn: boolean;
  /** Optional winner banner shown over the felt. */
  resultBanner?: ReactNode;
}

export function PokerTable({ view, youId, myTurn, resultBanner }: PokerTableProps) {
  const opponents = view.players.filter((p) => p.id !== youId);
  const you = view.players.find((p) => p.id === youId);
  const street = STREET_LABEL[view.street] ?? view.street;

  return (
    <div className="felt felt-rail relative overflow-hidden rounded-[20px] p-4 sm:rounded-[120px] sm:p-7">
      {/* Opponent seats — wrap row on desktop, stacked on mobile. */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {opponents.map((p) => (
          <Seat
            key={p.id}
            p={p}
            isTurn={view.toActId === p.id && !view.handOver}
            isYou={false}
            isButton={view.button === p.id}
          />
        ))}
      </div>

      {/* Centre: pot + community board. */}
      <div className="my-5 flex flex-col items-center gap-3 sm:my-7">
        <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-gold/80">{street}</span>

        <div className="flex items-center gap-2 rounded-full border border-gold/30 bg-black/40 px-4 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.4)]">
          <span className="font-sans text-[11px] uppercase tracking-[0.16em] text-muted-2">Pote</span>
          <CoinIcon className="h-4 w-4" />
          <span className="font-mono text-base font-semibold tabular-nums text-gold-light">
            {formatAmount(view.pot)}
          </span>
        </div>

        <div className="flex min-h-[64px] items-center gap-1.5 sm:gap-2">
          {view.community.length === 0 ? (
            // Five face-down placeholders so the board never looks empty.
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 w-[46px] rounded-[5px] border border-dashed border-gold/15"
                aria-hidden
              />
            ))
          ) : (
            view.community.map((c, i) => (
              <div key={i} className="animate-pop" style={{ animationDelay: `${i * 60}ms` }}>
                <PokerCard card={c} />
              </div>
            ))
          )}
        </div>

        {resultBanner}
      </div>

      {/* Your seat. */}
      {you && (
        <div className="mx-auto max-w-sm">
          <Seat
            p={you}
            isTurn={myTurn}
            isYou
            isButton={view.button === youId}
            big
          />
        </div>
      )}
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
    <p className="animate-pop rounded-full border border-positive/40 bg-positive-felt/30 px-4 py-1.5 text-center font-sans text-sm font-semibold text-positive">
      {text}
    </p>
  );
}
