import { useState } from 'react';
import { useProfile, useUpdateProfile } from '@/features/profile/useProfile';
import { netResult, winRate } from '@/features/profile/stats';
import { formatTostoes, formatAmount } from '@/lib/format';
import { displayNameSchema } from '@/features/auth/schema';
import { StatTile } from '@/components/StatTile';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { CoinIcon } from '@/components/CoinIcon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ProfilePage() {
  const { data: profile, isLoading, error } = useProfile();
  const updateProfile = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  if (isLoading) {
    return <p className="py-12 text-center text-muted">Loading your profile…</p>;
  }
  if (error || !profile) {
    return <p className="py-12 text-center text-negative">Could not load your profile.</p>;
  }

  const net = netResult(profile);

  function startEdit() {
    setName(profile!.display_name);
    setFormError(null);
    setEditing(true);
  }

  async function save() {
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Invalid name');
      return;
    }
    try {
      await updateProfile.mutateAsync({ display_name: parsed.data });
      setEditing(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save');
    }
  }

  return (
    <div className="animate-fade-in space-y-8">
      <section className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {editing ? (
              <div className="space-y-2">
                <Input
                  id="displayName"
                  label="Display name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={formError ?? undefined}
                />
                <div className="flex gap-2">
                  <Button onClick={save} disabled={updateProfile.isPending}>
                    {updateProfile.isPending ? 'Saving…' : 'Save'}
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="font-display text-2xl font-bold text-text">
                  {profile.display_name}
                  {profile.is_admin && (
                    <span className="ml-2 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                      Admin
                    </span>
                  )}
                </h1>
                <p className="mt-1 text-sm text-muted">Member since {formatDate(profile.created_at)}</p>
                <button onClick={startEdit} className="mt-2 text-sm text-gold hover:underline">
                  Edit profile
                </button>
              </>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted">Balance</p>
            <p className="flex items-center justify-end gap-2 font-display text-3xl font-bold text-text">
              <CoinIcon className="h-6 w-6" />
              <AnimatedNumber value={profile.balance} />
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Total wagered" value={formatTostoes(profile.total_wagered)} />
        <StatTile label="Total won" value={formatTostoes(profile.total_won)} tone="positive" />
        <StatTile label="Total lost" value={formatTostoes(profile.total_lost)} tone="negative" />
        <StatTile
          label="Net"
          value={`${net >= 0 ? '+' : '−'}${formatAmount(Math.abs(net))}`}
          tone={net >= 0 ? 'positive' : 'negative'}
        />
        <StatTile label="Win rate" value={`${winRate(profile)}%`} />
        <StatTile label="Biggest win" value={formatTostoes(profile.biggest_win)} tone="gold" />
        <StatTile label="Games played" value={formatAmount(profile.games_played)} />
        <StatTile label="Daily streak" value={`${profile.streak_count} 🔥`} />
      </section>

      <section className="card p-6">
        <h2 className="font-display text-lg font-semibold text-text">Achievements</h2>
        <p className="mt-1 text-sm text-muted">Coming soon — earn badges as you play. (Phase 14)</p>
      </section>
    </div>
  );
}
