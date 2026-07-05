import type { ReactNode } from 'react';
import type { Role } from '@clientflow/types';
import { Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth-store';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: Role[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const location = useLocation();
  const { user, isBootstrapped, bootstrap } = useAuthStore();

  useEffect(() => {
    if (!isBootstrapped) {
      void bootstrap();
    }
  }, [bootstrap, isBootstrapped]);

  if (!isBootstrapped) {
    return <div className="grid min-h-screen place-items-center bg-background">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
