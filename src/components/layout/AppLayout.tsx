import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { LowBalanceBanner } from '@/components/LowBalanceBanner';
import { TopAccentRule } from '@/components/ui/primitives';
import { useRealtimeSync } from '@/features/realtime/useRealtimeSync';

/** App shell: top gilded rule, sticky header, routed content, disclaimer footer. */
export function AppLayout() {
  // Keep friends / notifications / balance live across the app — no reloads.
  useRealtimeSync();
  return (
    <div className="flex min-h-full flex-col">
      <TopAccentRule />
      <Header />
      <AnnouncementBanner />
      <LowBalanceBanner />
      <main className="mx-auto w-full max-w-[1480px] flex-1 px-5 py-8 sm:px-9 sm:py-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
