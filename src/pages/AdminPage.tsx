import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useProfile } from '@/features/profile/useProfile';
import {
  useAdminActions,
  useAdminAnnouncements,
  useAdminChallenges,
  useAdminFixtures,
  useAdminPlayers,
  useAdminPlayerBets,
  useAdminPlayerTransactions,
  useAdminStats,
  useAdminActionsMutations,
  useSetAnnouncementActive,
  type AdminStats,
  type AdminTop,
} from '@/features/admin/useAdmin';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';
import type { AdminAction, AdminPlayerBet, AdminPlayerTransaction, Fixture, Profile } from '@/types/db';

type Tab = 'overview' | 'players' | 'sportsbook' | 'challenges' | 'broadcast' | 'logs';

const TAB_LABEL: Record<Tab, string> = {
  overview: 'Resumo',
  players: 'Jogadores',
  sportsbook: 'Futebol',
  challenges: 'Desafios',
  broadcast: 'Anúncios',
  logs: 'Registo',
};

/** Small inline toast/banner — surfaces action feedback more visibly than a stray line. */
type ToastTone = 'success' | 'error';
function useToast() {
  const [toast, setToast] = useState<{ tone: ToastTone; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const show = (text: string, tone: ToastTone = 'success') => {
    setToast({ tone, text });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4000);
  };
  return { toast, show };
}

function Toast({ toast }: { toast: { tone: ToastTone; text: string } | null }) {
  if (!toast) return null;
  const tone = toast.tone === 'error'
    ? 'border-negative/40 bg-negative/10 text-negative'
    : 'border-positive/40 bg-positive/10 text-positive';
  return (
    <div role="status" className={`animate-fade-in rounded border px-3 py-2 font-sans text-sm ${tone}`}>
      {toast.text}
    </div>
  );
}

