import { NavLink, useNavigate } from 'react-router-dom';
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

function NavRow({ items, mobile = false }: { items: typeof NAV_ITEMS; mobile?: boolean }) {
  return (
    <>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `focus-ring whitespace-nowrap px-1 pb-1 font-sans text-[12px] font-medium uppercase tracking-[0.18em] transition-colors ${
              isActive
                ? 'border-b border-gold text-gold'
                : 'border-b border-transparent text-muted-2 hover:text-text'
            } ${mobile ? '' : ''}`
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
  const navItems = profile?.is_admin ? [...NAV_ITEMS, { to: '/admin', label: 'Admin' }] : NAV_ITEMS;

  async function onSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/[0.86] backdrop-blur-[14px]">
      <div className="mx-auto flex h-[68px] max-w-[1480px] items-center justify-between gap-4 px-5 sm:px-9">
        <div className="flex items-center gap-6">
          <NavLink to="/" className="focus-ring flex items-center gap-3 rounded">
            <Monogram letter="A" />
            <span className="leading-tight">
              <span className="block font-sans text-base font-medium tracking-[0.5em] text-text">
                ARENTIM
              </span>
              <span className="block font-sans text-[9px] uppercase tracking-[0.35em] text-muted-2">
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

        <div className="flex items-center gap-4">
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
              <Button variant="secondary" className="!px-4 !py-2" onClick={() => navigate('/wallet')}>
                Caixa
              </Button>
              <NavLink to="/profile" className="focus-ring rounded-full" title="O seu perfil">
                <RingAvatar initials={initialsOf(profile?.display_name)} size={40} />
              </NavLink>
              <Button variant="ghost" className="!px-4 !py-2" onClick={onSignOut}>
                Sair
              </Button>
            </>
          ) : (
            <>
              <NavLink
                to="/login"
                className="focus-ring font-sans text-[12px] font-medium uppercase tracking-[0.18em] text-muted-2 hover:text-text"
              >
                Entrar
              </NavLink>
              <Button onClick={() => navigate('/signup')}>Criar conta</Button>
            </>
          )}
        </div>
      </div>

      {user && (
        <nav className="flex items-center gap-5 overflow-x-auto border-t border-border px-5 py-2.5 lg:hidden">
          <NavRow items={navItems} mobile />
        </nav>
      )}
    </header>
  );
}
