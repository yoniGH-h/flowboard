// שמירה על מסכים.

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from './AuthContext';
import { ROLE_LEVEL } from '../lib/permissions';

// מעביר למסך ההתחברות את מי שלא מחובר.
// נקרא מ: App.jsx
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

// מעביר למסך 403 את מי שהדרג שלו נמוך מהנדרש.
// נקרא מ: App.jsx, ProtectedRoute.test.jsx
export function RequireRoleLevel({ minLevel, children }) {
  const { activeRole } = useAuth();
  if (ROLE_LEVEL[activeRole] < minLevel) {
    return <Navigate to="/403" replace />;
  }
  return <>{children}</>;
}
