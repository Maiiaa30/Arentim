import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { LowBalanceBanner } from '@/components/LowBalanceBanner';
import { TopAccentRule } from '@/components/ui/primitives';
import { useRealtimeSync } from '@/features/realtime/useRealtimeSync';
import { useReferralClaim } from '@/features/referrals/useReferral';
import { ChipMark } from '@/components/ui/ChipMark';

/** A subtle casino atmosphere behind everything — like the home hero: soft depth
 *  glows, a couple of big faint suit watermarks and a few drifting "chip" rings.
 *  Fixed, non-interactive, and hidden on phones so it never clutters the content. */
function CasinoBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      {/* base depth: a soft vignette so the edges sink and the centre lifts */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 0%, rgba(28,24,15,0.5), transparent 55%), radial-gradient(100% 100% at 50% 120%, rgba(0,0,0,0.55), transparent 60%)' }} />
      <div className="absolute -left-44 -top-44 h-[540px] w-[540px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(201,162,75,0.06), transparent 70%)' }} />
      <div className="absolute -bottom-56 -right-44 h-[580px] w-[580px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(31,138,91,0.045), transparent 70%)' }} />
      {/* Big faint suit watermarks */}
      <span className="absolute left-[-3%] top-24 hidden select-none font-display text-[240px] leading-none text-gold/[0.03] sm:block">♠</span>
      <span className="absolute bottom-6 right-[-2%] hidden select-none font-display text-[280px] leading-none text-gold/[0.025] sm:block">♣</span>
      {/* Drifting poker chips */}
      <ChipMark className="animate-floaty absolute left-[12%] top-[40%] hidden h-24 w-24 sm:block" color="#C9A24B" opacity={0.06} />
      <ChipMark className="animate-floaty absolute right-[15%] top-[15%] hidden h-16 w-16 sm:block" color="#C9A24B" opacity={0.05} style={{ animationDelay: '-1.6s' }} />
      <ChipMark className="animate-floaty absolute bottom-[15%] left-[44%] hidden h-14 w-14 sm:block" color="#1f8a5b" opacity={0.05} style={{ animationDelay: '-0.8s' }} />
    </div>
  );
}

/** App shell: top gilded rule, sticky header, routed content, disclaimer footer. */
export function AppLayout() {
  // Keep friends / notifications / balance live across the app — no reloads.
  useRealtimeSync();
  // Redeem a pending referral code (from a signup link) on first auth load.
  useReferralClaim();
  return (
    <div className="flex min-h-full flex-col">
      <CasinoBackdrop />
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-gold focus:px-4 focus:py-2 focus:font-sans focus:text-sm focus:font-semibold focus:text-bg"
      >
        Saltar para o conteúdo
      </a>
      <TopAccentRule />
      <Header />
      <AnnouncementBanner />
      <LowBalanceBanner />
      <main id="conteudo" className="mx-auto w-full max-w-[1480px] flex-1 px-5 py-8 sm:px-9 sm:py-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
