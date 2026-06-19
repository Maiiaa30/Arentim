import type { Fixture } from '@/types/db';
import { useBetSlip, slipKey } from './betSlipStore';
import { selectionLabel, type Market, type Selection } from './odds';

const kickoffLabel = (iso: string) =>
  new Date(iso).toLocaleString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const CREST_COLORS = ['#b0303a', '#2b4a8b', '#1f8a5b', '#B68A2E', '#6b542a', '#5a5240'];
function crest(name: string): { abbr: string; color: string } {
  const abbr = name.replace(/[^A-Za-zÀ-ÿ ]/g, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return { abbr: abbr || name.slice(0, 3).toUpperCase(), color: CREST_COLORS[h % CREST_COLORS.length]! };
}

function Crest({ name }: { name: string }) {
  const { abbr, color } = crest(name);
  return (
    <span
      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full font-sans text-[9px] font-semibold text-white/90"
      style={{ background: color }}
    >
      {abbr}
    </span>
  );
}

function OddsButton({ fixture, market, selection, label }: {
  fixture: Fixture; market: Market; selection: Selection; label: string;
}) {
  const { items, toggle } = useBetSlip();
  const odds = fixture.odds?.[market]?.[selection];
  if (odds == null) return null;

  const active =
    items.find((i) => slipKey(i.fixtureId, market) === slipKey(fixture.id, market))?.selection === selection;

  return (
    <button
      onClick={() =>
        toggle({ fixtureId: fixture.id, fixtureLabel: `${fixture.home} v ${fixture.away}`, market, selection, odds })
      }
      className={`focus-ring flex flex-1 flex-col items-center gap-0.5 rounded border px-2 py-1.5 transition-colors ${
        active ? 'border-gold bg-gold/[0.18] text-gold' : 'border-border text-body hover:border-gold/60'
      }`}
    >
      <span className="font-sans text-[10px] uppercase tracking-wider text-muted-2">{label}</span>
      <span className="font-mono text-sm font-medium">{odds.toFixed(2)}</span>
    </button>
  );
}

export function FixtureCard({ fixture }: { fixture: Fixture }) {
  const live = fixture.status === 'live';
  const finished = fixture.status === 'finished';
  const score =
    live || finished ? `${fixture.home_score ?? 0} – ${fixture.away_score ?? 0}` : 'vs';

  return (
    <div className="card card-hover p-4">
      <div className="mb-3 flex items-center justify-between font-sans text-[11px] text-muted-2">
        <span className="flex items-center gap-1.5">
          {live && <span className="h-1.5 w-1.5 animate-livedot rounded-full bg-negative" />}
          {live ? `${fixture.minute ?? 0}'` : finished ? 'Terminado' : kickoffLabel(fixture.kickoff)}
        </span>
        <span>{fixture.league}</span>
      </div>

      <div className="mb-3 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2">
          <Crest name={fixture.home} />
          <span className="truncate font-sans text-sm text-body">{fixture.home}</span>
        </div>
        <span className={`shrink-0 font-mono text-sm ${live || finished ? 'text-gold' : 'text-muted-2'}`}>{score}</span>
        <div className="flex flex-1 items-center justify-end gap-2">
          <span className="truncate text-right font-sans text-sm text-body">{fixture.away}</span>
          <Crest name={fixture.away} />
        </div>
      </div>

      {fixture.preview && <p className="mb-3 font-sans text-xs italic text-muted-2">{fixture.preview}</p>}

      {!finished && (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <OddsButton fixture={fixture} market="1x2" selection="home" label="1" />
            <OddsButton fixture={fixture} market="1x2" selection="draw" label="X" />
            <OddsButton fixture={fixture} market="1x2" selection="away" label="2" />
          </div>
          <div className="flex gap-1.5">
            <OddsButton fixture={fixture} market="ou25" selection="over" label={selectionLabel('ou25', 'over')} />
            <OddsButton fixture={fixture} market="ou25" selection="under" label={selectionLabel('ou25', 'under')} />
            <OddsButton fixture={fixture} market="btts" selection="yes" label="Ambas sim" />
            <OddsButton fixture={fixture} market="btts" selection="no" label="Ambas não" />
          </div>
        </div>
      )}
    </div>
  );
}
