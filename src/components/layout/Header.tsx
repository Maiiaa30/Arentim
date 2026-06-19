import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/useProfile';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import { Monogram, RingAvatar } from '@/components/ui/primitives';
import { NAV_ITEMS } from './navItems';

function initialsOf(name: string | undefined): string {
  if (!name) return 'VC';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || name.slice(0, 2).toUpperCase();
}

function NavRow({
  items,
  onNavigate,
  className = '',
}: {
  items: typeof NAV_ITEMS;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `focus-ring whitespace-nowrap px-1 pb-1 font-sans text-[12px] font-medium uppercase tracking-[0.18em] transition-colors ${
              isActive
                ? 'border-b border-gold text-gold'
                : 'border-b border-transparent text-muted-2 hover:text-text'
            } ${className}`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </>
  );
}

export function Header() {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navItems = profile?.is_admin ? [...NAV_ITEMS, { to: '/admin', label: 'Admin' }] : NAV_ITEMS;

  // Close the drawer whenever the route changes (e.g. after a nav tap).
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  async function onSignOut() {
    setDrawerOpen(false);
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/[0.86] backdrop-blur-[14px]">
      <div className="mx-auto flex h-[68px] max-w-[1480px] items-center justify-between gap-3 px-4 sm:px-9">
        <div className="flex min-w-0 items-center gap-6">
          <NavLink to="/" className="focus-ring flex min-w-0 items-center gap-3 rounded">
            <Monogram letter="A" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-sans text-sm font-medium tracking-[0.35em] text-text sm:text-base sm:tracking-[0.5em]">
                ARENTIM
              </span>
              <span className="hidden truncate font-sans text-[9px] uppercase tracking-[0.35em] text-muted-2 sm:block">
                Casa de Jogos
              </span>
            </span>
          </NavLink>

          {user && (
            <nav className="hidden items-center gap-6 lg:flex">
              <NavRow items={navItems} />
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {user ? (
            <>
              <div className="hidden text-right sm:block">
                <span className="block font-sans text-[9px] uppercase tracking-[0.25em] text-muted-2">
                  Saldo
                </span>
                <span className="flex items-center justify-end gap-1 font-display text-lg font-medium text-gold">
                  {profile ? <AnimatedNumber value={profile.balance} /> : '—'}
                  <span className="font-mono text-xs">tós</span>
                </span>
              </div>

              {/* Compact balance pill for narrow screens. */}
              <span className="flex items-center gap-1 rounded border border-border bg-surface px-2.5 py-1.5 font-display text-sm font-medium text-gold sm:hidden">
                {profile ? <AnimatedNumber value={profile.balance} /> : '—'}
                <span className="font-mono text-[10px]">tós</span>
              </span>

              <Button
                variant="secondary"
                className="hidden !px-4 !py-2 sm:inline-flex"
                onClick={() => navigate('/wallet')}
              >
                Caixa
              </Button>
              <NavLink
                to="/profile"
                className="focus-ring hidden rounded-full sm:inline-flex"
                title="O seu perfil"
              >
                <RingAvatar initials={initialsOf(profile?.display_name)} size={40} />
              </NavLink>
              <Button variant="ghost" className="hidden !px-4 !py-2 sm:inline-flex" onClick={onSignOut}>
                Sair
              </Button>

              {/* Hamburger — opens the mobile drawer (visible below lg). */}
              <button
                type="button"
                aria-label={drawerOpen ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen((v) => !v)}
                className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded border border-border text-gold lg:hidden"
              >
                <span className="relative block h-4 w-5" aria-hidden>
                  <span
                    className={`absolute left-0 block h-0.5 w-5 bg-current transition-all ${
                      drawerOpen ? 'top-1.5 rotate-45' : 'top-0'
                    }`}
                  />
                  <span
                    className={`absolute left-0 top-1.5 block h-0.5 w-5 bg-current transition-all ${
                      drawerOpen ? 'opacity-0' : 'opacity-100'
                    }`}
                  />
                  <span
                    className={`absolute left-0 block h-0.5 w-5 bg-current transition-all ${
                      drawerOpen ? 'top-1.5 -rotate-45' : 'top-3'
                    }`}
                  />
                </span>
              </button>
            </>
          ) : (
            <>
              <NavLink
                to="/login"
                className="focus-ring flex min-h-[40px] items-center font-sans text-[12px] font-medium uppercase tracking-[0.18em] text-muted-2 hover:text-text"
              >
                Entrar
              </NavLink>
              <Button className="!px-4 !py-2.5 sm:!px-6 sm:!py-3" onClick={() => navigate('/signup')}>
                Criar conta
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mobile drawer overlay + panel (below lg, when authenticated). */}
      {user && drawerOpen && (
        <div className="fixed inset-0 top-[68px] z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
          />
          <nav className="animate-fade-in relative ml-auto flex h-[calc(100vh-68px)] w-[min(82vw,320px)] flex-col gap-1 overflow-y-auto border-l border-border bg-surface px-5 py-6">
            <div className="mb-2 flex items-center gap-3 border-b border-border pb-4">
              <RingAvatar initials={initialsOf(profile?.display_name)} size={44} />
              <div className="min-w-0">
                <p className="truncate font-sans text-sm font-medium text-text">
                  {profile?.display_name ?? 'Convidado'}
                </p>
                <p className="flex items-center gap-1 font-display text-base font-medium text-gold">
                  {profile ? <AnimatedNumber value={profile.balance} /> : '—'}
                  <span className="font-mono text-[11px]">tós</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `focus-ring flex min-h-[44px] items-center rounded px-3 font-sans text-[12px] font-medium uppercase tracking-[0.18em] transition-colors ${
                      isActive ? 'bg-gold/10 text-gold' : 'text-muted-2 hover:bg-surface-raised hover:text-text'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>

            <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
              <Button
                variant="secondary"
                className="w-full !py-3"
                onClick={() => {
                  setDrawerOpen(false);
                  navigate('/wallet');
                }}
              >
                Caixa
              </Button>
              <Button variant="ghost" className="w-full !py-3" onClick={onSignOut}>
                Sair
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
