import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useFriends } from '@/features/friends/useFriends';
import { usePresence } from '@/features/friends/usePresence';
import { useLeaderboard } from '@/features/friends/useLeaderboard';
import { useProfile } from '@/features/profile/useProfile';
import { levelInfo } from '@/features/profile/level';
import { LevelBadge } from '@/features/profile/LevelBadge';
import { useGameSwitches } from '@/features/admin/useAdmin';
import { PlayerCard } from '@/features/friends/PlayerCard';
import { DailyBonusCard } from '@/features/bonus/DailyBonusCard';
import { CasinoActivity } from '@/features/casino/CasinoActivity';
import { GameCard, type GameTile } from '@/features/casino/GameCard';
import { WinPopup } from '@/features/sportsbook/WinPopup';
import { LandingPage } from '@/pages/LandingPage';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/CoinIcon';
import { RingAvatar, SectionHeader } from '@/components/ui/primitives';
import { formatTos } from '@/lib/format';

/** A game tile's switch key is the last path segment ('/casino/crash' → 'crash'). */
const switchKey = (g: GameTile) => g.to.split('/').filter(Boolean).pop() ?? '';

const LIVE: GameTile[] = [
  { to: '/casino/crash', name: 'Crash', desc: 'Sala ao vivo. Sai antes do foguetão rebentar.', art: 'crash', badge: 'Ao vivo', tone: 'from-chip-ruby/40 to-bg', range: '5 – 100 tós' },
  { to: '/casino/roulette', name: 'Roleta', desc: 'Mesa ao vivo. Todos veem a mesma bola cair.', art: 'roulette', badge: 'Ao vivo', tone: 'from-chip-ruby/40 to-bg', range: '5 – 500 tós' },
  { to: '/casino/corrida', name: 'Corrida de Cavalos', desc: 'Corrida ao vivo. Escolhe o teu cavalo.', art: 'horse', badge: 'Ao vivo', tone: 'from-chip-navy/40 to-bg', range: '5 – 100 tós' },
];

const POPULAR: GameTile[] = [
  { to: '/casino/slots', name: 'Slots', desc: 'Máquinas temáticas, pote progressivo e o Tigrinho.', art: 'slots', badge: 'Máquinas', tone: 'from-gold/30 to-bg', range: '5 – 1000 tós' },
  { to: '/casino/blackjack', name: 'Blackjack', desc: 'O croupier pára nos 17.', art: 'blackjack', tone: 'from-positive-felt/40 to-bg', range: '10 – 500 tós' },
  { to: '/poker', name: 'Poker', desc: 'Texas Hold’em contra bots ou amigos.', art: 'poker', tone: 'from-chip-navy/40 to-bg', range: '100+ tós' },
  { to: '/casino/plinko', name: 'Plinko', desc: 'Larga a bola pelos pinos.', art: 'plinko', badge: 'Novo', tone: 'from-chip-ruby/40 to-bg', range: '5 – 100 tós' },
  { to: '/casino/mines', name: 'Mines', desc: 'Revela diamantes e foge das minas.', art: 'mines', badge: 'Novo', tone: 'from-positive-felt/40 to-bg', range: '5 – 100 tós' },
];

const ARCADE: GameTile[] = [
  { to: '/casino/frango', name: 'Atravessa!', desc: 'A galinha atravessa as faixas.', art: 'chicken', badge: 'Novo', tone: 'from-gold/30 to-bg', range: '5 – 100 tós' },
  { to: '/casino/balatro', name: 'Balatró', desc: 'Joga mãos de póquer para bater a meta.', art: 'balatro', badge: 'Novo', tone: 'from-chip-navy/40 to-bg', range: '5 – 100 tós' },
  { to: '/casino/wheel', name: 'Fita da Sorte', desc: 'A fita pára no multiplicador — até 5×.', art: 'wheel', tone: 'from-gold/30 to-bg', range: '5 – 100 tós' },
  { to: '/casino/chest', name: 'Jogo dos Copos', desc: 'Segue a joia debaixo do copo.', art: 'chest', tone: 'from-gold/30 to-bg', range: '5 – 100 tós' },
  { to: '/casino/maior-menor', name: 'Maior ou Menor', desc: 'Um dado. Maior, menor, ou certo a 5.7×.', art: 'highlow', tone: 'from-chip-navy/40 to-bg', range: '5 – 100 tós' },
  { to: '/casino/dice', name: 'Dados', desc: 'Dois dados. Mais de 7, menos de 7, ou sete.', art: 'dice', tone: 'from-chip-navy/40 to-bg', range: '5 – 100 tós' },
  { to: '/casino/coinflip', name: 'Moeda', desc: 'Cara ou coroa — dobro ou nada.', art: 'coinflip', tone: 'from-gold-light/30 to-bg', range: '5 – 500 tós' },
];

