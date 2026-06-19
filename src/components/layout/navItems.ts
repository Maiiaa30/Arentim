export interface NavItem {
  to: string;
  label: string;
}

/** Primary navigation. Routes are stubbed in Phase 1 and filled in later phases. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Home' },
  { to: '/casino', label: 'Casino' },
  { to: '/sportsbook', label: 'Sportsbook' },
  { to: '/poker', label: 'Poker' },
  { to: '/friends', label: 'Friends' },
  { to: '/challenges', label: 'Challenges' },
  { to: '/wallet', label: 'Wallet' },
  { to: '/profile', label: 'Profile' },
] as const;
