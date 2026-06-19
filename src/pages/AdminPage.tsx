import { useState } from 'react';
import { useProfile } from '@/features/profile/useProfile';
import {
  useAdminActions,
  useAdminChallenges,
  useAdminFixtures,
  useAdminPlayers,
  useAdminActionsMutations,
} from '@/features/admin/useAdmin';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatAmount } from '@/lib/format';
import type { Profile } from '@/types/db';

type Tab = 'players' | 'sportsbook' | 'challenges' | 'broadcast' | 'logs';

function PlayerActions({ player }: { player: Profile }) {
  const { adjustBalance, setStreak, setSuspended } = useAdminActionsMutations();
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [streak, setStreakVal] = useState(player.streak_count);
  const [msg, setMsg] = useState<string | null>(null);

  const guardReason = () => {
    if (reason.trim().length < 3) { setMsg('A reason (3+ chars) is required.'); return false; }
    return true;
  };

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium text-text">{player.display_name}{player.suspended && <span className="ml-2 text-xs text-negative">suspended</span>}</p>
        <span className="text-sm tabular-nums text-gold">{formatAmount(player.balance)}</span>
      </div>
      <Input id="reason" label="Reason (required for changes)" value={reason} onChange={(e) => setReason(e.target.value)} />

      <div className="flex items-end gap-2">
        <Input id="amount" type="number" label="Adjust balance (±)" value={amount}
          onChange={(e) => setAmount(Math.floor(Number(e.target.value) || 0))} />
        <Button onClick={async () => { if (!guardReason()) return; await adjustBalance.mutateAsync({ user: player.id, amount, reason }); setMsg('Balance adjusted.'); }}>
          Apply
        </Button>
      </div>

      <div className="flex items-end gap-2">
        <Input id="streak" type="number" label="Set streak" value={streak}
          onChange={(e) => setStreakVal(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
        <Button variant="secondary" onClick={async () => { if (!guardReason()) return; await setStreak.mutateAsync({ user: player.id, streak, reason }); setMsg('Streak set.'); }}>
          Set
        </Button>
      </div>

      <Button variant={player.suspended ? 'secondary' : 'danger'}
        onClick={async () => { if (!guardReason()) return; await setSuspended.mutateAsync({ user: player.id, suspended: !player.suspended, reason }); setMsg(player.suspended ? 'Unsuspended.' : 'Suspended.'); }}>
        {player.suspended ? 'Unsuspend' : 'Suspend'}
      </Button>
      {msg && <p className="text-sm text-positive">{msg}</p>}
    </div>
  );
}

export function AdminPage() {
  const { data: profile, isLoading } = useProfile();
  const [tab, setTab] = useState<Tab>('players');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Profile | null>(null);

  const { data: players } = useAdminPlayers(query);
  const { data: fixtures } = useAdminFixtures();
  const { data: challenges } = useAdminChallenges();
  const { data: actions } = useAdminActions();
  const { settleFixture, broadcast, upsertChallenge } = useAdminActionsMutations();

  const [bTitle, setBTitle] = useState('');
  const [bBody, setBBody] = useState('');
  const [bMsg, setBMsg] = useState<string | null>(null);

  if (isLoading) return <p className="py-12 text-center text-muted">Loading…</p>;
  if (!profile?.is_admin) {
    return <p className="py-12 text-center text-negative">Admins only.</p>;
  }

  const tabs: Tab[] = ['players', 'sportsbook', 'challenges', 'broadcast', 'logs'];

  return (
    <div className="animate-fade-in space-y-5">
      <h1 className="font-display text-2xl font-bold text-text">Admin</h1>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`focus-ring rounded-full px-3 py-1.5 text-sm font-medium capitalize ${tab === t ? 'bg-gold text-bg' : 'border border-border text-muted hover:text-text'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'players' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Input id="search" placeholder="Search players…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="space-y-1">
              {(players ?? []).map((p) => (
                <button key={p.id} onClick={() => setSelected(p)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${selected?.id === p.id ? 'bg-gold/10 ring-1 ring-gold/30' : 'bg-surface hover:bg-surface/70'}`}>
                  <span className="text-text">{p.display_name}{p.is_admin && ' ⭐'}{p.suspended && ' 🚫'}</span>
                  <span className="tabular-nums text-muted">{formatAmount(p.balance)}</span>
                </button>
              ))}
            </div>
          </div>
          {selected && <PlayerActions key={selected.id} player={players?.find((p) => p.id === selected.id) ?? selected} />}
        </div>
      )}

      {tab === 'sportsbook' && (
        <div className="space-y-2">
          {(fixtures ?? []).map((f) => <FixtureRow key={f.id} fixture={f} onSettle={settleFixture.mutateAsync} />)}
        </div>
      )}

      {tab === 'challenges' && (
        <div className="space-y-2">
          {(challenges ?? []).map((c) => (
            <ChallengeRowEditor key={c.key} c={c} onSave={upsertChallenge.mutateAsync} />
          ))}
        </div>
      )}

      {tab === 'broadcast' && (
        <div className="card max-w-lg space-y-3 p-4">
          <Input id="btitle" label="Title" value={bTitle} onChange={(e) => setBTitle(e.target.value)} />
          <Input id="bbody" label="Message" value={bBody} onChange={(e) => setBBody(e.target.value)} />
          <Button onClick={async () => { await broadcast.mutateAsync({ title: bTitle, body: bBody }); setBTitle(''); setBBody(''); setBMsg('Announcement sent.'); }}
            disabled={broadcast.isPending || bTitle.trim().length === 0}>
            Send announcement
          </Button>
          {bMsg && <p className="text-sm text-positive">{bMsg}</p>}
        </div>
      )}

      {tab === 'logs' && (
        <div className="space-y-1">
          {(actions ?? []).map((a) => (
            <div key={a.id} className="rounded-lg bg-surface px-3 py-2 text-xs">
              <span className="font-medium text-text">{a.action}</span>
              <span className="text-muted"> · {new Date(a.created_at).toLocaleString('pt-PT')}</span>
              {a.detail && <span className="text-muted"> · {JSON.stringify(a.detail)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FixtureRow({ fixture, onSettle }: {
  fixture: { id: number; home: string; away: string; status: string; home_score: number | null; away_score: number | null };
  onSettle: (v: { fixture: number; home: number; away: number }) => Promise<unknown>;
}) {
  const [h, setH] = useState(0);
  const [a, setA] = useState(0);
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-3">
      <span className="text-sm text-text">{fixture.home} v {fixture.away} <span className="text-xs text-muted">({fixture.status})</span></span>
      {fixture.status !== 'finished' ? (
        <div className="flex items-center gap-2">
          <input type="number" value={h} onChange={(e) => setH(Math.max(0, Number(e.target.value) || 0))} className="w-14 rounded border border-border bg-bg px-2 py-1 text-sm" />
          <span className="text-muted">–</span>
          <input type="number" value={a} onChange={(e) => setA(Math.max(0, Number(e.target.value) || 0))} className="w-14 rounded border border-border bg-bg px-2 py-1 text-sm" />
          <Button onClick={() => onSettle({ fixture: fixture.id, home: h, away: a })} className="!px-3 !py-1.5 text-xs">Settle</Button>
        </div>
      ) : (
        <span className="text-sm tabular-nums text-positive">{fixture.home_score}–{fixture.away_score}</span>
      )}
    </div>
  );
}

function ChallengeRowEditor({ c, onSave }: {
  c: { key: string; title: string; description: string; metric: string; target: number; reward: number; track: string; active: boolean };
  onSave: (v: { key: string; title: string; description: string; metric: string; target: number; reward: number; track: string; active: boolean }) => Promise<unknown>;
}) {
  const [reward, setReward] = useState(c.reward);
  const [active, setActive] = useState(c.active);
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-3">
      <span className="text-sm text-text">{c.title} <span className="text-xs text-muted">({c.track})</span></span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-muted">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> active
        </label>
        <input type="number" value={reward} onChange={(e) => setReward(Math.max(1, Number(e.target.value) || 1))}
          className="w-24 rounded border border-border bg-bg px-2 py-1 text-sm" />
        <Button onClick={() => onSave({ ...c, reward, active })} className="!px-3 !py-1.5 text-xs">Save</Button>
      </div>
    </div>
  );
}
