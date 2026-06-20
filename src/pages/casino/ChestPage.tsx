import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useChest } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

export function ChestPage() {
  const { data: profile } = useProfile();
  const chest = useChest();
  const [stake, setStake] = useState(25);
  const [opened, setOpened] = useState<{ index: number; layout: number[]; mult: number; payout: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [winId, setWinId] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const balance = profile?.balance ?? 0;
  const tooPoor = stake > balance;

  async function pick(i: number) {
    if (busy || opened || tooPoor) return;
    setError(null);
    setBusy(true);
    try {
      const res = await chest.mutateAsync({ stake, pick: i });
      setOpened({ index: i, layout: res.layout.map(Number), mult: res.multiplier, payout: res.payout });
      if (res.payout > 0) setWinId((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível abrir o baú.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Baú do Tesouro</h1>
        <p className="mt-2 font-sans text-sm text-muted">Escolha um dos nove baús. A maioria está vazia — mas um esconde 5× a aposta.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        {/* ---- Game ---- */}
        <div className="felt felt-rail relative overflow-hidden rounded-lg px-5 py-8 text-center sm:px-8">
          {opened && opened.payout > 0 && <WinCelebration key={winId} jackpot={opened.mult >= 5} />}
          <div className="mx-auto grid max-w-[360px] grid-cols-3 gap-3">
            {Array.from({ length: 9 }, (_, i) => {
              const isOpen = !!opened;
              const val = opened?.layout[i];
              const picked = opened?.index === i;
              const win = picked && (opened?.mult ?? 0) > 0;
              return (
                <button
                  key={i}
                  onClick={() => pick(i)}
                  disabled={busy || isOpen}
                  className={`focus-ring relative flex aspect-square items-center justify-center rounded-xl border-2 text-3xl transition-all ${
                    !isOpen
                      ? 'border-gold/30 bg-black/30 hover:scale-105 hover:border-gold/70'
                      : picked
                        ? win
                          ? 'border-gold bg-gold/20 shadow-[0_0_22px_rgba(201,162,75,0.5)]'
                          : 'border-negative/60 bg-negative/10'
                        : 'border-border/40 bg-black/20 opacity-55'
                  }`}
                >
                  {!isOpen ? (
                    <span className="animate-floaty" style={{ animationDelay: `${i * -0.25}s` }}>🧰</span>
                  ) : val && val > 0 ? (
                    <span className="flex flex-col items-center">
                      <span className="text-2xl">💰</span>
                      <span className="font-mono text-sm font-bold text-gold-light">{val}×</span>
                    </span>
                  ) : (
                    <span className="text-xl opacity-50">·</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex min-h-[2.5rem] items-center justify-center px-2">
            {opened ? (
              opened.payout > 0 ? (
                <p className="animate-pop font-display text-xl font-bold text-positive">
                  {opened.mult}× — ganhou {formatAmount(opened.payout)} tós!
                </p>
              ) : (
                <p className="font-sans text-sm text-muted">Baú vazio — tente outra vez.</p>
              )
            ) : (
              <p className="font-sans text-sm text-muted-2">{busy ? 'A abrir…' : 'Defina a aposta e escolha um baú.'}</p>
            )}
          </div>
        </div>

        {/* ---- Bet ---- */}
        <div className="card space-y-5 p-5 sm:p-6">
          <div>
            <p className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-2">Aposta</p>
            <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={busy || !!opened} />
          </div>
          {opened ? (
            <Button variant="primary" onClick={() => setOpened(null)} className="w-full">Novo baú</Button>
          ) : (
            <p className="font-sans text-[12px] text-muted">Toque num baú na mesa para abrir com {formatAmount(stake)} tós.</p>
          )}
          {tooPoor && <p className="font-sans text-sm text-negative">Saldo insuficiente para esta aposta.</p>}
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>
      </div>
    </div>
  );
}
