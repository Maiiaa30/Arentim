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

export type Fixture = {
  id: number;
  external_ref: string | null;
  league: string;
  season: number | null;
  home: string;
  away: string;
  kickoff: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed';
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  odds: Record<string, Record<string, number>>;
  events: { type?: string; minute?: number | null; team?: string | null; player?: string | null }[];
  created_at: string;
  updated_at: string;
};

export type Bet = {
  id: number;
  user_id: string;
  stake: number;
  combined_odds: number;
  potential_payout: number;
  status: 'pending' | 'won' | 'lost' | 'void';
  created_at: string;
  settled_at: string | null;
};

export type BetSelectionRow = {
  id: number;
  bet_id: number;
  fixture_id: number;
  market: string;
  selection: string;
  odds: number;
  result: 'pending' | 'won' | 'lost' | 'void';
};

/** A selection sent to place_bet. */
export type BetSelectionInput = {
  fixture_id: number;
  market: string;
  selection: string;
};

/** Result returned by place_bet. */
export type PlaceBetResult = {
  bet_id: number;
  stake: number;
  combined_odds: number;
  potential_payout: number;
  balance: number;
};

export type UserSearchResult = { id: string; display_name: string; avatar_url: string | null };

export type FriendRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  balance: number;
  total_wagered: number;
  total_won: number;
  total_lost: number;
  games_played: number;
  games_won: number;
  biggest_win: number;
  streak_count: number;
  last_online: string | null;
};

export type FriendRequest = {
  id: number;
  direction: 'incoming' | 'outgoing';
  other_id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
};

export type MyPokerTable = {
  table_id: number;
  code: string;
  status: string;
  player_count: number;
  is_host: boolean;
};

export type LeaderboardRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  value: number;
  is_me: boolean;
};

/** A single player hand in the blackjack view. */
export type BlackjackHandView = {
  cards: number[];
  total: number;
  stake: number;
  status: string;
};

/** Sanitized blackjack state returned by bj_deal / bj_action / bj_current. */
export type BlackjackView = {
  hand_id: number;
  status: 'player_turn' | 'complete';
  active: number;
  dealer: number[];
  dealer_total: number | null;
  dealer_hidden: boolean;
  hands: BlackjackHandView[];
  payout: number;
  options: {
    can_hit: boolean;
    can_stand: boolean;
    can_double: boolean;
    can_split: boolean;
  } | null;
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
      fixtures: {
        Row: Fixture;
        Insert: Partial<Fixture> & { league: string; home: string; away: string; kickoff: string };
        Update: Partial<Fixture>;
        Relationships: [];
      };
      bets: {
        Row: Bet;
        Insert: Partial<Bet> & { user_id: string; stake: number };
        Update: Partial<Bet>;
        Relationships: [];
      };
      bet_selections: {
        Row: BetSelectionRow;
        Insert: Partial<BetSelectionRow> & { bet_id: number; fixture_id: number; market: string; selection: string; odds: number };
        Update: Partial<BetSelectionRow>;
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
      bj_deal: {
        Args: { p_stake: number };
        Returns: BlackjackView;
      };
      bj_action: {
        Args: { p_hand_id: number; p_action: string };
        Returns: BlackjackView;
      };
      bj_current: {
        Args: Record<string, never>;
        Returns: BlackjackView | null;
      };
      place_bet: {
        Args: { p_selections: BetSelectionInput[]; p_stake: number };
        Returns: PlaceBetResult;
      };
      admin_settle_fixture: {
        Args: { p_fixture_id: number; p_home: number; p_away: number };
        Returns: undefined;
      };
      search_users: {
        Args: { p_query: string };
        Returns: UserSearchResult[];
      };
      send_friend_request: {
        Args: { p_addressee: string };
        Returns: string;
      };
      respond_friend_request: {
        Args: { p_request_id: number; p_accept: boolean };
        Returns: undefined;
      };
      remove_friend: {
        Args: { p_other: string };
        Returns: undefined;
      };
      list_friends: {
        Args: Record<string, never>;
        Returns: FriendRow[];
      };
      list_friend_requests: {
        Args: Record<string, never>;
        Returns: FriendRequest[];
      };
      leaderboard: {
        Args: { p_scope: string; p_metric: string };
        Returns: LeaderboardRow[];
      };
      list_my_poker_tables: {
        Args: Record<string, never>;
        Returns: MyPokerTable[];
      };
    };
    Enums: {
      transaction_type: TransactionType;
    };
    CompositeTypes: Record<string, never>;
  };
}
