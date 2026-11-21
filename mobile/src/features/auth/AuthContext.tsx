import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { mock } from '@/constants/qingrun';
import {
  fetchMemberApplication,
  submitMemberApplication,
  type JoinInput,
  type MemberApplication,
} from '@/features/auth/memberApi';

export const DEMO_USERNAME = 'demo';
export const DEMO_PASSWORD = 'qingrun123';
export const DEMO_INVITE = 'KANGFU-2026';

export type AuthStatus = 'guest' | 'pending' | 'approved' | 'rejected' | 'active';

export type MemberProfile = {
  username: string;
  nickname: string;
  grade: string;
  inviteCode: string;
};

type AuthContextValue = {
  status: AuthStatus;
  profile: MemberProfile | null;
  application: MemberApplication | null;
  joinDraft: JoinInput | null;
  login: (username: string, password: string) => string | null;
  requestJoin: (input: JoinInput) => Promise<string | null>;
  refreshApplication: () => Promise<void>;
  enterClub: () => void;
  startReapply: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('guest');
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [application, setApplication] = useState<MemberApplication | null>(null);
  const [joinDraft, setJoinDraft] = useState<JoinInput | null>(null);

  const login = (username: string, password: string) => {
    if (username.trim().toLowerCase() === DEMO_USERNAME && password === DEMO_PASSWORD) {
      setProfile({
        username: DEMO_USERNAME,
        nickname: mock.user.name,
        grade: mock.user.grade,
        inviteCode: '',
      });
      setApplication(null);
      setJoinDraft(null);
      setStatus('active');
      return null;
    }
    return '用户名或密码不对。演示账号是 demo / qingrun123。';
  };

  const requestJoin = async (input: JoinInput) => {
    const nickname = input.nickname.trim();
    const username = input.username.trim().toLowerCase();
    if (nickname.length < 2) return '昵称至少 2 个字，方便社团里的同学认识你。';
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return '用户名需要 3 到 20 位小写字母、数字或下划线。';
    }
    try {
      const result = await submitMemberApplication({
        inviteCode: input.inviteCode.trim().toUpperCase(),
        nickname,
        username,
        grade: input.grade,
      });
      setApplication(result.application);
      setJoinDraft({
        inviteCode: input.inviteCode.trim().toUpperCase(),
        nickname,
        username,
        grade: input.grade,
      });
      setProfile({
        username,
        nickname,
        grade: input.grade,
        inviteCode: input.inviteCode.trim().toUpperCase(),
      });
      setStatus('pending');
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : '申请提交失败，请稍后再试。';
    }
  };

  const refreshApplication = useCallback(async () => {
    if (!application) return;
    try {
      const next = await fetchMemberApplication(application.id);
      setApplication(next);
      if (next.status === 'active') {
        setProfile({
          username: next.username,
          nickname: next.nickname,
          grade: next.grade,
          inviteCode: joinDraft?.inviteCode ?? DEMO_INVITE,
        });
        setStatus('approved');
      } else if (next.status === 'rejected') {
        setStatus('rejected');
      }
    } catch {
      // 轮询失败时保持当前页面，下一次自动重试。
    }
  }, [application, joinDraft?.inviteCode]);

  const enterClub = () => {
    if (status === 'approved') setStatus('active');
  };

  const startReapply = () => {
    setStatus('guest');
  };

  const logout = () => {
    setProfile(null);
    setApplication(null);
    setJoinDraft(null);
    setStatus('guest');
  };

  const value = useMemo(
    () => ({
      status,
      profile,
      application,
      joinDraft,
      login,
      requestJoin,
      refreshApplication,
      enterClub,
      startReapply,
      logout,
    }),
    [status, profile, application, joinDraft, refreshApplication],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
