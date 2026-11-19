import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { mock } from '@/constants/qingrun';

export const DEMO_USERNAME = 'demo';
export const DEMO_PASSWORD = 'qingrun123';
export const DEMO_INVITE = 'KANGFU-2026';

export type AuthStatus = 'guest' | 'pending' | 'active';

export type MemberProfile = {
  username: string;
  nickname: string;
  grade: string;
  inviteCode: string;
};

type JoinInput = MemberProfile & { password: string };

type AuthContextValue = {
  status: AuthStatus;
  profile: MemberProfile | null;
  login: (username: string, password: string) => string | null;
  requestJoin: (input: JoinInput) => string | null;
  approveDemo: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('guest');
  const [profile, setProfile] = useState<MemberProfile | null>(null);

  const login = (username: string, password: string) => {
    if (username.trim().toLowerCase() === DEMO_USERNAME && password === DEMO_PASSWORD) {
      setProfile({
        username: DEMO_USERNAME,
        nickname: mock.user.name,
        grade: mock.user.grade,
        inviteCode: '',
      });
      setStatus('active');
      return null;
    }
    return '用户名或密码不对。演示账号是 demo / qingrun123。';
  };

  const requestJoin = (input: JoinInput) => {
    if (input.inviteCode.trim().toUpperCase() !== DEMO_INVITE) {
      return '邀请码不对，请向社长要一个新的邀请码。';
    }
    setProfile({
      username: input.username.trim(),
      nickname: input.nickname.trim(),
      grade: input.grade,
      inviteCode: DEMO_INVITE,
    });
    setStatus('pending');
    return null;
  };

  const approveDemo = () => {
    setStatus((current) => (current === 'pending' ? 'active' : current));
  };

  const logout = () => {
    setProfile(null);
    setStatus('guest');
  };

  const value = useMemo(
    () => ({ status, profile, login, requestJoin, approveDemo, logout }),
    [status, profile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
