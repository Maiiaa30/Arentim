import { Link } from 'react-router-dom';
import { Eyebrow } from '@/components/ui/primitives';
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

export function PokerHome() {
  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <Link to="/" className="font-sans text-sm text-muted-2 hover:text-text">
          ← Voltar às Mesas
        </Link>
        <div className="mt-4">
          <Eyebrow>Salão de Póquer</Eyebrow>
          <h1 className="mt-2 font-display text-[40px] font-medium leading-[1.04] text-text">Póquer</h1>
          <p className="mt-3 font-sans text-[15px] leading-relaxed text-muted">
            Texas Hold'em — o servidor distribui, as cartas privadas ficam só para si.
          </p>
        </div>
      </div>

      {/* Felt banner */}
      <div className="felt felt-rail relative flex items-center justify-center overflow-hidden rounded-[16px] p-8 sm:p-12">
        <div className="flex items-center justify-center" aria-hidden>
          {[51, 25, 38, 12].map((c, i) => (
            <div
              key={i}
              className="origin-bottom"
              style={{ transform: `rotate(${(i - 1.5) * 11}deg)`, marginLeft: i === 0 ? 0 : -18 }}
            >
              <PokerCard card={c} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-[18px] sm:grid-cols-2">
        <Link to="/poker/bots" className="card card-hover focus-ring group flex flex-col justify-between gap-6 p-6">
          <div>
            <h2 className="font-display text-[22px] font-semibold text-text group-hover:text-gold">Jogar contra bots</h2>
            <p className="mt-2 font-sans text-[12.5px] text-muted">Mesa para um jogador contra 1 a 5 adversários de IA.</p>
          </div>
          <CardFan cards={[47, 8]} />
        </Link>
        <Link to="/poker/private" className="card card-hover focus-ring group flex flex-col justify-between gap-6 p-6">
          <div>
            <h2 className="font-display text-[22px] font-semibold text-text group-hover:text-gold">Mesa privada</h2>
            <p className="mt-2 font-sans text-[12.5px] text-muted">Crie uma mesa, convide amigos com um código e preencha os lugares com bots.</p>
          </div>
          <CardFan cards={[20, 33]} />
        </Link>
      </div>
    </div>
  );
}
