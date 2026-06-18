import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { HomePage } from '@/pages/HomePage';
import {
  CasinoPage,
  SportsbookPage,
  PokerPage,
  FriendsPage,
  ProfilePage,
  NotFoundPage,
} from '@/pages/stubs';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="casino" element={<CasinoPage />} />
        <Route path="sportsbook" element={<SportsbookPage />} />
        <Route path="poker" element={<PokerPage />} />
        <Route path="friends" element={<FriendsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
