import { useState } from 'react';
import { PokerTable, ResultBanner } from '@/features/poker/PokerTable';
import { PokerActionBar } from '@/features/poker/PokerActionBar';
import { Overview } from '@/pages/AdminPage';
import type { AdminStats } from '@/features/admin/useAdmin';
import type { PokerView } from '@/features/poker/types';

const MOCK_STATS: AdminStats = {
  users_total: 142, users_new_today: 6, users_new_7d: 28,
  online_now: 9, active_24h: 41, active_7d: 88, suspended: 3, admins: 2,
  bettors: 117, balance_total: 7_240_500, wagered_total: 18_905_000,
  won_total: 16_120_000, games_total: 9_412,
  sports_bets_total: 1_204, sports_bets_today: 37, sports_bets_open: 52, sports_stake_total: 612_000,
  top_balances: [
    { id: '1', display_name: 'Rui', balance: 412_000 },
    { id: '2', display_name: 'Sofia', balance: 318_500 },
    { id: '3', display_name: 'Tó Zé', balance: 201_000 },
  ],
  top_wagered: [
    { id: '2', display_name: 'Sofia', total_wagered: 2_100_000 },
    { id: '1', display_name: 'Rui', total_wagered: 1_540_000 },
  ],
  recent_signups: [
    { id: '9', display_name: 'Inês', created_at: '2026-06-20T10:00:00Z' },
    { id: '8', display_name: 'Bruno', created_at: '2026-06-19T18:00:00Z' },
  ],
};

/**
 * DEV-ONLY visual harness (route gated by import.meta.env.DEV — never shipped to
 * production). Renders the casino presentational components against mock data so
 * the table/board layouts can be verified without an authenticated session.
 */

function mockView(opponents: number, street: PokerView['street']): PokerView {
  const board: Record<string, number[]> = {
    idle: [],
    preflop: [],
    flop: [12, 25, 47],
    turn: [12, 25, 47, 3],
    river: [12, 25, 47, 3, 38],
    showdown: [12, 25, 47, 3, 38],
  };
  const names = ['Rui', 'Sofia Marques', 'Tó Zé', 'Inês', 'Bot 5'];
  const players: PokerView['players'] = [
    { id: 'you', name: 'Você', isBot: false, stack: 1840, committed: 120, status: 'active', hole: [48, 9] },
    ...Array.from({ length: opponents }, (_, i) => ({
      id: `bot${i}`,
      name: names[i] ?? `Bot ${i + 1}`,
      isBot: true,
      stack: 1000 + i * 230,
      committed: i === 1 ? 0 : 120,
      status: (i === 1 ? 'folded' : 'active') as PokerView['players'][number]['status'],
      hole: street === 'showdown' ? [i * 5 + 2, i * 5 + 7] : [-1, -1],
    })),
  ];
  return {
    street,
    community: board[street] ?? [],
    pot: 640 + opponents * 80,
    currentBet: 120,
    minRaise: 40,
    handOver: street === 'showdown',
    toActId: 'you',
    button: 'bot0',
    result: street === 'showdown' ? { winners: [{ id: 'you', amount: 940 }], reveal: [] } : null,
    log: ['Rui sobe para 120', 'Sofia desiste'],
    players,
  };
}

const STREETS: PokerView['street'][] = ['preflop', 'flop', 'turn', 'river', 'showdown'];

export function CasinoPreview() {
  const [opponents, setOpponents] = useState(3);
  const [street, setStreet] = useState<PokerView['street']>('flop');
  const [raiseTo, setRaiseTo] = useState(0);
  const view = mockView(opponents, street);

  // Mock action-bar wiring (mirrors PokerPage's raise math).
  const minRaiseTo = view.currentBet + view.minRaise;
  const maxRaiseTo = 1840 + 120;
  const effRaiseTo = Math.max(minRaiseTo, Math.min(raiseTo || minRaiseTo, maxRaiseTo));
  const quickBets = [
    { label: 'Mín', to: minRaiseTo },
    { label: '½ Pote', to: Math.min(view.currentBet + Math.round(view.pot * 0.5), maxRaiseTo) },
    { label: 'Pote', to: Math.min(view.currentBet + view.pot, maxRaiseTo) },
    { label: 'All-in', to: maxRaiseTo },
  ];

  return (
    <div className="space-y-5 p-4">
      <h1 className="font-display text-2xl text-text">Casino preview (DEV)</h1>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setOpponents(n)}
            className={`rounded border px-3 py-1.5 font-mono text-sm ${opponents === n ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted'}`}
          >
            {n} opp
          </button>
        ))}
        <span className="w-4" />
        {STREETS.map((s) => (
          <button
            key={s}
            onClick={() => setStreet(s)}
            className={`rounded border px-3 py-1.5 font-sans text-sm ${street === s ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted'}`}
          >
            {s}
          </button>
        ))}
      </div>
      <h2 className="font-display text-xl text-text">Admin overview (mock)</h2>
      <Overview stats={MOCK_STATS} />

      <h2 className="font-display text-xl text-text">Poker table</h2>
      <PokerTable view={view} youId="you" myTurn resultBanner={<ResultBanner view={view} />} />

      <div className="card mx-auto max-w-md p-4">
        <PokerActionBar
          owe={view.currentBet - 120}
          callAmount={view.currentBet - 120}
          raiseTo={effRaiseTo}
          minRaiseTo={minRaiseTo}
          maxRaiseTo={maxRaiseTo}
          canRaise
          busy={false}
          quickBets={quickBets}
          onFold={() => {}}
          onCheck={() => {}}
          onCall={() => {}}
          onRaise={() => {}}
          onRaiseChange={setRaiseTo}
        />
      </div>
    </div>
  );
}
