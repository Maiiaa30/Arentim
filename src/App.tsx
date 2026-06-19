import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { SignupPage } from '@/pages/auth/SignupPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { WalletPage } from '@/pages/WalletPage';
import { CasinoLobby } from '@/pages/casino/CasinoLobby';
import { RoulettePage } from '@/pages/casino/RoulettePage';
import { SlotsPage } from '@/pages/casino/SlotsPage';
import { CoinflipPage } from '@/pages/casino/CoinflipPage';
import { BlackjackPage } from '@/pages/casino/BlackjackPage';
import { SportsbookPage } from '@/pages/SportsbookPage';
import { PokerPage } from '@/pages/PokerPage';
import { PokerHome } from '@/pages/poker/PokerHome';
import { PrivatePokerPage } from '@/pages/poker/PrivatePokerPage';
import { FriendsPage } from '@/pages/FriendsPage';
import { ChallengesPage } from '@/pages/ChallengesPage';
import { AdminPage } from '@/pages/AdminPage';
import { NotFoundPage } from '@/pages/stubs';

export default function App() {
  return (
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
          <Route path="casino/slots" element={<SlotsPage />} />
          <Route path="casino/coinflip" element={<CoinflipPage />} />
          <Route path="casino/blackjack" element={<BlackjackPage />} />
          <Route path="sportsbook" element={<SportsbookPage />} />
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
  );
}
