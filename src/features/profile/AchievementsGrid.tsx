import { evaluateAchievements, unlockedCount } from './achievements';
import { SectionHeader } from '@/components/ui/primitives';
import type { Profile } from '@/types/db';

/** Badge grid derived from the profile's lifetime stats. */
export function AchievementsGrid({ profile }: { profile: Profile }) {
  const items = evaluateAchievements(profile);
  const total = items.length;
  const done = unlockedCount(profile);

  return (
    <div className="space-y-3">
      <SectionHeader title="Conquistas" right={`${done}/${total}`} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((a) => (
          <div
            key={a.key}
            className={`card p-3 ${a.unlocked ? 'border-gold/40' : 'opacity-70'}`}
            title={a.description}
          >
            <div className="flex items-center gap-2">
              <span className={`text-xl ${a.unlocked ? '' : 'grayscale'}`} aria-hidden>{a.icon}</span>
              <span className={`font-display text-sm font-medium ${a.unlocked ? 'text-gold' : 'text-text'}`}>{a.title}</span>
            </div>
            <p className="mt-1 font-sans text-[11px] leading-snug text-muted-2">{a.description}</p>
            {a.unlocked ? (
              <p className="mt-2 font-sans text-[10px] uppercase tracking-[0.16em] text-positive">Desbloqueado</p>
            ) : (
              <div className="mt-2">
                <div className="h-1 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-gold/70" style={{ width: `${Math.round(a.pct * 100)}%` }} />
                </div>
                <p className="mt-1 font-mono text-[10px] text-muted-2">{Math.min(a.current, a.target)}/{a.target}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
