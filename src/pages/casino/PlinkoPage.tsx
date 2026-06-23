import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { usePlinko } from '@/features/casino/usePlinko';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount, formatDelta } from '@/lib/format';
import {
  PLINKO_MULT,
  plinkoBinColor,
  type PlinkoResult,
  type PlinkoRisk,
  type PlinkoRows,
} from '@/features/casino/plinko';

const ROWS_OPTS: PlinkoRows[] = [8, 12, 16];
const RISK_OPTS: { id: PlinkoRisk; label: string }[] = [
  { id: 'low', label: 'Baixo' },
  { id: 'medium', label: 'Médio' },
  { id: 'high', label: 'Alto' },
];

// Board geometry in a 0..100 viewBox (× a taller height). Row r (0-indexed) has
// r+1 pegs centred horizontally; bin b sits under peg column b.
const VB_W = 100;
const PAD_X = 8;
const TOP_Y = 8;

// A floating win/loss marker that pops over the bin a ball just landed in. Each
// ball spawns its own, so several balls landing at once each get a marker.
interface Pop {
  id: number;
  bin: number;
  mult: number;
  net: number; // payout − stake for this ball
  win: boolean;
}
// One entry per settled ball, newest first — the "Últimas" history strip.
interface RecentDrop {
  id: number;
  mult: number;
  win: boolean;
}
const POP_MS = 1500; // matches the plinko-rise animation duration
const RECENT_MAX = 14;
const CELEBRATE_MULT = 2; // floating pop covers small wins; confetti only for big ones
const JACKPOT_MULT = 10;

function pegX(row: number, col: number, rows: number): number {
  const span = VB_W - 2 * PAD_X;
  const step = span / rows;
  const rowWidth = step * row;
  const start = (VB_W - rowWidth) / 2;
  return start + step * col;
}

function fmtMult(m: number): string {
  if (m >= 100) return `${Math.round(m)}×`;
  if (m >= 10) return `${m.toFixed(0)}×`;
  return `${m}×`;
}

