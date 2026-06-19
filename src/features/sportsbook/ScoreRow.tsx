import type { Fixture } from '@/types/db';

/**
 * A single FlashScore-style row: team crests + names on the left, score/time on
 * the right, with a live pulse + minute and (when present) a recent-events line.
 * Pure presentation — no money/bet logic. Shared by the Resultados page.
 */

const CREST_COLORS = ['#b0303a', '#2b4a8b', '#1f8a5b', '#B68A2E', '#6b542a', '#5a5240'];

function crest(name: string): { abbr: string; color: string } {
  const abbr = name
    .replace(/[^A-Za-zÀ-ÿ ]/g, '')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return { abbr: abbr || name.slice(0, 3).toUpperCase(), color: CREST_COLORS[h % CREST_COLORS.length]! };
}

function Crest({ name }: { name: string }) {
  const { abbr, color } = crest(name);
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-sans text-[9px] font-semibold text-white/90"
      style={{ background: color }}
      aria-hidden
    >
      {abbr}
    </span>
  );
}

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

type EventRow = { type?: string; minute?: number | null; team?: string | null; player?: string | null };

function goalLine(fixture: Fixture): string | null {
  const events = Array.isArray(fixture.events) ? (fixture.events as EventRow[]) : [];
  const goals = events.filter((e) => e.type?.toLowerCase() === 'goal');
  if (goals.length === 0) return null;
  return goals
    .slice(-4)
    .map((g) => `${g.minute != null ? `${g.minute}'` : ''} ${g.player ?? g.team ?? ''}`.trim())
    .filter(Boolean)
    .join(' · ');
}

export function ScoreRow({ fixture }: { fixture: Fixture }) {
  const live = fixture.status === 'live';
  const finished = fixture.status === 'finished';
  const postponed = fixture.status === 'postponed';
  const hasScore = live || finished;

  const winnerHome = hasScore && (fixture.home_score ?? 0) > (fixture.away_score ?? 0);
  const winnerAway = hasScore && (fixture.away_score ?? 0) > (fixture.home_score ?? 0);

  const goals = live ? goalLine(fixture) : null;

  // Left-hand status cell: minute (live), final marker, kickoff time or postponed.
  const statusCell = live ? (
    <span className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-negative">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-negative opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-negative" />
      </span>
      {fixture.minute != null ? `${fixture.minute}'` : 'AO VIVO'}
    </span>
  ) : finished ? (
    <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-muted-2">Fim</span>
  ) : postponed ? (
    <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-muted-2">Adiado</span>
  ) : (
    <span className="font-mono text-[11px] text-muted-2">{timeLabel(fixture.kickoff)}</span>
  );

  return (
    <div className={`card p-0 ${live ? 'border-negative/30' : ''}`}>
      <div className="flex items-stretch">
        <div className="flex w-[58px] shrink-0 flex-col items-center justify-center gap-0.5 border-r border-border px-1.5 py-3 text-center">
          {statusCell}
        </div>

        <div className="min-w-0 flex-1 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Crest name={fixture.home} />
            <span
              className={`min-w-0 flex-1 truncate font-sans text-sm ${
                winnerHome ? 'font-semibold text-text' : 'text-body'
              }`}
            >
              {fixture.home}
            </span>
            <span
              className={`shrink-0 font-mono text-sm tabular-nums ${
                live ? 'font-bold text-gold' : finished ? 'font-semibold text-text' : 'text-faint'
              }`}
            >
              {hasScore ? (fixture.home_score ?? 0) : '–'}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <Crest name={fixture.away} />
            <span
              className={`min-w-0 flex-1 truncate font-sans text-sm ${
                winnerAway ? 'font-semibold text-text' : 'text-body'
              }`}
            >
              {fixture.away}
            </span>
            <span
              className={`shrink-0 font-mono text-sm tabular-nums ${
                live ? 'font-bold text-gold' : finished ? 'font-semibold text-text' : 'text-faint'
              }`}
            >
              {hasScore ? (fixture.away_score ?? 0) : '–'}
            </span>
          </div>

          {goals && (
            <p className="mt-2 flex items-start gap-1 truncate border-t border-border/60 pt-1.5 font-sans text-[11px] text-muted-2">
              <span aria-hidden>⚽</span>
              <span className="truncate">{goals}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
