import { useMyBets } from './useSportsbook';
import { selectionLabel, type Market, type Selection } from './odds';
import { formatAmount } from '@/lib/format';

const statusStyle: Record<string, string> = {
  pending: 'text-muted',
  won: 'text-positive',
  lost: 'text-negative',
  void: 'text-muted',
};

export function MyBets() {
  const { data: bets, isLoading } = useMyBets();

  if (isLoading) return <p className="py-6 text-center text-muted">Loading…</p>;
  if (!bets || bets.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">No bets yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {bets.map((bet) => (
        <li key={bet.id} className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-text">
              {bet.legs.length > 1 ? `${bet.legs.length}-leg parlay` : 'Single'} ·{' '}
              <span className="tabular-nums text-muted">{Number(bet.combined_odds).toFixed(2)}</span>
            </span>
            <span className={`text-sm font-semibold capitalize ${statusStyle[bet.status]}`}>
              {bet.status}
            </span>
          </div>
          <ul className="space-y-1">
            {bet.legs.map((leg) => (
              <li key={leg.id} className="flex justify-between text-xs">
                <span className="text-muted">
                  {leg.fixture ? `${leg.fixture.home} v ${leg.fixture.away}` : `Fixture ${leg.fixture_id}`} ·{' '}
                  <span className="text-text">
                    {selectionLabel(leg.market as Market, leg.selection as Selection)}
                  </span>
                </span>
                <span className={statusStyle[leg.result] ?? 'text-muted'}>{leg.result}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-xs text-muted">
            <span>Stake {formatAmount(bet.stake)}</span>
            <span>
              {bet.status === 'won' ? 'Returned ' : 'To return '}
              <span className="font-semibold text-text">{formatAmount(bet.potential_payout)}</span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
