import { lazy, Suspense, type ComponentType } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { HomePage } from '@/pages/HomePage';

// Route-level code splitting: each screen is its own chunk, so the initial load
// stays small and supabase-heavy pages only download when visited.
const named = <T extends Record<string, unknown>, K extends keyof T>(p: Promise<T>, key: K) =>
  p.then((m) => ({ default: m[key] as ComponentType }));

const LoginPage = lazy(() => named(import('@/pages/auth/LoginPage'), 'LoginPage'));
const SignupPage = lazy(() => named(import('@/pages/auth/SignupPage'), 'SignupPage'));
const ProfilePage = lazy(() => named(import('@/pages/ProfilePage'), 'ProfilePage'));
const WalletPage = lazy(() => named(import('@/pages/WalletPage'), 'WalletPage'));
const CasinoLobby = lazy(() => named(import('@/pages/casino/CasinoLobby'), 'CasinoLobby'));
const RoulettePage = lazy(() => named(import('@/pages/casino/RoulettePage'), 'RoulettePage'));
const SlotsLobby = lazy(() => named(import('@/pages/casino/SlotsLobby'), 'SlotsLobby'));
const SlotMachinePage = lazy(() => named(import('@/pages/casino/SlotMachinePage'), 'SlotMachinePage'));
const CoinflipPage = lazy(() => named(import('@/pages/casino/CoinflipPage'), 'CoinflipPage'));
const BlackjackPage = lazy(() => named(import('@/pages/casino/BlackjackPage'), 'BlackjackPage'));
const SportsbookPage = lazy(() => named(import('@/pages/SportsbookPage'), 'SportsbookPage'));
const ScoresPage = lazy(() => named(import('@/pages/ScoresPage'), 'ScoresPage'));
const OnzePage = lazy(() => named(import('@/pages/OnzePage'), 'OnzePage'));
const PokerPage = lazy(() => named(import('@/pages/PokerPage'), 'PokerPage'));
const PokerHome = lazy(() => named(import('@/pages/poker/PokerHome'), 'PokerHome'));
const PrivatePokerPage = lazy(() => named(import('@/pages/poker/PrivatePokerPage'), 'PrivatePokerPage'));
const FriendsPage = lazy(() => named(import('@/pages/FriendsPage'), 'FriendsPage'));
const ChallengesPage = lazy(() => named(import('@/pages/ChallengesPage'), 'ChallengesPage'));
const AdminPage = lazy(() => named(import('@/pages/AdminPage'), 'AdminPage'));
const NotFoundPage = lazy(() => named(import('@/pages/stubs'), 'NotFoundPage'));

function PageFallback() {
  return <div className="py-24 text-center text-muted">A carregar…</div>;
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<AppLayout />}>
          {/* Public */}
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />

          {/* Authenticated only */}
          <Route element={<RequireAuth />}>
            <Route path="casino" element={<CasinoLobby />} />
            <Route path="casino/roulette" element={<RoulettePage />} />
            <Route path="casino/slots" element={<SlotsLobby />} />
            <Route path="casino/slots/:key" element={<SlotMachinePage />} />
            <Route path="casino/coinflip" element={<CoinflipPage />} />
            <Route path="casino/blackjack" element={<BlackjackPage />} />
            <Route path="sportsbook" element={<SportsbookPage />} />
            <Route path="resultados" element={<ScoresPage />} />
            <Route path="onze" element={<OnzePage />} />
            <Route path="poker" element={<PokerHome />} />
            <Route path="poker/bots" element={<PokerPage />} />
            <Route path="poker/private" element={<PrivatePokerPage />} />
            <Route path="friends" element={<FriendsPage />} />
            <Route path="challenges" element={<ChallengesPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="admin" element={<AdminPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
