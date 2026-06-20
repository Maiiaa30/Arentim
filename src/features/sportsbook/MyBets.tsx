import { useMemo, useState } from 'react';
import { useMyBets, type BetWithLegs } from './useSportsbook';
import { selectionLabel, type Market, type Selection } from './odds';
import { summariseBets, filterBets, type BetFilter } from './betStats';
import { formatAmount } from '@/lib/format';

const statusLabel: Record<string, string> = {
  pending: 'Pendente',
  won: 'Ganha',
  lost: 'Perdida',
  void: 'Anulada',
};

/** Small coloured pill for a leg/bet outcome. */
function ResultPill({ result }: { result: string }) {
  const tone =
    result === 'won'
      ? 'border-positive/40 bg-positive/10 text-positive'
      : result === 'lost'
        ? 'border-negative/40 bg-negative/10 text-negative'
        : 'border-border bg-bg text-muted-2';
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 font-sans text-[10px] font-medium uppercase tracking-[0.1em] ${tone}`}
    >
      {statusLabel[result] ?? result}
    </span>
  );
}

/** A round status marker (✓ / ✗ / ·) for a leg. */
function LegMark({ result }: { result: string }) {
  const map: Record<string, { ch: string; cls: string }> = {
    won: { ch: '✓', cls: 'bg-positive/15 text-positive' },
    lost: { ch: '✗', cls: 'bg-negative/15 text-negative' },
    void: { ch: '—', cls: 'bg-bg text-muted-2 ring-1 ring-border' },
    pending: { ch: '', cls: 'bg-bg text-muted-2 ring-1 ring-border' },
  };
  const m = map[result] ?? map.pending!;
  return (
    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold ${m.cls}`}>
      {m.ch || <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />}
    </span>
  );
}

/** One bet, with each leg on its own clear two-line row + live state/score. */
export function BetCard({ bet }: { bet: BetWithLegs }) {
  const accent =
    bet.status === 'won' ? 'border-l-positive' : bet.status === 'lost' ? 'border-l-negative' : 'border-l-gold/50';
  return (
    <li className={`card border-l-2 ${accent} p-4`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-sans text-sm font-medium text-text">
            {bet.legs.length > 1 ? `Múltipla · ${bet.legs.length} jogos` : 'Aposta simples'}
          </p>
          <p className="font-mono text-[11px] text-muted-2">Cota {Number(bet.combined_odds).toFixed(2)}</p>
        </div>
        <ResultPill result={bet.status} />
      </div>

      <ul className="space-y-2.5">
        {bet.legs.map((leg) => {
          const fx = leg.fixture;
          const finished = fx?.status === 'finished';
          const live = fx?.status === 'live';
          const hasScore = fx && fx.home_score != null && fx.away_score != null;
          return (
            <li key={leg.id} className="flex items-start gap-2.5">
              <LegMark result={leg.result} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-sans text-[13px] leading-tight text-text">
                  {fx ? `${fx.home} — ${fx.away}` : `Jogo ${leg.fixture_id}`}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-sans text-[11px] leading-tight">
                  <span className="font-medium text-gold-light">
                    {selectionLabel(leg.market as Market, leg.selection as Selection, fx?.home, fx?.away)}
                  </span>
                  {hasScore ? (
                    <span className={`font-mono ${finished ? 'text-body' : 'text-gold'}`}>
                      {fx!.home_score}–{fx!.away_score}
                      {live && <span className="ml-1 uppercase tracking-wide text-negative">ao vivo</span>}
                    </span>
                  ) : fx ? (
                    <span className="text-faint">{live ? 'ao vivo' : 'por jogar'}</span>
                  ) : null}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 font-sans text-xs">
        <span className="text-muted-2">
          Aposta <span className="font-mono text-body">{formatAmount(bet.stake)}</span>
        </span>
        <span className="text-muted-2">
          {bet.status === 'won' ? 'Ganhou ' : bet.status === 'lost' ? 'Retorno ' : 'Retorno possível '}
          <span
            className={`font-mono font-semibold ${
              bet.status === 'won' ? 'text-positive' : bet.status === 'lost' ? 'text-muted-2 line-through' : 'text-gold'
            }`}
          >
            {formatAmount(bet.potential_payout)}
          </span>
        </span>
      </div>
    </li>
  );
}

/** Compact summary statistic. */
function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded border border-border bg-bg/40 px-3 py-2">
      <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-muted-2">{label}</p>
      <p className={`mt-0.5 font-mono text-sm ${tone || 'text-text'}`}>{value}</p>
    </div>
  );
}

const FILTERS: { key: BetFilter; label: string }[] = [
  { key: 'pending', label: 'Em aberto' },
  { key: 'all', label: 'Todas' },
  { key: 'won', label: 'Ganhas' },
  { key: 'lost', label: 'Perdidas' },
];

/**
 * Betting history: summary stats, a status filter and the bet cards (each with
 * per-leg results). Lives where `MyBets` used to; data streams via Realtime +
 * the 30s refetch, so finished legs update on their own.
 */
export function BetHistory() {
  const { data: bets, isLoading } = useMyBets();
  const [filter, setFilter] = useState<BetFilter>('pending');

  const summary = useMemo(() => summariseBets(bets ?? []), [bets]);
  const shown = useMemo(() => filterBets(bets ?? [], filter), [bets, filter]);

  if (isLoading) return <p className="py-6 text-center text-muted-2">A carregar…</p>;
  if (!bets || bets.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-2">Ainda sem apostas.</p>;
  }

  const winPct = Math.round(summary.winRate * 100);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Apostado" value={formatAmount(summary.staked)} />
        <Stat label="Ganho" value={formatAmount(summary.won)} tone="text-positive" />
        <Stat label="Taxa de vitória" value={`${winPct}%`} tone="text-gold" />
        <Stat label="Em aberto" value={String(summary.pending)} />
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`focus-ring shrink-0 rounded-full px-3.5 py-1.5 font-sans text-xs font-medium uppercase tracking-[0.14em] transition-colors ${
              filter === f.key ? 'bg-gold text-bg' : 'border border-border text-muted-2 hover:text-text'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-2">Sem apostas nesta categoria.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((bet) => (
            <BetCard key={bet.id} bet={bet} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Backwards-compatible alias rendered on the sportsbook page. */
export function MyBets() {
  return <BetHistory />;
}
