import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Fixture, MatchStats, TeamStat } from '@/types/db';
import { useBroadcasts, useMatchStats } from './useSportsbook';

/**
 * Match-detail popup for the Resultados page: teams + score/kickoff, the 1x2 /
 * over-under / BTTS odds with implied probabilities, and a standings-form
 * comparison for both sides (cached on the fixture, no extra API calls).
 */

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleString('pt-PT', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

function Crest({ name, src }: { name: string; src: string | null }) {
  if (src) return <img src={src} alt="" className="h-10 w-10 object-contain" />;
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-raised font-sans text-xs font-semibold text-muted">
      {name.slice(0, 3).toUpperCase()}
    </span>
  );
}

/** Implied probabilities (%) from a market's odds, normalised to remove the margin. */
function implied(market?: Record<string, number>): Record<string, number> {
  if (!market) return {};
  const raw = Object.values(market).reduce((s, o) => s + (o > 0 ? 1 / o : 0), 0) || 1;
  const out: Record<string, number> = {};
  for (const [k, o] of Object.entries(market)) out[k] = o > 0 ? Math.round(((1 / o) / raw) * 100) : 0;
  return out;
}

function OddsRow({ label, market, keys, names }: { label: string; market?: Record<string, number> | undefined; keys: string[]; names: string[] }) {
  if (!market) return null;
  const probs = implied(market);
  return (
    <div>
      <p className="mb-1.5 font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k, i) => (
          <div key={k} className="rounded border border-border bg-surface px-2 py-2 text-center">
            <p className="font-sans text-[10px] uppercase tracking-wider text-muted-2">{names[i]}</p>
            <p className="font-mono text-base font-semibold text-gold">{market[k]?.toFixed(2) ?? '—'}</p>
            {probs[k] != null && <p className="font-sans text-[10px] text-faint">{probs[k]}%</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function FormChips({ form }: { form: string | null }) {
  if (!form) return <span className="text-faint">—</span>;
  const map: Record<string, string> = { W: 'bg-positive text-bg', V: 'bg-positive text-bg', D: 'bg-muted-2/40 text-text', E: 'bg-muted-2/40 text-text', L: 'bg-negative text-white' };
  return (
    <span className="flex gap-0.5">
      {form.split(/[ ,]/).filter(Boolean).slice(-5).map((r, i) => (
        <span key={i} className={`flex h-4 w-4 items-center justify-center rounded-sm text-[9px] font-bold ${map[r.toUpperCase()] ?? 'bg-muted-2/40 text-text'}`}>
          {r.toUpperCase()}
        </span>
      ))}
    </span>
  );
}

function StatTable({ home, away, hName, aName }: { home?: TeamStat | null | undefined; away?: TeamStat | null | undefined; hName: string; aName: string }) {
  if (!home && !away) {
    return <p className="text-center text-sm text-muted-2">Sem dados de classificação para este jogo.</p>;
  }
  const rows: [string, (s: TeamStat) => string | number][] = [
    ['Posição', (s) => (s.position ? `${s.position}.º` : '—')],
    ['Jogos', (s) => s.played],
    ['V – E – D', (s) => `${s.won}–${s.draw}–${s.lost}`],
    ['Golos', (s) => `${s.gf}–${s.ga}`],
    ['Pontos', (s) => s.points],
  ];
  const cell = (s: TeamStat | null | undefined, fn: (s: TeamStat) => string | number) =>
    s ? fn(s) : '—';
  return (
    <div className="overflow-hidden rounded border border-border">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="truncate text-left font-sans text-xs font-medium text-text">{hName}</span>
        <span className="font-sans text-[9px] uppercase tracking-wider text-muted-2">Forma</span>
        <span className="truncate text-right font-sans text-xs font-medium text-text">{aName}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2">
        <span className="flex justify-start"><FormChips form={home?.form ?? null} /></span>
        <span />
        <span className="flex justify-end"><FormChips form={away?.form ?? null} /></span>
      </div>
      {rows.map(([label, fn]) => (
        <div key={label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-border/60 px-3 py-1.5">
          <span className="text-left font-mono text-sm tabular-nums text-text">{cell(home, fn)}</span>
          <span className="font-sans text-[9px] uppercase tracking-[0.16em] text-muted-2">{label}</span>
          <span className="text-right font-mono text-sm tabular-nums text-text">{cell(away, fn)}</span>
        </div>
      ))}
    </div>
  );
}

/** "Onde ver" — the official broadcaster for this competition (if curated). */
function OndeVer({ league }: { league: string }) {
  const { data } = useBroadcasts();
  const b = (data ?? []).find((x) => x.league === league);
  if (!b) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-border bg-surface px-3 py-2">
      <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Onde ver</span>
      {b.url ? (
        <a href={b.url} target="_blank" rel="noopener noreferrer" className="font-sans text-sm font-medium text-gold hover:underline">
          {b.channel} ↗
        </a>
      ) : (
        <span className="font-sans text-sm font-medium text-text">{b.channel}</span>
      )}
    </div>
  );
}

const pct = (v: string | number | null): number | null => {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseInt(String(v).replace('%', ''), 10);
  return Number.isFinite(n) ? n : null;
};
const sval = (v: string | number | null): string => (v == null ? '—' : String(v));

const STAT_ROWS: [string, keyof MatchStats['home']][] = [
  ['Remates', 'shots'],
  ['Remates à baliza', 'shotsOn'],
  ['Cantos', 'corners'],
  ['Faltas', 'fouls'],
  ['Amarelos', 'yellow'],
  ['Vermelhos', 'red'],
  ['Foras de jogo', 'offsides'],
  ['Passes certos', 'passAcc'],
];

function StatsBody({ s }: { s: MatchStats }) {
  const ph = pct(s.home.possession);
  const pa = pct(s.away.possession);
  const rows = STAT_ROWS.filter(([, k]) => s.home[k] != null || s.away[k] != null);
  return (
    <div className="space-y-2.5 px-3 py-2.5">
      {ph != null && pa != null && (
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-text">
            <span>{ph}%</span>
            <span className="font-sans text-[9px] uppercase tracking-[0.16em] text-muted-2">Posse de bola</span>
            <span>{pa}%</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full">
            <div className="bg-gold" style={{ width: `${ph}%` }} />
            <div className="bg-muted-2/40" style={{ width: `${pa}%` }} />
          </div>
        </div>
      )}
      {rows.map(([label, k]) => (
        <div key={k} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className="text-left font-mono text-sm tabular-nums text-text">{sval(s.home[k])}</span>
          <span className="font-sans text-[9px] uppercase tracking-[0.16em] text-muted-2">{label}</span>
          <span className="text-right font-mono text-sm tabular-nums text-text">{sval(s.away[k])}</span>
        </div>
      ))}
    </div>
  );
}

/** Live statistics panel — only fetched while the game is live. */
function LiveStatsSection({ fixtureId, live }: { fixtureId: number; live: boolean }) {
  const { data, isLoading } = useMatchStats(fixtureId, live);
  if (!live) return null;
  return (
    <div className="overflow-hidden rounded border border-border">
      <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-2">
        <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-gold">Estatísticas ao vivo</span>
        <span className="flex items-center gap-1 font-mono text-[10px] text-negative">
          <span className="h-1.5 w-1.5 animate-livedot rounded-full bg-negative" /> ao vivo
        </span>
      </div>
      {isLoading && !data ? (
        <p className="px-3 py-4 text-center font-sans text-sm text-muted-2">A carregar estatísticas…</p>
      ) : data?.available && data.stats ? (
        <StatsBody s={data.stats} />
      ) : (
        <p className="px-3 py-4 text-center font-sans text-xs text-muted-2">Estatísticas em direto indisponíveis para este jogo.</p>
      )}
    </div>
  );
}

export function MatchDetail({ fixture, onClose }: { fixture: Fixture; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const played = fixture.status === 'live' || fixture.status === 'finished';

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card max-h-[88vh] w-full max-w-md overflow-y-auto border-border-strong p-6 shadow-modal animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center font-sans text-[10px] uppercase tracking-[0.2em] text-gold">{fixture.league}</p>

        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <Crest name={fixture.home} src={fixture.home_crest} />
            <span className="text-center font-sans text-sm text-text">{fixture.home}</span>
          </div>
          <div className="text-center">
            {played ? (
              <span className="font-display text-3xl font-bold text-text">
                {fixture.home_score ?? 0}<span className="px-1 text-muted-2">–</span>{fixture.away_score ?? 0}
              </span>
            ) : (
              <span className="font-sans text-sm text-muted-2">vs</span>
            )}
            {fixture.status === 'live' && (
              <p className="mt-1 font-mono text-[11px] font-medium text-negative">
                {fixture.minute != null ? `${fixture.minute}'` : 'AO VIVO'}
              </p>
            )}
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Crest name={fixture.away} src={fixture.away_crest} />
            <span className="text-center font-sans text-sm text-text">{fixture.away}</span>
          </div>
        </div>

        <p className="mt-3 text-center font-sans text-xs text-muted-2">{dateLabel(fixture.kickoff)}</p>

        <div className="mt-5 space-y-4">
          <OndeVer league={fixture.league} />
          <LiveStatsSection fixtureId={fixture.id} live={fixture.status === 'live'} />
          <StatTable home={fixture.stats?.home} away={fixture.stats?.away} hName={fixture.home} aName={fixture.away} />

          {fixture.odds && Object.keys(fixture.odds).length > 0 && (
            <div className="space-y-3">
              <OddsRow label="Resultado (1X2)" market={fixture.odds['1x2']} keys={['home', 'draw', 'away']} names={['Casa', 'Empate', 'Fora']} />
              <div className="grid grid-cols-2 gap-3">
                <OddsRow label="Mais/Menos 2.5" market={fixture.odds.ou25} keys={['over', 'under']} names={['+2.5', '–2.5']} />
                <OddsRow label="Ambas marcam" market={fixture.odds.btts} keys={['yes', 'no']} names={['Sim', 'Não']} />
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="focus-ring mt-6 w-full rounded border border-border py-2.5 font-sans text-sm text-muted hover:text-text"
        >
          Fechar
        </button>
      </div>
    </div>,
    document.body,
  );
}
