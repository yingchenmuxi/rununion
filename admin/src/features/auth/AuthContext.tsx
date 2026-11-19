import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { repository } from '../../data';
import type { AdminUser } from '../../types/models';

interface AuthContextValue {
  user: AdminUser | null;
  login: (email: string, password: string) => Promise<AdminUser>;
  logout: () => void;
}

const STORAGE_KEY = 'qingrun.admin.session.v1';
const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminUser;
    return parsed && parsed.email ? parsed : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(readStoredUser);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    login: async (email: string, password: string) => {
      const nextUser = await repository.login(email, password);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
      return nextUser;
    },
    logout: () => {
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
    },
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth 必须在 AuthProvider 内使用。');
  return value;
}
