import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile, useUpdateProfile } from '@/features/profile/useProfile';
import { useChallenges } from '@/features/challenges/useChallenges';
import { useTransactions } from '@/features/wallet/useTransactions';
import { netResult, winRate } from '@/features/profile/stats';
import { AchievementsGrid } from '@/features/profile/AchievementsGrid';
import { AccountSecurity } from '@/features/auth/AccountSecurity';
import { formatAmount, formatTos } from '@/lib/format';
import { displayNameSchema } from '@/features/auth/schema';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Eyebrow, RingAvatar, SectionHeader } from '@/components/ui/primitives';
import { HeroFrame } from '@/components/ui/HeroFrame';
import { Skeleton } from '@/components/ui/Skeleton';
import type { TransactionType } from '@/types/db';

const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-PT', { year: 'numeric', month: 'short' });

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Agora mesmo';
  if (m < 60) return `Há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Ontem' : `Há ${d} dias`;
}

const TX_EMBLEM: Record<TransactionType, string> = {
  bonus: '❖', bet: '▲', win: '◉', loss: '◐', refund: '⟲', adjustment: '⚑',
};
const TX_LABEL: Record<TransactionType, string> = {
  bonus: 'Bónus', bet: 'Aposta', win: 'Ganho', loss: 'Perda', refund: 'Reembolso', adjustment: 'Ajuste',
};

function StatCard({ label, value, sub, tone = 'text-text' }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="card p-5">
      <p className="font-sans text-[10.5px] uppercase tracking-[0.18em] text-muted-2">{label}</p>
      <p className={`mt-1 font-display text-3xl font-medium tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 font-sans text-xs text-muted-2">{sub}</p>
    </div>
  );
}

export function ProfilePage() {
  const { data: profile, isLoading, error } = useProfile();
  const { data: challenges } = useChallenges();
  const { data: activity } = useTransactions({ limit: 8 });
  const updateProfile = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-8">
        <Skeleton className="h-44 w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (error || !profile) return <p className="py-12 text-center text-negative">Não foi possível carregar o perfil.</p>;

  const net = netResult(profile);
  const handle = profile.display_name.toLowerCase().replace(/\s+/g, '');
  const initials = profile.display_name.slice(0, 2).toUpperCase();

  async function save() {
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Nome inválido');
      return;
    }
    try {
      await updateProfile.mutateAsync({ display_name: parsed.data });
      setEditing(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Não foi possível guardar');
    }
  }

  return (
    <div className="animate-fade-in space-y-8">
      <Link to="/" className="font-sans text-sm text-muted-2 hover:text-text">
        ← Voltar às Mesas
      </Link>

      <HeroFrame>
        <div className="flex flex-wrap items-center gap-5 sm:gap-6">
          <RingAvatar initials={initials} size={96} />
          <div className="min-w-[180px] flex-1">
            {editing ? (
              <div className="max-w-xs space-y-2">
                <Input id="displayName" label="Nome de exibição" value={name}
                  onChange={(e) => setName(e.target.value)} error={formError ?? undefined} />
                <div className="flex gap-2">
                  <Button variant="primary" onClick={save} disabled={updateProfile.isPending}>
                    {updateProfile.isPending ? 'A guardar…' : 'Guardar'}
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <>
                <Eyebrow>{profile.is_admin ? 'Administrador' : 'Membro Ouro'}</Eyebrow>
                <h1 className="mt-2 break-words font-display text-[28px] font-medium leading-tight text-text sm:text-[38px]">
                  {profile.display_name}
                </h1>
                <p className="mt-1 break-words font-sans text-sm text-muted-2">
                  @{handle} · Membro desde {monthYear(profile.created_at)}
                </p>
                <button onClick={() => { setName(profile.display_name); setFormError(null); setEditing(true); }}
                  className="mt-2 inline-flex min-h-[40px] items-center font-sans text-sm text-gold hover:underline">
                  Editar perfil
                </button>
              </>
            )}
          </div>
          <div className="w-full border-gold/20 sm:w-auto sm:border-l sm:pl-6">
            <p className="font-sans text-[10.5px] uppercase tracking-[0.18em] text-muted-2">Saldo</p>
            <p className="flex items-baseline gap-1 font-display text-3xl font-medium text-gold">
              <AnimatedNumber value={profile.balance} /> <span className="font-mono text-base">tós</span>
            </p>
            <Link to="/challenges">
              <Button variant="ghost" className="mt-3 !px-4 !py-2">Adicionar Tostões</Button>
            </Link>
          </div>
        </div>
      </HeroFrame>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Jogos" value={formatAmount(profile.games_played)} sub="no total" />
        <StatCard label="Apostado" value={formatTos(profile.total_wagered)} sub="ao longo do tempo" />
        <StatCard label="Ganho total" value={formatTos(profile.total_won)} sub="em prémios" tone="text-positive" />
        <StatCard label="Maior ganho" value={formatTos(profile.biggest_win)} sub="num só lance" tone="text-positive" />
        <StatCard label="Taxa de vitória" value={`${winRate(profile)}%`} sub="ao longo do tempo" tone="text-gold" />
        <StatCard
          label="Resultado"
          value={`${net >= 0 ? '+' : '−'}${formatAmount(Math.abs(net))} tós`}
          sub="ganhos − perdas"
          tone={net >= 0 ? 'text-positive' : 'text-negative'}
        />
      </div>

      <AchievementsGrid profile={profile} />

      <AccountSecurity />

      <div className="flex flex-wrap gap-5 sm:gap-[30px]">
        <div className="min-w-0 flex-[3_1_560px] space-y-3">
          <SectionHeader title="Atividade Recente" />
          <div className="card divide-y divide-border">
            {(activity ?? []).length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-2">Ainda sem atividade.</p>
            ) : (
              (activity ?? []).map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/30 text-gold">
                    {TX_EMBLEM[t.type]}
                  </span>
                  <div className="flex-1">
                    <p className="font-sans text-sm text-body">
                      {TX_LABEL[t.type]}{t.game ? ` · ${t.game}` : ''}
                    </p>
                    <p className="font-sans text-xs text-muted-2">{relativeTime(t.created_at)}</p>
                  </div>
                  <span className={`font-mono text-sm ${t.amount >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {t.amount >= 0 ? '+' : '−'}{formatAmount(Math.abs(t.amount))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <aside className="min-w-0 flex-[1_1_280px] space-y-3">
          <SectionHeader title="Distinções" />
          <div className="space-y-2">
            {(challenges ?? []).map((c) => (
              <div
                key={c.key}
                className={`card flex items-center gap-3 p-3 ${c.claimed ? '' : 'opacity-50'}`}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm"
                  style={c.claimed
                    ? { background: 'linear-gradient(140deg,#C9A24B,#6b542a)', color: '#0a0907' }
                    : { border: '1px solid rgba(201,162,75,0.2)', color: '#8a7f63' }}
                >
                  🏅
                </span>
                <div>
                  <p className={`font-sans text-sm ${c.claimed ? 'text-text' : 'text-muted-2'}`}>{c.title}</p>
                  <p className="font-sans text-xs text-muted-2">{c.description}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
