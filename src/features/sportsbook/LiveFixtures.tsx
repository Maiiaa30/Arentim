import { useState, type KeyboardEvent } from 'react';
import { useLiveFixtures } from './useSportsbook';
import { MatchDetail } from './MatchDetail';
import type { Fixture } from '@/types/db';

function LiveRow({ fixture, onSelect }: { fixture: Fixture; onSelect: () => void }) {
  const goals = Array.isArray(fixture.events)
    ? (fixture.events as { type?: string; minute?: number | null; team?: string | null }[]).filter(
        (e) => e.type?.toLowerCase() === 'goal',
      )
    : [];

  return (
    <div
      className="card card-hover focus-ring cursor-pointer p-4"
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
      }}
    >
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
  const [selected, setSelected] = useState<Fixture | null>(null);
  if (!live || live.length === 0) return null;

  return (
    <section className="space-y-3">
      {selected && <MatchDetail fixture={selected} onClose={() => setSelected(null)} />}
      <h2 className="font-display text-xl font-medium text-text">Ao vivo agora</h2>
      <p className="-mt-1 font-sans text-[11px] text-muted-2">Toca num jogo para ver os detalhes ao vivo.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {live.map((f) => (
          <LiveRow key={f.id} fixture={f} onSelect={() => setSelected(f)} />
        ))}
      </div>
    </section>
  );
}
