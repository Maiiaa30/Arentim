import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { Bet, BetSelectionInput, BetSelectionRow, Fixture, PlaceBetResult } from '@/types/db';

/** Currently-live fixtures (score, minute, events stream in over Realtime). */
export function useLiveFixtures() {
  return useQuery({
    queryKey: ['fixtures', 'live'] as const,
    queryFn: async (): Promise<Fixture[]> => {
      const { data, error } = await supabase
        .from('fixtures')
        .select('*')
        .eq('status', 'live')
        .order('kickoff', { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000, // safety net in case a Realtime event is missed
  });
}

/**
 * Subscribes to fixture + own-bet changes over Supabase Realtime and refreshes
 * the relevant queries, so scores and bet settlement update live.
 */
export function useSportsbookRealtime() {
  const qc = useQueryClient();
  const { user } = useAuth();
  useEffect(() => {
    const channel = supabase
      .channel('sportsbook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fixtures' }, () => {
        void qc.invalidateQueries({ queryKey: ['fixtures'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, () => {
        void qc.invalidateQueries({ queryKey: ['bets', user?.id] });
        void qc.invalidateQueries({ queryKey: profileKey(user?.id) });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc, user?.id]);
}

/**
 * Every fixture we know about (live, upcoming and finished), newest activity
 * first. Powers the FlashScore-style Resultados page. Read-only; never touches
 * money/bet logic. Auto-refreshes as a safety net on top of Realtime.
 */
export function useAllFixtures() {
  return useQuery({
    queryKey: ['fixtures', 'all'] as const,
    queryFn: async (): Promise<Fixture[]> => {
      const { data, error } = await supabase
        .from('fixtures')
        .select('*')
        .order('kickoff', { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });
}

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
  legs: (BetSelectionRow & {
    fixture?: Pick<Fixture, 'home' | 'away' | 'status' | 'home_score' | 'away_score'>;
  })[];
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
        .select('id, home, away, status, home_score, away_score')
        .in('id', fixtureIds);
      if (fxErr) throw fxErr;

      const fxById = new Map(fixtures.map((f) => [f.id, f]));
      return bets.map((b) => ({
        ...b,
        legs: legs
          .filter((l) => l.bet_id === b.id)
          .map((l) => {
            const fx = fxById.get(l.fixture_id);
            return fx
              ? {
                  ...l,
                  fixture: {
                    home: fx.home,
                    away: fx.away,
                    status: fx.status,
                    home_score: fx.home_score,
                    away_score: fx.away_score,
                  },
                }
              : l;
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
      /** Stable per-submission key so a retry can't double-debit (audit H1). */
      idempotencyKey: string;
    }): Promise<PlaceBetResult> => {
      const { data, error } = await supabase.rpc('place_bet', {
        p_selections: input.selections,
        p_stake: input.stake,
        p_idempotency_key: input.idempotencyKey,
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

/** Early cash-out: sell a still-pending, pre-kickoff bet back for 90% of stake. */
export function useCashoutBet() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (betId: number) => {
      const { data, error } = await supabase.rpc('cashout_bet', { p_bet_id: betId });
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
