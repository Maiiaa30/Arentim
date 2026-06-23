/**
 * Hand-written database types mirroring the SQL migrations. Kept deliberately
 * small and focused; can be regenerated with `supabase gen types` later.
 */

export type TransactionType = 'bonus' | 'bet' | 'win' | 'loss' | 'refund' | 'adjustment';

/** Bet payload sent to the play_roulette RPC. */
export type RouletteBetPayload = {
  kind: string;
  selection: number | null;
  /** Covered numbers for split (2) / corner (4) bets. */
  numbers?: number[];
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

/** A team's standings snapshot, cached on a fixture for the match-detail popup. */
export type TeamStat = {
  position: number | null;
  played: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  gf: number;
  ga: number;
  form: string | null;
};
export type FixtureStats = { home?: TeamStat | null; away?: TeamStat | null };

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
  home_crest: string | null;
  away_crest: string | null;
  odds: Record<string, Record<string, number>>;
  stats: FixtureStats;
  events: { type?: string; minute?: number | null; team?: string | null; player?: string | null }[];
  preview: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyContent = {
  id: number;
  kind: 'featured' | 'recap';
  fixture_id: number | null;
  title: string;
  body: string;
  created_at: string;
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
  replayed?: boolean;
};

export type UserSearchResult = { id: string; display_name: string; avatar_url: string | null };

export type FriendStatus = 'self' | 'friends' | 'pending_out' | 'pending_in' | 'none';

export type PublicProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  games_played: number;
  games_won: number;
  biggest_win: number;
  total_won: number;
  total_lost: number;
  streak_count: number;
  created_at: string;
  last_online: string | null;
  friend_status: FriendStatus;
};

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

export type ChallengeRow = {
  key: string;
  title: string;
  description: string;
  track: 'recovery' | 'highroller';
  target: number;
  reward: number;
  progress: number;
  claimed: boolean;
};

export type ChallengeClaimResult = {
  status: 'claimed' | 'already_claimed' | 'incomplete';
  reward?: number;
  balance?: number;
  progress?: number;
  target?: number;
};

export type RescueResult = {
  status: 'granted' | 'not_eligible' | 'already_claimed';
  amount?: number;
  balance?: number;
};

export type DailyChallengeRow = {
  key: string;
  title: string;
  description: string;
  target: number;
  reward: number;
  progress: number;
  claimed: boolean;
  slot: number;
  resets_at: string;
};

export type DailyChallengeClaimResult = {
  status: 'claimed' | 'already_claimed' | 'incomplete';
  reward?: number;
  balance?: number;
  progress?: number;
  target?: number;
};

export type MyPokerTable = {
  table_id: number;
  code: string;
  status: string;
  player_count: number;
  is_host: boolean;
};

export type PublicPokerTable = {
  table_id: number;
  code: string;
  status: string;
  host_name: string;
  buy_in: number;
  seats: number;
  max_seats: number;
};

export type LeaderboardRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  value: number;
  is_me: boolean;
};

/** A row in the Onze de Ouro daily leaderboard. */
export type OnzeLeaderboardRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
  record: string;
  champion: boolean;
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

/** A reel symbol (id + emoji glyph) as exposed by list_slot_machines. */
export type SlotSymbolMeta = { id: string; glyph: string };

/** One paytable row; `mult` is null for the (hidden) jackpot symbol. */
export type SlotPayRow = { id: string; glyph: string; mult: number | null };

/** Public, jackpot-masked machine config from list_slot_machines. */
export type SlotMachineMeta = {
  key: string;
  name: string;
  blurb: string;
  accent: string;
  /** Cabinet style: 'video' (ornate themed) or 'classic' (chrome 3-reel drum). */
  cabinet?: 'video' | 'classic';
  min_bet: number;
  max_bet: number;
  jackpot_symbol: string;
  /** True for a progressive machine (shared, growing jackpot pool). */
  progressive?: boolean;
  /** The live progressive pool (only for progressive machines; null otherwise). */
  jackpot_pool?: number | null;
  symbols: SlotSymbolMeta[];
  paytable: SlotPayRow[];
};

