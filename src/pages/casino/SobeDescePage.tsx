import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useHiloDeal, useHiloBet } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import type { HiLoPick } from '@/features/casino/miniGames';
import type { HiloDealResult } from '@/types/db';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

const RUNGS = [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export function SobeDescePage() {
  const { data: profile } = useProfile();
  const deal = useHiloDeal();
  const bet = useHiloBet();
  const [stake, setStake] = useState(25);
  const [round, setRound] = useState<HiloDealResult | null>(null);
  const [marker, setMarker] = useState(7);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<{ won: boolean; payout: number; next: number; mult: number } | null>(null);
  const [spinId, setSpinId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const balance = profile?.balance ?? 0;
  const tooPoor = stake > balance;

  const dealNew = useCallback(async () => {
    setError(null);
    setResult(null);
    try {
      const r = await deal.mutateAsync();
      setRound(r);
      setMarker(r.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível baralhar.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void dealNew();
  }, [dealNew]);
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  async function play(pick: HiLoPick) {
    if (rolling || tooPoor || !round) return;
    setError(null);
    setResult(null);
    setRolling(true);
    const shuffle = window.setInterval(() => setMarker(1 + Math.floor(Math.random() * 13)), 70);
    try {
      const res = await bet.mutateAsync({ stake, pick });
      timers.current.push(
        window.setTimeout(() => {
          window.clearInterval(shuffle);
          setMarker(res.next);
          setRolling(false);
          setResult({ won: res.won, payout: res.payout, next: res.next, mult: res.mult });
          if (res.won) setSpinId((n) => n + 1);
          // Deal the next random number after a beat.
          timers.current.push(window.setTimeout(() => void dealNew(), 1700));
        }, 800),
      );
    } catch (e) {
      window.clearInterval(shuffle);
      setRolling(false);
      setError(e instanceof Error ? e.message : 'A jogada falhou.');
    }
  }

  const current = round?.current ?? marker;
  const sobeOff = !round || round.sobe_count === 0;
  const desceOff = !round || round.desce_count === 0;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Sobe e Desce</h1>
        <p className="mt-2 font-sans text-sm text-muted">Sai um número de 1 a 13. Aposte se o próximo é maior ou menor — quanto mais difícil o lado, mais paga.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        {/* ---- Game ---- */}
        <div className="felt felt-rail relative overflow-hidden rounded-lg px-5 py-8 sm:px-8">
          {result?.won && <WinCelebration key={spinId} />}
          <div className="flex items-stretch justify-center gap-7">
            {/* Ladder */}
            <div className="flex w-[160px] flex-col gap-1">
              {RUNGS.map((n) => {
                const here = marker === n;
                const isCurrent = !rolling && !result && n === current;
                const above = n > current;
                return (
                  <div
                    key={n}
                    className={`flex items-center gap-2.5 rounded px-3 py-1.5 transition-all duration-150 ${
                      here ? 'scale-[1.06] shadow-[0_0_20px_rgba(201,162,75,0.45)] ring-1 ring-gold' : ''
                    }`}
                    style={{ background: here ? 'rgba(201,162,75,0.22)' : above ? 'rgba(43,111,78,0.12)' : 'rgba(176,48,58,0.12)' }}
                  >
                    <span className={`w-6 text-right font-mono text-base font-bold ${here ? 'text-gold' : 'text-body'}`}>{n}</span>
                    <span
                      className="h-2 flex-1 rounded-full"
                      style={{ background: here ? '#C9A24B' : above ? 'rgba(43,111,78,0.5)' : 'rgba(176,48,58,0.5)' }}
                    />
                    {here && <span className="text-sm">🪙</span>}
                    {isCurrent && !here && <span className="font-sans text-[9px] uppercase tracking-wider text-muted-2">atual</span>}
                  </div>
                );
              })}
            </div>

            {/* Big readout */}
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-gold/20 bg-black/30 px-3 py-4">
              <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-2">
                {rolling ? 'a sair' : result ? 'saiu' : 'número atual'}
              </span>
              <span className={`font-display text-7xl font-bold ${result ? (result.won ? 'text-positive' : 'text-negative') : 'text-gold'}`}>{marker}</span>
              {result ? (
                <span className="mt-1 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {result.next > current ? '▲ subiu' : '▼ desceu'}
                </span>
              ) : (
                <span className="mt-1 font-sans text-[11px] text-muted-2">aposte o próximo</span>
              )}
            </div>
          </div>

          <div className="mt-5 flex min-h-[2.5rem] items-center justify-center px-2 text-center">
            {rolling ? (
              <p className="animate-pulse font-display text-lg italic text-gold-light">A revelar…</p>
            ) : result ? (
              result.won ? (
                <p className="animate-pop font-display text-xl font-bold text-positive">
                  Saiu {result.next} — ganhou {formatAmount(result.payout)} tós! ({result.mult}×)
                </p>
              ) : (
                <p className="font-sans text-sm text-muted">Saiu {result.next} — não foi desta.</p>
              )
            ) : (
              <p className="font-sans text-sm text-muted-2">Escolha maior ou menor que {current}.</p>
            )}
          </div>
        </div>

        {/* ---- Bet ---- */}
        <div className="card space-y-5 p-5 sm:p-6">
          <div>
            <p className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-2">Aposta</p>
            <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={rolling} />
          </div>
          <div className="space-y-2.5">
            <button
              onClick={() => play('sobe')}
              disabled={rolling || tooPoor || sobeOff}
              className="focus-ring flex w-full items-center justify-between rounded-lg border border-positive/40 bg-positive-felt/20 px-4 py-3.5 transition-colors hover:bg-positive-felt/30 disabled:opacity-40"
            >
              <span className="flex flex-col items-start">
                <span className="font-display text-lg font-bold text-positive">▲ Sobe</span>
                <span className="font-sans text-[11px] text-muted-2">maior que {current} · {round?.sobe_count ?? 0} números</span>
              </span>
              <span className="font-mono text-xl font-bold text-gold-light">{round ? round.sobe_mult : 0}×</span>
            </button>
            <button
              onClick={() => play('desce')}
              disabled={rolling || tooPoor || desceOff}
              className="focus-ring flex w-full items-center justify-between rounded-lg border border-negative/40 bg-negative/10 px-4 py-3.5 transition-colors hover:bg-negative/20 disabled:opacity-40"
            >
              <span className="flex flex-col items-start">
                <span className="font-display text-lg font-bold text-negative">▼ Desce</span>
                <span className="font-sans text-[11px] text-muted-2">menor que {current} · {round?.desce_count ?? 0} números</span>
              </span>
              <span className="font-mono text-xl font-bold text-gold-light">{round ? round.desce_mult : 0}×</span>
            </button>
          </div>
          <p className="font-sans text-[11px] text-muted-2">Cada rodada sorteia um número novo. O lado menos provável paga mais.</p>
          {tooPoor && <p className="font-sans text-sm text-negative">Saldo insuficiente para esta aposta.</p>}
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>
      </div>
    </div>
  );
}
