import { Link } from 'react-router-dom';
import { Eyebrow } from '@/components/ui/primitives';

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
      <div className="grid gap-[18px] sm:grid-cols-2">
        <Link to="/poker/bots" className="card card-hover focus-ring group p-6">
          <h2 className="font-display text-[22px] font-semibold text-text group-hover:text-gold">Jogar contra bots</h2>
          <p className="mt-2 font-sans text-[12.5px] text-muted">Mesa para um jogador contra 1 a 5 adversários de IA.</p>
        </Link>
        <Link to="/poker/private" className="card card-hover focus-ring group p-6">
          <h2 className="font-display text-[22px] font-semibold text-text group-hover:text-gold">Mesa privada</h2>
          <p className="mt-2 font-sans text-[12.5px] text-muted">Crie uma mesa, convide amigos com um código e preencha os lugares com bots.</p>
        </Link>
      </div>
    </div>
  );
}
