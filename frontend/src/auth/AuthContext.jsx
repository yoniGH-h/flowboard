// תפקיד הקובץ: מחזיק את המשתמש המחובר, הארגון והתפקיד הפעיל, ומשתף אותם עם כל האתר.
// משתמשים בו: SignInPage.jsx, SignInPage.test.jsx, SignUpPage.jsx, ProtectedRoute.jsx +26

import { createContext, useContext, useEffect, useState } from 'react';
import { fetchCurrentSession, highestRole, signOut as apiSignOut } from '../api/authApi';
import { updateUserProfile } from '../api/api';
import { getAccessToken } from '../api/session';
import { onSessionExpired } from '../api/session';

const ROLE_KEY = 'flowboard.session.activeRole';

const AuthContext = createContext(undefined);

// הרכיב שעוטף את האתר ומספק את נתוני המשתמש.
// נקרא מ: main.jsx
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRole, setActiveRoleState] = useState(() => localStorage.getItem(ROLE_KEY) || 'EMPLOYEE');

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!getAccessToken()) {
        setIsLoading(false);
        return;
      }
      const result = await fetchCurrentSession();
      if (cancelled) return;
      if (result) {
        setUser(result.user);
        setOrganization(result.organization);
        setActiveRoleState(result.user.roles.includes(result.user.defaultRole)
          ? result.user.defaultRole
          : highestRole(result.user.roles));
      }
      setIsLoading(false);
    }

    bootstrap();
    onSessionExpired(() => {
      setUser(null);
      setOrganization(null);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(ROLE_KEY, activeRole);
  }, [activeRole]);

  const signInWithResult = (result) => {
    setUser(result.user);
    setOrganization(result.organization);
    setActiveRoleState(result.user.defaultRole ?? highestRole(result.user.roles));
  };

  const signOut = () => {
    setUser(null);
    setOrganization(null);
    void apiSignOut();
  };

  const setActiveRole = async (role) => {
    if (!user?.roles.includes(role)) return;
    setActiveRoleState(role);
    setUser((current) => current ? { ...current, defaultRole: role } : current);
    await updateUserProfile(user.id, { defaultRole: role });
  };

  const refreshUser = async () => {
    const result = await fetchCurrentSession();
    if (result) {
      setUser(result.user);
      setOrganization(result.organization);
    }
  };

  const value = {
    isAuthenticated: !!user,
    isLoading,
    user,
    organization,
    activeRole,
    availableRoles: user?.roles ?? [],
    setActiveRole,
    signInWithResult,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// מחזיר את המשתמש המחובר, התפקיד הפעיל ופעולות כניסה ויציאה.
// נקרא מ: SignInPage.jsx, SignInPage.test.jsx, SignUpPage.jsx, ProtectedRoute.jsx +24
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// השם המוצג של כל תפקיד.
// נקרא מ: UserManagementPage.jsx, UserPermissionsDialog.jsx, ProfileSettingsPage.jsx, RoleSwitcher.jsx +2
export const ROLE_LABELS = {
  EMPLOYEE: 'Employee',
  PROJECT_MANAGER: 'Project Manager',
  ORG_ADMIN: 'Organization Administrator',
  SYSTEM_ADMIN: 'System Administrator',
};
