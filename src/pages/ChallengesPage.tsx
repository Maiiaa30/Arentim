import { useState } from 'react';
import { useProfile } from '@/features/profile/useProfile';
import { useChallenges, useChallengeActions } from '@/features/challenges/useChallenges';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount } from '@/lib/format';
import type { ChallengeRow } from '@/types/db';

const RESCUE_THRESHOLD = 100;

function ChallengeCard({ c, onClaim, busy }: { c: ChallengeRow; onClaim: () => void; busy: boolean }) {
  const pct = Math.min(100, Math.round((c.progress / c.target) * 100));
  const complete = c.progress >= c.target;
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-text">{c.title}</p>
          <p className="text-xs text-muted">{c.description}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-gold">
          <CoinIcon className="h-3.5 w-3.5" /> {formatAmount(c.reward)}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full ${complete ? 'bg-positive' : 'bg-gold'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs tabular-nums text-muted">
          {formatAmount(c.progress)} / {formatAmount(c.target)}
        </span>
        {c.claimed ? (
          <span className="text-xs font-medium text-positive">✓ Claimed</span>
        ) : (
          <Button onClick={onClaim} disabled={!complete || busy} className="!px-3 !py-1.5 text-xs">
            {complete ? 'Claim' : 'Locked'}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ChallengesPage() {
  const { data: profile } = useProfile();
  const { data: challenges } = useChallenges();
  const { claim, rescue } = useChallengeActions();
  const [msg, setMsg] = useState<string | null>(null);

  const balance = profile?.balance ?? 0;
  const lowBalance = balance < RESCUE_THRESHOLD;
  const recovery = (challenges ?? []).filter((c) => c.track === 'recovery');
  const highroller = (challenges ?? []).filter((c) => c.track === 'highroller');
  const badges = (challenges ?? []).filter((c) => c.claimed);

  async function onClaim(key: string) {
    setMsg(null);
    const res = await claim.mutateAsync(key);
    if (res.status === 'claimed') setMsg(`Claimed +${formatAmount(res.reward ?? 0)} Tostões!`);
    else if (res.status === 'incomplete') setMsg('Not quite there yet.');
  }
  async function onRescue() {
    setMsg(null);
    const res = await rescue.mutateAsync();
    if (res.status === 'granted') setMsg(`Rescue granted +${formatAmount(res.amount ?? 0)} Tostões.`);
    else if (res.status === 'already_claimed') setMsg('Already claimed your rescue today.');
    else setMsg('Rescue is only available when your balance is low.');
  }

  const tracksInOrder = lowBalance
    ? [{ title: 'Recovery', items: recovery }, { title: 'High-roller', items: highroller }]
    : [{ title: 'High-roller', items: highroller }, { title: 'Recovery', items: recovery }];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Challenges</h1>
        <p className="mt-1 text-sm text-muted">Complete milestones for Tostões and badges.</p>
      </div>

      {/* Rescue loop */}
      {lowBalance && (
        <section className="card border-accent/40 p-5">
          <h2 className="font-display text-lg font-semibold text-text">Rock bottom?</h2>
          <p className="mt-1 text-sm text-muted">
            Out of Tostões — here's a free daily rescue to get you back in the game.
          </p>
          <Button onClick={onRescue} disabled={rescue.isPending} className="mt-3">
            {rescue.isPending ? 'Claiming…' : 'Claim free rescue'}
          </Button>
        </section>
      )}

      {msg && <p className="text-sm text-positive">{msg}</p>}

      {tracksInOrder.map((track) => (
        <section key={track.title} className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-text">{track.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {track.items.map((c) => (
              <ChallengeCard key={c.key} c={c} busy={claim.isPending} onClaim={() => onClaim(c.key)} />
            ))}
          </div>
        </section>
      ))}

      {/* Badges */}
      {badges.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold text-text">Badges</h2>
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <span key={b.key} className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
                🏅 {b.title}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
