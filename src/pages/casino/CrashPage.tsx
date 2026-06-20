import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/features/profile/useProfile';
import { useCrashStart, useCrashCashout } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

const W = 100;
const H = 60;

/** Colour a (past) crash multiplier for the history strip. */
function crashColor(m: number): string {
  if (m < 2) return '#e0555f';
  if (m < 5) return '#2b6f4e';
  return '#C9A24B';
}

/** SVG path for the rising curve up to `mult` (rescales to fill the box). */
function curvePath(mult: number): string {
  const yMax = Math.log(Math.max(mult, 2));
  const N = 40;
  let d = '';
  for (let i = 0; i <= N; i++) {
    const frac = i / N;
    const m = Math.pow(mult, frac);
    const x = frac * W;
    const y = H - (Math.log(m) / yMax) * H;
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d.trim();
}

export function CrashPage() {
  const { data: profile } = useProfile();
  const start = useCrashStart();
  const cashout = useCrashCashout();
  const [stake, setStake] = useState(25);
  const [autoOn, setAutoOn] = useState(false);
  const [autoTarget, setAutoTarget] = useState(2);
  const [phase, setPhase] = useState<'idle' | 'flying' | 'watching' | 'done'>('idle');
  const [mult, setMult] = useState(1);
  const [result, setResult] = useState<{ won: boolean; mult: number; crash: number; payout: number } | null>(null);
  const [watchedBust, setWatchedBust] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const [winId, setWinId] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const roundId = useRef<number | null>(null);
  const startedPerf = useRef(0);
  const raf = useRef<number | null>(null);
  const poll = useRef<number | null>(null);
  const watchRaf = useRef<number | null>(null);
  const settling = useRef(false);
  const flyingRef = useRef(false);

  const loadHistory = useCallback(() => {
    void supabase.rpc('crash_history').then(({ data }) => {
      if (Array.isArray(data)) setHistory(data.map(Number));
    });
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const stopLoops = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (poll.current) window.clearInterval(poll.current);
    if (watchRaf.current) cancelAnimationFrame(watchRaf.current);
    raf.current = null;
    poll.current = null;
    watchRaf.current = null;
  }, []);
  useEffect(() => stopLoops, [stopLoops]);

  // After a winning cash-out, fly the rocket on to where it really crashed, so
  // the player sees how far it would have gone (purely cosmetic — already paid).
  const watchToCrash = useCallback((fromMult: number, crash: number) => {
    const startWatch = performance.now();
    const fromT = Math.log(Math.max(1, fromMult)) / 0.15;
    setPhase('watching');
    const tick = () => {
      const elapsed = fromT + (performance.now() - startWatch) / 1000;
      const m = Math.max(1, Math.floor(Math.exp(0.15 * elapsed) * 100) / 100);
      if (m >= crash) {
        setMult(crash);
        setWatchedBust(true);
        setPhase('done');
        watchRaf.current = null;
        return;
      }
      setMult(m);
      watchRaf.current = requestAnimationFrame(tick);
    };
    watchRaf.current = requestAnimationFrame(tick);
  }, []);

  const finish = useCallback(
    async (id: number) => {
      if (settling.current) return;
      settling.current = true;
      flyingRef.current = false;
      stopLoops();
      try {
        const res = await cashout.mutateAsync(id);
        setResult(res);
        loadHistory();
        if (res.won) {
          setWinId((n) => n + 1);
          watchToCrash(res.mult, res.crash); // keep watching until it busts
        } else {
          setMult(res.crash);
          setPhase('done');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'A retirada falhou.');
        setPhase('done');
      }
    },
    [cashout, loadHistory, stopLoops, watchToCrash],
  );

  const balance = profile?.balance ?? 0;
  const tooPoor = stake > balance;

  async function launch() {
    if (phase === 'flying' || phase === 'watching' || tooPoor) return;
    setError(null);
    setResult(null);
    setWatchedBust(false);
    setMult(1);
    settling.current = false;
    try {
      const res = await start.mutateAsync({ stake, autoTarget: autoOn ? autoTarget : null });
      roundId.current = res.round_id;
      startedPerf.current = performance.now();
      flyingRef.current = true;
      setPhase('flying');

      const tick = () => {
        if (!flyingRef.current) return;
        const elapsed = (performance.now() - startedPerf.current) / 1000;
        const m = Math.max(1, Math.floor(Math.exp(0.15 * elapsed) * 100) / 100);
        setMult(m);
        if (autoOn && m >= autoTarget && roundId.current != null) {
          void finish(roundId.current);
          return;
        }
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);

      // Poll the server for the authoritative bust (the client never sees the
      // hidden crash point, so it can't know when to stop on its own).
      poll.current = window.setInterval(() => {
        const id = roundId.current;
        if (id == null || !flyingRef.current) return;
        void supabase.rpc('crash_state', { p_round_id: id }).then(({ data }) => {
          if (data?.phase === 'busted' || data?.phase === 'settled') void finish(id);
        });
      }, 250);
    } catch (e) {
      setPhase('idle');
      setError(e instanceof Error ? e.message : 'O lançamento falhou.');
    }
  }

  function manualCashout() {
    if (phase === 'flying' && roundId.current != null) void finish(roundId.current);
  }

  const flying = phase === 'flying';
  const watching = phase === 'watching';
  // The rocket is "exploded" when it has reached its crash point — either we
  // busted, or we cashed out and watched it fly on to the bust.
  const exploded = watchedBust || (phase === 'done' && !!result && !result.won);
  const endY = H - (Math.log(Math.max(mult, 1.0001)) / Math.log(Math.max(mult, 2))) * H;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Crash</h1>
        <p className="mt-2 font-sans text-sm text-muted">O foguetão sobe. Carregue em Retirar antes de rebentar — quanto mais espera, maior o prémio.</p>
      </div>

      {/* Recent crashes */}
      {history.length > 0 && (
        <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-1.5">
          <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Anteriores</span>
          {history.map((h, i) => (
            <span key={i} className="rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold" style={{ color: crashColor(h), background: `${crashColor(h)}1a` }}>
              {h.toFixed(2)}×
            </span>
          ))}
        </div>
      )}

      <div className="felt felt-rail relative mx-auto max-w-2xl overflow-hidden rounded-lg px-5 py-10 text-center sm:px-10">
        {result?.won && <WinCelebration key={winId} jackpot={result.mult >= 10} />}
        <div className="relative mx-auto h-72 w-full sm:h-80">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            <line x1="0" y1={H} x2={W} y2={H} stroke="rgba(201,162,75,0.2)" strokeWidth="0.5" />
            <path
              d={`${curvePath(mult)} L ${W} ${H} L 0 ${H} Z`}
              fill={exploded ? 'rgba(224,85,95,0.14)' : 'rgba(201,162,75,0.14)'}
            />
            <path
              d={curvePath(mult)}
              fill="none"
              stroke={exploded ? '#e0555f' : '#C9A24B'}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span
            className="absolute text-2xl transition-none"
            style={{ left: `calc(${W - 6}% )`, top: `calc(${(endY / H) * 100}% - 12px)`, transform: 'translate(-50%,-50%)' }}
            aria-hidden
          >
            {exploded ? '💥' : '🚀'}
          </span>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span
              className={`font-mono text-6xl font-bold tabular-nums sm:text-7xl ${
                exploded ? 'text-negative' : flying || watching ? 'text-gold-light' : result?.won ? 'text-positive' : 'text-text'
              }`}
              style={{ textShadow: '0 0 30px rgba(0,0,0,0.65)' }}
            >
              {mult.toFixed(2)}×
            </span>
          </div>
        </div>

        <div className="mt-4 flex min-h-[2.5rem] items-center justify-center px-2 text-center">
          {flying ? (
            <p className="font-sans text-sm text-muted">{autoOn ? `Saída automática a ${autoTarget.toFixed(2)}×` : 'A subir — retire quando quiser.'}</p>
          ) : watching ? (
            <p className="font-display text-base font-bold text-positive">
              Saiu a {result?.mult.toFixed(2)}× — a ver até onde ia…
            </p>
          ) : result ? (
            result.won ? (
              <p className="animate-pop font-display text-xl font-bold text-positive">
                Saiu a {result.mult.toFixed(2)}× — ganhou {formatAmount(result.payout)} tós!
                {watchedBust && (
                  <span className="mt-0.5 block font-sans text-xs font-normal text-muted-2">
                    Acabou por rebentar a {result.crash.toFixed(2)}×
                  </span>
                )}
              </p>
            ) : (
              <p className="font-display text-lg font-bold text-negative">Rebentou a {result.crash.toFixed(2)}×.</p>
            )
          ) : (
            <p className="font-sans text-sm text-muted-2">Defina a aposta e lance o foguetão.</p>
          )}
        </div>

        {flying && (
          <Button variant="primary" onClick={manualCashout} disabled={cashout.isPending} className="mx-auto w-full max-w-sm text-base">
            Retirar {formatAmount(Math.floor(stake * mult))} tós
          </Button>
        )}
      </div>

      <div className="card mx-auto max-w-2xl space-y-4 p-5 sm:p-6">
        <label className="flex cursor-pointer items-center justify-between">
          <span className="font-sans text-[12px] text-muted">Saída automática</span>
          <input type="checkbox" checked={autoOn} disabled={flying || watching} onChange={(e) => setAutoOn(e.target.checked)} className="h-4 w-4 accent-gold" />
        </label>
        {autoOn && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-sans text-[11px] text-muted-2">Sair em</span>
              <span className="font-mono text-sm text-gold">{autoTarget.toFixed(2)}×</span>
            </div>
            <input
              type="range" min={1.1} max={20} step={0.1} value={autoTarget} disabled={flying || watching}
              onChange={(e) => setAutoTarget(Number(e.target.value))}
              className="h-2 w-full cursor-pointer rounded-full accent-gold disabled:opacity-50"
              aria-label="Alvo de saída automática"
            />
          </div>
        )}
        <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={flying || watching} />
        <Button variant="primary" onClick={launch} disabled={flying || watching || tooPoor} className="w-full">
          {flying ? 'Em voo…' : watching ? 'A ver…' : tooPoor ? 'Saldo insuficiente' : `Lançar · ${formatAmount(stake)} tós`}
        </Button>
        {error && <p className="font-sans text-sm text-negative">{error}</p>}
      </div>
    </div>
  );
}
