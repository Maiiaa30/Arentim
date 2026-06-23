import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { LowBalanceBanner } from '@/components/LowBalanceBanner';
import { TopAccentRule } from '@/components/ui/primitives';
import { useRealtimeSync } from '@/features/realtime/useRealtimeSync';
import { useReferralClaim } from '@/features/referrals/useReferral';

/** A subtle casino atmosphere behind everything — warm depth glows + a faint
 *  tiled card-suit pattern, so the app isn't flat black. Fixed + non-interactive. */
function CasinoBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      <div
        className="absolute -left-44 -top-44 h-[560px] w-[560px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(201,162,75,0.08), transparent 70%)' }}
      />
      <div
        className="absolute -bottom-56 -right-44 h-[600px] w-[600px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(31,138,91,0.06), transparent 70%)' }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-[0.045]">
        <defs>
          <pattern id="arentim-suits" width="128" height="128" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
            <text x="22" y="44" fontSize="30" fill="#C9A24B">♠</text>
            <text x="86" y="98" fontSize="30" fill="#b0303a">♥</text>
            <text x="20" y="104" fontSize="26" fill="#C9A24B">♣</text>
            <text x="84" y="34" fontSize="26" fill="#b0303a">♦</text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#arentim-suits)" />
      </svg>
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
