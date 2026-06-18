/**
 * Hand-written database types mirroring the SQL migrations. Kept deliberately
 * small and focused; can be regenerated with `supabase gen types` later.
 */

export type TransactionType = 'bonus' | 'bet' | 'win' | 'loss' | 'refund' | 'adjustment';

/** Bet payload sent to the play_roulette RPC. */
export type RouletteBetPayload = {
  kind: string;
  selection: number | null;
  stake: number;
};

/** Per-bet settlement detail returned by play_roulette. */
export type RouletteBetResult = {
  kind: string;
  selection: number | null;
  stake: number;
  won: boolean;
  return: number;
};

/** Result returned by the play_coinflip RPC. */
export type CoinflipResult = {
  outcome: 'heads' | 'tails';
  won: boolean;
  payout: number;
  balance: number;
  replayed: boolean;
};

/** Result returned by the play_slots RPC. */
export type SlotsResult = {
  reels: string[];
  multiplier: number;
  payout: number;
  balance: number;
  replayed: boolean;
};

/** Result returned by the claim_daily_bonus RPC. */
export type DailyBonusResult = {
  status: 'claimed' | 'already_claimed' | 'play_required';
  streak: number;
  reward: number;
  balance: number;
};

/** Result object returned by the play_roulette RPC. */
export type RouletteSpinResult = {
  round_id: number;
  number: number;
  stake: number;
  payout: number;
  balance: number;
  results: RouletteBetResult[];
  replayed: boolean;
};

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  balance: number;
  is_admin: boolean;
  total_wagered: number;
  total_won: number;
  total_lost: number;
  games_played: number;
  games_won: number;
  biggest_win: number;
  streak_count: number;
  last_played_date: string | null;
  last_claim_date: string | null;
  created_at: string;
  last_online: string | null;
};

export type Transaction = {
  id: number;
  user_id: string;
  type: TransactionType;
  game: string | null;
  amount: number;
  balance_after: number;
  note: string | null;
  idempotency_key: string | null;
  created_at: string;
};

/** Minimal shape consumed by the typed Supabase client. */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; display_name: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      transactions: {
        Row: Transaction;
        Insert: Partial<Transaction> & { user_id: string; type: TransactionType; amount: number };
        Update: Partial<Transaction>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      update_own_profile: {
        Args: { p_display_name: string | null; p_avatar_url: string | null };
        Returns: Profile;
      };
      touch_last_online: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      play_roulette: {
        Args: { p_bets: RouletteBetPayload[]; p_idempotency_key: string | null };
        Returns: RouletteSpinResult;
      };
      claim_daily_bonus: {
        Args: Record<string, never>;
        Returns: DailyBonusResult;
      };
      play_coinflip: {
        Args: { p_stake: number; p_choice: string; p_idempotency_key: string | null };
        Returns: CoinflipResult;
      };
      play_slots: {
        Args: { p_stake: number; p_idempotency_key: string | null };
        Returns: SlotsResult;
      };
    };
    Enums: {
      transaction_type: TransactionType;
    };
    CompositeTypes: Record<string, never>;
  };
}
