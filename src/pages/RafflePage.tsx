import { useEffect, useMemo, useState } from 'react';
import { useRaffle, useBuyTickets } from '@/features/raffle/useRaffle';
import { useProfile } from '@/features/profile/useProfile';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount, formatTostoes } from '@/lib/format';
import { Eyebrow, SectionHeader } from '@/components/ui/primitives';

const QUICK = [1, 5, 10, 25];

/** "2d 04:11:09" / "04:11:09" until the draw. */
function untilDraw(drawsAt: string, now: number): string {
  const ms = Math.max(0, new Date(drawsAt).getTime() - now);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return d > 0 ? `${d}d ${clock}` : clock;
}

export function RafflePage() {
  const { data: raffle } = useRaffle();
  const { data: profile } = useProfile();
  const buy = useBuyTickets();
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const price = raffle?.ticket_price ?? 0;
  const cost = price * qty;
  const balance = profile?.balance ?? 0;
  const myOdds = useMemo(() => {
    if (!raffle || raffle.total_tickets === 0 || raffle.my_tickets === 0) return 0;
    return Math.round((raffle.my_tickets / raffle.total_tickets) * 100);
  }, [raffle]);

  async function onBuy() {
    setMsg(null);
    try {
      const res = await buy.mutateAsync(qty);
      if (res.status === 'bought') setMsg(`Comprou ${qty} bilhete(s) por ${formatTostoes(res.cost ?? cost)}.`);
      else if (res.status === 'insufficient') setMsg('Saldo insuficiente para esses bilhetes.');
      else setMsg('A rifa desta semana já fechou — vai abrir a próxima.');
    } catch {
      setMsg('Não foi possível comprar agora. Tente outra vez.');
    }
  }

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <Eyebrow>Sorteio semanal</Eyebrow>
        <h1 className="mt-2 font-display text-[28px] font-medium leading-tight text-text sm:text-[34px]">
          Rifa
        </h1>
        <p className="mt-1 font-sans text-sm text-muted-2">
          Compre bilhetes durante a semana. Domingo às 20h, um de vocês leva o pote inteiro.
        </p>
      </div>

      {/* Pote + contagem decrescente */}
      <section className="card border-gold/40 p-6 text-center sm:p-8">
        <p className="font-sans text-xs uppercase tracking-wide text-muted-2">Pote desta semana</p>
        <p className="mt-2 flex items-center justify-center gap-2 font-mono text-4xl font-semibold text-gold sm:text-5xl">
          <CoinIcon className="h-7 w-7" /> {formatAmount(raffle?.pot ?? 0)}
        </p>
        <p className="mt-3 font-sans text-sm text-muted-2">
          Sorteio em{' '}
          <span className="font-mono tabular-nums text-text">
            {raffle ? untilDraw(raffle.draws_at, now) : '—'}
          </span>
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 font-sans text-sm text-muted-2">
          <span>{formatAmount(raffle?.total_tickets ?? 0)} bilhetes vendidos</span>
          <span>
            Os seus: <span className="font-medium text-text">{formatAmount(raffle?.my_tickets ?? 0)}</span>
            {myOdds > 0 && <span className="text-gold"> · {myOdds}% de hipóteses</span>}
          </span>
        </div>
      </section>

      {/* Comprar bilhetes */}
      <section className="card space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-medium text-text sm:text-xl">Comprar bilhetes</h2>
          <span className="font-mono text-xs text-muted-2">
            {formatAmount(price)} tós / bilhete
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK.map((n) => (
            <button
              key={n}
              onClick={() => setQty(n)}
              className={`rounded-md border px-4 py-2 font-mono text-sm transition-colors ${
                qty === n
                  ? 'border-gold bg-gold/10 text-gold'
                  : 'border-border text-muted-2 hover:border-gold/40'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-sans text-sm text-muted-2">
            Custo: <span className="font-mono font-medium text-text">{formatAmount(cost)} tós</span>
            <span className="ml-2 text-xs">(saldo {formatAmount(balance)})</span>
          </span>
          <Button variant="primary" onClick={onBuy} disabled={buy.isPending || cost > balance || cost === 0}>
            {buy.isPending ? 'A comprar…' : (
              <>
                <CoinIcon className="h-4 w-4" /> Comprar {qty}
              </>
            )}
          </Button>
        </div>
        {msg && <p className="animate-fade-in font-sans text-sm font-medium text-positive">{msg}</p>}
      </section>

      {/* Vencedores recentes */}
      {raffle && raffle.recent.length > 0 && (
        <section className="space-y-4">
          <SectionHeader title="Vencedores recentes" />
          <div className="space-y-2">
            {raffle.recent.map((r) => (
              <div
                key={r.id}
                className="card flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="flex items-center gap-2 font-sans text-sm text-text">
                  🏆 {r.winner_name ?? 'Sem vencedor'}
                  <span className="font-mono text-xs text-muted-2">
                    · {formatAmount(r.total_tickets)} bilhetes
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 font-mono text-sm font-semibold text-gold">
                  <CoinIcon className="h-3.5 w-3.5" /> {formatAmount(r.pot)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
