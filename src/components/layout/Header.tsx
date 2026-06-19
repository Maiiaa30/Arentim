import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/useProfile';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import { Monogram, RingAvatar } from '@/components/ui/primitives';
import { NAV, isGroup, type NavEntry, type NavLeaf } from './navItems';

function initialsOf(name: string | undefined): string {
  if (!name) return 'VC';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || name.slice(0, 2).toUpperCase();
}

const leafClass =
  'focus-ring whitespace-nowrap border-b px-1 pb-1 font-sans text-[12px] font-medium uppercase tracking-[0.16em] transition-colors';

/** A top-level link in the desktop bar. */
function NavTopLink({ to, label }: NavLeaf) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `${leafClass} ${isActive ? 'border-gold text-gold' : 'border-transparent text-muted-2 hover:text-text'}`
      }
    >
      {label}
    </NavLink>
  );
}

/** A grouped dropdown (Casino / Futebol) in the desktop bar. */
function NavDropdown({
  label,
  items,
  open,
  onToggle,
}: {
  label: string;
  items: NavLeaf[];
  open: boolean;
  onToggle: () => void;
}) {
  const { pathname } = useLocation();
  const active = items.some((i) => pathname === i.to || pathname.startsWith(i.to + '/'));
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`${leafClass} flex items-center gap-1 ${
          active ? 'border-gold text-gold' : 'border-transparent text-muted-2 hover:text-text'
        }`}
      >
        {label}
        <svg width="9" height="9" viewBox="0 0 10 10" className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
          <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[160px] rounded border border-border bg-surface p-1 shadow-modal">
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              className={({ isActive }) =>
                `block rounded px-3 py-2 font-sans text-[12px] font-medium uppercase tracking-[0.14em] transition-colors ${
                  isActive ? 'bg-gold/10 text-gold' : 'text-muted-2 hover:bg-surface-raised hover:text-text'
                }`
              }
            >
              {i.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const nav: NavEntry[] = profile?.is_admin ? [...NAV, { to: '/admin', label: 'Admin' }] : NAV;

  // Close menus/drawer on navigation.
  useEffect(() => {
    setDrawerOpen(false);
    setOpenMenu(null);
  }, [location.pathname]);

  // Close an open desktop dropdown on any outside click.
  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenu]);

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
      <div className="mx-auto flex h-[68px] max-w-[1480px] items-center justify-between gap-4 px-4 sm:px-9">
        <div className="flex min-w-0 items-center gap-7">
          <NavLink to="/" className="focus-ring flex shrink-0 items-center gap-3 rounded">
            <Monogram letter="A" />
            <span className="leading-tight">
              <span className="block font-sans text-sm font-medium tracking-[0.35em] text-text sm:text-base sm:tracking-[0.45em]">
                ARENTIM
              </span>
              <span className="hidden font-sans text-[9px] uppercase tracking-[0.3em] text-muted-2 sm:block">
                Casa de Jogos
              </span>
            </span>
          </NavLink>

          {user && (
            <nav className="hidden items-center gap-5 lg:flex">
              {nav.map((e) =>
                isGroup(e) ? (
                  <NavDropdown
                    key={e.label}
                    label={e.label}
                    items={e.items}
                    open={openMenu === e.label}
                    onToggle={() => setOpenMenu((m) => (m === e.label ? null : e.label))}
                  />
                ) : (
                  <NavTopLink key={e.to} to={e.to} label={e.label} />
                ),
              )}
            </nav>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          {user ? (
            <>
              <div className="hidden text-right sm:block">
                <span className="block font-sans text-[9px] uppercase tracking-[0.25em] text-muted-2">Saldo</span>
                <span className="flex items-center justify-end gap-1 font-display text-lg font-medium text-gold">
                  {profile ? <AnimatedNumber value={profile.balance} /> : '—'}
                  <span className="font-mono text-xs">tós</span>
                </span>
              </div>

              <span className="flex items-center gap-1 rounded border border-border bg-surface px-2.5 py-1.5 font-display text-sm font-medium text-gold sm:hidden">
                {profile ? <AnimatedNumber value={profile.balance} /> : '—'}
                <span className="font-mono text-[10px]">tós</span>
              </span>

              <Button variant="secondary" className="hidden !px-4 !py-2 sm:inline-flex" onClick={() => navigate('/wallet')}>
                Caixa
              </Button>
              <NavLink to="/profile" className="focus-ring hidden rounded-full sm:inline-flex" title="O seu perfil">
                <RingAvatar initials={initialsOf(profile?.display_name)} size={40} />
              </NavLink>
              <Button variant="ghost" className="hidden !px-4 !py-2 sm:inline-flex" onClick={onSignOut}>
                Sair
              </Button>

              <button
                type="button"
                aria-label={drawerOpen ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen((v) => !v)}
                className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded border border-border text-gold lg:hidden"
              >
                <span className="relative block h-4 w-5" aria-hidden>
                  <span className={`absolute left-0 block h-0.5 w-5 bg-current transition-all ${drawerOpen ? 'top-1.5 rotate-45' : 'top-0'}`} />
                  <span className={`absolute left-0 top-1.5 block h-0.5 w-5 bg-current transition-all ${drawerOpen ? 'opacity-0' : 'opacity-100'}`} />
                  <span className={`absolute left-0 block h-0.5 w-5 bg-current transition-all ${drawerOpen ? 'top-1.5 -rotate-45' : 'top-3'}`} />
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

      {/* Mobile drawer (below lg, authenticated). */}
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
                <p className="truncate font-sans text-sm font-medium text-text">{profile?.display_name ?? 'Convidado'}</p>
                <p className="flex items-center gap-1 font-display text-base font-medium text-gold">
                  {profile ? <AnimatedNumber value={profile.balance} /> : '—'}
                  <span className="font-mono text-[11px]">tós</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-0.5">
              {nav.map((e) =>
                isGroup(e) ? (
                  <div key={e.label} className="mt-2">
                    <p className="px-3 pb-1 font-sans text-[10px] uppercase tracking-[0.2em] text-faint">{e.label}</p>
                    {e.items.map((i) => (
                      <DrawerLink key={i.to} to={i.to} label={i.label} indent onNavigate={() => setDrawerOpen(false)} />
                    ))}
                  </div>
                ) : (
                  <DrawerLink key={e.to} to={e.to} label={e.label} onNavigate={() => setDrawerOpen(false)} />
                ),
              )}
              <DrawerLink to="/profile" label="Perfil" onNavigate={() => setDrawerOpen(false)} />
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

function DrawerLink({
  to,
  label,
  indent,
  onNavigate,
}: {
  to: string;
  label: string;
  indent?: boolean;
  onNavigate: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        `focus-ring flex min-h-[44px] items-center rounded font-sans text-[12px] font-medium uppercase tracking-[0.18em] transition-colors ${
          indent ? 'px-5' : 'px-3'
        } ${isActive ? 'bg-gold/10 text-gold' : 'text-muted-2 hover:bg-surface-raised hover:text-text'}`
      }
    >
      {label}
    </NavLink>
  );
}
