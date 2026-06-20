import type { ReactNode } from 'react';
import { colorOf, betCellKey, type RouletteBetKind } from './roulette';

interface BettingBoardProps {
  onPlace: (kind: RouletteBetKind, selection: number | null, numbers?: number[]) => void;
  /** Current stake per cell key (see betCellKey), e.g. { 'straight:17': 25, 'split:23-24': 10 }. */
  stakes?: Record<string, number>;
  /** This round's lucky numbers — highlighted (a straight on one pays double). */
  bonus?: ReadonlySet<number>;
  disabled?: boolean;
}

// Board rows (top→bottom), each a column of the felt: row 0 = 3,6,9…; etc.
const ROWS: number[][] = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

const numberBg: Record<string, string> = {
  red: 'bg-[#b0303a] hover:bg-[#c63a45]',
  black: 'bg-[#14110c] hover:bg-[#211b12]',
  green: 'bg-[#1f8a5b] hover:bg-[#239c66]',
};

export function BettingBoard({ onPlace, stakes = {}, bonus, disabled }: BettingBoardProps) {
  const badge = (keyStr: string, pos = '-right-1 -top-1') => {
    const v = stakes[keyStr];
    if (!v) return null;
    return (
      <span
        className={`pointer-events-none absolute z-40 flex min-w-[16px] items-center justify-center rounded-full border border-gold-light bg-gold px-1 font-mono text-[8px] font-bold leading-none text-bg shadow-[0_1px_3px_rgba(0,0,0,0.5)] ${pos}`}
      >
        {v}
      </span>
    );
  };

  const cell =
    'focus-ring relative flex items-center justify-center rounded-[3px] font-mono text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_0_0_1px_rgba(201,162,75,0.25)] transition-colors disabled:opacity-50';
  const outside =
    'focus-ring relative flex items-center justify-center rounded-[3px] border border-gold/25 bg-[#0c241b]/80 px-2 text-[11px] font-semibold uppercase tracking-wide text-body shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:border-gold/60 hover:text-text disabled:opacity-50';
  // Invisible-until-hover chip line/corner handle, sitting in a gap track.
  const handle = 'focus-ring relative rounded-sm bg-gold/0 transition-colors enabled:hover:bg-gold/50 disabled:opacity-50';

  // Build the inside-bets grid: numbers on odd tracks, split/corner handles in
  // the gap tracks between them. col c → grid col 2c+1; row r → grid row 2r+1.
  const items: ReactNode[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 12; c++) {
      const num = ROWS[r]![c]!;
      const lucky = bonus?.has(num);
      items.push(
        <button
          key={`n${num}`}
          type="button"
          disabled={disabled}
          onClick={() => onPlace('straight', num)}
          style={{ gridColumn: c * 2 + 1, gridRow: r * 2 + 1 }}
          className={`${cell} h-10 ${numberBg[colorOf(num)]} ${lucky ? 'z-10 ring-2 ring-gold ring-offset-1 ring-offset-[#0c241b] animate-glow' : ''}`}
          aria-label={`Apostar no ${num}${lucky ? ' (número da sorte)' : ''}`}
        >
          {lucky && <span className="pointer-events-none absolute -left-1 -top-1 text-[10px]">⭐</span>}
          {num}
          {badge(betCellKey('straight', num))}
        </button>,
      );
      // Horizontal split with the number to the right.
      if (c < 11) {
        const nums = [num, ROWS[r]![c + 1]!];
        items.push(
          <button key={`hs${num}`} type="button" disabled={disabled} title={`Split ${nums[0]}/${nums[1]}`}
            onClick={() => onPlace('split', null, nums)}
            style={{ gridColumn: c * 2 + 2, gridRow: r * 2 + 1 }}
            className={`${handle} z-20`} aria-label={`Split ${nums[0]} e ${nums[1]}`}>
            {badge(betCellKey('split', null, nums), 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2')}
          </button>,
        );
      }
      // Vertical split with the number below.
      if (r < 2) {
        const nums = [num, ROWS[r + 1]![c]!];
        items.push(
          <button key={`vs${num}`} type="button" disabled={disabled} title={`Split ${nums[0]}/${nums[1]}`}
            onClick={() => onPlace('split', null, nums)}
            style={{ gridColumn: c * 2 + 1, gridRow: r * 2 + 2 }}
            className={`${handle} z-20`} aria-label={`Split ${nums[0]} e ${nums[1]}`}>
            {badge(betCellKey('split', null, nums), 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2')}
          </button>,
        );
      }
      // Corner of the four numbers meeting at this cell's bottom-right.
      if (c < 11 && r < 2) {
        const nums = [num, ROWS[r]![c + 1]!, ROWS[r + 1]![c]!, ROWS[r + 1]![c + 1]!];
        items.push(
          <button key={`cn${num}`} type="button" disabled={disabled} title={`Canto ${nums.join('/')}`}
            onClick={() => onPlace('corner', null, nums)}
            style={{ gridColumn: c * 2 + 2, gridRow: r * 2 + 2 }}
            className={`${handle} z-30 enabled:hover:bg-gold/70`} aria-label={`Canto ${nums.join(', ')}`}>
            {badge(betCellKey('corner', null, nums), 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2')}
          </button>,
        );
      }
    }
  }

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
            0
            {badge(betCellKey('straight', 0))}
          </button>

          <div
            className="min-w-0 flex-1"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 9px '.repeat(11).trim() + ' 1fr',
              gridTemplateRows: '2.5rem 9px 2.5rem 9px 2.5rem',
            }}
          >
            {items}
          </div>

          {/* Columns */}
          <div className="flex w-9 shrink-0 flex-col gap-1">
            <button type="button" disabled={disabled} onClick={() => onPlace('col3', null)} className={`${outside} flex-1`} aria-label="Coluna 3 (2:1)">
              {badge(betCellKey('col3', null))}2:1
            </button>
            <button type="button" disabled={disabled} onClick={() => onPlace('col2', null)} className={`${outside} flex-1`} aria-label="Coluna 2 (2:1)">
              {badge(betCellKey('col2', null))}2:1
            </button>
            <button type="button" disabled={disabled} onClick={() => onPlace('col1', null)} className={`${outside} flex-1`} aria-label="Coluna 1 (2:1)">
              {badge(betCellKey('col1', null))}2:1
            </button>
          </div>
        </div>

        {/* Dozens */}
        <div className="ml-[46px] grid grid-cols-3 gap-1">
          <button type="button" disabled={disabled} onClick={() => onPlace('dozen1', null)} className={`${outside} min-h-[40px]`}>
            {badge(betCellKey('dozen1', null))}1.ª dúzia
          </button>
          <button type="button" disabled={disabled} onClick={() => onPlace('dozen2', null)} className={`${outside} min-h-[40px]`}>
            {badge(betCellKey('dozen2', null))}2.ª dúzia
          </button>
          <button type="button" disabled={disabled} onClick={() => onPlace('dozen3', null)} className={`${outside} min-h-[40px]`}>
            {badge(betCellKey('dozen3', null))}3.ª dúzia
          </button>
        </div>

        {/* Even-money bets */}
        <div className="ml-[46px] grid grid-cols-3 gap-1 sm:grid-cols-6">
          <button type="button" disabled={disabled} onClick={() => onPlace('low', null)} className={`${outside} min-h-[40px]`}>
            {badge(betCellKey('low', null))}1–18
          </button>
          <button type="button" disabled={disabled} onClick={() => onPlace('even', null)} className={`${outside} min-h-[40px]`}>
            {badge(betCellKey('even', null))}Par
          </button>
          <button type="button" disabled={disabled} onClick={() => onPlace('red', null)} className={`${outside} min-h-[40px] !border-[#b0303a]/60 !text-[#e36c72] hover:!border-[#b0303a]`}>
            {badge(betCellKey('red', null))}Vermelho
          </button>
          <button type="button" disabled={disabled} onClick={() => onPlace('black', null)} className={`${outside} min-h-[40px]`}>
            {badge(betCellKey('black', null))}Preto
          </button>
          <button type="button" disabled={disabled} onClick={() => onPlace('odd', null)} className={`${outside} min-h-[40px]`}>
            {badge(betCellKey('odd', null))}Ímpar
          </button>
          <button type="button" disabled={disabled} onClick={() => onPlace('high', null)} className={`${outside} min-h-[40px]`}>
            {badge(betCellKey('high', null))}19–36
          </button>
        </div>
      </div>
    </div>
  );
}