/** Result returned by the play_slot RPC (themed machines). */
export type SlotSpinResult = {
  reels: string[];
  machine: string;
  multiplier: number;
  jackpot: boolean;
  payout: number;
  /** New progressive pool value after the spin (progressive machines only). */
  jackpot_pool?: number | null;
  balance: number;
  replayed: boolean;
};

/** Result returned by the play_dice RPC. */
export type DiceResult = {
  dice: [number, number];
  sum: number;
  won: boolean;
  payout: number;
  balance: number;
  replayed: boolean;
};

/** A dealt Sobe e Desce round: the current rung + the two adapted multipliers. */
export type HiloDealResult = {
  current: number;
  sobe_count: number;
  desce_count: number;
  sobe_mult: number;
  desce_mult: number;
};

/** cups_start: a cosmetic swap sequence for the shuffle. The winning cup is
 *  hidden server-side (decided at cups_pick) and never sent here, so it can't be
 *  read from the response. */
export type CupsStartResult = {
  swaps: [number, number][];
  multiplier: number;
  balance: number;
};

/** cups_pick: settle which cup you chose. */
export type CupsPickResult = {
  prize: number;
  picked: number;
  won: boolean;
  multiplier: number;
  payout: number;
  balance: number;
};

/** One row of the football betting leaderboard. */
export type FootballLeaderRow = {
  id: string;
  name: string;
  wagered: number;
  won: number;
  lost: number;
  net: number;
  bets: number;
};

/** Result of the play_highlow RPC (single-die High/Low). */
export type HighLowResult = {
  die: number;
  won: boolean;
  payout: number;
  balance: number;
  replayed: boolean;
};

/** Result of a settled Sobe e Desce bet. */
export type HiloBetResult = {
  current: number;
  next: number;
  won: boolean;
  mult: number;
  payout: number;
  balance: number;
};

/** Result returned by the play_wheel RPC. */
export type WheelResult = {
  index: number;
  multiplier: number;
  payout: number;
  balance: number;
  replayed: boolean;
};

/** Result of crash_start: a launched round the client then animates. */
export type CrashStartResult = {
  round_id: number;
  started_at: string;
  auto_target: number | null;
  balance: number;
};

/** Live read of a flying crash round (polled for the animation). */
export type CrashStateResult = {
  phase: 'none' | 'flying' | 'busted' | 'settled';
  mult?: number;
  crash?: number;
  won?: boolean;
  payout?: number;
};

/** Authoritative settle of a crash round (manual or auto cash-out / bust). */
export type CrashSettleResult = {
  won: boolean;
  mult: number;
  crash: number;
  payout: number;
  balance: number;
  replayed: boolean;
};

/** A bet row in the shared Crash room (no hidden info — readable by everyone). */
export type CrashBetRow = {
  id: number;
  room_id: number;
  user_id: string;
  display_name: string;
  stake: number;
  auto_target: number | null;
  cashout: number | null;
  payout: number;
  settled: boolean;
  created_at: string;
};

/** Masked snapshot of the shared Crash round (crash_room_now). */
export type CrashRoomState = {
  room_id: number;
  status: 'betting' | 'flying' | 'busted';
  server_now: string;
  betting_ends_at: string;
  fly_start_at: string;
  bust_at: string | null;
  mult: number | null;
  crash: number | null;
  mine: {
    stake: number;
    auto_target: number | null;
    settled: boolean;
    cashout: number | null;
    payout: number;
  } | null;
};

export type CrashRoomBetResult = { ok?: boolean; balance: number };
export type CrashRoomCashoutResult = {
  won: boolean;
  mult: number;
  crash: number | null;
  payout: number;
  balance: number;
  replayed?: boolean;
};

/** A slip row in the shared Roulette table (no hidden info). */
export type RouletteRoomBetRow = {
  id: number;
  room_id: number;
  user_id: string;
  display_name: string;
  bets: RouletteBetPayload[];
  stake: number;
  payout: number;
  bonus_hit: boolean;
  settled: boolean;
  created_at: string;
};

