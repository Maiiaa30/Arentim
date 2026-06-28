import { Link } from 'react-router-dom';
import { Eyebrow, FramedPanel } from '@/components/ui/primitives';
import { UiIcon } from '@/components/icons/UiIcon';
import { PokerCard } from '@/features/poker/PokerCard';

// A small fanned hand of face-up cards as decoration on each lobby card.
function CardFan({ cards }: { cards: number[] }) {
  return (
    <div className="pointer-events-none flex items-end" aria-hidden>
      {cards.map((c, i) => (
        <div
          key={i}
          className="origin-bottom transition-transform duration-300 group-hover:-translate-y-1"
          style={{ transform: `rotate(${(i - (cards.length - 1) / 2) * 9}deg)`, marginLeft: i === 0 ? 0 : -16 }}
        >
          <PokerCard card={c} small />
        </div>
      ))}
    </div>
  );
}

/** A small muted info pill — stake range, seats, fairness. */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border px-3 py-1 font-sans text-[11px] text-muted-2">{children}</span>
  );
}

/** A choosable poker mode — title, blurb, decorative hand, and a gold "Entrar" CTA. */
function ModeCard({ to, title, desc, fan }: { to: string; title: string; desc: string; fan: number[] }) {
  return (
    <Link to={to} className="card card-hover focus-ring group relative flex flex-col justify-between gap-6 overflow-hidden p-6">
      <div>
        <h2 className="font-display text-[22px] font-semibold text-text transition-colors group-hover:text-gold">{title}</h2>
        <p className="mt-2 max-w-sm font-sans text-[12.5px] leading-relaxed text-muted">{desc}</p>
      </div>
      <div className="flex items-end justify-between gap-4">
        <CardFan cards={fan} />
        <span className="flex items-center gap-1.5 font-sans text-[12px] font-medium text-gold">
          Entrar <UiIcon name="arrowRight" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

export function PokerHome() {
  return (
    <div className="animate-fade-in space-y-8">
      <Link to="/" className="font-sans text-sm text-muted-2 hover:text-text">← Voltar às Mesas</Link>

      <FramedPanel>
        <div className="flex items-center justify-between gap-8">
          <div className="max-w-xl">
            <Eyebrow>Salão de Poker</Eyebrow>
            <h1 className="mt-3 font-display text-[40px] font-medium leading-[1.04] text-text sm:text-[44px]">
              Texas <span className="italic text-gold">Hold'em</span>
            </h1>
            <p className="mt-3 font-sans text-[14.5px] leading-relaxed text-muted">
              O servidor distribui — as cartas privadas ficam só para si. Jogue contra bots ou abra uma
              mesa privada para os amigos.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Pill>100+ tós</Pill>
              <Pill>1–6 jogadores</Pill>
              <Pill>Justo &amp; verificável</Pill>
            </div>
          </div>
          {/* Fanned hand — the hero's emblem, hidden on phones. */}
          <div className="hidden shrink-0 items-center justify-center sm:flex" aria-hidden>
            {[51, 25, 38, 12].map((c, i) => (
              <div key={i} className="origin-bottom" style={{ transform: `rotate(${(i - 1.5) * 10}deg)`, marginLeft: i === 0 ? 0 : -20 }}>
                <PokerCard card={c} />
              </div>
            ))}
          </div>
        </div>
      </FramedPanel>

      <div className="grid gap-[18px] sm:grid-cols-2">
        <ModeCard
          to="/poker/bots"
          title="Jogar contra bots"
          desc="Mesa para um jogador contra 1 a 5 adversários de IA. Comece já, sem esperar por ninguém."
          fan={[47, 8]}
        />
        <ModeCard
          to="/poker/private"
          title="Mesa privada"
          desc="Crie uma mesa, convide amigos com um código e preencha os lugares vazios com bots."
          fan={[20, 33]}
        />
      </div>
    </div>
  );
}
