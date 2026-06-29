// ============================================================================
// Arentim — Battleship (online 1v1) shared engine. Pure, deterministic logic
// used by the battleship-table Edge Function. Board is 10×10 (cells 0..99,
// cell = row*10 + col). Classic fleet: one each of sizes 5,4,3,3,2 (17 cells).
// Players place their own ships, then alternate single shots; first to sink the
// whole enemy fleet wins. No money — this is a "for fun" match.
// ============================================================================

export const BOARD = 10;
export const CELLS = BOARD * BOARD; // 100
export const FLEET = [5, 4, 3, 3, 2]; // ship sizes
export const FLEET_CELLS = FLEET.reduce((a, b) => a + b, 0); // 17

export type Ship = { cells: number[]; size: number };
export type Phase = 'placing' | 'playing' | 'finished';

export interface PlayerState {
  name: string;
  ships: Ship[] | null; // null until placed
  shots: number[]; // cells this player has fired at the opponent
}

export interface BattleState {
  phase: Phase;
  order: string[]; // [hostId, guestId]
  players: Record<string, PlayerState>;
  turn: string | null; // whose turn to fire (during 'playing')
  winner: string | null;
}

export const other = (s: BattleState, id: string): string => s.order.find((x) => x !== id) ?? '';

export function freshState(hostId: string, hostName: string): BattleState {
  return {
    phase: 'placing',
    order: [hostId],
    players: { [hostId]: { name: hostName, ships: null, shots: [] } },
    turn: null,
    winner: null,
  };
}

export function addGuest(s: BattleState, guestId: string, guestName: string): void {
  if (s.order.includes(guestId)) return;
  s.order.push(guestId);
  s.players[guestId] = { name: guestName, ships: null, shots: [] };
}

const sunk = (ship: Ship, shots: number[]): boolean => ship.cells.every((c) => shots.includes(c));
const allSunk = (ships: Ship[] | null, shots: number[]): boolean => !!ships && ships.every((sh) => sunk(sh, shots));

/** Are these cells a straight, contiguous horizontal or vertical run? */
function isStraightRun(cells: number[]): boolean {
  if (cells.length < 2) return cells.length === 1;
  const sorted = [...cells].sort((a, b) => a - b);
  const rows = sorted.map((c) => Math.floor(c / BOARD));
  const cols = sorted.map((c) => c % BOARD);
  const sameRow = rows.every((r) => r === rows[0]);
  const sameCol = cols.every((c) => c === cols[0]);
  if (sameRow) {
    for (let i = 1; i < sorted.length; i++) if (sorted[i] !== sorted[i - 1] + 1) return false;
    return true;
  }
  if (sameCol) {
    for (let i = 1; i < sorted.length; i++) if (sorted[i] !== sorted[i - 1] + BOARD) return false;
    return true;
  }
  return false;
}

/**
 * Validate a submitted fleet: exact ship sizes, in bounds, straight, no overlap.
 * The wire format is an array of cell-arrays (number[][]) — each ship is just
 * the list of cells it occupies. (Tolerates the {cells:[...]} object form too.)
 */
export function validateFleet(fleet: unknown): { ok: boolean; error?: string; ships?: Ship[] } {
  if (!Array.isArray(fleet) || fleet.length !== FLEET.length) return { ok: false, error: 'invalid fleet' };
  const parsed: Ship[] = [];
  const used = new Set<number>();
  for (const raw of fleet) {
    const cells: unknown = Array.isArray(raw) ? raw : (raw as { cells?: unknown })?.cells;
    if (!Array.isArray(cells)) return { ok: false, error: 'invalid fleet' };
    if (cells.some((c) => !Number.isInteger(c) || c < 0 || c >= CELLS)) return { ok: false, error: 'invalid fleet' };
    if (new Set(cells).size !== cells.length) return { ok: false, error: 'invalid fleet' };
    if (!isStraightRun(cells)) return { ok: false, error: 'invalid fleet' };
    for (const c of cells) {
      if (used.has(c)) return { ok: false, error: 'ships overlap' };
      used.add(c);
    }
    parsed.push({ cells: [...cells], size: cells.length });
  }
  // The multiset of sizes must equal FLEET.
  const want = [...FLEET].sort((a, b) => a - b).join(',');
  const got = parsed.map((s) => s.size).sort((a, b) => a - b).join(',');
  if (want !== got) return { ok: false, error: 'wrong fleet' };
  return { ok: true, ships: parsed };
}

