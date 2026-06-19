import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AdminAction, Fixture, Profile } from '@/types/db';

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

export function useAdminActionsMutations() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin-players'] });
    void qc.invalidateQueries({ queryKey: ['admin-actions'] });
    void qc.invalidateQueries({ queryKey: ['admin-fixtures'] });
    void qc.invalidateQueries({ queryKey: ['admin-challenges'] });
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
  const settleFixture = useMutation({
    mutationFn: async (v: { fixture: number; home: number; away: number }) => {
      const { error } = await supabase.rpc('admin_settle_fixture', { p_fixture_id: v.fixture, p_home: v.home, p_away: v.away });
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

  return { adjustBalance, setStreak, setSuspended, settleFixture, broadcast, upsertChallenge };
}
