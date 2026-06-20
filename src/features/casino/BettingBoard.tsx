import { colorOf, type RouletteBetKind } from './roulette';

interface BettingBoardProps {
  onPlace: (kind: RouletteBetKind, selection: number | null) => void;
  /** Current stake per cell key, e.g. { 'straight:17': 25, 'red:null': 10 }. */
  stakes?: Record<string, number>;
  /** This round's lucky numbers — highlighted (a straight on one pays double). */
  bonus?: ReadonlySet<number>;
  disabled?: boolean;
}

const TOP = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
const MID = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
const BOT = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];

const numberBg: Record<string, string> = {
  red: 'bg-[#b0303a] hover:bg-[#c63a45]',
  black: 'bg-[#14110c] hover:bg-[#211b12]',
  green: 'bg-[#1f8a5b] hover:bg-[#239c66]',
};

const key = (kind: RouletteBetKind, selection: number | null) => `${kind}:${selection}`;

export function BettingBoard({ onPlace, stakes = {}, bonus, disabled }: BettingBoardProps) {
  // A little gold chip badge shown on any cell that currently carries a stake.
  const stakeDot = (kind: RouletteBetKind, selection: number | null) => {
    const v = stakes[key(kind, selection)];
    if (!v) return null;
    return (
      <span className="pointer-events-none absolute -right-1 -top-1 z-10 flex min-w-[18px] items-center justify-center rounded-full border border-gold-light bg-gold px-1 font-mono text-[9px] font-bold leading-none text-bg shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
        {v}
      </span>
    );
  };

  const cell =
    'focus-ring relative flex items-center justify-center rounded-[3px] font-mono text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_0_0_1px_rgba(201,162,75,0.25)] transition-colors disabled:opacity-50';
  const outside =
    'focus-ring relative flex items-center justify-center rounded-[3px] border border-gold/25 bg-[#0c241b]/80 px-2 text-[11px] font-semibold uppercase tracking-wide text-body shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:border-gold/60 hover:text-text disabled:opacity-50';

  const numberCell = (n: number) => {
    const lucky = bonus?.has(n);
    return (
      <button
        key={n}
        type="button"
        disabled={disabled}
        onClick={() => onPlace('straight', n)}
        className={`${cell} h-10 ${numberBg[colorOf(n)]} ${lucky ? 'z-10 ring-2 ring-gold ring-offset-1 ring-offset-[#0c241b] animate-glow' : ''}`}
        aria-label={`Apostar no ${n}${lucky ? ' (número da sorte)' : ''}`}
      >
        {stakeDot('straight', n)}
        {lucky && <span className="pointer-events-none absolute -left-1 -top-1 text-[10px]">⭐</span>}
        {n}
      </button>
    );
  };

  return (
    <div className="rounded-md bg-[#0c241b] p-2 shadow-[inset_0_0_0_1px_rgba(201,162,75,0.3),inset_0_0_24px_rgba(0,0,0,0.4)]">
      <div className="space-y-1.5">
        <div className="flex gap-1.5">
          {/* Zero */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPlace('straight', 0)}
            className={`${cell} min-h-[40px] w-10 shrink-0 ${numberBg.green}`}
            aria-label="Apostar no 0"
          >
            {stakeDot('straight', 0)}
            0
          </button>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="grid grid-cols-12 gap-1">{TOP.map(numberCell)}</div>
            <div className="grid grid-cols-12 gap-1">{MID.map(numberCell)}</div>
            <div className="grid grid-cols-12 gap-1">{BOT.map(numberCell)}</div>
          </div>

          {/* Columns */}
          <div className="flex w-9 shrink-0 flex-col gap-1">
            <button type="button" disabled={disabled} onClick={() => onPlace('col3', null)} className={`${outside} flex-1`} aria-label="Coluna 3 (2:1)">
              {stakeDot('col3', null)}2:1
            </button>
            <button type="button" disabled={disabled} onClick={() => onPlace('col2', null)} className={`${outside} flex-1`} aria-label="Coluna 2 (2:1)">
              {stakeDot('col2', null)}2:1
            </button>
            <button type="button" disabled={disabled} onClick={() => onPlace('col1', null)} className={`${outside} flex-1`} aria-label="Coluna 1 (2:1)">
              {stakeDot('col1', null)}2:1
            </button>
          </div>
        </div>

        {/* Dozens */}
        <div className="ml-[46px] grid grid-cols-3 gap-1">
          <button type="button" disabled={disabled} onClick={() => onPlace('dozen1', null)} className={`${outside} min-h-[40px]`}>
            {stakeDot('dozen1', null)}1.ª dúzia
          </button>
          <button type="button" disabled={disabled} onClick={() => onPlace('dozen2', null)} className={`${outside} min-h-[40px]`}>
            {stakeDot('dozen2', null)}2.ª dúzia
          </button>
          <button type="button" disabled={disabled} onClick={() => onPlace('dozen3', null)} className={`${outside} min-h-[40px]`}>
            {stakeDot('dozen3', null)}3.ª dúzia
          </button>
        </div>

        {/* Even-money bets */}
        <div className="ml-[46px] grid grid-cols-3 gap-1 sm:grid-cols-6">
          <button type="button" disabled={disabled} onClick={() => onPlace('low', null)} className={`${outside} min-h-[40px]`}>
            {stakeDot('low', null)}1–18
          </button>
          <button type="button" disabled={disabled} onClick={() => onPlace('even', null)} className={`${outside} min-h-[40px]`}>
            {stakeDot('even', null)}Par
          </button>
          <button type="button" disabled={disabled} onClick={() => onPlace('red', null)} className={`${outside} min-h-[40px] !border-[#b0303a]/60 !text-[#e36c72] hover:!border-[#b0303a]`}>
            {stakeDot('red', null)}Vermelho
          </button>
          <button type="button" disabled={disabled} onClick={() => onPlace('black', null)} className={`${outside} min-h-[40px]`}>
            {stakeDot('black', null)}Preto
          </button>
          <button type="button" disabled={disabled} onClick={() => onPlace('odd', null)} className={`${outside} min-h-[40px]`}>
            {stakeDot('odd', null)}Ímpar
          </button>
          <button type="button" disabled={disabled} onClick={() => onPlace('high', null)} className={`${outside} min-h-[40px]`}>
            {stakeDot('high', null)}19–36
          </button>
        </div>
      </div>
    </div>
  );
}