/** Personal welcome strip — greeting, level progress, balance, daily reward. */
function PersonalBar() {
  const { data: profile } = useProfile();
  if (!profile) return <div className="card h-[92px] animate-pulse" />;
  const info = levelInfo(profile.total_wagered);
  return (
    <section className="card flex flex-wrap items-center justify-between gap-x-6 gap-y-4 p-4 sm:p-5">
      <div className="min-w-0">
        <p className="font-display text-xl font-medium text-text sm:text-2xl">
          Olá, <span className="text-gold">{profile.display_name}</span>
        </p>
        <div className="mt-2 flex items-center gap-2.5">
          <LevelBadge level={info.level} />
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-border sm:w-40" title={`${info.progressPct}% para o nível ${info.level + 1}`}>
            <div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${info.progressPct}%` }} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Saldo</p>
          <p className="font-display text-2xl font-semibold leading-none text-gold">{formatTos(profile.balance)}</p>
        </div>
        <Link to="/challenges">
          <Button variant="primary" className="shrink-0">
            <CoinIcon className="h-4 w-4" /> Roleta diária
          </Button>
        </Link>
      </div>
    </section>
  );
}

/** A curated section of wide, cinematic game cards (≤3 per row so they read as
 *  banners, not squares). */
function GameSection({ title, right, games }: { title: string; right?: string; games: GameTile[] }) {
  if (games.length === 0) return null;
  return (
    <section className="space-y-4">
      <SectionHeader title={title} right={right} />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {games.map((g) => (
          <GameCard key={g.to} g={g} />
        ))}
      </div>
    </section>
  );
}

function HighRollers({ onSelect }: { onSelect: (id: string) => void }) {
  const { data } = useLeaderboard('global', 'net');
  return (
    <div className="card space-y-1 p-4 sm:p-5">
      <SectionHeader title="Grandes Apostadores" right="Esta semana" />
      <div className="mt-2 space-y-1">
        {(data ?? []).slice(0, 5).map((row, i) => (
          <button
            key={row.id}
            onClick={() => onSelect(row.id)}
            className={`focus-ring flex w-full items-center gap-3 rounded px-3 py-2 text-left transition-colors hover:bg-gold/[0.07] ${row.is_me ? 'bg-gold/[0.07]' : ''}`}
          >
            <span className={`w-5 text-right font-display ${i < 3 ? 'text-gold' : 'text-muted-2'}`}>{i + 1}</span>
            <RingAvatar initials={row.display_name.slice(0, 2).toUpperCase()} size={34} tone={i < 3 ? 'gold' : 'muted'} />
            <span className="flex-1 truncate font-sans text-sm text-body">{row.display_name}</span>
            <span className="font-mono text-sm text-gold">{formatTos(row.value)}</span>
          </button>
        ))}
        {(!data || data.length === 0) && <p className="px-3 py-2 text-sm text-muted-2">Ainda sem dados.</p>}
      </div>
    </div>
  );
}

function Circle({ onSelect }: { onSelect: (id: string) => void }) {
  const { data: friends } = useFriends();
  const online = usePresence();
  return (
    <div className="card space-y-1 p-4 sm:p-5">
      <SectionHeader title="O Seu Círculo" right={<Link to="/friends" className="hover:text-text">+ Convidar</Link>} />
      <div className="mt-2 space-y-1">
        {(friends ?? []).slice(0, 5).map((f) => (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className="focus-ring flex w-full items-center gap-3 rounded px-3 py-2 text-left transition-colors hover:bg-gold/[0.07]"
          >
            <RingAvatar initials={f.display_name.slice(0, 2).toUpperCase()} size={34} presence={online.has(f.id) ? 'online' : 'offline'} />
            <span className="flex-1 truncate font-sans text-sm text-body">{f.display_name}</span>
            <span className="font-sans text-xs text-muted-2">{online.has(f.id) ? 'Online' : 'Offline'}</span>
          </button>
        ))}
        {(!friends || friends.length === 0) && (
          <p className="px-3 py-2 text-sm text-muted-2">
            Sem amigos ainda — <Link to="/friends" className="text-gold hover:underline">encontre alguns</Link>.
          </p>
        )}
      </div>
    </div>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const { data: switches } = useGameSwitches();
  const [selected, setSelected] = useState<string | null>(null);

  if (!user) return <LandingPage />;

  const off = new Set((switches ?? []).filter((s) => !s.enabled).map((s) => s.key));
  const show = (games: GameTile[]) => games.filter((g) => !off.has(switchKey(g)));

  return (
    <div className="animate-fade-in space-y-8">
      {selected && <PlayerCard userId={selected} onClose={() => setSelected(null)} />}
      <WinPopup />

      <PersonalBar />
      <DailyBonusCard />
      <CasinoActivity />

      {/* Social — leaderboard + your circle, up near the top (not buried at the end) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <HighRollers onSelect={setSelected} />
        <Circle onSelect={setSelected} />
      </div>

      <GameSection title="Ao vivo" right="Multijogador" games={show(LIVE)} />
      <GameSection title="Populares" right="Os preferidos" games={show(POPULAR)} />
      <GameSection title="Arcada" right="Uma jogada" games={show(ARCADE)} />
    </div>
  );
}
