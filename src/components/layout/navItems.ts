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
 * Primary navigation (PT-PT), grouped to keep the bar uncluttered. Casino and
 * Futebol collapse into dropdowns; Carteira/Perfil live in the right-hand
 * cluster (Caixa button + avatar), so they're intentionally not repeated here.
 */
export const NAV: NavEntry[] = [
  { to: '/', label: 'Salão' },
  {
    label: 'Casino',
    items: [
      { to: '/casino', label: 'Casino' },
      { to: '/casino/slots', label: 'Slots' },
    ],
  },
  {
    label: 'Futebol',
    items: [
      { to: '/sportsbook', label: 'Apostas' },
      { to: '/resultados', label: 'Resultados' },
      { to: '/onze', label: 'Onze de Ouro' },
    ],
  },
  { to: '/poker', label: 'Póquer' },
  { to: '/friends', label: 'Amigos' },
  { to: '/challenges', label: 'Desafios' },
];