/** Small labelled status pill. */
function Pill({ children, tone }: { children: ReactNode; tone: 'gold' | 'negative' | 'muted' }) {
  const cls = tone === 'gold'
    ? 'border-gold/40 text-gold'
    : tone === 'negative'
      ? 'border-negative/40 text-negative'
      : 'border-border text-muted-2';
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 font-sans text-[10px] font-medium uppercase tracking-[0.12em] ${cls}`}>
      {children}
    </span>
  );
}

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
        <Stat label="Jogos jogados" value={n(stats.games_total)} sub="casino + poker" />
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

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const dateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });

/** Is the player under an active temporary block? */
function tempBlock(player: Profile): { until: Date; active: boolean } | null {
  if (!player.suspended_until) return null;
  const until = new Date(player.suspended_until);
  return { until, active: until.getTime() > Date.now() };
}

/** Status pills shown next to a player's name. */
function PlayerPills({ player }: { player: Profile }) {
  const temp = tempBlock(player);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {player.is_admin && <Pill tone="gold">admin</Pill>}
      {player.suspended && <Pill tone="negative">suspenso</Pill>}
      {temp?.active && <Pill tone="negative">bloqueado</Pill>}
    </span>
  );
}

type DetailSection = 'profile' | 'transactions' | 'bets' | 'moderation';
const DETAIL_LABEL: Record<DetailSection, string> = {
  profile: 'Perfil',
  transactions: 'Transações',
  bets: 'Apostas',
  moderation: 'Moderação',
};

/** Master/detail right panel for a selected player. */
function PlayerDetail({ player, onToast }: { player: Profile; onToast: (text: string, tone?: ToastTone) => void }) {
  const [section, setSection] = useState<DetailSection>('profile');
  const sections: DetailSection[] = ['profile', 'transactions', 'bets', 'moderation'];

  return (
    <div className="card space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-medium text-text">{player.display_name}</p>
          <PlayerPills player={player} />
        </div>
        <span className="shrink-0 font-mono text-sm tabular-nums text-gold">{formatAmount(player.balance)}</span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        {sections.map((s) => (
          <button key={s} onClick={() => setSection(s)}
            className={`focus-ring rounded-full px-3 py-1 font-sans text-xs font-medium ${section === s ? 'bg-gold text-bg' : 'border border-border text-muted-2 hover:text-text'}`}>
            {DETAIL_LABEL[s]}
          </button>
        ))}
      </div>

      {section === 'profile' && <PlayerProfile player={player} />}
      {section === 'transactions' && <PlayerTransactions player={player} />}
      {section === 'bets' && <PlayerBets player={player} />}
      {section === 'moderation' && <PlayerActions player={player} onToast={onToast} />}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-2">{label}</span>
      <span className="shrink-0 font-mono tabular-nums text-text">{value}</span>
    </div>
  );
}

function PlayerProfile({ player }: { player: Profile }) {
  return (
    <div className="divide-y divide-border/60">
      <StatRow label="Total apostado" value={formatAmount(player.total_wagered)} />
      <StatRow label="Total ganho" value={formatAmount(player.total_won)} />
      <StatRow label="Total perdido" value={formatAmount(player.total_lost)} />
      <StatRow label="Jogos (jogados / ganhos)" value={`${player.games_played.toLocaleString('pt-PT')} / ${player.games_won.toLocaleString('pt-PT')}`} />
      <StatRow label="Maior ganho" value={formatAmount(player.biggest_win)} />
      <StatRow label="Sequência" value={`${player.streak_count} dias`} />
      <StatRow label="Última atividade" value={player.last_online ? dateTime(player.last_online) : '—'} />
      <StatRow label="Inscrição" value={dateShort(player.created_at)} />
    </div>
  );
}

const TX_LABEL: Record<string, string> = {
  bonus: 'Bónus', bet: 'Aposta', win: 'Ganho', loss: 'Perda', refund: 'Reembolso', adjustment: 'Ajuste',
};

function PlayerTransactions({ player }: { player: Profile }) {
  const { data, isLoading } = useAdminPlayerTransactions(player.id);
  if (isLoading) return <p className="py-6 text-center text-sm text-muted-2">A carregar…</p>;
  const rows = data ?? [];
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-2">Sem transações.</p>;
  return (
    <ul className="divide-y divide-border/60">
      {rows.map((t: AdminPlayerTransaction) => (
        <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <div className="min-w-0">
            <span className="text-text">{TX_LABEL[t.type] ?? t.type}</span>
            {t.game && <span className="ml-1.5 text-xs text-muted-2">· {t.game}</span>}
            {t.note && <p className="truncate text-xs text-muted-2">{t.note}</p>}
          </div>
          <div className="shrink-0 text-right">
            <span className={`font-mono tabular-nums ${t.amount >= 0 ? 'text-positive' : 'text-negative'}`}>
              {t.amount >= 0 ? '+' : ''}{formatAmount(t.amount)}
            </span>
            <p className="font-sans text-[10px] text-muted-2">{dateTime(t.created_at)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

const BET_STATUS: Record<string, { label: string; tone: 'gold' | 'negative' | 'muted' }> = {
  pending: { label: 'aberta', tone: 'gold' },
  won: { label: 'ganha', tone: 'gold' },
  lost: { label: 'perdida', tone: 'negative' },
  void: { label: 'anulada', tone: 'muted' },
};

function PlayerBets({ player }: { player: Profile }) {
  const { data, isLoading } = useAdminPlayerBets(player.id);
  if (isLoading) return <p className="py-6 text-center text-sm text-muted-2">A carregar…</p>;
  const rows = data ?? [];
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-2">Sem apostas.</p>;
  return (
    <ul className="divide-y divide-border/60">
      {rows.map((b: AdminPlayerBet) => {
        const st = BET_STATUS[b.status] ?? { label: b.status, tone: 'muted' as const };
        return (
          <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <span className="font-mono tabular-nums text-text">{formatAmount(b.stake)}</span>
              <span className="ml-1.5 text-xs text-muted-2">@ {b.combined_odds.toFixed(2)} · {formatAmount(b.potential_payout)}</span>
              <p className="font-sans text-[10px] text-muted-2">{dateTime(b.created_at)}</p>
            </div>
            <Pill tone={st.tone}>{st.label}</Pill>
          </li>
        );
      })}
    </ul>
  );
}

function PlayerActions({ player, onToast }: { player: Profile; onToast: (text: string, tone?: ToastTone) => void }) {
  const { adjustBalance, setStreak, setSuspended, suspendUntil } = useAdminActionsMutations();
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [streak, setStreakVal] = useState(player.streak_count);

  const guardReason = () => {
    if (reason.trim().length < 3) { onToast('É necessário um motivo (3+ caracteres).', 'error'); return false; }
    return true;
  };
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); onToast(ok); } catch { onToast('Não foi possível concluir a ação.', 'error'); }
  };

  const temp = tempBlock(player);

  return (
    <div className="space-y-3">
      {temp?.active && (
        <p className="font-sans text-xs text-negative">Bloqueado até {dateTime(temp.until.toISOString())}.</p>
      )}
      <Input id="reason" label="Motivo (obrigatório)" value={reason} onChange={(e) => setReason(e.target.value)} />

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input id="amount" type="number" label="Ajustar saldo (±)" value={amount}
            onChange={(e) => setAmount(Math.floor(Number(e.target.value) || 0))} />
        </div>
        <Button variant="primary" className="shrink-0 !px-4 !py-2.5" onClick={() => { if (guardReason()) void run(() => adjustBalance.mutateAsync({ user: player.id, amount, reason }), 'Saldo ajustado.'); }}>
          Aplicar
        </Button>
      </div>

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input id="streak" type="number" label="Definir sequência" value={streak}
            onChange={(e) => setStreakVal(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
        </div>
        <Button variant="secondary" className="shrink-0 !px-4 !py-2.5" onClick={() => { if (guardReason()) void run(() => setStreak.mutateAsync({ user: player.id, streak, reason }), 'Sequência definida.'); }}>
          Definir
        </Button>
      </div>

      {/* Temporary block — auto-expires, no manual unsuspend needed. */}
      <div>
        <p className="mb-1.5 font-sans text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-2">Bloqueio temporário</p>
        <div className="flex flex-wrap gap-2">
          {TEMP_BLOCKS.map((b) => (
            <Button key={b.minutes} variant="secondary" className="!px-3 !py-1.5"
              onClick={() => { if (guardReason()) void run(() => suspendUntil.mutateAsync({ user: player.id, minutes: b.minutes, reason }), `Bloqueado por ${b.label}.`); }}>
              {b.label}
            </Button>
          ))}
          {temp?.active && (
            <Button variant="ghost" className="!px-3 !py-1.5"
              onClick={() => { if (guardReason()) void run(() => suspendUntil.mutateAsync({ user: player.id, minutes: 0, reason }), 'Bloqueio temporário levantado.'); }}>
              Levantar
            </Button>
          )}
        </div>
      </div>

      <Button variant={player.suspended ? 'secondary' : 'danger'}
        onClick={() => {
          if (!guardReason()) return;
          const next = !player.suspended;
          if (next && !window.confirm(`Suspender ${player.display_name} permanentemente?`)) return;
          void run(() => setSuspended.mutateAsync({ user: player.id, suspended: next, reason }), next ? 'Suspenso.' : 'Reativado.');
        }}>
        {player.suspended ? 'Reativar (permanente)' : 'Suspender (permanente)'}
      </Button>
    </div>
  );
}

type PlayerFilter = 'all' | 'suspended' | 'admins' | 'temp';
const FILTER_LABEL: Record<PlayerFilter, string> = {
  all: 'Todos', suspended: 'Suspensos', admins: 'Admins', temp: 'Bloqueados temporariamente',
};
function matchesFilter(p: Profile, f: PlayerFilter): boolean {
  switch (f) {
    case 'suspended': return p.suspended;
    case 'admins': return p.is_admin;
    case 'temp': return tempBlock(p)?.active ?? false;
    default: return true;
  }
}

export function AdminPage() {
  const { data: profile, isLoading } = useProfile();
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PlayerFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: stats } = useAdminStats();
  const { data: players } = useAdminPlayers(query);
  const { data: fixtures } = useAdminFixtures();
  const { data: challenges } = useAdminChallenges();
  const { data: actions } = useAdminActions();
  const { settleFixture, setOdds, broadcast, upsertChallenge, resetSeason } = useAdminActionsMutations();
  const { toast, show } = useToast();

  const [bTitle, setBTitle] = useState('');
  const [bBody, setBBody] = useState('');

  if (isLoading) return <p className="py-12 text-center text-muted-2">A carregar…</p>;
  if (!profile?.is_admin) {
    return <p className="py-12 text-center text-negative">Apenas administradores.</p>;
  }

  const tabs: Tab[] = ['overview', 'players', 'sportsbook', 'challenges', 'broadcast', 'logs'];
  const visiblePlayers = (players ?? []).filter((p) => matchesFilter(p, filter));
  const selected = visiblePlayers.find((p) => p.id === selectedId) ?? (players ?? []).find((p) => p.id === selectedId) ?? null;

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

      <Toast toast={toast} />

      {tab === 'overview' && (
        <div className="space-y-5">
          <Overview stats={stats} />
          <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-display text-base font-medium text-text">Temporada</p>
              <p className="font-sans text-[12px] text-muted-2">
                Reinicia a tabela da temporada — o resultado de jogo passa a contar a partir de agora.
              </p>
            </div>
            <Button
              variant="secondary"
              disabled={resetSeason.isPending}
              onClick={async () => {
                if (!window.confirm('Reiniciar a temporada agora?')) return;
                try {
                  await resetSeason.mutateAsync();
                  show('Temporada reiniciada.');
                } catch {
                  show('Não foi possível reiniciar.', 'error');
                }
              }}
            >
              {resetSeason.isPending ? 'A reiniciar…' : 'Repor temporada'}
            </Button>
          </div>
        </div>
      )}

      {tab === 'players' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Input id="search" placeholder="Procurar jogadores…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="flex flex-wrap items-center gap-1.5">
              {(Object.keys(FILTER_LABEL) as PlayerFilter[]).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`focus-ring rounded-full px-2.5 py-1 font-sans text-[11px] font-medium ${filter === f ? 'bg-gold text-bg' : 'border border-border text-muted-2 hover:text-text'}`}>
                  {FILTER_LABEL[f]}
                </button>
              ))}
            </div>
            <p className="font-sans text-[11px] text-muted-2">{visiblePlayers.length} {visiblePlayers.length === 1 ? 'jogador' : 'jogadores'}</p>
            <div className="space-y-1">
              {visiblePlayers.map((p) => (
                <button key={p.id} onClick={() => setSelectedId(p.id)}
                  className={`focus-ring flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm ${selectedId === p.id ? 'bg-gold/10 ring-1 ring-gold/30' : 'bg-surface hover:bg-surface/70'}`}>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-text">{p.display_name}</span>
                      <PlayerPills player={p} />
                    </span>
                    <span className="font-sans text-[10px] text-muted-2">
                      {formatAmount(p.total_wagered)} apostado · {p.last_online ? dateTime(p.last_online) : 'nunca online'}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-muted-2">{formatAmount(p.balance)}</span>
                </button>
              ))}
              {visiblePlayers.length === 0 && (
                <p className="py-6 text-center font-sans text-sm text-muted-2">Nenhum jogador corresponde.</p>
              )}
            </div>
          </div>
          {selected && <PlayerDetail key={selected.id} player={selected} onToast={show} />}
        </div>
      )}

      {tab === 'sportsbook' && (
        <div className="space-y-2">
          {(fixtures ?? []).map((f) => (
            <FixtureRow key={f.id} fixture={f} onSettle={settleFixture.mutateAsync} onSetOdds={setOdds.mutateAsync} onToast={show} />
          ))}
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
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card max-w-lg space-y-3 p-4">
            <p className="font-display text-base font-medium text-text">Novo anúncio</p>
            <Input id="btitle" label="Título" value={bTitle} onChange={(e) => setBTitle(e.target.value)} />
            <Input id="bbody" label="Mensagem" value={bBody} onChange={(e) => setBBody(e.target.value)} />
            <Button variant="primary"
              onClick={async () => {
                try {
                  await broadcast.mutateAsync({ title: bTitle, body: bBody });
                  setBTitle(''); setBBody(''); show('Anúncio enviado.');
                } catch { show('Não foi possível enviar.', 'error'); }
              }}
              disabled={broadcast.isPending || bTitle.trim().length === 0}>
              Enviar anúncio
            </Button>
          </div>
          <AnnouncementsList onToast={show} />
        </div>
      )}

      {tab === 'logs' && <LogsView actions={actions ?? []} players={players ?? []} />}
    </div>
  );
}

/** Anúncios → Ativos: every announcement with an activate/deactivate toggle. */
function AnnouncementsList({ onToast }: { onToast: (text: string, tone?: ToastTone) => void }) {
  const { data, isLoading } = useAdminAnnouncements();
  const setActive = useSetAnnouncementActive();
  return (
    <div className="card space-y-2 p-4">
      <p className="font-display text-base font-medium text-text">Ativos</p>
      {isLoading ? (
        <p className="py-4 text-center text-sm text-muted-2">A carregar…</p>
      ) : (data ?? []).length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-2">Sem anúncios.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {(data ?? []).map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-sans text-sm font-medium text-text">{a.title}</span>
                  <Pill tone={a.active ? 'gold' : 'muted'}>{a.active ? 'ativo' : 'inativo'}</Pill>
                </div>
                {a.body && <p className="truncate font-sans text-xs text-muted-2">{a.body}</p>}
                <p className="font-sans text-[10px] text-muted-2">{dateTime(a.created_at)}</p>
              </div>
              <Button variant={a.active ? 'secondary' : 'primary'} className="!px-3 !py-1.5"
                disabled={setActive.isPending}
                onClick={async () => {
                  try {
                    await setActive.mutateAsync({ id: a.id, active: !a.active });
                    onToast(a.active ? 'Anúncio desativado.' : 'Anúncio ativado.');
                  } catch { onToast('Não foi possível atualizar.', 'error'); }
                }}>
                {a.active ? 'Desativar' : 'Ativar'}
              </Button>
            </li>
          ))}
        </ul>
      )}
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
  const [filter, setFilter] = useState<string>('all');
  const nameById = new Map(players.map((p) => [p.id, p.display_name]));
  // Action types present in the log, in LOG_META order, for filter chips.
  const present = Object.keys(LOG_META).filter((k) => actions.some((a) => a.action === k));
  const shown = filter === 'all' ? actions : actions.filter((a) => a.action === filter);

  if (actions.length === 0) return <p className="py-10 text-center text-sm text-muted-2">Sem registos ainda.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setFilter('all')}
          className={`focus-ring rounded-full px-2.5 py-1 font-sans text-[11px] font-medium ${filter === 'all' ? 'bg-gold text-bg' : 'border border-border text-muted-2 hover:text-text'}`}>
          Tudo
        </button>
        {present.map((k) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`focus-ring rounded-full px-2.5 py-1 font-sans text-[11px] font-medium ${filter === k ? 'bg-gold text-bg' : 'border border-border text-muted-2 hover:text-text'}`}>
            {LOG_META[k]!.label}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        {shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-2">Sem registos deste tipo.</p>
        ) : shown.map((a, i) => {
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
    </div>
  );
}

function FixtureRow({ fixture, onSettle, onSetOdds, onToast }: {
  fixture: Fixture;
  onSettle: (v: { fixture: number; home: number; away: number }) => Promise<unknown>;
  onSetOdds: (v: { fixture: number; odds: Record<string, Record<string, number>> }) => Promise<unknown>;
  onToast: (text: string, tone?: ToastTone) => void;
}) {
  const [h, setH] = useState(0);
  const [a, setA] = useState(0);
  const [editOdds, setEditOdds] = useState(false);
  const cur = fixture.odds['1x2'] ?? {};
  const [home, setHome] = useState(cur.home ?? 0);
  const [draw, setDraw] = useState(cur.draw ?? 0);
  const [away, setAway] = useState(cur.away ?? 0);

  const saveOdds = async () => {
    if (home <= 1 || draw <= 1 || away <= 1) { onToast('As odds têm de ser maiores que 1.', 'error'); return; }
    const next = { ...fixture.odds, '1x2': { home, draw, away } };
    try { await onSetOdds({ fixture: fixture.id, odds: next }); setEditOdds(false); onToast('Odds atualizadas.'); }
    catch { onToast('Não foi possível guardar as odds.', 'error'); }
  };

  return (
    <div className="card space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-text">{fixture.home} v {fixture.away} <span className="text-xs text-muted-2">({fixture.status})</span></span>
        {fixture.status !== 'finished' ? (
          <div className="flex items-center gap-2">
            <input type="number" value={h} onChange={(e) => setH(Math.max(0, Number(e.target.value) || 0))} className="focus-ring w-14 rounded border border-border bg-bg px-2 py-1 font-mono text-sm" />
            <span className="text-muted-2">–</span>
            <input type="number" value={a} onChange={(e) => setA(Math.max(0, Number(e.target.value) || 0))} className="focus-ring w-14 rounded border border-border bg-bg px-2 py-1 font-mono text-sm" />
            <Button variant="primary" onClick={() => onSettle({ fixture: fixture.id, home: h, away: a })} className="!px-3 !py-1.5">Liquidar</Button>
            <Button variant="secondary" onClick={() => setEditOdds((v) => !v)} className="!px-3 !py-1.5">Odds</Button>
          </div>
        ) : (
          <span className="font-mono text-sm tabular-nums text-positive">{fixture.home_score}–{fixture.away_score}</span>
        )}
      </div>

      {editOdds && fixture.status !== 'finished' && (
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <OddsField label="1 (Casa)" value={home} onChange={setHome} />
          <OddsField label="X (Empate)" value={draw} onChange={setDraw} />
          <OddsField label="2 (Fora)" value={away} onChange={setAway} />
          <Button variant="primary" onClick={saveOdds} className="!px-4 !py-2.5">Guardar odds</Button>
        </div>
      )}
    </div>
  );
}

function OddsField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="w-20">
      <label className="mb-1 block font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-muted-2">{label}</label>
      <input type="number" step="0.01" min="1" value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="focus-ring w-full rounded border border-border bg-bg px-2 py-1.5 font-mono text-sm" />
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
        <Input id={`reward-${c.key}`} type="number" value={reward}
          onChange={(e) => setReward(Math.max(1, Number(e.target.value) || 1))} className="w-24 !py-1.5 font-mono" />
        <Button variant="primary" onClick={() => onSave({ ...c, reward, active })} className="!px-3 !py-1.5">Guardar</Button>
      </div>
    </div>
  );
}
