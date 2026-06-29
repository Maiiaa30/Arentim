export interface NavLeaf {
  to: string;
  label: string;
}
export interface NavGroup {
  label: string;
  items: NavLeaf[];
}
export type NavEntry = NavLeaf | NavGroup;

export const isGroup = (e: NavEntry): e is NavGroup => 'items' in e;

/**
 * Primary navigation (PT-PT). Kept deliberately FLAT — "Casino" links straight
 * to the lobby (which already showcases every game by category), so the bar
 * isn't a wall of dropdowns. Only Futebol keeps a small dropdown, since its
 * three sections (apostas / resultados / Onze) are genuinely distinct.
 */
export const NAV: NavEntry[] = [
  { to: '/', label: 'Salão' },
  { to: '/casino', label: 'Casino' },
  {
    label: 'Futebol',
    items: [
      { to: '/sportsbook', label: 'Apostas' },
      { to: '/resultados', label: 'Resultados' },
      { to: '/onze', label: 'Onze de Ouro' },
    ],
  },
  { to: '/poker', label: 'Poker' },
  { to: '/sueca', label: 'Sueca' },
  { to: '/batalha-naval', label: 'Batalha Naval' },
  { to: '/friends', label: 'Amigos' },
  { to: '/challenges', label: 'Desafios' },
  { to: '/rifa', label: 'Rifa' },
];
