import { useState } from 'react';
import { PokerTable, ResultBanner } from '@/features/poker/PokerTable';
import { PokerActionBar } from '@/features/poker/PokerActionBar';
import type { PokerView } from '@/features/poker/types';

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
