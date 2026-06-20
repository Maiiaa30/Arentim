import { useState } from 'react';
import { useProfile } from '@/features/profile/useProfile';
import {
  useAdminActions,
  useAdminChallenges,
  useAdminFixtures,
  useAdminPlayers,
  useAdminStats,
  useAdminActionsMutations,
  type AdminStats,
  type AdminTop,
} from '@/features/admin/useAdmin';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';
import type { AdminAction, Profile } from '@/types/db';

type Tab = 'overview' | 'players' | 'sportsbook' | 'challenges' | 'broadcast' | 'logs';

const TAB_LABEL: Record<Tab, string> = {
  overview: 'Resumo',
  players: 'Jogadores',
  sportsbook: 'Futebol',
  challenges: 'Desafios',
  broadcast: 'Anúncios',
  logs: 'Registo',
};

/** A single KPI tile. */
function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <p className="font-sans text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-2">{label}</p>
      <p className={`mt-1 font-display text-[26px] font-semibold leading-none tabular-nums ${accent ? 'text-gold' : 'text-text'}`}>
        {value}
      </p>
      {sub && <p className="mt-1 font-sans text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

/** A small ranked list (top balances / wagered / recent signups). */
function TopList({ title, rows, valueOf }: { title: string; rows: AdminTop[]; valueOf: (r: AdminTop) => string }) {
  return (
    <div className="card p-4">
      <p className="mb-2 font-sans text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-2">{title}</p>
      {rows.length === 0 ? (
        <p className="py-2 font-sans text-sm text-muted-2">Sem dados ainda.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-text">
                <span className="mr-2 font-mono text-muted-2">{i + 1}.</span>
                {r.display_name}
              </span>
              <span className="shrink-0 font-mono tabular-nums text-gold">{valueOf(r)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Overview({ stats }: { stats: AdminStats | undefined }) {
  if (!stats) return <p className="py-10 text-center text-sm text-muted-2">A carregar métricas…</p>;
  const n = (v: number) => v.toLocaleString('pt-PT');
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Utilizadores" value={n(stats.users_total)} sub={`+${n(stats.users_new_today)} hoje · +${n(stats.users_new_7d)} em 7 dias`} />
        <Stat label="Online agora" value={n(stats.online_now)} sub={`${n(stats.active_24h)} ativos em 24h`} accent />
        <Stat label="Ativos (7 dias)" value={n(stats.active_7d)} sub="entraram esta semana" />
        <Stat label="Apostadores" value={n(stats.bettors)} sub="já fizeram pelo menos uma aposta" />
        <Stat label="Saldo em circulação" value={formatAmount(stats.balance_total)} sub="Tostões em todas as carteiras" accent />
        <Stat label="Total apostado" value={formatAmount(stats.wagered_total)} sub={`${formatAmount(stats.won_total)} devolvidos`} />
        <Stat label="Jogos jogados" value={n(stats.games_total)} sub="casino + póquer" />
        <Stat label="Suspensos" value={n(stats.suspended)} sub={`${n(stats.admins)} administradores`} />
        <Stat label="Apostas (futebol)" value={n(stats.sports_bets_total)} sub={`+${n(stats.sports_bets_today)} hoje · ${n(stats.sports_bets_open)} abertas`} />
        <Stat label="Stake em futebol" value={formatAmount(stats.sports_stake_total)} sub="total apostado em jogos" />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <TopList title="Maiores saldos" rows={stats.top_balances} valueOf={(r) => formatAmount(r.balance ?? 0)} />
        <TopList title="Mais apostaram" rows={stats.top_wagered} valueOf={(r) => formatAmount(r.total_wagered ?? 0)} />
        <TopList
          title="Inscrições recentes"
          rows={stats.recent_signups}
          valueOf={(r) => (r.created_at ? new Date(r.created_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }) : '')}
        />
      </div>
    </div>
  );
}

const TEMP_BLOCKS: { label: string; minutes: number }[] = [
  { label: '1 h', minutes: 60 },
  { label: '24 h', minutes: 1440 },
  { label: '7 dias', minutes: 10080 },
];

function PlayerActions({ player }: { player: Profile }) {
  const { adjustBalance, setStreak, setSuspended, suspendUntil } = useAdminActionsMutations();
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [streak, setStreakVal] = useState(player.streak_count);
  const [msg, setMsg] = useState<string | null>(null);

  const guardReason = () => {
    if (reason.trim().length < 3) { setMsg('É necessário um motivo (3+ caracteres).'); return false; }
    return true;
  };

  const tempUntil = player.suspended_until ? new Date(player.suspended_until) : null;
  const tempActive = !!tempUntil && tempUntil.getTime() > Date.now();

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium text-text">
          {player.display_name}
          {player.suspended && <span className="ml-2 text-xs text-negative">suspenso</span>}
          {tempActive && (
            <span className="ml-2 text-xs text-negative">
              bloqueado até {tempUntil!.toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </p>
        <span className="font-mono text-sm tabular-nums text-gold">{formatAmount(player.balance)}</span>
      </div>
      <Input id="reason" label="Motivo (obrigatório)" value={reason} onChange={(e) => setReason(e.target.value)} />

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input id="amount" type="number" label="Ajustar saldo (±)" value={amount}
            onChange={(e) => setAmount(Math.floor(Number(e.target.value) || 0))} />
        </div>
        <Button variant="primary" className="shrink-0 !px-4 !py-2.5" onClick={async () => { if (!guardReason()) return; await adjustBalance.mutateAsync({ user: player.id, amount, reason }); setMsg('Saldo ajustado.'); }}>
          Aplicar
        </Button>
      </div>

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input id="streak" type="number" label="Definir sequência" value={streak}
            onChange={(e) => setStreakVal(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
        </div>
        <Button variant="secondary" className="shrink-0 !px-4 !py-2.5" onClick={async () => { if (!guardReason()) return; await setStreak.mutateAsync({ user: player.id, streak, reason }); setMsg('Sequência definida.'); }}>
          Definir
        </Button>
      </div>

      {/* Temporary block — auto-expires, no manual unsuspend needed. */}
      <div>
        <p className="mb-1.5 font-sans text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-2">Bloqueio temporário</p>
        <div className="flex flex-wrap gap-2">
          {TEMP_BLOCKS.map((b) => (
            <Button key={b.minutes} variant="secondary" className="!px-3 !py-1.5"
              onClick={async () => { if (!guardReason()) return; await suspendUntil.mutateAsync({ user: player.id, minutes: b.minutes, reason }); setMsg(`Bloqueado por ${b.label}.`); }}>
              {b.label}
            </Button>
          ))}
          {tempActive && (
            <Button variant="ghost" className="!px-3 !py-1.5"
              onClick={async () => { if (!guardReason()) return; await suspendUntil.mutateAsync({ user: player.id, minutes: 0, reason }); setMsg('Bloqueio temporário levantado.'); }}>
              Levantar
            </Button>
          )}
        </div>
      </div>

      <Button variant={player.suspended ? 'secondary' : 'danger'}
        onClick={async () => { if (!guardReason()) return; await setSuspended.mutateAsync({ user: player.id, suspended: !player.suspended, reason }); setMsg(player.suspended ? 'Reativado.' : 'Suspenso.'); }}>
        {player.suspended ? 'Reativar (permanente)' : 'Suspender (permanente)'}
      </Button>
      {msg && <p className="font-sans text-sm text-positive">{msg}</p>}
    </div>
  );
}

export function AdminPage() {
  const { data: profile, isLoading } = useProfile();
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Profile | null>(null);

  const { data: stats } = useAdminStats();
  const { data: players } = useAdminPlayers(query);
  const { data: fixtures } = useAdminFixtures();
  const { data: challenges } = useAdminChallenges();
  const { data: actions } = useAdminActions();
  const { settleFixture, broadcast, upsertChallenge } = useAdminActionsMutations();

  const [bTitle, setBTitle] = useState('');
  const [bBody, setBBody] = useState('');
  const [bMsg, setBMsg] = useState<string | null>(null);

  if (isLoading) return <p className="py-12 text-center text-muted-2">A carregar…</p>;
  if (!profile?.is_admin) {
    return <p className="py-12 text-center text-negative">Apenas administradores.</p>;
  }

  const tabs: Tab[] = ['overview', 'players', 'sportsbook', 'challenges', 'broadcast', 'logs'];

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <Eyebrow>Administração</Eyebrow>
        <h1 className="mt-2 font-display text-[28px] font-medium leading-tight text-text sm:text-[38px]">Admin</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`focus-ring inline-flex min-h-[40px] items-center rounded-full px-4 py-1.5 font-sans text-sm font-medium ${tab === t ? 'bg-gold text-bg' : 'border border-border text-muted-2 hover:text-text'}`}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview stats={stats} />}

      {tab === 'players' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Input id="search" placeholder="Procurar jogadores…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="space-y-1">
              {(players ?? []).map((p) => (
                <button key={p.id} onClick={() => setSelected(p)}
                  className={`focus-ring flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${selected?.id === p.id ? 'bg-gold/10 ring-1 ring-gold/30' : 'bg-surface hover:bg-surface/70'}`}>
                  <span className="text-text">{p.display_name}{p.is_admin && ' ⭐'}{p.suspended && ' 🚫'}</span>
                  <span className="font-mono tabular-nums text-muted-2">{formatAmount(p.balance)}</span>
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
          <Input id="btitle" label="Título" value={bTitle} onChange={(e) => setBTitle(e.target.value)} />
          <Input id="bbody" label="Mensagem" value={bBody} onChange={(e) => setBBody(e.target.value)} />
          <Button variant="primary" onClick={async () => { await broadcast.mutateAsync({ title: bTitle, body: bBody }); setBTitle(''); setBBody(''); setBMsg('Anúncio enviado.'); }}
            disabled={broadcast.isPending || bTitle.trim().length === 0}>
            Enviar anúncio
          </Button>
          {bMsg && <p className="font-sans text-sm text-positive">{bMsg}</p>}
        </div>
      )}

      {tab === 'logs' && <LogsView actions={actions ?? []} players={players ?? []} />}
    </div>
  );
}

/** Action → (label, accent tone) for the audit log. */
const LOG_META: Record<string, { label: string; tone: string }> = {
  adjust_balance: { label: 'Ajuste de saldo', tone: 'bg-gold' },
  set_streak: { label: 'Sequência', tone: 'bg-muted-2' },
  suspend: { label: 'Suspensão', tone: 'bg-negative' },
  unsuspend: { label: 'Reativação', tone: 'bg-positive' },
  suspend_temp: { label: 'Bloqueio temporário', tone: 'bg-negative' },
  settle_fixture: { label: 'Liquidação de jogo', tone: 'bg-positive' },
  set_odds: { label: 'Odds', tone: 'bg-muted-2' },
  upsert_challenge: { label: 'Desafio', tone: 'bg-muted-2' },
  broadcast: { label: 'Anúncio', tone: 'bg-gold' },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
}

/** Human summary of an action's detail payload. */
function logSummary(action: string, detail: Record<string, unknown> | null): string {
  const d = detail ?? {};
  const n = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('pt-PT') : String(v ?? ''));
  switch (action) {
    case 'adjust_balance': return `${Number(d.amount) >= 0 ? '+' : ''}${n(d.amount)} Tt`;
    case 'set_streak': return `${n(d.streak)} dias`;
    case 'suspend_temp': return `${n(d.minutes)} min`;
    case 'settle_fixture': return `resultado ${n(d.score)}`;
    case 'upsert_challenge': return `${n(d.key)} · prémio ${n(d.reward)}`;
    case 'broadcast': return `“${n(d.title)}”`;
    default: return '';
  }
}

function LogsView({ actions, players }: { actions: AdminAction[]; players: Profile[] }) {
  const nameById = new Map(players.map((p) => [p.id, p.display_name]));
  if (actions.length === 0) return <p className="py-10 text-center text-sm text-muted-2">Sem registos ainda.</p>;
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {actions.map((a, i) => {
        const meta = LOG_META[a.action] ?? { label: a.action, tone: 'bg-muted-2' };
        const summary = logSummary(a.action, a.detail);
        const reason = a.detail && typeof a.detail.reason === 'string' ? a.detail.reason : null;
        const target = a.target_user_id ? nameById.get(a.target_user_id) : null;
        return (
          <div key={a.id} className={`flex items-start gap-3 px-3 py-2.5 ${i % 2 ? 'bg-surface/40' : ''}`}>
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.tone}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-sans text-sm font-medium text-text">{meta.label}</span>
                {summary && <span className="font-mono text-xs text-gold">{summary}</span>}
                {target && <span className="font-sans text-xs text-muted">· {target}</span>}
              </div>
              {reason && <p className="truncate font-sans text-xs text-muted-2">{reason}</p>}
            </div>
            <span className="shrink-0 font-sans text-[11px] text-muted-2" title={new Date(a.created_at).toLocaleString('pt-PT')}>
              {relativeTime(a.created_at)}
            </span>
          </div>
        );
      })}
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
      <span className="text-sm text-text">{fixture.home} v {fixture.away} <span className="text-xs text-muted-2">({fixture.status})</span></span>
      {fixture.status !== 'finished' ? (
        <div className="flex items-center gap-2">
          <input type="number" value={h} onChange={(e) => setH(Math.max(0, Number(e.target.value) || 0))} className="focus-ring w-14 rounded border border-border bg-bg px-2 py-1 font-mono text-sm" />
          <span className="text-muted-2">–</span>
          <input type="number" value={a} onChange={(e) => setA(Math.max(0, Number(e.target.value) || 0))} className="focus-ring w-14 rounded border border-border bg-bg px-2 py-1 font-mono text-sm" />
          <Button variant="primary" onClick={() => onSettle({ fixture: fixture.id, home: h, away: a })} className="!px-3 !py-1.5">Liquidar</Button>
        </div>
      ) : (
        <span className="font-mono text-sm tabular-nums text-positive">{fixture.home_score}–{fixture.away_score}</span>
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
      <span className="text-sm text-text">{c.title} <span className="text-xs text-muted-2">({c.track})</span></span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 font-sans text-xs text-muted-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> ativo
        </label>
        <input type="number" value={reward} onChange={(e) => setReward(Math.max(1, Number(e.target.value) || 1))}
          className="focus-ring w-24 rounded border border-border bg-bg px-2 py-1 font-mono text-sm" />
        <Button variant="primary" onClick={() => onSave({ ...c, reward, active })} className="!px-3 !py-1.5">Guardar</Button>
      </div>
    </div>
  );
}