/** Masked snapshot of the shared Roulette round (roulette_room_now). */
export type RouletteRoomState = {
  room_id: number;
  status: 'betting' | 'spinning' | 'done';
  server_now: string;
  betting_ends_at: string;
  spin_start_at: string;
  reveal_at: string;
  /** Hidden (null) until betting closes. */
  number: number | null;
  bonus: RouletteBonus | null;
  mine: {
    bets: RouletteBetPayload[];
    stake: number;
    settled: boolean;
    payout: number;
    bonus_hit: boolean;
  } | null;
};

export type RouletteRoomBetResult = { ok?: boolean; balance: number; stake: number };

/** A bet row in the shared horse-race room. */
export type HorseBetRow = {
  id: number;
  room_id: number;
  user_id: string;
  display_name: string;
  horse: number;
  stake: number;
  payout: number;
  settled: boolean;
  created_at: string;
};

/** Masked snapshot of the shared horse race (horse_room_now). */
export type HorseRoomState = {
  room_id: number;
  status: 'betting' | 'racing' | 'done';
  server_now: string;
  betting_ends_at: string;
  race_start_at: string;
  finish_at: string;
  odds: number[];
  winner: number | null;
  mine: { horse: number; stake: number; settled: boolean; payout: number } | null;
};

/** A head-to-head duel row (duel_list RPC). */
export type DuelRow = {
  id: number;
  role: 'challenger' | 'opponent';
  other_id: string;
  other_name: string;
  stake: number;
  game: string;
  status: 'pending' | 'settled' | 'declined' | 'cancelled';
  challenger_roll: number | null;
  opponent_roll: number | null;
  winner: string | null;
  my_roll: number | null;
  their_roll: number | null;
  created_at: string;
};

export type DuelRespondResult = {
  status: 'declined' | 'settled';
  challenger_roll?: number;
  opponent_roll?: number;
  winner?: string;
  won?: boolean;
  balance?: number;
};

/** Live casino-lobby activity (casino_activity RPC). */
export type CasinoActivity = {
  crash: { players: number; friends: number };
  roulette: { players: number; friends: number };
  horse?: { players: number; friends: number };
  recent: { name: string; game: string | null; amount: number; at: string; is_me: boolean }[];
};

