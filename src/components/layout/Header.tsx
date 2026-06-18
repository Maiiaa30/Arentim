import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/useProfile';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { CoinIcon } from '@/components/CoinIcon';
import { Button } from '@/components/ui/Button';
import { NAV_ITEMS } from './navItems';

const linkBase = 'rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-ring';

function BalanceDisplay() {
  const { data: profile } = useProfile();
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5">
      <CoinIcon className="h-4 w-4" />
      {profile ? (
        <AnimatedNumber value={profile.balance} className="text-sm font-semibold text-text" />
      ) : (
        <span className="text-sm text-muted">—</span>
      )}
      <span className="text-xs text-muted">Tostões</span>
    </div>
  );
}

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function onSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <NavLink to="/" className="focus-ring rounded-lg">
            <span className="font-display text-xl font-bold tracking-tight text-text">
              Arent<span className="text-gold">im</span>
            </span>
          </NavLink>

          {user && (
            <nav className="hidden items-center gap-1 md:flex">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? 'bg-surface text-text' : 'text-muted hover:text-text'}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <BalanceDisplay />
              <Button variant="secondary" onClick={onSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={`${linkBase} text-muted hover:text-text`}>
                Sign in
              </NavLink>
              <Button onClick={() => navigate('/signup')}>Sign up</Button>
            </>
          )}
        </div>
      </div>

      {user && (
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-2 py-2 md:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `${linkBase} whitespace-nowrap ${isActive ? 'bg-surface text-text' : 'text-muted'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
