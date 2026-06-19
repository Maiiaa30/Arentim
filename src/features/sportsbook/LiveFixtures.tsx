import { useLiveFixtures } from './useSportsbook';
import type { Fixture } from '@/types/db';

function LiveRow({ fixture }: { fixture: Fixture }) {
  const goals = Array.isArray(fixture.events)
    ? (fixture.events as { type?: string; minute?: number | null; team?: string | null }[]).filter(
        (e) => e.type?.toLowerCase() === 'goal',
      )
    : [];

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-semibold text-negative">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-negative opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-negative" />
          </span>
          AO VIVO {fixture.minute != null && `· ${fixture.minute}'`}
        </span>
        <span className="text-xs text-muted">{fixture.league}</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-medium text-text">{fixture.home}</span>
        <span className="font-display text-xl font-bold tabular-nums text-text">
          {fixture.home_score ?? 0} – {fixture.away_score ?? 0}
        </span>
        <span className="font-medium text-text">{fixture.away}</span>
      </div>
      {goals.length > 0 && (
        <p className="mt-2 truncate text-xs text-muted">
          ⚽ {goals.map((g) => `${g.minute ?? ''}' ${g.team ?? ''}`).join(' · ')}
        </p>
      )}
    </div>
  );
}

export function LiveFixtures() {
  const { data: live } = useLiveFixtures();
  if (!live || live.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-medium text-text">Ao vivo agora</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {live.map((f) => (
          <LiveRow key={f.id} fixture={f} />
        ))}
      </div>
    </section>
  );
}