/** A row in the per-user notification inbox (header bell). */
export type NotificationRow = {
  id: number;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

/** Result returned by the claim_daily_bonus RPC. */
export type DailyBonusResult = {
  status: 'claimed' | 'already_claimed' | 'play_required';
  streak: number;
  reward: number;
  balance: number;
};

/** The round's lucky numbers + bonus multiple (roulette mini-game). */
export type RouletteBonus = { numbers: number[]; mult: number };

/** Result object returned by the play_roulette RPC. */
export type RouletteSpinResult = {
  round_id: number;
  number: number;
  stake: number;
  payout: number;
  balance: number;
  results: RouletteBetResult[];
  /** The next round's lucky numbers (re-rolled after this spin). */
  bonus?: RouletteBonus | null;
  /** True if a straight bet landed on a lucky number (paid double). */
  bonus_hit?: boolean;
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
  last_rescue_date: string | null;
  suspended: boolean;
  suspended_until: string | null;
};

export type Announcement = {
  id: number;
  admin_id: string;
  title: string;
  body: string;
  active: boolean;
  created_at: string;
};

export type AdminAction = {
  id: number;
  admin_id: string;
  target_user_id: string | null;
  action: string;
  detail: Record<string, unknown> | null;
  created_at: string;
};

/** Row from admin_player_transactions — recent ledger for one player. */
export type AdminPlayerTransaction = {
  id: number;
  type: TransactionType;
  game: string | null;
  amount: number;
  balance_after: number;
  note: string | null;
  created_at: string;
};

/** Row from admin_player_bets — recent sports bets for one player. */
export type AdminPlayerBet = {
  id: number;
  stake: number;
  combined_odds: number;
  potential_payout: number;
  status: 'pending' | 'won' | 'lost' | 'void';
  created_at: string;
};

/** Row from admin_announcements — every announcement for the management list. */
export type AdminAnnouncement = {
  id: number;
  title: string;
  body: string;
  active: boolean;
  created_at: string;
};

/** A whole-game on/off switch shown in the casino lobby + admin. */
export type GameSwitch = { key: string; label: string; enabled: boolean };
/** Admin view of a slot machine with its enable flag. */
export type AdminMachine = { key: string; name: string; enabled: boolean };

/** Official broadcaster for a competition ("Onde ver"). */
export type Broadcast = { league: string; channel: string; url: string | null };

/** Per-team live match statistics (from the match-stats Edge Function). */
export type LiveTeamStats = {
  possession: string | number | null;
  shots: number | string | null;
  shotsOn: number | string | null;
  corners: number | string | null;
  fouls: number | string | null;
  yellow: number | string | null;
  red: number | string | null;
  offsides: number | string | null;
  passAcc: string | number | null;
};
export type MatchStats = { home: LiveTeamStats; away: LiveTeamStats };
export type MatchStatsResponse = {
  available: boolean;
  reason?: string;
  stats?: MatchStats | null;
  cached?: boolean;
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

/** Mines: masked round snapshot + pick/cash-out results. */
export type MinesState = {
  mines: number;
  picks: number[];
  multiplier: number;
  next_multiplier?: number;
  balance: number;
};
export type MinesPickResult = {
  safe: boolean;
  cell: number;
  picks?: number[];
  multiplier?: number;
  next_multiplier?: number;
  cashed?: boolean;
  payout?: number;
  mines?: number[];
  balance?: number;
};
export type MinesCashoutResult = {
  payout: number;
  multiplier: number;
  picks: number[];
  mines: number[];
  balance: number;
};
/** Masked in-progress Mines round for resume (mines_current). Never the layout. */
export type MinesCurrent = {
  mines: number;
  stake: number;
  picks: number[];
  multiplier: number;
  next_multiplier: number;
};

/** Tigrinho (3×3 tiger slot). */
export type TigrinhoResult = {
  grid: number[];
  wins: { row: number; symbol: number; amount: number }[];
  payout: number;
  multiplier: number;
  balance: number;
  replayed: boolean;
};

/** Corrida de Cavalos. */
export type HorseResult = {
  winner: number;
  horse: number;
  won: boolean;
  payout: number;
  odds: number[];
  balance: number;
  replayed: boolean;
};

/** Frango na Estrada (chicken). */
export type ChickenState = {
  difficulty: string;
  step: number;
  multiplier: number;
  next_multiplier?: number;
  balance: number;
};
export type ChickenStepResult = {
  alive: boolean;
  lane: number;
  multiplier?: number;
  next_multiplier?: number;
  cashed?: boolean;
  payout?: number;
  balance?: number;
};
export type ChickenCashoutResult = { payout: number; multiplier: number; lane: number; balance: number };
/** Masked in-progress Frango round for resume (chicken_current). */
export type ChickenCurrent = { difficulty: string; step: number; stake: number; multiplier: number };

/** Balatró — a single-blind poker-hand skill game (mirrors src/features/casino/balatro.ts). */
export type BalatroState = {
  hand: number[];
  target: number;
  score: number;
  hands_left: number;
  discards_left: number;
  reward: number;
  status: 'playing';
};
export type BalatroPlayResult = {
  hand_type: string;
  gained: number;
  score: number;
  hands_left: number;
  discards_left: number;
  played: number[];
  hand: number[];
  status: 'playing' | 'won' | 'lost';
  payout: number;
  balance: number;
};
export type BalatroDiscardResult = {
  hand: number[];
  score: number;
  target: number;
  hands_left: number;
  discards_left: number;
  status: 'playing';
  balance: number;
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
      daily_content: {
        Row: DailyContent;
        Insert: Partial<DailyContent> & { kind: string; title: string; body: string };
        Update: Partial<DailyContent>;
        Relationships: [];
      };
      announcements: {
        Row: Announcement;
        Insert: Partial<Announcement> & { admin_id: string; title: string; body: string };
        Update: Partial<Announcement>;
        Relationships: [];
      };
      admin_actions: {
        Row: AdminAction;
        Insert: Partial<AdminAction> & { admin_id: string; action: string };
        Update: Partial<AdminAction>;
        Relationships: [];
      };
      challenge_catalog: {
        Row: { key: string; title: string; description: string; metric: string; target: number; reward: number; track: string; sort: number; active: boolean };
        Insert: { key: string; title: string; description: string; metric: string; target: number; reward: number; track: string };
        Update: Partial<{ title: string; description: string; metric: string; target: number; reward: number; track: string; active: boolean }>;
        Relationships: [];
      };
      daily_challenge_catalog: {
        Row: { key: string; title: string; description: string; metric: string; target: number; reward: number; sort: number; active: boolean };
        Insert: { key: string; title: string; description: string; metric: string; target: number; reward: number };
        Update: Partial<{ title: string; description: string; metric: string; target: number; reward: number; active: boolean }>;
        Relationships: [];
      };
      daily_challenge_claims: {
        Row: { user_id: string; challenge_key: string; claim_date: string; claimed_at: string; reward: number };
        Insert: { user_id: string; challenge_key: string; reward: number };
        Update: Partial<{ reward: number }>;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: Partial<NotificationRow> & { user_id: string; type: string; title: string };
        Update: Partial<NotificationRow>;
        Relationships: [];
      };
      crash_bets: {
        Row: CrashBetRow;
        Insert: Partial<CrashBetRow> & { room_id: number; user_id: string; display_name: string; stake: number };
        Update: Partial<CrashBetRow>;
        Relationships: [];
      };
      roulette_room_bets: {
        Row: RouletteRoomBetRow;
        Insert: Partial<RouletteRoomBetRow> & { room_id: number; user_id: string; display_name: string; bets: RouletteBetPayload[]; stake: number };
        Update: Partial<RouletteRoomBetRow>;
        Relationships: [];
      };
      horse_bets: {
        Row: HorseBetRow;
        Insert: Partial<HorseBetRow> & { room_id: number; user_id: string; display_name: string; horse: number; stake: number };
        Update: Partial<HorseBetRow>;
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
      roulette_get_bonus: {
        Args: Record<string, never>;
        Returns: RouletteBonus;
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
      list_slot_machines: {
        Args: Record<string, never>;
        Returns: SlotMachineMeta[];
      };
      play_slot: {
        Args: { p_machine: string; p_stake: number; p_idempotency_key: string | null };
        Returns: SlotSpinResult;
      };
      play_video_slot: {
        Args: { p_stake: number; p_idempotency_key: string | null };
        Returns: {
          grid: string[][];
          lines: { line: number; symbol: string; len: number; mult: number }[];
          multiplier: number;
          jackpot: boolean;
          payout: number;
          balance: number;
          replayed: boolean;
        };
      };
      play_dice: {
        Args: { p_stake: number; p_pick: string; p_idempotency_key: string | null };
        Returns: DiceResult;
      };
      cups_start: {
        Args: { p_stake: number };
        Returns: CupsStartResult;
      };
      cups_pick: {
        Args: { p_picked: number };
        Returns: CupsPickResult;
      };
      mines_start: {
        Args: { p_stake: number; p_mines: number };
        Returns: MinesState;
      };
      mines_pick: {
        Args: { p_cell: number };
        Returns: MinesPickResult;
      };
      mines_cashout: {
        Args: Record<string, never>;
        Returns: MinesCashoutResult;
      };
      mines_current: {
        Args: Record<string, never>;
        Returns: MinesCurrent | null;
      };
      chicken_current: {
        Args: Record<string, never>;
        Returns: ChickenCurrent | null;
      };
      play_tigrinho: {
        Args: { p_stake: number; p_idempotency_key?: string };
        Returns: TigrinhoResult;
      };
      play_horse: {
        Args: { p_stake: number; p_horse: number; p_idempotency_key?: string };
        Returns: HorseResult;
      };
      chicken_start: {
        Args: { p_stake: number; p_difficulty?: string };
        Returns: ChickenState;
      };
      chicken_step: {
        Args: Record<string, never>;
        Returns: ChickenStepResult;
      };
      chicken_cashout: {
        Args: Record<string, never>;
        Returns: ChickenCashoutResult;
      };
      play_highlow: {
        Args: { p_stake: number; p_pick: string; p_idempotency_key: string | null };
        Returns: HighLowResult;
      };
      football_leaderboard: {
        Args: Record<string, never>;
        Returns: FootballLeaderRow[];
      };
      hilo_deal: {
        Args: Record<string, never>;
        Returns: HiloDealResult;
      };
      hilo_bet: {
        Args: { p_stake: number; p_pick: string };
        Returns: HiloBetResult;
      };
      play_wheel: {
        Args: { p_stake: number; p_idempotency_key: string | null };
        Returns: WheelResult;
      };
      play_plinko: {
        Args: { p_stake: number; p_rows: number; p_risk: string; p_idempotency_key: string | null };
        Returns: {
          path: number[];
          bin: number;
          rows: number;
          risk: string;
          multiplier: number;
          payout: number;
          balance: number;
          replayed: boolean;
        };
      };
      balatro_start: {
        Args: { p_stake: number };
        Returns: BalatroState;
      };
      balatro_play: {
        Args: { p_cards: number[] };
        Returns: BalatroPlayResult;
      };
      balatro_discard: {
        Args: { p_cards: number[] };
        Returns: BalatroDiscardResult;
      };
      balatro_current: {
        Args: Record<string, never>;
        Returns: BalatroState | null;
      };
      horse_room_now: {
        Args: Record<string, never>;
        Returns: HorseRoomState;
      };
      horse_room_bet: {
        Args: { p_room_id: number; p_horse: number; p_stake: number };
        Returns: { ok?: boolean; balance: number };
      };
      horse_room_history: {
        Args: Record<string, never>;
        Returns: number[];
      };
      crash_start: {
        Args: { p_stake: number; p_auto_target: number | null };
        Returns: CrashStartResult;
      };
      crash_state: {
        Args: { p_round_id: number };
        Returns: CrashStateResult;
      };
      crash_cashout: {
        Args: { p_round_id: number };
        Returns: CrashSettleResult;
      };
      crash_history: {
        Args: Record<string, never>;
        Returns: number[];
      };
      crash_room_now: {
        Args: Record<string, never>;
        Returns: CrashRoomState;
      };
      crash_room_bet: {
        Args: { p_room_id: number; p_stake: number; p_auto_target: number | null };
        Returns: CrashRoomBetResult;
      };
      crash_room_cashout: {
        Args: { p_room_id: number };
        Returns: CrashRoomCashoutResult;
      };
      crash_room_history: {
        Args: Record<string, never>;
        Returns: number[];
      };
      roulette_room_now: {
        Args: Record<string, never>;
        Returns: RouletteRoomState;
      };
      roulette_room_bet: {
        Args: { p_room_id: number; p_bets: RouletteBetPayload[] };
        Returns: RouletteRoomBetResult;
      };
      roulette_room_history: {
        Args: Record<string, never>;
        Returns: number[];
      };
      list_notifications: {
        Args: { p_limit: number };
        Returns: NotificationRow[];
      };
      notifications_unread_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      mark_notifications_read: {
        Args: { p_ids: number[] | null };
        Returns: undefined;
      };
      casino_activity: {
        Args: Record<string, never>;
        Returns: CasinoActivity;
      };
      gift_tos: {
        Args: { p_to: string; p_amount: number };
        Returns: { balance: number; amount: number };
      };
      my_referral: {
        Args: Record<string, never>;
        Returns: { code: string | null; referred_by: string | null; referred_count: number };
      };
      claim_referral: {
        Args: { p_code: string };
        Returns:
          | { status: 'already' | 'invalid' }
          | { status: 'claimed'; reward: number; balance: number };
      };
      duel_create: {
        Args: { p_opponent: string; p_stake: number; p_game?: string };
        Returns: { duel_id: number; balance: number };
      };
      duel_respond: {
        Args: { p_duel_id: number; p_accept: boolean };
        Returns: DuelRespondResult;
      };
      duel_cancel: {
        Args: { p_duel_id: number };
        Returns: { balance: number };
      };
      duel_list: {
        Args: Record<string, never>;
        Returns: DuelRow[];
      };
      duel_record: {
        Args: { p_other: string };
        Returns: { wins: number; losses: number; total: number };
      };
      request_tos: {
        Args: { p_from: string; p_amount: number };
        Returns: undefined;
      };
      cashout_bet: {
        Args: { p_bet_id: number };
        Returns: { refund: number; balance: number };
      };
      admin_reset_season: {
        Args: Record<string, never>;
        Returns: string;
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
        Args: { p_selections: BetSelectionInput[]; p_stake: number; p_idempotency_key?: string };
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
      season_leaderboard: {
        Args: { p_scope: string };
        Returns: LeaderboardRow[];
      };
      onze_leaderboard: {
        Args: { p_scope: string };
        Returns: OnzeLeaderboardRow[];
      };
      submit_onze_score: {
        Args: {
          p_score: number; p_rating: number; p_wins: number; p_champion: boolean;
          p_record: string; p_formation: string; p_xi: unknown[];
        };
        Returns: { best: number };
      };
      list_my_poker_tables: {
        Args: Record<string, never>;
        Returns: MyPokerTable[];
      };
      list_public_poker_tables: {
        Args: Record<string, never>;
        Returns: PublicPokerTable[];
      };
      list_my_sueca_tables: {
        Args: Record<string, never>;
        Returns: { table_id: number; code: string; status: string; player_count: number; is_host: boolean }[];
      };
      username_available: {
        Args: { p_name: string };
        Returns: boolean;
      };
      public_profile: {
        Args: { p_user: string };
        Returns: PublicProfile | null;
      };
      list_challenges: {
        Args: Record<string, never>;
        Returns: ChallengeRow[];
      };
      claim_challenge: {
        Args: { p_key: string };
        Returns: ChallengeClaimResult;
      };
      claim_rescue: {
        Args: Record<string, never>;
        Returns: RescueResult;
      };
      list_daily_challenges: {
        Args: Record<string, never>;
        Returns: DailyChallengeRow[];
      };
      claim_daily_challenge: {
        Args: { p_key: string };
        Returns: DailyChallengeClaimResult;
      };
      admin_adjust_balance: {
        Args: { p_user: string; p_amount: number; p_reason: string };
        Returns: { balance: number };
      };
      admin_set_streak: {
        Args: { p_user: string; p_streak: number; p_reason: string };
        Returns: undefined;
      };
      admin_set_suspended: {
        Args: { p_user: string; p_suspended: boolean; p_reason: string };
        Returns: undefined;
      };
      admin_suspend_until: {
        Args: { p_user: string; p_minutes: number; p_reason: string };
        Returns: string | null;
      };
      admin_stats: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      admin_set_odds: {
        Args: { p_fixture: number; p_odds: Record<string, Record<string, number>> };
        Returns: undefined;
      };
      admin_upsert_challenge: {
        Args: {
          p_key: string; p_title: string; p_description: string; p_metric: string;
          p_target: number; p_reward: number; p_track: string; p_active: boolean;
        };
        Returns: undefined;
      };
      admin_broadcast: {
        Args: { p_title: string; p_body: string };
        Returns: undefined;
      };
      admin_player_transactions: {
        Args: { p_user: string; p_limit?: number };
        Returns: AdminPlayerTransaction[];
      };
      admin_player_bets: {
        Args: { p_user: string; p_limit?: number };
        Returns: AdminPlayerBet[];
      };
      admin_announcements: {
        Args: Record<string, never>;
        Returns: AdminAnnouncement[];
      };
      admin_set_announcement_active: {
        Args: { p_id: number; p_active: boolean };
        Returns: undefined;
      };
      list_game_switches: {
        Args: Record<string, never>;
        Returns: GameSwitch[];
      };
      admin_set_game_enabled: {
        Args: { p_key: string; p_enabled: boolean };
        Returns: undefined;
      };
      admin_list_machines: {
        Args: Record<string, never>;
        Returns: AdminMachine[];
      };
      admin_set_machine_enabled: {
        Args: { p_key: string; p_enabled: boolean };
        Returns: undefined;
      };
      list_broadcasts: {
        Args: Record<string, never>;
        Returns: Broadcast[];
      };
      admin_set_broadcast: {
        Args: { p_league: string; p_channel: string; p_url: string };
        Returns: undefined;
      };
    };
    Enums: {
      transaction_type: TransactionType;
    };
    CompositeTypes: Record<string, never>;
  };
}
