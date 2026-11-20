import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  compareActivityDate,
  DEMO_MEMBER_ID,
  isActiveSignup,
  mapActivity,
  type Activity,
  type SignupStatus,
} from './activityData';
import {
  ActivityApiError,
  cancelActivitySignup,
  createActivitySignup,
  fetchMemberActivities,
  resetActivityDemo,
} from './activityApi';

export type SignupResult = 'joined' | 'already' | 'full' | 'closed' | 'error';

type ActivityContextValue = {
  activities: Activity[];
  upcomingActivities: Activity[];
  myUpcoming: Activity[];
  myPast: Activity[];
  pendingCount: number;
  confirmedCount: number;
  attendedCount: number;
  absentCount: number;
  checkinPendingCount: number;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  getSignupStatus: (id: string) => SignupStatus | undefined;
  isSignedUp: (id: string) => boolean;
  signupCount: (activity: Activity) => number;
  signup: (id: string) => Promise<SignupResult>;
  cancelSignup: (id: string) => Promise<boolean>;
  resetDemo: () => Promise<void>;
};

const ActivityContext = createContext<ActivityContextValue | undefined>(undefined);

export function ActivityProvider({ children }: { children: ReactNode }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchMemberActivities(DEMO_MEMBER_ID);
      setActivities(rows.map(mapActivity));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '活动数据加载失败。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<ActivityContextValue>(() => {
    const getActivity = (id: string) => activities.find((activity) => activity.id === id);
    const getSignupStatus = (id: string) => getActivity(id)?.mySignup?.status;
    const isSignedUp = (id: string) => isActiveSignup(getSignupStatus(id));
    const signupCount = (activity: Activity) => activity.signupCount;

    const upcomingActivities = activities
      .filter((activity) => activity.status === 'published')
      .sort(compareActivityDate);

    const myUpcoming = upcomingActivities
      .filter((activity) => activity.mySignup?.status === 'pending' || activity.mySignup?.status === 'approved')
      .sort(compareActivityDate);

    const myPast = activities
      .filter(
        (activity) =>
          activity.status === 'ended' &&
          (activity.mySignup?.status === 'approved' ||
            activity.mySignup?.status === 'attended' ||
            activity.mySignup?.status === 'absent'),
      )
      .sort((a, b) => b.dateISO.localeCompare(a.dateISO) || b.startTime.localeCompare(a.startTime));

    const signup = async (id: string): Promise<SignupResult> => {
      try {
        await createActivitySignup(id, DEMO_MEMBER_ID);
        await refresh();
        return 'joined';
      } catch (cause) {
        if (cause instanceof ActivityApiError) {
          if (cause.code === 'already' || cause.code === 'full' || cause.code === 'closed') return cause.code;
        }
        return 'error';
      }
    };

    const cancelSignup = async (id: string) => {
      const signupRecord = getActivity(id)?.mySignup;
      if (!signupRecord) return false;
      try {
        await cancelActivitySignup(signupRecord.id);
        await refresh();
        return true;
      } catch {
        return false;
      }
    };

    const resetDemo = async () => {
      await resetActivityDemo();
      await refresh();
    };

    return {
      activities,
      upcomingActivities,
      myUpcoming,
      myPast,
      pendingCount: myUpcoming.filter((activity) => activity.mySignup?.status === 'pending').length,
      confirmedCount: myUpcoming.filter((activity) => activity.mySignup?.status === 'approved').length,
      attendedCount: myPast.filter((activity) => activity.mySignup?.status === 'attended').length,
      absentCount: myPast.filter((activity) => activity.mySignup?.status === 'absent').length,
      checkinPendingCount: myPast.filter((activity) => activity.mySignup?.status === 'approved').length,
      loading,
      error,
      refresh,
      getSignupStatus,
      isSignedUp,
      signupCount,
      signup,
      cancelSignup,
      resetDemo,
    };
  }, [activities, error, loading, refresh]);

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useActivities() {
  const context = useContext(ActivityContext);
  if (!context) throw new Error('useActivities must be used inside ActivityProvider');
  return context;
}