export function PlinkoPage() {
  const { data: profile } = useProfile();
  const game = usePlinko();
  const [stake, setStake] = useState(25);
  const [rows, setRows] = useState<PlinkoRows>(12);
  const [risk, setRisk] = useState<PlinkoRisk>('medium');
  // Several balls can be in flight at once (drop up to MAX_BALLS rapidly). Each
  // ball animates on its own rAF loop and is removed when it lands.
  const [balls, setBalls] = useState<{ id: number; x: number; y: number }[]>([]);
  // Per-ball win feedback — independent of how many balls land together.
  const [pops, setPops] = useState<Pop[]>([]);
  const [recent, setRecent] = useState<RecentDrop[]>([]);
  const [session, setSession] = useState({ drops: 0, staked: 0, won: 0 });
  const [result, setResult] = useState<PlinkoResult | null>(null);
  // Full-screen confetti, decoupled from `result` so it isn't unmounted when a
  // later ball lands on a loss while a big win's burst is still playing.
  const [celebrate, setCelebrate] = useState<{ id: number; jackpot: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ballSeq = useRef(0);
  const popSeq = useRef(0);
  const rafs = useRef<Set<number>>(new Set());
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(
    () => () => {
      rafs.current.forEach((id) => cancelAnimationFrame(id));
      rafs.current.clear();
      timers.current.forEach((id) => clearTimeout(id));
      timers.current.clear();
    },
    [],
  );

  const balance = profile?.balance ?? 0;
  const inFlight = balls.length;
  const MAX_BALLS = 8;
  // Each in-flight ball already locked a stake; don't let the total exceed balance.
  const tooPoor = stake > balance - inFlight * stake;
  const settingsLocked = inFlight > 0;
  const mults = PLINKO_MULT[rows][risk];
  const rowHeight = (100 - TOP_Y) / (rows + 1);
  const net = session.won - session.staked;

  // Pre-compute the bin centre X positions (bottom row, b in 0..rows).
  const binXs = useMemo(
    () => Array.from({ length: rows + 1 }, (_, b) => pegX(rows, b, rows)),
    [rows],
  );
  // Bins currently showing a marker pulse (a Set, so several light up at once).
  const activeBins = useMemo(() => new Set(pops.map((p) => p.bin)), [pops]);

  function settleBall(bin: number, res: PlinkoResult, ballStake: number) {
    const win = res.multiplier > 1;
    setResult(res);
    setSession((s) => ({ drops: s.drops + 1, staked: s.staked + ballStake, won: s.won + res.payout }));
    setRecent((r) => [{ id: popSeq.current, mult: res.multiplier, win }, ...r].slice(0, RECENT_MAX));

    const popId = (popSeq.current += 1);
    setPops((ps) => [...ps, { id: popId, bin, mult: res.multiplier, net: res.payout - ballStake, win }]);
    const t = setTimeout(() => {
      setPops((ps) => ps.filter((p) => p.id !== popId));
      timers.current.delete(t);
    }, POP_MS);
    timers.current.add(t);

    if (res.multiplier >= CELEBRATE_MULT) {
      setCelebrate({ id: popId, jackpot: res.multiplier >= JACKPOT_MULT });
      const ct = setTimeout(() => {
        setCelebrate((c) => (c?.id === popId ? null : c));
        timers.current.delete(ct);
      }, res.multiplier >= JACKPOT_MULT ? 3200 : 2400);
      timers.current.add(ct);
    }
  }

  function animateBall(id: number, path: number[], bin: number, res: PlinkoResult, ballStake: number) {
    // The ball visits one peg per row, drifting toward the landing bin. At row r
    // its column = number of right-bounces so far. (rows/risk are locked while
    // any ball is in flight, so this geometry stays valid for every ball.)
    const points: { x: number; y: number }[] = [{ x: VB_W / 2, y: TOP_Y }];
    let col = 0;
    for (let r = 0; r < path.length; r++) {
      col += path[r]!;
      points.push({ x: pegX(r + 1, col, rows), y: TOP_Y + rowHeight * (r + 1) });
    }
    points.push({ x: binXs[bin]!, y: TOP_Y + rowHeight * (rows + 1) - 1 });

    const stepMs = rows >= 16 ? 90 : rows >= 12 ? 110 : 130;
    let seg = 0;
    let segStart = performance.now();

    const tick = (now: number) => {
      const from = points[seg]!;
      const to = points[seg + 1]!;
      const t = Math.min(1, (now - segStart) / stepMs);
      // ease for a little bounce feel
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x = from.x + (to.x - from.x) * e;
      const y = from.y + (to.y - from.y) * e;
      setBalls((bs) => bs.map((b) => (b.id === id ? { ...b, x, y } : b)));
      if (t >= 1) {
        seg += 1;
        segStart = now;
        if (seg >= points.length - 1) {
          setBalls((bs) => bs.filter((b) => b.id !== id));
          settleBall(bin, res, ballStake);
          return;
        }
      }
      const rid = requestAnimationFrame(tick);
      rafs.current.add(rid);
    };
    const rid = requestAnimationFrame(tick);
    rafs.current.add(rid);
  }

  async function drop() {
    if (tooPoor || balls.length >= MAX_BALLS) return;
    setError(null);
    const id = (ballSeq.current += 1);
    const ballStake = stake; // lock this ball's stake (the input can change for the next)
    setBalls((bs) => [...bs, { id, x: VB_W / 2, y: TOP_Y }]);
    try {
      const res = await game.mutateAsync({ stake: ballStake, rows, risk });
      animateBall(id, res.path, res.bin, res, ballStake);
    } catch (e) {
      setBalls((bs) => bs.filter((b) => b.id !== id));
      setError(e instanceof Error ? e.message : 'A jogada falhou.');
    }
  }

  // Peg dots for the triangle.
  const pegs: { x: number; y: number; key: string }[] = [];
  for (let r = 1; r <= rows; r++) {
    for (let c = 0; c <= r; c++) {
      pegs.push({ x: pegX(r, c, rows), y: TOP_Y + rowHeight * r, key: `${r}-${c}` });
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão · Arcada</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Plinko</h1>
        <p className="mt-2 font-sans text-sm text-muted">
          Largue a bola pelos pinos. Onde cai decide o prémio — as bordas pagam grande, o centro pouco.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        {/* ---- Board ---- */}
        <div className="felt felt-rail relative overflow-hidden rounded-lg px-3 py-6 sm:px-5">
          {celebrate && <WinCelebration key={celebrate.id} jackpot={celebrate.jackpot} />}

          <div className="mx-auto w-full max-w-[440px]">
            <svg viewBox={`0 0 ${VB_W} ${TOP_Y + rowHeight * (rows + 1)}`} className="w-full">
              {pegs.map((p) => (
                <circle key={p.key} cx={p.x} cy={p.y} r={rows >= 16 ? 0.8 : 1.1} fill="#d8c79a" opacity="0.85" />
              ))}
              {balls.map((b) => (
                <circle
                  key={b.id}
                  cx={b.x}
                  cy={b.y}
                  r={rows >= 16 ? 1.6 : 2}
                  fill="#C9A24B"
                  stroke="#fff0b8"
                  strokeWidth="0.4"
                />
              ))}
            </svg>

            {/* Bins (with floating per-ball win markers above them) */}
            <div className="relative mt-2">
              {/* Floating markers — one per recently-landed ball, anchored to its bin. */}
              <div className="pointer-events-none absolute inset-x-0 bottom-full z-10 h-0">
                {pops.map((p) => (
                  <span
                    key={p.id}
                    className="absolute bottom-0 animate-plinko-rise whitespace-nowrap rounded-full border px-2 py-[3px] text-center font-mono text-[11px] font-bold leading-none shadow-lg"
                    style={{
                      left: `${((p.bin + 0.5) / (rows + 1)) * 100}%`,
                      background: 'rgba(10,9,7,0.92)',
                      borderColor: p.win ? 'rgba(201,162,75,0.7)' : 'rgba(120,110,90,0.4)',
                      color: p.win ? '#f3dca0' : '#a39a86',
                      boxShadow: p.win ? '0 0 14px rgba(201,162,75,0.55)' : 'none',
                    }}
                  >
                    {fmtMult(p.mult)} <span className={p.net >= 0 ? 'text-positive' : 'text-negative'}>{formatDelta(p.net)}</span>
                  </span>
                ))}
              </div>

              <div className="flex gap-[2px]">
                {mults.map((m, b) => {
                  const active = activeBins.has(b);
                  const color = plinkoBinColor(m);
                  return (
                    <div
                      key={b}
                      className={`flex flex-1 items-center justify-center rounded-[3px] py-1 text-center font-mono font-bold transition-all ${
                        active ? 'animate-pop scale-110 shadow-[0_0_14px_rgba(201,162,75,0.8)]' : ''
                      }`}
                      style={{
                        background: active ? '#C9A24B' : color,
                        color: active ? '#0a0907' : m >= 1 ? '#fff' : '#cdbf9f',
                        fontSize: rows >= 16 ? '8px' : rows >= 12 ? '9px' : '11px',
                        opacity: active ? 1 : m < 0.6 ? 0.7 : 0.92,
                      }}
                    >
                      {fmtMult(m)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-5 flex min-h-[2.25rem] items-center justify-center px-2 text-center">
            {inFlight > 0 ? (
              <p className="animate-pulse font-display text-lg italic text-gold-light">
                A cair{inFlight > 1 ? ` · ${inFlight} bolas` : '…'}
              </p>
            ) : result ? (
              result.multiplier > 1 ? (
                <p className="animate-pop font-display text-xl font-bold text-positive">
                  {fmtMult(result.multiplier)} — ganhou {formatAmount(result.payout)} tós!
                </p>
              ) : (
                <p className="font-sans text-sm text-muted">
                  {fmtMult(result.multiplier)} — recebeu {formatAmount(result.payout)} tós.
                </p>
              )
            ) : (
              <p className="font-sans text-sm text-muted-2">Escolha a aposta e largue a bola.</p>
            )}
          </div>

          {/* Recent drops — keeps a burst of balls visible after they land. */}
          {recent.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center justify-center gap-1 px-2">
              <span className="mr-1 font-sans text-[10px] uppercase tracking-[0.16em] text-muted-2">Últimas</span>
              {recent.map((d) => (
                <span
                  key={d.id}
                  className="rounded-[3px] px-1.5 py-0.5 font-mono text-[10px] font-bold"
                  style={{
                    background: plinkoBinColor(d.mult),
                    color: d.mult >= 1 ? '#fff' : '#cdbf9f',
                    boxShadow: d.win ? '0 0 8px rgba(201,162,75,0.5)' : 'none',
                  }}
                >
                  {fmtMult(d.mult)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ---- Bet ---- */}
        <div className="card space-y-5 p-5 sm:p-6">
          <div>
            <p className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-2">Linhas</p>
            <div className="grid grid-cols-3 gap-2">
              {ROWS_OPTS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRows(r)}
                  disabled={settingsLocked}
                  className={`focus-ring rounded-lg border px-3 py-2 font-mono text-sm font-bold transition-colors disabled:opacity-40 ${
                    rows === r ? 'border-gold bg-gold text-bg' : 'border-border text-muted hover:text-text'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-2">Risco</p>
            <div className="grid grid-cols-3 gap-2">
              {RISK_OPTS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRisk(r.id)}
                  disabled={settingsLocked}
                  className={`focus-ring rounded-lg border px-3 py-2 font-sans text-sm font-semibold transition-colors disabled:opacity-40 ${
                    risk === r.id ? 'border-gold bg-gold/15 text-gold' : 'border-border text-muted hover:text-text'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-2">Aposta</p>
            <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={settingsLocked} />
          </div>

          <Button variant="primary" className="w-full" onClick={drop} disabled={tooPoor || inFlight >= MAX_BALLS}>
            {inFlight >= MAX_BALLS ? 'Aguarda…' : inFlight > 0 ? `Largar outra (${inFlight})` : 'Largar'}
          </Button>
          <p className="text-center font-sans text-[11px] text-muted-2">Podes largar várias bolas ao mesmo tempo (até {MAX_BALLS}).</p>

          {/* Session ledger — the running total across every ball this session. */}
          {session.drops > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-bg/40 px-3 py-2">
              <span className="font-sans text-[11px] uppercase tracking-[0.16em] text-muted-2">
                {session.drops} {session.drops === 1 ? 'largada' : 'largadas'}
              </span>
              <span className={`font-mono text-sm font-bold ${net > 0 ? 'text-positive' : net < 0 ? 'text-negative' : 'text-muted'}`}>
                {formatDelta(net)} tós
              </span>
            </div>
          )}

          {tooPoor && <p className="font-sans text-sm text-negative">Saldo insuficiente para esta aposta.</p>}
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>
      </div>
    </div>
  );
}
