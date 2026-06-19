import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';

export function RequireAuth({ children, allowOnboarding = false }: { children: ReactNode; allowOnboarding?: boolean }) {
  const { session, loading, localMode, needsOnboarding } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--rka-bg)', color: 'var(--rka-text-secondary)', fontSize: 14 }}>
        Loading secure session...
      </div>
    );
  }

  if (!localMode && !session) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (!allowOnboarding && needsOnboarding) {
    return <Navigate to="/welcome" replace state={{ from: location }} />;
  }

  return children;
}
