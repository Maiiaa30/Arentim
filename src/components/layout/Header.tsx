import { NavLink } from 'react-router-dom';
import { BalancePill } from '@/components/BalancePill';
import { NAV_ITEMS } from './navItems';

const linkBase =
  'rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-ring';

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <NavLink to="/" className="focus-ring rounded-lg">
            <span className="font-display text-xl font-bold tracking-tight text-text">
              Arent<span className="text-gold">im</span>
            </span>
          </NavLink>

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
        </div>

        {/* Placeholder balance until auth + wallet land in Phase 2. */}
        <BalancePill amount={5000} />
      </div>

      {/* Mobile nav */}
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
    </header>
  );
}
