import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useMinesStart, useMinesPick, useMinesCashout } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

const MINE_OPTIONS = [1, 3, 5, 8];

export function MinesPage() {
  const { data: profile } = useProfile();
  const start = useMinesStart();
  const pick = useMinesPick();
  const cashout = useMinesCashout();

  const [stake, setStake] = useState(25);
  const [mines, setMines] = useState(3);
  const [phase, setPhase] = useState<'idle' | 'playing' | 'done'>('idle');
  const [safe, setSafe] = useState<Set<number>>(new Set());
  const [bombs, setBombs] = useState<number[]>([]);
  const [hit, setHit] = useState<number | null>(null);
  const [mult, setMult] = useState(1);
  const [nextMult, setNextMult] = useState(1);
  const [result, setResult] = useState<{ won: boolean; payout: number } | null>(null);
  const [winId, setWinId] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const balance = profile?.balance ?? 0;
  const busy = start.isPending || pick.isPending || cashout.isPending;

  async function begin() {
    setError(null);
    if (stake > balance) { setError('Saldo insuficiente.'); return; }
    try {
      const r = await start.mutateAsync({ stake, mines });
      setPhase('playing');
      setSafe(new Set());
      setBombs([]);
      setHit(null);
      setResult(null);
      setMult(1);
      setNextMult(Number(r.next_multiplier ?? 1));
    } catch {
      setError('Não foi possível começar.');
    }
  }

  async function reveal(cell: number) {
    if (phase !== 'playing' || busy || safe.has(cell)) return;
    try {
      const r = await pick.mutateAsync(cell);
      if (!r.safe) {
        setHit(cell);
        setBombs(r.mines ?? []);
        setResult({ won: false, payout: 0 });
        setPhase('done');
        return;
      }
      setSafe(new Set(r.picks));
      setMult(Number(r.multiplier ?? 1));
      setNextMult(Number(r.next_multiplier ?? r.multiplier ?? 1));
      if (r.cashed) {
        setBombs(r.mines ?? []);
        setResult({ won: true, payout: r.payout ?? 0 });
        setPhase('done');
        setWinId((n) => n + 1);
      }
    } catch {
      setError('Jogada inválida.');
    }
  }

  async function takeMoney() {
    if (phase !== 'playing' || safe.size === 0) return;
    try {
      const r = await cashout.mutateAsync();
      setBombs(r.mines);
      setMult(Number(r.multiplier));
      setResult({ won: true, payout: r.payout });
      setPhase('done');
      setWinId((n) => n + 1);
    } catch {
      setError('A retirada falhou.');
    }
  }

  const cashValue = Math.floor(stake * mult);

  function tileFace(i: number) {
    const isSafe = safe.has(i);
    const isBomb = phase === 'done' && bombs.includes(i);
    if (isBomb) return i === hit ? '💥' : '💣';
    if (isSafe) return '💎';
    return '';
  }
  function tileCls(i: number) {
    const isSafe = safe.has(i);
    const isBomb = phase === 'done' && bombs.includes(i);
    if (isBomb) return i === hit ? 'bg-negative/30 ring-1 ring-negative' : 'bg-negative/15';
    if (isSafe) return 'bg-positive/15 ring-1 ring-positive/40';
    if (phase === 'playing') return 'bg-surface-raised hover:bg-gold/15 cursor-pointer';
    return 'bg-surface-raised/60';
  }

  return (
    <div className="animate-fade-in space-y-6">
      {result?.won && <WinCelebration key={winId} jackpot={mult >= 10} />}
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Mines</h1>
        <p className="mt-2 font-sans text-sm text-muted">Revela diamantes para subir o multiplicador. Retira antes de tocares numa mina.</p>
      </div>

      <div className="felt felt-rail mx-auto max-w-md rounded-lg p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-center gap-4 text-center">
          <div>
            <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Multiplicador</p>
            <p className={`font-mono text-2xl font-bold tabular-nums ${phase === 'done' && !result?.won ? 'text-negative' : 'text-gold'}`}>{mult.toFixed(2)}×</p>
          </div>
          {phase === 'playing' && (
            <div>
              <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Próximo</p>
              <p className="font-mono text-lg tabular-nums text-muted">{nextMult.toFixed(2)}×</p>
            </div>
          )}
        </div>

        <div className="mx-auto grid max-w-[320px] grid-cols-5 gap-1.5">
          {Array.from({ length: 25 }, (_, i) => (
            <button
              key={i}
              onClick={() => reveal(i)}
              disabled={phase !== 'playing' || busy || safe.has(i)}
              className={`focus-ring flex aspect-square items-center justify-center rounded-md text-xl transition-colors ${tileCls(i)}`}
            >
              {tileFace(i)}
            </button>
          ))}
        </div>

        <div className="mt-4 min-h-[2rem] text-center">
          {phase === 'done' && result && (
            <p className={`font-display text-base font-bold ${result.won ? 'text-positive' : 'text-negative'}`}>
              {result.won ? `Retiraste ${formatAmount(result.payout)} tós!` : 'Rebentaste numa mina.'}
            </p>
          )}
        </div>

        {phase === 'playing' && (
          <Button variant="primary" onClick={takeMoney} disabled={safe.size === 0 || busy} className="w-full">
            Retirar {formatAmount(cashValue)} tós
          </Button>
        )}
      </div>

      {phase !== 'playing' && (
        <div className="card mx-auto max-w-md space-y-4 p-5">
          <div>
            <span className="mb-2 block font-sans text-sm font-medium text-muted">Minas</span>
            <div className="flex gap-2">
              {MINE_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMines(m)}
                  className={`focus-ring rounded px-3 py-1.5 font-mono text-sm ${mines === m ? 'bg-gold text-bg' : 'border border-border text-muted hover:text-text'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <StakeChips stake={stake} onChange={setStake} balance={balance} />
          <Button variant="primary" onClick={begin} disabled={busy || stake > balance} className="w-full">
            {stake > balance ? 'Saldo insuficiente' : `Jogar · ${formatAmount(stake)} tós`}
          </Button>
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>
      )}
    </div>
  );
}
