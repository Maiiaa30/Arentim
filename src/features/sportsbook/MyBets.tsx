import { useMyBets } from './useSportsbook';
import { selectionLabel, type Market, type Selection } from './odds';
import { formatAmount } from '@/lib/format';

const statusStyle: Record<string, string> = {
  pending: 'text-muted-2',
  won: 'text-positive',
  lost: 'text-negative',
  void: 'text-muted-2',
};
const statusLabel: Record<string, string> = {
  pending: 'Pendente',
  won: 'Ganha',
  lost: 'Perdida',
  void: 'Anulada',
};

export function MyBets() {
  const { data: bets, isLoading } = useMyBets();

  if (isLoading) return <p className="py-6 text-center text-muted-2">A carregar…</p>;
  if (!bets || bets.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-2">Ainda sem apostas.</p>;
  }

  return (
    <ul className="space-y-3">
      {bets.map((bet) => (
        <li key={bet.id} className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-sans text-sm text-body">
              {bet.legs.length > 1 ? `Múltipla de ${bet.legs.length}` : 'Simples'} ·{' '}
              <span className="font-mono text-muted-2">{Number(bet.combined_odds).toFixed(2)}</span>
            </span>
            <span className={`font-sans text-sm font-medium ${statusStyle[bet.status]}`}>
              {statusLabel[bet.status] ?? bet.status}
            </span>
          </div>
          <ul className="space-y-1">
            {bet.legs.map((leg) => (
              <li key={leg.id} className="flex justify-between font-sans text-xs">
                <span className="text-muted-2">
                  {leg.fixture ? `${leg.fixture.home} v ${leg.fixture.away}` : `Jogo ${leg.fixture_id}`} ·{' '}
                  <span className="text-body">{selectionLabel(leg.market as Market, leg.selection as Selection)}</span>
                </span>
                <span className={statusStyle[leg.result] ?? 'text-muted-2'}>{statusLabel[leg.result] ?? leg.result}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t border-border pt-2 font-sans text-xs text-muted-2">
            <span>Aposta {formatAmount(bet.stake)}</span>
            <span>
              {bet.status === 'won' ? 'Devolvido ' : 'A devolver '}
              <span className="font-mono text-body">{formatAmount(bet.potential_payout)}</span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
