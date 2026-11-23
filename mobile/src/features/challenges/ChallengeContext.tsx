import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { DEMO_MEMBER_ID } from '@/features/activities/activityData';
import type { MemberChallenge } from './challengeData';
import { fetchMemberChallenges } from './challengeApi';

type ChallengeContextValue = {
  challenges: MemberChallenge[];
  activeChallenge: MemberChallenge | null;
  upcomingChallenge: MemberChallenge | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

const ChallengeContext = createContext<ChallengeContextValue | undefined>(undefined);

export function ChallengeProvider({ children }: { children: ReactNode }) {
  const [challenges, setChallenges] = useState<MemberChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchMemberChallenges(DEMO_MEMBER_ID);
      setChallenges(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '挑战加载失败。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeChallenge = challenges.find((item) => item.status === 'active') ?? null;
  const upcomingChallenge = challenges.find((item) => item.status === 'upcoming') ?? null;

  const value = useMemo<ChallengeContextValue>(
    () => ({ challenges, activeChallenge, upcomingChallenge, loading, error, refresh }),
    [challenges, activeChallenge, upcomingChallenge, loading, error, refresh],
  );

  return <ChallengeContext.Provider value={value}>{children}</ChallengeContext.Provider>;
}

export function useChallenges() {
  const value = useContext(ChallengeContext);
  if (!value) throw new Error('useChallenges 必须在 ChallengeProvider 内使用。');
  return value;
}
