export interface PokerPlayerView {
  id: string;
  name: string;
  isBot: boolean;
  stack: number;
  committed: number;
  status: 'active' | 'folded' | 'allin' | 'out';
  /** Card codes 0–51, or -1 for a hidden card. */
  hole: number[];
}

export interface PokerView {
  street: 'idle' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  community: number[];
  pot: number;
  currentBet: number;
  minRaise: number;
  handOver: boolean;
  toActId: string | null;
  button: string | null;
  result: {
    winners: { id: string; amount: number }[];
    reveal: { id: string; hole: number[]; hand: string }[];
  } | null;
  log: string[];
  players: PokerPlayerView[];
}
