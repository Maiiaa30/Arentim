import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  AdminAction,
  AdminAnnouncement,
  AdminMachine,
  AdminPlayerBet,
  AdminPlayerTransaction,
  Fixture,
  GameSwitch,
  Profile,
} from '@/types/db';

export interface AdminTop {
  id: string;
  display_name: string;
  balance?: number;
  total_wagered?: number;
  created_at?: string;
}

/** One-shot KPI snapshot for the admin overview (admin_stats RPC). */
export interface AdminStats {
  users_total: number;
  users_new_today: number;
  users_new_7d: number;
  online_now: number;
  active_24h: number;
  active_7d: number;
  suspended: number;
  admins: number;
  bettors: number;
  balance_total: number;
  wagered_total: number;
  won_total: number;
  games_total: number;
  sports_bets_total: number;
  sports_bets_today: number;
  sports_bets_open: number;
  sports_stake_total: number;
  top_balances: AdminTop[];
  top_wagered: AdminTop[];
  recent_signups: AdminTop[];
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'] as const,
    queryFn: async (): Promise<AdminStats> => {
      const { data, error } = await supabase.rpc('admin_stats');
      if (error) throw error;
      return data as unknown as AdminStats;
    },
    refetchInterval: 30_000,
  });
}

/** Player search (admin RLS lets admins read all profiles). */
export function useAdminPlayers(query: string) {
  return useQuery({
    queryKey: ['admin-players', query] as const,
    queryFn: async (): Promise<Profile[]> => {
      let q = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
      if (query.trim()) q = q.ilike('display_name', `%${query.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminActions() {
  return useQuery({
    queryKey: ['admin-actions'] as const,
    queryFn: async (): Promise<AdminAction[]> => {
      const { data, error } = await supabase
        .from('admin_actions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminFixtures() {
  return useQuery({
    queryKey: ['admin-fixtures'] as const,
    queryFn: async (): Promise<Fixture[]> => {
      const { data, error } = await supabase
        .from('fixtures')
        .select('*')
        .order('kickoff', { ascending: true })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminChallenges() {
  return useQuery({
    queryKey: ['admin-challenges'] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challenge_catalog')
        .select('*')
        .order('track')
        .order('sort');
      if (error) throw error;
      return data;
    },
  });
}

/** Recent ledger rows for one player (admin drill-down → Transações). */
export function useAdminPlayerTransactions(userId: string | null) {
  return useQuery({
    queryKey: ['admin-player-transactions', userId] as const,
    enabled: !!userId,
    queryFn: async (): Promise<AdminPlayerTransaction[]> => {
      const { data, error } = await supabase.rpc('admin_player_transactions', { p_user: userId!, p_limit: 30 });
      if (error) throw error;
      return data;
    },
  });
}

/** Recent sports bets for one player (admin drill-down → Apostas). */
export function useAdminPlayerBets(userId: string | null) {
  return useQuery({
    queryKey: ['admin-player-bets', userId] as const,
    enabled: !!userId,
    queryFn: async (): Promise<AdminPlayerBet[]> => {
      const { data, error } = await supabase.rpc('admin_player_bets', { p_user: userId!, p_limit: 20 });
      if (error) throw error;
      return data;
    },
  });
}

/** Every announcement (active + inactive) for the management list. */
export function useAdminAnnouncements() {
  return useQuery({
    queryKey: ['admin-announcements'] as const,
    queryFn: async (): Promise<AdminAnnouncement[]> => {
      const { data, error } = await supabase.rpc('admin_announcements');
      if (error) throw error;
      return data;
    },
  });
}

/** Toggle an announcement active/inactive. */
export function useSetAnnouncementActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: number; active: boolean }) => {
      const { error } = await supabase.rpc('admin_set_announcement_active', { p_id: v.id, p_active: v.active });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-announcements'] });
      void qc.invalidateQueries({ queryKey: ['announcements'] });
      void qc.invalidateQueries({ queryKey: ['admin-actions'] });
    },
  });
}

/** Whole-game on/off switches — read by the casino lobby AND the admin panel. */
export function useGameSwitches() {
  return useQuery({
    queryKey: ['game-switches'] as const,
    staleTime: 60_000,
    queryFn: async (): Promise<GameSwitch[]> => {
      const { data, error } = await supabase.rpc('list_game_switches');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Admin list of every slot machine with its enable flag. */
export function useAdminMachines() {
  return useQuery({
    queryKey: ['admin-machines'] as const,
    queryFn: async (): Promise<AdminMachine[]> => {
      const { data, error } = await supabase.rpc('admin_list_machines');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Toggle a whole game or a single slot machine on/off (admin). */
export function useGameToggles() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['game-switches'] });
    void qc.invalidateQueries({ queryKey: ['admin-machines'] });
    void qc.invalidateQueries({ queryKey: ['slot-machines'] });
    void qc.invalidateQueries({ queryKey: ['admin-actions'] });
  };
  const setGameEnabled = useMutation({
    mutationFn: async (v: { key: string; enabled: boolean }) => {
      const { error } = await supabase.rpc('admin_set_game_enabled', { p_key: v.key, p_enabled: v.enabled });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const setMachineEnabled = useMutation({
    mutationFn: async (v: { key: string; enabled: boolean }) => {
      const { error } = await supabase.rpc('admin_set_machine_enabled', { p_key: v.key, p_enabled: v.enabled });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  return { setGameEnabled, setMachineEnabled };
}

export function useAdminActionsMutations() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin-players'] });
    void qc.invalidateQueries({ queryKey: ['admin-actions'] });
    void qc.invalidateQueries({ queryKey: ['admin-fixtures'] });
    void qc.invalidateQueries({ queryKey: ['admin-challenges'] });
    void qc.invalidateQueries({ queryKey: ['admin-announcements'] });
    void qc.invalidateQueries({ queryKey: ['announcements'] });
  };

  const adjustBalance = useMutation({
    mutationFn: async (v: { user: string; amount: number; reason: string }) => {
      const { error } = await supabase.rpc('admin_adjust_balance', { p_user: v.user, p_amount: v.amount, p_reason: v.reason });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const setStreak = useMutation({
    mutationFn: async (v: { user: string; streak: number; reason: string }) => {
      const { error } = await supabase.rpc('admin_set_streak', { p_user: v.user, p_streak: v.streak, p_reason: v.reason });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const setSuspended = useMutation({
    mutationFn: async (v: { user: string; suspended: boolean; reason: string }) => {
      const { error } = await supabase.rpc('admin_set_suspended', { p_user: v.user, p_suspended: v.suspended, p_reason: v.reason });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const suspendUntil = useMutation({
    mutationFn: async (v: { user: string; minutes: number; reason: string }) => {
      const { error } = await supabase.rpc('admin_suspend_until', { p_user: v.user, p_minutes: v.minutes, p_reason: v.reason });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const settleFixture = useMutation({
    mutationFn: async (v: { fixture: number; home: number; away: number }) => {
      const { error } = await supabase.rpc('admin_settle_fixture', { p_fixture_id: v.fixture, p_home: v.home, p_away: v.away });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const setOdds = useMutation({
    mutationFn: async (v: { fixture: number; odds: Record<string, Record<string, number>> }) => {
      const { error } = await supabase.rpc('admin_set_odds', { p_fixture: v.fixture, p_odds: v.odds });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const broadcast = useMutation({
    mutationFn: async (v: { title: string; body: string }) => {
      const { error } = await supabase.rpc('admin_broadcast', { p_title: v.title, p_body: v.body });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const upsertChallenge = useMutation({
    mutationFn: async (v: {
      key: string; title: string; description: string; metric: string;
      target: number; reward: number; track: string; active: boolean;
    }) => {
      const { error } = await supabase.rpc('admin_upsert_challenge', {
        p_key: v.key, p_title: v.title, p_description: v.description, p_metric: v.metric,
        p_target: v.target, p_reward: v.reward, p_track: v.track, p_active: v.active,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const resetSeason = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_reset_season');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refresh();
      void qc.invalidateQueries({ queryKey: ['season-leaderboard'] });
    },
  });

  return { adjustBalance, setStreak, setSuspended, suspendUntil, settleFixture, setOdds, broadcast, upsertChallenge, resetSeason };
}
