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
import { SportsbookPage, PokerPage, FriendsPage, NotFoundPage } from '@/pages/stubs';

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
          <Route path="sportsbook" element={<SportsbookPage />} />
          <Route path="poker" element={<PokerPage />} />
          <Route path="friends" element={<FriendsPage />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
