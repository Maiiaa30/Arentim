import { create } from 'zustand';
import type { Market, Selection } from './odds';

export interface SlipItem {
  fixtureId: number;
  fixtureLabel: string;
  market: Market;
  selection: Selection;
  odds: number;
}

const keyOf = (fixtureId: number, market: Market) => `${fixtureId}:${market}`;

interface BetSlipState {
  items: SlipItem[];
  /** Toggle a pick: re-clicking the exact pick removes it; a different pick on
   *  the same fixture+market replaces it. */
  toggle: (item: SlipItem) => void;
  remove: (fixtureId: number, market: Market) => void;
  clear: () => void;
}

export const useBetSlip = create<BetSlipState>((set) => ({
  items: [],
  toggle: (item) =>
    set((state) => {
      const k = keyOf(item.fixtureId, item.market);
      const existing = state.items.find((i) => keyOf(i.fixtureId, i.market) === k);
      if (existing && existing.selection === item.selection) {
        return { items: state.items.filter((i) => keyOf(i.fixtureId, i.market) !== k) };
      }
      return {
        items: [...state.items.filter((i) => keyOf(i.fixtureId, i.market) !== k), item],
      };
    }),
  remove: (fixtureId, market) =>
    set((state) => ({
      items: state.items.filter((i) => keyOf(i.fixtureId, i.market) !== keyOf(fixtureId, market)),
    })),
  clear: () => set({ items: [] }),
}));

export const slipKey = keyOf;
