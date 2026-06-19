import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useFriends } from '@/features/friends/useFriends';
import { usePresence } from '@/features/friends/usePresence';
import { useLeaderboard } from '@/features/friends/useLeaderboard';
import { PlayerCard } from '@/features/friends/PlayerCard';
import { DailyBonusCard } from '@/features/bonus/DailyBonusCard';
import { Button } from '@/components/ui/Button';
import { Eyebrow, FramedPanel, RingAvatar, SectionHeader } from '@/components/ui/primitives';
import { GameArt, type GameArtKind } from '@/features/casino/GameArt';
import { formatTos } from '@/lib/format';

interface GameTile {
  to: string;
  name: string;
  desc: string;
  art: GameArtKind;
  badge?: string;
  tone: string; // artwork gradient
  cta?: string;
}

const GAMES: GameTile[] = [
  { to: '/casino/roulette', name: 'Roleta', desc: 'Roleta europeia, zero único.', art: 'roulette', badge: 'Em alta', tone: 'from-chip-ruby/40 to-bg' },
  { to: '/casino/blackjack', name: 'Blackjack', desc: 'O croupier pára nos 17.', art: 'blackjack', tone: 'from-positive-felt/40 to-bg' },
  { to: '/casino/slots', name: 'Slots Aurelia', desc: 'Três rolos, tema Arentim.', art: 'slots', tone: 'from-gold/30 to-bg' },
  { to: '/casino/coinflip', name: 'Moeda', desc: 'Cara ou coroa — dobro ou nada.', art: 'coinflip', badge: 'Novo', tone: 'from-gold-light/30 to-bg' },
  { to: '/poker', name: "Hold'em", desc: 'Contra bots ou amigos.', art: 'poker', tone: 'from-chip-navy/40 to-bg' },
  { to: '/sportsbook', name: 'Futebol', desc: 'Primeira Liga e mais.', art: 'football', badge: 'Ao vivo', tone: 'from-positive-felt/30 to-bg', cta: 'Abrir' },
];

function GameCard({ g }: { g: GameTile }) {
  return (
    <Link to={g.to} className="card card-hover focus-ring group flex flex-col overflow-hidden">
      <div className={`relative h-[120px] bg-gradient-to-br ${g.tone}`}>
        <GameArt kind={g.art} />
        {g.badge && (
          <span className="absolute left-3 top-3 rounded-full border border-gold/40 bg-bg/60 px-2 py-0.5 font-sans text-[9px] uppercase tracking-[0.18em] text-gold">
            {g.badge}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-[22px] font-semibold text-text group-hover:text-gold">{g.name}</h3>
        <p className="mt-1 flex-1 font-sans text-[12.5px] text-muted">{g.desc}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-xs text-muted-2">5 – 500 tós</span>
          <span className="rounded border border-gold/40 px-3 py-1 font-sans text-[10px] uppercase tracking-[0.18em] text-gold transition-colors group-hover:bg-gold group-hover:text-bg">
            {g.cta ?? 'Entrar'}
          </span>
        </div>
      </div>
    </Link>
  );
}

function HighRollers({ onSelect }: { onSelect: (id: string) => void }) {
  const { data } = useLeaderboard('global', 'net');
  return (
    <div className="space-y-3">
      <SectionHeader title="Grandes Apostadores" right="Esta semana" />
      <div className="space-y-1">
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
    <div className="space-y-3">
      <SectionHeader title="O Seu Círculo" right={<Link to="/friends" className="hover:text-text">+ Convidar</Link>} />
      <div className="space-y-1">
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
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="animate-fade-in space-y-10">
      {selected && <PlayerCard userId={selected} onClose={() => setSelected(null)} />}
      {user && <DailyBonusCard />}

      <FramedPanel>
        <div className="max-w-xl">
          <Eyebrow>Bem-vindo ao Arentim</Eyebrow>
          <h1 className="mt-3 font-display text-[44px] font-medium leading-[1.04] text-text">
            A sorte está <span className="italic text-gold">lançada.</span>
          </h1>
          <p className="mt-4 font-sans text-[15px] leading-relaxed text-muted">
            Uma casa de jogos só para amigos. Cada conta começa com 500 Tostões. É tudo a brincar.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/casino/coinflip">
              <Button variant="ghost">Lançar a Moeda</Button>
            </Link>
            <Link to="/sportsbook">
              <Button variant="secondary">Ver Futebol</Button>
            </Link>
          </div>
        </div>
      </FramedPanel>

      <div className="flex flex-wrap gap-8">
        <div className="min-w-[300px] flex-[3_1_600px] space-y-5">
          <SectionHeader title="As Mesas" right="Salão" />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(238px,1fr))] gap-[18px]">
            {GAMES.map((g) => (
              <GameCard key={g.to} g={g} />
            ))}
          </div>
        </div>
        {user && (
          <aside className="min-w-[296px] flex-[1_1_300px] space-y-8">
            <HighRollers onSelect={setSelected} />
            <Circle onSelect={setSelected} />
          </aside>
        )}
      </div>
    </div>
  );
}
