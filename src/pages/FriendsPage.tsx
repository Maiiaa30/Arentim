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
import { Eyebrow, RingAvatar } from '@/components/ui/primitives';
import type { FriendRow } from '@/types/db';

type Tab = 'friends' | 'requests' | 'find' | 'leaderboard';

const initialsOf = (name: string) => name.slice(0, 2).toUpperCase();

function lastSeen(iso: string | null): string {
  if (!iso) return 'nunca';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora mesmo';
  if (mins < 60) return `há ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs} h`;
  return `há ${Math.floor(hrs / 24)} dias`;
}

function FriendCard({ f, online, showBalance, onRemove }: {
  f: FriendRow; online: boolean; showBalance: boolean; onRemove: () => void;
}) {
  const net = f.total_won - f.total_lost;
  const winRate = f.games_played > 0 ? Math.round((f.games_won / f.games_played) * 100) : 0;
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RingAvatar
            initials={initialsOf(f.display_name)}
            size={36}
            tone={online ? 'gold' : 'muted'}
            presence={online ? 'online' : 'offline'}
          />
          <span className="font-sans font-medium text-text">{f.display_name}</span>
        </div>
        <span className="font-sans text-xs text-muted-2">{online ? 'Online' : lastSeen(f.last_online)}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="font-sans text-[10.5px] uppercase tracking-[0.14em] text-muted-2">Resultado</p>
          <p className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${net >= 0 ? 'text-positive' : 'text-negative'}`}>
            {net >= 0 ? '+' : '−'}{formatAmount(Math.abs(net))}
          </p>
        </div>
        <div>
          <p className="font-sans text-[10.5px] uppercase tracking-[0.14em] text-muted-2">Taxa de vitória</p>
          <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-text">{winRate}%</p>
        </div>
        <div>
          <p className="font-sans text-[10.5px] uppercase tracking-[0.14em] text-muted-2">
            {showBalance ? 'Saldo' : 'Maior ganho'}
          </p>
          <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-gold">
            {formatAmount(showBalance ? f.balance : f.biggest_win)}
          </p>
        </div>
      </div>
      <button onClick={onRemove} className="mt-3 font-sans text-xs text-muted-2 hover:text-negative">Remover</button>
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
    { id: 'friends', label: `Amigos${friends ? ` (${friends.length})` : ''}` },
    { id: 'requests', label: `Pedidos${incoming.length ? ` (${incoming.length})` : ''}` },
    { id: 'find', label: 'Procurar' },
    { id: 'leaderboard', label: 'Classificação' },
  ];

  const scopeLabel: Record<LeaderboardScope, string> = { global: 'global', friends: 'amigos' };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Eyebrow>Comunidade</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text">Amigos</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`focus-ring rounded px-4 py-1.5 font-sans text-[11px] font-medium uppercase tracking-[0.12em] transition-colors ${tab === t.id ? 'bg-gold text-bg' : 'border border-border text-muted-2 hover:text-text'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'friends' && (
        <div className="space-y-3">
          <label className="flex items-center justify-end gap-2 font-sans text-xs text-muted-2">
            <input type="checkbox" checked={showBalance} onChange={(e) => setShowBalance(e.target.checked)} />
            Mostrar saldos
          </label>
          {!friends || friends.length === 0 ? (
            <p className="py-6 text-center font-sans text-sm text-muted-2">
              Ainda sem amigos — encontre alguns no separador Procurar.
            </p>
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
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">Recebidos</h2>
            {incoming.length === 0 ? <p className="font-sans text-sm text-muted-2">Nenhum.</p> : incoming.map((r) => (
              <div key={r.id} className="card flex items-center justify-between p-3">
                <span className="font-sans text-sm text-text">{r.display_name}</span>
                <div className="flex gap-2">
                  <Button variant="primary" className="!px-4 !py-2" onClick={() => respond.mutate({ requestId: r.id, accept: true })}>Aceitar</Button>
                  <Button variant="ghost" className="!px-4 !py-2" onClick={() => respond.mutate({ requestId: r.id, accept: false })}>Recusar</Button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <h2 className="font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">Enviados</h2>
            {outgoing.length === 0 ? <p className="font-sans text-sm text-muted-2">Nenhum.</p> : outgoing.map((r) => (
              <div key={r.id} className="card flex items-center justify-between p-3">
                <span className="font-sans text-sm text-text">{r.display_name}</span>
                <span className="font-sans text-xs text-muted-2">Pendente</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'find' && (
        <div className="space-y-3">
          <Input id="search" label="Procurar jogadores" placeholder="Escreva um nome de exibição…"
            value={query} onChange={(e) => { setQuery(e.target.value); setFindMsg(null); }} />
          {findMsg && <p className="font-sans text-sm text-positive">{findMsg}</p>}
          <div className="space-y-2">
            {(results ?? []).map((u) => (
              <div key={u.id} className="card flex items-center justify-between p-3">
                <span className="font-sans text-sm text-text">{u.display_name}</span>
                <Button
                  variant="primary"
                  className="!px-4 !py-2"
                  onClick={async () => {
                    const status = await sendRequest.mutateAsync(u.id);
                    setFindMsg(
                      status === 'accepted' ? `Agora é amigo de ${u.display_name}!`
                      : status === 'already_friends' ? 'Já são amigos.'
                      : status === 'already_requested' ? 'Pedido já pendente.'
                      : `Pedido enviado a ${u.display_name}.`,
                    );
                  }}
                  disabled={sendRequest.isPending}
                >
                  Adicionar
                </Button>
              </div>
            ))}
            {query.trim().length >= 2 && results && results.length === 0 && (
              <p className="font-sans text-sm text-muted-2">Nenhum jogador encontrado.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'leaderboard' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(['global', 'friends'] as const).map((s) => (
              <button key={s} onClick={() => setScope(s)}
                className={`focus-ring rounded px-3 py-1 font-sans text-[11px] font-medium uppercase tracking-[0.12em] ${scope === s ? 'bg-gold text-bg' : 'border border-border text-muted-2 hover:text-text'}`}>
                {scopeLabel[s]}
              </button>
            ))}
            <span className="mx-1 text-border">|</span>
            {([['net', 'Resultado'], ['biggest_win', 'Maior ganho'], ['streak', 'Sequência']] as const).map(([m, label]) => (
              <button key={m} onClick={() => setMetric(m)}
                className={`focus-ring rounded px-3 py-1 font-sans text-[11px] font-medium uppercase tracking-[0.12em] ${metric === m ? 'bg-gold text-bg' : 'border border-border text-muted-2 hover:text-text'}`}>
                {label}
              </button>
            ))}
          </div>
          <ol className="space-y-1">
            {(board ?? []).map((row, i) => (
              <li key={row.id}
                className={`flex items-center justify-between rounded px-3 py-2 ${row.is_me ? 'bg-gold/10 ring-1 ring-gold/30' : 'bg-surface'}`}>
                <span className="flex items-center gap-3">
                  <span className="w-6 text-right font-mono tabular-nums text-muted-2">{i + 1}</span>
                  <span className="font-sans text-sm text-text">{row.display_name}</span>
                </span>
                <span className="font-mono font-semibold tabular-nums text-gold">
                  {metric === 'streak' ? `${row.value} 🔥` : formatAmount(row.value)}
                </span>
              </li>
            ))}
            {board && board.length === 0 && <p className="py-4 text-center font-sans text-sm text-muted-2">Ainda sem dados.</p>}
          </ol>
        </div>
      )}
    </div>
  );
}
