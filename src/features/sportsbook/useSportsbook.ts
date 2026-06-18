import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { Bet, BetSelectionInput, BetSelectionRow, Fixture, PlaceBetResult } from '@/types/db';

/** Upcoming, open-for-betting fixtures. */
export function useFixtures() {
  return useQuery({
    queryKey: ['fixtures', 'upcoming'] as const,
    queryFn: async (): Promise<Fixture[]> => {
      const { data, error } = await supabase
        .from('fixtures')
        .select('*')
        .eq('status', 'scheduled')
        .gt('kickoff', new Date().toISOString())
        .order('kickoff', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export interface BetWithLegs extends Bet {
  legs: (BetSelectionRow & { fixture?: Pick<Fixture, 'home' | 'away' | 'status'> })[];
}

/** The signed-in user's bets with their legs and fixture names. */
export function useMyBets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['bets', user?.id] as const,
    enabled: !!user,
    queryFn: async (): Promise<BetWithLegs[]> => {
      const { data: bets, error } = await supabase
        .from('bets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (bets.length === 0) return [];

      const betIds = bets.map((b) => b.id);
      const { data: legs, error: legErr } = await supabase
        .from('bet_selections')
        .select('*')
        .in('bet_id', betIds);
      if (legErr) throw legErr;

      const fixtureIds = [...new Set(legs.map((l) => l.fixture_id))];
      const { data: fixtures, error: fxErr } = await supabase
        .from('fixtures')
        .select('id, home, away, status')
        .in('id', fixtureIds);
      if (fxErr) throw fxErr;

      const fxById = new Map(fixtures.map((f) => [f.id, f]));
      return bets.map((b) => ({
        ...b,
        legs: legs
          .filter((l) => l.bet_id === b.id)
          .map((l) => {
            const fx = fxById.get(l.fixture_id);
            return fx ? { ...l, fixture: { home: fx.home, away: fx.away, status: fx.status } } : l;
          }),
      }));
    },
  });
}

export function usePlaceBet() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      selections: BetSelectionInput[];
      stake: number;
    }): Promise<PlaceBetResult> => {
      const { data, error } = await supabase.rpc('place_bet', {
        p_selections: input.selections,
        p_stake: input.stake,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKey(user?.id) });
      void qc.invalidateQueries({ queryKey: ['bets', user?.id] });
      void qc.invalidateQueries({ queryKey: ['transactions', user?.id] });
    },
  });
}
