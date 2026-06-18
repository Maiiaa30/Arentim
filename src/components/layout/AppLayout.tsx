import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';

/** App shell: sticky header, routed content, persistent disclaimer footer. */
export function AppLayout() {
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
