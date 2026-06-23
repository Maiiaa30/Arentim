import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { LowBalanceBanner } from '@/components/LowBalanceBanner';
import { TopAccentRule } from '@/components/ui/primitives';
import { useRealtimeSync } from '@/features/realtime/useRealtimeSync';
import { useReferralClaim } from '@/features/referrals/useReferral';

/** A subtle casino atmosphere behind everything — like the home hero: soft depth
 *  glows, a couple of big faint suit watermarks and a few drifting "chip" rings.
 *  Fixed, non-interactive, and hidden on phones so it never clutters the content. */
function CasinoBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      <div className="absolute -left-44 -top-44 h-[540px] w-[540px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(201,162,75,0.06), transparent 70%)' }} />
      <div className="absolute -bottom-56 -right-44 h-[580px] w-[580px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(31,138,91,0.045), transparent 70%)' }} />
      {/* Big faint suit watermarks */}
      <span className="absolute left-[-3%] top-24 hidden select-none font-display text-[240px] leading-none text-gold/[0.035] sm:block">♠</span>
      <span className="absolute bottom-6 right-[-2%] hidden select-none font-display text-[280px] leading-none text-gold/[0.03] sm:block">♣</span>
      <span className="absolute right-[34%] top-[-5%] hidden select-none font-display text-[170px] leading-none sm:block" style={{ color: 'rgba(176,48,58,0.03)' }}>♥</span>
      {/* Drifting chip rings */}
      <span className="animate-floaty absolute left-[13%] top-[42%] hidden h-20 w-20 rounded-full border-[3px] border-dashed border-gold/[0.08] sm:block" />
      <span className="animate-floaty absolute right-[17%] top-[16%] hidden h-14 w-14 rounded-full border-[3px] border-dashed border-gold/[0.06] sm:block" style={{ animationDelay: '-1.6s' }} />
      <span className="animate-floaty absolute bottom-[16%] left-[42%] hidden h-12 w-12 rounded-full border-[3px] border-dashed sm:block" style={{ borderColor: 'rgba(31,138,91,0.07)', animationDelay: '-0.8s' }} />
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
