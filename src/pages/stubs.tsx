import { PagePlaceholder } from '@/components/PagePlaceholder';

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
