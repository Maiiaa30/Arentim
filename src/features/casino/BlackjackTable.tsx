import type { ReactNode } from 'react';
import { cardRank, cardSuit, RANK_LABELS } from './blackjack';
import { PlayingCardFace, type CardSize } from '@/components/PlayingCardFace';
import { Chip } from './Chip';
import { formatAmount } from '@/lib/format';
import type { BlackjackView } from '@/types/db';

/**
 * Blackjack felt table — pure presentation for the {@link BlackjackView} state.
 * A proper baize table with a dealer zone up top, a gilded "BLACKJACK PAYS 3:2"
 * arc through the middle, and the player's hand(s) plus a bet spot at the
 * bottom. Cards animate in with a staggered pop. All game logic stays in the
 * page; this component only draws what it's handed.
 */

const outcome: Record<string, { text: string; ring: string; badge: string }> = {
  win: { text: 'Ganhou', ring: 'ring-positive/60', badge: 'bg-positive/15 text-positive' },
  blackjack: { text: 'Blackjack!', ring: 'ring-gold/70', badge: 'bg-gold/20 text-gold' },
  push: { text: 'Empate', ring: 'ring-border', badge: 'bg-white/10 text-muted' },
  lose: { text: 'Perdeu', ring: 'ring-negative/50', badge: 'bg-negative/15 text-negative' },
  busted: { text: 'Rebentou', ring: 'ring-negative/50', badge: 'bg-negative/15 text-negative' },
};

/** A single card, sized for the table, that pops in as it's dealt. */
function TableCard({ card, i, size }: { card: number | null; i: number; size: CardSize }) {
  return (
    <span
      className="inline-block animate-pop drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)]"
      style={{ animationDelay: `${i * 80}ms` }}
    >
      {card === null ? (
        <PlayingCardFace faceDown size={size} />
      ) : (
        <PlayingCardFace rank={RANK_LABELS[cardRank(card)]} suit={cardSuit(card)} size={size} />
      )}
    </span>
  );
}

/** Pill showing a hand's running total, tinted by the hand's final status. */
function TotalBadge({ total, status }: { total: number | null; status?: string | undefined }) {
  const oc = status ? outcome[status] : undefined;
  return (
    <span
      className={`inline-flex h-9 min-w-[36px] items-center justify-center rounded-full px-3 font-mono text-base font-bold tabular-nums shadow-[0_2px_6px_rgba(0,0,0,0.5)] ring-1 ring-inset ${
        oc ? oc.badge : 'bg-black/55 text-gold-light ring-gold/30'
      }`}
    >
      {total ?? '—'}
    </span>
  );
}

/** The empty bet spot drawn on the felt — fills with a chip stack once staked. */
function BetSpot({ stake, dimmed }: { stake: number; dimmed?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 transition-opacity ${dimmed ? 'opacity-40' : ''}`}
    >
      <div className="relative flex h-[58px] w-[58px] items-center justify-center rounded-full border border-dashed border-gold/45 bg-black/20">
        {stake > 0 ? (
          <Chip value={stake} size={52} />
        ) : (
          <span className="font-display text-[11px] uppercase tracking-[0.18em] text-gold/55">
            Aposta
          </span>
        )}
      </div>
      {stake > 0 && (
        <span className="font-mono text-xs font-semibold tabular-nums text-gold-light">
          {formatAmount(stake)}
        </span>
      )}
    </div>
  );
}

interface BlackjackTableProps {
  view: BlackjackView | null;
  /** True while it's the player's turn (drives the active-hand highlight). */
  inPlay: boolean;
  /** Pending stake shown in the bet spot before any cards are dealt. */
  pendingStake: number;
  /** Rendered inside the centre of the table (e.g. result text + actions). */
  children?: ReactNode;
}

export function BlackjackTable({ view, inPlay, pendingStake, children }: BlackjackTableProps) {
  const dealerCards = view?.dealer ?? [];
  const complete = view?.status === 'complete';

  return (
    <div className="felt felt-rail relative overflow-hidden rounded-2xl px-3 py-6 sm:px-6 sm:py-8">
      {/* Soft spotlight from the top of the table */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{ background: 'radial-gradient(70% 100% at 50% 0%, rgba(243,220,160,0.10), transparent 70%)' }}
        aria-hidden
      />

      {/* Dealer zone */}
      <div className="relative flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="font-display text-xs uppercase tracking-[0.28em] text-gold/70">Croupier</span>
          {view && (view.dealer_total !== null || dealerCards.length > 0) && (
            <TotalBadge total={view.dealer_total} />
          )}
        </div>
        <div className="flex min-h-[140px] items-center justify-center gap-2 sm:gap-2.5">
          {view ? (
            <>
              {dealerCards.map((c, i) => (
                <TableCard key={i} card={c} i={i} size="xl" />
              ))}
              {view.dealer_hidden && <TableCard card={null} i={dealerCards.length} size="xl" />}
            </>
          ) : (
            <span className="font-sans text-sm text-emerald-100/30">À espera da jogada</span>
          )}
        </div>
      </div>

      {/* Centre arc — house rules */}
      <div className="relative my-5 flex flex-col items-center gap-1.5">
        <div className="flex w-full max-w-md items-center gap-3">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/40" />
          <span className="font-display text-[13px] font-semibold uppercase tracking-[0.22em] text-gold-light/90">
            Blackjack paga 3:2
          </span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/40" />
        </div>
        <span className="font-sans text-[11px] uppercase tracking-[0.18em] text-emerald-100/45">
          O croupier pára nos 17
        </span>
      </div>

      {/* Player zone */}
      <div className="relative flex flex-col items-center gap-4">
        {view ? (
          <div
            className={`flex w-full flex-wrap items-start justify-center gap-x-6 gap-y-5 ${
              view.hands.length > 1 ? 'sm:gap-x-10' : ''
            }`}
          >
            {view.hands.map((hand, i) => {
              const isActive = inPlay && i === view.active;
              const oc = complete ? outcome[hand.status] : undefined;
              const cardSize: CardSize = view.hands.length > 1 ? 'lg' : 'xl';
              return (
                <div
                  key={i}
                  className={`flex flex-col items-center gap-2.5 rounded-2xl p-3 transition-all ${
                    isActive
                      ? 'bg-gold/[0.06] ring-2 ring-gold/55 shadow-[0_0_24px_rgba(201,162,75,0.18)]'
                      : oc
                        ? `ring-2 ${oc.ring}`
                        : 'ring-1 ring-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {view.hands.length > 1 && (
                      <span className="font-display text-[11px] uppercase tracking-[0.2em] text-gold/65">
                        Mão {i + 1}
                      </span>
                    )}
                    <TotalBadge total={hand.total} status={complete ? hand.status : undefined} />
                  </div>
                  <div className="flex min-h-[136px] items-center justify-center gap-2">
                    {hand.cards.map((c, j) => (
                      <TableCard key={j} card={c} i={j} size={cardSize} />
                    ))}
                  </div>
                  {oc && (
                    <span
                      className={`rounded-full px-3 py-1 font-display text-sm font-bold ${oc.badge}`}
                    >
                      {oc.text}
                    </span>
                  )}
                  <BetSpot stake={hand.stake} dimmed={complete && hand.status === 'lose'} />
                </div>
              );
            })}
          </div>
        ) : (
          <BetSpot stake={pendingStake} />
        )}
      </div>

      {children && <div className="relative mt-6">{children}</div>}
    </div>
  );
}
