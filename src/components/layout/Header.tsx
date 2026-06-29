import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/useProfile';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import { RingAvatar } from '@/components/ui/primitives';
import { LevelBadge } from '@/features/profile/LevelBadge';
import { levelFromWagered } from '@/features/profile/level';
import { Brandmark } from '@/components/ui/Brandmark';
import { CoinIcon } from '@/components/CoinIcon';
import { NotificationBell } from '@/components/NotificationBell';
import { NAV, isGroup, type NavEntry, type NavLeaf } from './navItems';

function initialsOf(name: string | undefined): string {
  if (!name) return 'VC';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || name.slice(0, 2).toUpperCase();
}

const leafClass =
  'focus-ring whitespace-nowrap border-b px-1 pb-1 font-sans text-[12.5px] font-medium uppercase tracking-[0.08em] transition-colors';

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
                `block rounded px-3 py-2 font-sans text-[12px] font-medium uppercase tracking-[0.08em] transition-colors ${
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

  // Admin no longer lives in the primary nav (it crowded the Saldo chip on the
  // right) — it's in the account menu / mobile drawer instead.
  const nav: NavEntry[] = NAV;
  const isAdmin = !!profile?.is_admin;

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
    <header className="sticky top-0 z-30 border-b border-border bg-bg/[0.82] backdrop-blur-[14px]">
      {/* Refined gold hairline glow under the bar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" aria-hidden />
      <div className="mx-auto flex h-[68px] max-w-[1480px] items-center justify-between gap-4 px-4 sm:px-9">
        <div className="flex min-w-0 items-center gap-7">
          <NavLink to="/" className="focus-ring group flex shrink-0 items-center gap-3 rounded">
            <span className="transition-transform duration-300 ease-aretim group-hover:scale-105">
              <Brandmark size={40} />
            </span>
            <span className="leading-tight">
              <span className="block font-sans text-sm font-semibold tracking-[0.28em] text-gold sm:text-base sm:tracking-[0.32em]">
                ARENTIM
              </span>
              <span className="hidden font-sans text-[9px] uppercase tracking-[0.24em] text-muted-2 sm:block">
                Casa de Jogos
              </span>
            </span>
          </NavLink>

          {user && (
            <nav className="hidden items-center gap-4 xl:flex">
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
              {/* Balance chip doubles as the Caixa entry point (keeps the bar
                  compact so the nav fits on narrow/vertical desktops). */}
              <NavLink
                to="/wallet"
                title="Abrir a Caixa"
                className="focus-ring hidden items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.06] px-3.5 py-1.5 transition-colors hover:border-gold/50 sm:flex"
              >
                <CoinIcon className="h-4 w-4" />
                <span className="leading-none">
                  <span className="block font-sans text-[8px] uppercase tracking-[0.22em] text-muted-2">Saldo</span>
                  <span className="flex items-baseline gap-1 font-display text-base font-semibold text-gold">
                    {profile ? <AnimatedNumber value={profile.balance} /> : '—'}
                    <span className="font-mono text-[10px]">tós</span>
                  </span>
                </span>
              </NavLink>

              <NavLink
                to="/wallet"
                title="Abrir a Caixa"
                className="flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/[0.06] px-2.5 py-1.5 font-display text-sm font-semibold text-gold sm:hidden"
              >
                <CoinIcon className="h-3.5 w-3.5" />
                {profile ? <AnimatedNumber value={profile.balance} /> : '—'}
                <span className="font-mono text-[10px]">tós</span>
              </NavLink>

              <NotificationBell />

              <UserMenu
                name={profile?.display_name}
                level={profile ? levelFromWagered(profile.total_wagered) : null}
                isAdmin={isAdmin}
                open={openMenu === '__account'}
                onToggle={() => setOpenMenu((m) => (m === '__account' ? null : '__account'))}
                onSignOut={onSignOut}
              />

              <button
                type="button"
                aria-label={drawerOpen ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen((v) => !v)}
                className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded border border-border text-gold xl:hidden"
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
        <div className="fixed inset-0 top-[68px] z-40 xl:hidden">
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
              {isAdmin && <DrawerLink to="/admin" label="Admin" onNavigate={() => setDrawerOpen(false)} />}
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

/**
 * Account dropdown anchored on the avatar (sm+). Collapses the level badge,
 * profile link, admin link and Sair into one tidy menu so the right side of the
 * bar stays uncluttered. Uses the shared `openMenu` state (key `'__account'`) so
 * the existing outside-click + route-change handlers close it too.
 */
function UserMenu({
  name,
  level,
  isAdmin,
  open,
  onToggle,
  onSignOut,
}: {
  name: string | undefined;
  level: number | null;
  isAdmin: boolean;
  open: boolean;
  onToggle: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="relative hidden sm:block">
      <button
        type="button"
        aria-label="Conta"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`focus-ring flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 transition-colors ${
          open ? 'bg-surface-raised' : 'hover:bg-surface-raised'
        }`}
      >
        <RingAvatar initials={initialsOf(name)} size={36} />
        <svg
          width="9"
          height="9"
          viewBox="0 0 10 10"
          className={`text-muted-2 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded border border-border bg-surface shadow-modal">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
            <RingAvatar initials={initialsOf(name)} size={42} />
            <div className="min-w-0">
              <p className="truncate font-sans text-sm font-medium text-text">{name ?? 'Convidado'}</p>
              {level != null && <LevelBadge level={level} className="mt-1.5" />}
            </div>
          </div>
          <div className="p-1.5">
            <MenuRow to="/profile" label="Perfil" />
            <MenuRow to="/wallet" label="Caixa" />
            {isAdmin && <MenuRow to="/admin" label="Admin" />}
          </div>
          <div className="border-t border-border p-1.5">
            <button
              type="button"
              onClick={onSignOut}
              className="focus-ring block w-full rounded px-3 py-2 text-left font-sans text-[13px] font-medium text-muted-2 transition-colors hover:bg-surface-raised hover:text-text"
            >
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuRow({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `focus-ring block rounded px-3 py-2 font-sans text-[13px] font-medium transition-colors ${
          isActive ? 'bg-gold/10 text-gold' : 'text-muted-2 hover:bg-surface-raised hover:text-text'
        }`
      }
    >
      {label}
    </NavLink>
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
