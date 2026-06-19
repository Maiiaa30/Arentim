import { useState } from 'react';
import { useFriends, useFriendRequests, useFriendActions, useSearchUsers } from '@/features/friends/useFriends';
import { usePresence } from '@/features/friends/usePresence';
import {
  useLeaderboard,
  type LeaderboardMetric,
  type LeaderboardScope,
} from '@/features/friends/useLeaderboard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatAmount } from '@/lib/format';
import type { FriendRow } from '@/types/db';

type Tab = 'friends' | 'requests' | 'find' | 'leaderboard';

function lastSeen(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function FriendCard({ f, online, showBalance, onRemove }: {
  f: FriendRow; online: boolean; showBalance: boolean; onRemove: () => void;
}) {
  const net = f.total_won - f.total_lost;
  const winRate = f.games_played > 0 ? Math.round((f.games_won / f.games_played) * 100) : 0;
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-positive' : 'bg-border'}`} />
          <span className="font-medium text-text">{f.display_name}</span>
        </div>
        <span className="text-xs text-muted">{online ? 'Online' : lastSeen(f.last_online)}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <p className="text-muted">Net</p>
          <p className={`font-semibold tabular-nums ${net >= 0 ? 'text-positive' : 'text-negative'}`}>
            {net >= 0 ? '+' : '−'}{formatAmount(Math.abs(net))}
          </p>
        </div>
        <div>
          <p className="text-muted">Win rate</p>
          <p className="font-semibold tabular-nums text-text">{winRate}%</p>
        </div>
        <div>
          <p className="text-muted">{showBalance ? 'Balance' : 'Biggest win'}</p>
          <p className="font-semibold tabular-nums text-gold">
            {formatAmount(showBalance ? f.balance : f.biggest_win)}
          </p>
        </div>
      </div>
      <button onClick={onRemove} className="mt-3 text-xs text-muted hover:text-negative">Remove</button>
    </div>
  );
}

export function FriendsPage() {
  const [tab, setTab] = useState<Tab>('friends');
  const [showBalance, setShowBalance] = useState(false);
  const online = usePresence();
  const { data: friends } = useFriends();
  const { data: requests } = useFriendRequests();
  const { sendRequest, respond, remove } = useFriendActions();

  const [query, setQuery] = useState('');
  const { data: results } = useSearchUsers(query);
  const [findMsg, setFindMsg] = useState<string | null>(null);

  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [metric, setMetric] = useState<LeaderboardMetric>('net');
  const { data: board } = useLeaderboard(scope, metric);

  const incoming = requests?.filter((r) => r.direction === 'incoming') ?? [];
  const outgoing = requests?.filter((r) => r.direction === 'outgoing') ?? [];

  const tabs: { id: Tab; label: string }[] = [
    { id: 'friends', label: `Friends${friends ? ` (${friends.length})` : ''}` },
    { id: 'requests', label: `Requests${incoming.length ? ` (${incoming.length})` : ''}` },
    { id: 'find', label: 'Find' },
    { id: 'leaderboard', label: 'Leaderboard' },
  ];

  return (
    <div className="animate-fade-in space-y-5">
      <h1 className="font-display text-2xl font-bold text-text">Friends</h1>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`focus-ring rounded-full px-3 py-1.5 text-sm font-medium ${tab === t.id ? 'bg-gold text-bg' : 'border border-border text-muted hover:text-text'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'friends' && (
        <div className="space-y-3">
          <label className="flex items-center justify-end gap-2 text-xs text-muted">
            <input type="checkbox" checked={showBalance} onChange={(e) => setShowBalance(e.target.checked)} />
            Show balances
          </label>
          {!friends || friends.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No friends yet — find some in the Find tab.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {friends.map((f) => (
                <FriendCard key={f.id} f={f} online={online.has(f.id)} showBalance={showBalance}
                  onRemove={() => remove.mutate(f.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-4">
          <div>
            <h2 className="mb-2 text-sm font-medium text-muted">Incoming</h2>
            {incoming.length === 0 ? <p className="text-sm text-muted">None.</p> : incoming.map((r) => (
              <div key={r.id} className="card mb-2 flex items-center justify-between p-3">
                <span className="text-sm text-text">{r.display_name}</span>
                <div className="flex gap-2">
                  <Button onClick={() => respond.mutate({ requestId: r.id, accept: true })}>Accept</Button>
                  <Button variant="ghost" onClick={() => respond.mutate({ requestId: r.id, accept: false })}>Decline</Button>
                </div>
              </div>
            ))}
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium text-muted">Sent</h2>
            {outgoing.length === 0 ? <p className="text-sm text-muted">None.</p> : outgoing.map((r) => (
              <div key={r.id} className="card mb-2 flex items-center justify-between p-3">
                <span className="text-sm text-text">{r.display_name}</span>
                <span className="text-xs text-muted">Pending</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'find' && (
        <div className="space-y-3">
          <Input id="search" label="Search players" placeholder="Type a display name…"
            value={query} onChange={(e) => { setQuery(e.target.value); setFindMsg(null); }} />
          {findMsg && <p className="text-sm text-positive">{findMsg}</p>}
          <div className="space-y-2">
            {(results ?? []).map((u) => (
              <div key={u.id} className="card flex items-center justify-between p-3">
                <span className="text-sm text-text">{u.display_name}</span>
                <Button
                  onClick={async () => {
                    const status = await sendRequest.mutateAsync(u.id);
                    setFindMsg(
                      status === 'accepted' ? `You're now friends with ${u.display_name}!`
                      : status === 'already_friends' ? 'Already friends.'
                      : status === 'already_requested' ? 'Request already pending.'
                      : `Request sent to ${u.display_name}.`,
                    );
                  }}
                  disabled={sendRequest.isPending}
                >
                  Add
                </Button>
              </div>
            ))}
            {query.trim().length >= 2 && results && results.length === 0 && (
              <p className="text-sm text-muted">No players found.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'leaderboard' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['global', 'friends'] as const).map((s) => (
              <button key={s} onClick={() => setScope(s)}
                className={`focus-ring rounded-full px-3 py-1 text-sm capitalize ${scope === s ? 'bg-accent text-white' : 'border border-border text-muted'}`}>
                {s}
              </button>
            ))}
            <span className="mx-1 text-border">|</span>
            {([['net', 'Net'], ['biggest_win', 'Biggest win'], ['streak', 'Streak']] as const).map(([m, label]) => (
              <button key={m} onClick={() => setMetric(m)}
                className={`focus-ring rounded-full px-3 py-1 text-sm ${metric === m ? 'bg-gold text-bg' : 'border border-border text-muted'}`}>
                {label}
              </button>
            ))}
          </div>
          <ol className="space-y-1">
            {(board ?? []).map((row, i) => (
              <li key={row.id}
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${row.is_me ? 'bg-gold/10 ring-1 ring-gold/30' : 'bg-surface'}`}>
                <span className="flex items-center gap-3">
                  <span className="w-6 text-right tabular-nums text-muted">{i + 1}</span>
                  <span className="text-sm text-text">{row.display_name}</span>
                </span>
                <span className="tabular-nums font-semibold text-gold">
                  {metric === 'streak' ? `${row.value} 🔥` : formatAmount(row.value)}
                </span>
              </li>
            ))}
            {board && board.length === 0 && <p className="py-4 text-center text-sm text-muted">No data yet.</p>}
          </ol>
        </div>
      )}
    </div>
  );
}