/** Both players placed → start the battle, host fires first. */
export function maybeStart(s: BattleState): void {
  if (s.phase !== 'placing') return;
  if (s.order.length === 2 && s.order.every((id) => s.players[id]?.ships)) {
    s.phase = 'playing';
    s.turn = s.order[0];
  }
}

export type FireOutcome = { hit: boolean; sunk: Ship | null; win: boolean };

/** Fire at `cell` on the opponent's board. Caller must check turn + dedupe. */
export function fire(s: BattleState, firerId: string, cell: number): FireOutcome {
  const oppId = other(s, firerId);
  const opp = s.players[oppId]!;
  const me = s.players[firerId]!;
  me.shots.push(cell);
  const ship = (opp.ships ?? []).find((sh) => sh.cells.includes(cell)) ?? null;
  const hit = !!ship;
  const justSunk = ship && sunk(ship, me.shots) ? ship : null;
  const win = allSunk(opp.ships, me.shots);
  if (win) {
    s.phase = 'finished';
    s.winner = firerId;
    s.turn = null;
  } else {
    s.turn = oppId; // classic: alternate every shot
  }
  return { hit, sunk: justSunk, win };
}

/** Forfeit — the opponent (if any) wins. */
export function forfeit(s: BattleState, quitterId: string): void {
  s.phase = 'finished';
  s.winner = other(s, quitterId) || null;
  s.turn = null;
}

/** Reset both boards for a rematch, keeping the same two players. */
export function rematch(s: BattleState): void {
  s.phase = 'placing';
  s.winner = null;
  s.turn = null;
  for (const id of s.order) {
    const p = s.players[id];
    if (p) {
      p.ships = null;
      p.shots = [];
    }
  }
}

/**
 * Per-caller masked view. Never leaks the opponent's un-sunk ship positions:
 * the firer sees only hit/miss on each shot, plus the full outline of any ship
 * they have fully sunk.
 */
export function viewFor(s: BattleState, uid: string) {
  const oppId = other(s, uid);
  const me = s.players[uid];
  const opp = oppId ? s.players[oppId] : undefined;
  if (!me) return null;

  const myShipCells = new Set((me.ships ?? []).flatMap((sh) => sh.cells));
  const oppShipCells = opp?.ships ?? [];

  // My shots at the opponent, with hit/miss.
  const myShots = me.shots.map((c) => ({ cell: c, hit: oppShipCells.some((sh) => sh.cells.includes(c)) }));
  // Enemy ships I've fully sunk — reveal their outline.
  const sunkEnemy = oppShipCells.filter((sh) => sunk(sh, me.shots)).map((sh) => sh.cells);
  const enemyShipsLeft = oppShipCells.length ? oppShipCells.filter((sh) => !sunk(sh, me.shots)).length : null;

  return {
    phase: s.phase,
    myName: me.name,
    oppName: opp?.name ?? null,
    oppJoined: !!opp,
    iPlaced: !!me.ships,
    oppPlaced: !!opp?.ships,
    myShips: (me.ships ?? []).map((sh) => sh.cells), // my own fleet, fully visible
    incoming: opp ? opp.shots : [], // cells the opponent fired at me
    myHits: opp ? opp.shots.filter((c) => myShipCells.has(c)) : [], // their hits on me
    myShots, // [{cell,hit}]
    sunkEnemy, // number[][]
    enemyShipsLeft,
    myShipsLeft: me.ships ? me.ships.filter((sh) => !sunk(sh, opp?.shots ?? [])).length : null,
    isMyTurn: s.turn === uid,
    winner: s.winner ? (s.winner === uid ? 'me' : 'opp') : null,
  };
}
