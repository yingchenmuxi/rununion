import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { AdminUser } from '../../types/models';
import { useAuth } from './AuthContext';

export function RequireAuth({ role }: { role: AdminUser['role'] }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (user.role !== role) {
    return <Navigate to={user.role === 'platform' ? '/platform' : '/'} replace />;
  }
  return <Outlet />;
}
