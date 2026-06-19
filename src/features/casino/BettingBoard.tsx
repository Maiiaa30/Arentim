import { colorOf, type RouletteBetKind } from './roulette';

interface BettingBoardProps {
  onPlace: (kind: RouletteBetKind, selection: number | null) => void;
  disabled?: boolean;
}

const TOP = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
const MID = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
const BOT = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];

const numberBg: Record<string, string> = {
  red: 'bg-negative/80 hover:bg-negative',
  black: 'bg-black/60 hover:bg-black/80',
  green: 'bg-positive/80 hover:bg-positive',
};

export function BettingBoard({ onPlace, disabled }: BettingBoardProps) {
  const cell =
    'focus-ring flex items-center justify-center rounded-md text-sm font-semibold text-white transition-colors disabled:opacity-50';
  const outside =
    'focus-ring rounded-md border border-border bg-surface px-2 py-2 text-xs font-medium text-text transition-colors hover:border-gold/60 disabled:opacity-50';

  const numberCell = (n: number) => (
    <button
      key={n}
      type="button"
      disabled={disabled}
      onClick={() => onPlace('straight', n)}
      className={`${cell} h-9 ${numberBg[colorOf(n)]}`}
      aria-label={`Apostar no ${n}`}
    >
      {n}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {/* Zero */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPlace('straight', 0)}
          className={`${cell} w-10 shrink-0 ${numberBg.green}`}
          aria-label="Apostar no 0"
        >
          0
        </button>

        <div className="flex-1 space-y-1">
          <div className="grid grid-cols-12 gap-1">{TOP.map(numberCell)}</div>
          <div className="grid grid-cols-12 gap-1">{MID.map(numberCell)}</div>
          <div className="grid grid-cols-12 gap-1">{BOT.map(numberCell)}</div>
        </div>

        {/* Columns */}
        <div className="flex w-10 shrink-0 flex-col gap-1">
          <button type="button" disabled={disabled} onClick={() => onPlace('col3', null)} className={`${outside} flex-1`}>
            2:1
          </button>
          <button type="button" disabled={disabled} onClick={() => onPlace('col2', null)} className={`${outside} flex-1`}>
            2:1
          </button>
          <button type="button" disabled={disabled} onClick={() => onPlace('col1', null)} className={`${outside} flex-1`}>
            2:1
          </button>
        </div>
      </div>

      {/* Dozens */}
      <div className="ml-12 grid grid-cols-3 gap-1">
        <button type="button" disabled={disabled} onClick={() => onPlace('dozen1', null)} className={outside}>
          1st 12
        </button>
        <button type="button" disabled={disabled} onClick={() => onPlace('dozen2', null)} className={outside}>
          2nd 12
        </button>
        <button type="button" disabled={disabled} onClick={() => onPlace('dozen3', null)} className={outside}>
          3rd 12
        </button>
      </div>

      {/* Even-money bets */}
      <div className="ml-12 grid grid-cols-6 gap-1">
        <button type="button" disabled={disabled} onClick={() => onPlace('low', null)} className={outside}>
          1–18
        </button>
        <button type="button" disabled={disabled} onClick={() => onPlace('even', null)} className={outside}>
          Even
        </button>
        <button type="button" disabled={disabled} onClick={() => onPlace('red', null)} className={`${outside} !border-negative/50`}>
          Red
        </button>
        <button type="button" disabled={disabled} onClick={() => onPlace('black', null)} className={outside}>
          Black
        </button>
        <button type="button" disabled={disabled} onClick={() => onPlace('odd', null)} className={outside}>
          Odd
        </button>
        <button type="button" disabled={disabled} onClick={() => onPlace('high', null)} className={outside}>
          19–36
        </button>
      </div>
    </div>
  );
}
