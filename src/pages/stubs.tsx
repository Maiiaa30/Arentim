import { PagePlaceholder } from '@/components/PagePlaceholder';

export function PokerPage() {
  return (
    <PagePlaceholder
      title="Poker"
      description="Texas Hold'em against AI bots first, then private server-authoritative tables with friends."
      phase="Phases 8 & 10"
    />
  );
}

export function FriendsPage() {
  return (
    <PagePlaceholder
      title="Friends"
      description="Friend requests, online presence, shared stats and friends-only leaderboards."
      phase="Phase 9"
    />
  );
}

export function NotFoundPage() {
  return (
    <PagePlaceholder title="Not found" description="That page does not exist. Head back home." />
  );
}
