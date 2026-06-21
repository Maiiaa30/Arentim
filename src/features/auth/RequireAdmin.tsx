import { Navigate, Outlet } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';

/**
 * Defence-in-depth gate for admin-only routes. Every admin mutation is already
 * re-checked server-side (the `admin_*` RPCs gate on `is_admin()`), so this is
 * purely so the admin UI shell never renders for a non-admin. Sits inside
 * RequireAuth, so the user is already authenticated here.
 */
export function RequireAdmin() {
  const { data: profile, isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted" role="status">
        A carregar…
      </div>
    );
  }

  if (!profile?.is_admin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
