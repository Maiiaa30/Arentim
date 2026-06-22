import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { usePlinko } from '@/features/casino/usePlinko';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';
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
  const [result, setResult] = useState<PlinkoResult | null>(null);
  const [landedBin, setLandedBin] = useState<number | null>(null);
  const [winId, setWinId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const ballSeq = useRef(0);
  const rafs = useRef<Set<number>>(new Set());

  useEffect(
    () => () => {
      rafs.current.forEach((id) => cancelAnimationFrame(id));
      rafs.current.clear();
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

  // Pre-compute the bin centre X positions (bottom row, b in 0..rows).
  const binXs = useMemo(
    () => Array.from({ length: rows + 1 }, (_, b) => pegX(rows, b, rows)),
    [rows],
  );

  function animateBall(id: number, path: number[], bin: number, res: PlinkoResult) {
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
          setLandedBin(bin);
          setResult(res);
          if (res.multiplier > 1) setWinId((n) => n + 1);
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
    setBalls((bs) => [...bs, { id, x: VB_W / 2, y: TOP_Y }]);
    try {
      const res = await game.mutateAsync({ stake, rows, risk });
      animateBall(id, res.path, res.bin, res);
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

  const jackpot = result ? result.multiplier >= 5 : false;

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
          {result && result.multiplier > 1 && <WinCelebration key={winId} jackpot={jackpot} />}

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

            {/* Bins */}
            <div className="mt-2 flex gap-[2px]">
              {mults.map((m, b) => {
                const active = landedBin === b;
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

          {tooPoor && <p className="font-sans text-sm text-negative">Saldo insuficiente para esta aposta.</p>}
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>
      </div>
    </div>
  );
}
