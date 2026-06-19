import { useAnnouncements } from '@/features/admin/useAnnouncements';

/** Shows active admin announcements as a dismissible-free banner. */
export function AnnouncementBanner() {
  const { data: announcements } = useAnnouncements();
  if (!announcements || announcements.length === 0) return null;
  const a = announcements[0]!;
  return (
    <div className="border-b border-accent/30 bg-accent/10">
      <div className="mx-auto max-w-6xl px-4 py-2 text-sm">
        <span className="font-semibold text-accent">{a.title}</span>
        {a.body && <span className="ml-2 text-text">{a.body}</span>}
      </div>
    </div>
  );
}
