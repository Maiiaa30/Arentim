import type { Fixture } from '@/types/db';
import { useBetSlip, slipKey } from './betSlipStore';
import { selectionLabel, type Market, type Selection } from './odds';

const kickoffLabel = (iso: string) =>
  new Date(iso).toLocaleString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

interface OddsButtonProps {
  fixture: Fixture;
  market: Market;
  selection: Selection;
  label: string;
}

function OddsButton({ fixture, market, selection, label }: OddsButtonProps) {
  const { items, toggle } = useBetSlip();
  const odds = fixture.odds?.[market]?.[selection];
  if (odds == null) return null;

  const active =
    items.find((i) => slipKey(i.fixtureId, market) === slipKey(fixture.id, market))?.selection ===
    selection;

  return (
    <button
      onClick={() =>
        toggle({
          fixtureId: fixture.id,
          fixtureLabel: `${fixture.home} v ${fixture.away}`,
          market,
          selection,
          odds,
        })
      }
      className={`focus-ring flex flex-1 flex-col items-center rounded-lg border px-2 py-1.5 text-sm transition-colors ${
        active ? 'border-gold bg-gold/10 text-gold' : 'border-border text-text hover:border-accent/50'
      }`}
    >
      <span className="text-[11px] text-muted">{label}</span>
      <span className="font-semibold tabular-nums">{odds.toFixed(2)}</span>
    </button>
  );
}

export function FixtureCard({ fixture }: { fixture: Fixture }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-medium text-text">
            {fixture.home} <span className="text-muted">v</span> {fixture.away}
          </p>
          <p className="text-xs text-muted">
            {fixture.league} · {kickoffLabel(fixture.kickoff)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <OddsButton fixture={fixture} market="1x2" selection="home" label="1" />
          <OddsButton fixture={fixture} market="1x2" selection="draw" label="X" />
          <OddsButton fixture={fixture} market="1x2" selection="away" label="2" />
        </div>
        <div className="flex gap-2">
          <OddsButton fixture={fixture} market="ou25" selection="over" label={selectionLabel('ou25', 'over')} />
          <OddsButton fixture={fixture} market="ou25" selection="under" label={selectionLabel('ou25', 'under')} />
          <OddsButton fixture={fixture} market="btts" selection="yes" label="BTTS Yes" />
          <OddsButton fixture={fixture} market="btts" selection="no" label="BTTS No" />
        </div>
      </div>
    </div>
  );
}
