// src/renderer/components/ProtectedRoute.tsx (create or update this file)
import { useSelector } from 'react-redux';
import { Navigate, Outlet, RouteProps } from 'react-router-dom';
import { selectAuth } from 'renderer/store/slices/auth.ts';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const auth = useSelector(selectAuth);
  const isLoggedIn = auth.isLoggedIn;
  if (!isLoggedIn) {
    return <Navigate to="/signin" replace />;
  }
  return children ? children : <Outlet />;
}

export function PublicRoute({ children }: RouteProps) {  // FIXED: New component for public routes like login
  const auth = useSelector(selectAuth);
  const isLoggedIn = auth.isLoggedIn;
  if (isLoggedIn) {
    return <Navigate to="/stats" replace />;  // Auto-redirect if already logged in
  }
  return children ? children : <Outlet />;
}