// Client-side board helpers for online Battleship — placement geometry + the
// masked view shape returned by the battleship-table Edge Function. The server
// is authoritative; these helpers are for the placement UX and rendering.

export const BOARD = 10;
export const CELLS = BOARD * BOARD; // 100
export const FLEET = [5, 4, 3, 3, 2]; // ship sizes, largest first
export const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

export const rowOf = (c: number) => Math.floor(c / BOARD);
export const colOf = (c: number) => c % BOARD;

/** The cells a ship would occupy from `anchor`, or null if it runs off-board. */
export function shipCells(anchor: number, size: number, horizontal: boolean): number[] | null {
  const r = rowOf(anchor);
  const c = colOf(anchor);
  const cells: number[] = [];
  for (let i = 0; i < size; i++) {
    const rr = horizontal ? r : r + i;
    const cc = horizontal ? c + i : c;
    if (rr >= BOARD || cc >= BOARD) return null;
    cells.push(rr * BOARD + cc);
  }
  return cells;
}

export const overlaps = (cells: number[], used: Set<number>) => cells.some((x) => used.has(x));

/** A valid random fleet (no overlaps), for the "Aleatório" button. */
export function randomFleet(): number[][] {
  for (let outer = 0; outer < 200; outer++) {
    const used = new Set<number>();
    const ships: number[][] = [];
    let ok = true;
    for (const size of FLEET) {
      let placed = false;
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const horizontal = Math.random() < 0.5;
        const anchor = Math.floor(Math.random() * CELLS);
        const cells = shipCells(anchor, size, horizontal);
        if (cells && !overlaps(cells, used)) {
          cells.forEach((x) => used.add(x));
          ships.push(cells);
          placed = true;
        }
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return ships;
  }
  return [];
}

export type Shot = { cell: number; hit: boolean };

export type BattleshipView = {
  phase: 'placing' | 'playing' | 'finished';
  myName: string;
  oppName: string | null;
  oppJoined: boolean;
  iPlaced: boolean;
  oppPlaced: boolean;
  myShips: number[][];
  incoming: number[]; // cells the opponent fired at me
  myHits: number[]; // their hits on my fleet
  myShots: Shot[]; // my shots with hit/miss
  sunkEnemy: number[][]; // outlines of enemy ships I've sunk
  enemyShipsLeft: number | null;
  myShipsLeft: number | null;
  isMyTurn: boolean;
  turnDeadline: string | null; // ISO — current turn's auto-pass time
  enemyShips: number[][] | null; // revealed only when the game is finished
  winner: 'me' | 'opp' | null;
};

export type BattleshipResponse = {
  view: BattleshipView | null;
  tableId?: number;
  code?: string;
  isPublic?: boolean;
  serverNow?: string;
  outcome?: { hit: boolean; sunk: { cells: number[]; size: number } | null; win: boolean };
};

/**
 * Map each ship cell to a rounded-corner class so a run of cells reads as one
 * hull (bow/stern rounded, middle square). Used with a metallic gradient fill.
 */
export function shipSegments(ships: number[][]): Map<number, string> {
  const map = new Map<number, string>();
  for (const cells of ships) {
    if (cells.length === 0) continue;
    const sorted = [...cells].sort((a, b) => a - b);
    const horizontal = sorted.length < 2 || sorted[1]! === sorted[0]! + 1;
    sorted.forEach((c, idx) => {
      const first = idx === 0;
      const last = idx === sorted.length - 1;
      let rounded = '';
      if (sorted.length === 1) rounded = 'rounded-md';
      else if (horizontal) rounded = first ? 'rounded-l-md' : last ? 'rounded-r-md' : '';
      else rounded = first ? 'rounded-t-md' : last ? 'rounded-b-md' : '';
      map.set(c, rounded);
    });
  }
  return map;
}
