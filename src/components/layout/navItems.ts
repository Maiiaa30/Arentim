export interface NavItem {
  to: string;
  label: string;
}

/** Primary navigation (Português de Portugal). */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Salão' },
  { to: '/casino', label: 'Casino' },
  { to: '/casino/slots', label: 'Slots' },
  { to: '/sportsbook', label: 'Futebol' },
  { to: '/resultados', label: 'Resultados' },
  { to: '/poker', label: 'Póquer' },
  { to: '/friends', label: 'Amigos' },
  { to: '/challenges', label: 'Desafios' },
  { to: '/wallet', label: 'Carteira' },
  { to: '/profile', label: 'Perfil' },
] as const;
