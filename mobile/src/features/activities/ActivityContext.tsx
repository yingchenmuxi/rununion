import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import {
  ACTIVITIES,
  compareActivityDate,
  type Activity,
  type SignupStatus,
} from './activityData';

export type SignupResult = 'joined' | 'already' | 'full' | 'closed';

type ActivityContextValue = {
  activities: Activity[];
  upcomingActivities: Activity[];
  myUpcoming: Activity[];
  myPast: Activity[];
  pendingCount: number;
  confirmedCount: number;
  attendedCount: number;
  getSignupStatus: (id: string) => SignupStatus | undefined;
  isSignedUp: (id: string) => boolean;
  signupCount: (activity: Activity) => number;
  signup: (id: string) => SignupResult;
  cancelSignup: (id: string) => boolean;
};

const ActivityContext = createContext<ActivityContextValue | undefined>(undefined);

const INITIAL_SIGNUPS: Record<string, SignupStatus> = {
  a2: 'confirmed',
  p1: 'attended',
};

export function ActivityProvider({ children }: { children: ReactNode }) {
  const [signups, setSignups] = useState<Record<string, SignupStatus>>(INITIAL_SIGNUPS);

  const value = useMemo<ActivityContextValue>(() => {
    const getSignupStatus = (id: string) => signups[id];

    const isSignedUp = (id: string) => {
      const status = signups[id];
      return status === 'pending' || status === 'confirmed';
    };

    const signupCount = (activity: Activity) => {
      const status = signups[activity.id];
      const self = status === 'pending' || status === 'confirmed' ? 1 : 0;
      return activity.signedBase + self;
    };

    const signup = (id: string): SignupResult => {
      const activity = ACTIVITIES.find((item) => item.id === id);
      if (!activity || activity.status === 'past') return 'closed';
      const current = signups[id];
      if (current === 'pending' || current === 'confirmed' || current === 'attended') return 'already';
      if (activity.signedBase >= activity.capacity) return 'full';
      setSignups((previous) => ({ ...previous, [id]: 'pending' }));
      return 'joined';
    };

    const cancelSignup = (id: string) => {
      const current = signups[id];
      if (current !== 'pending' && current !== 'confirmed') return false;
      setSignups((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      return true;
    };

    const upcomingActivities = ACTIVITIES.filter((activity) => activity.status === 'upcoming').sort(
      compareActivityDate,
    );
    const myUpcoming = upcomingActivities.filter((activity) => isSignedUp(activity.id));
    const myPast = ACTIVITIES.filter(
      (activity) => activity.status === 'past' && signups[activity.id] === 'attended',
    ).sort((a, b) => b.dateISO.localeCompare(a.dateISO));

    return {
      activities: ACTIVITIES,
      upcomingActivities,
      myUpcoming,
      myPast,
      pendingCount: myUpcoming.filter((activity) => signups[activity.id] === 'pending').length,
      confirmedCount: myUpcoming.filter((activity) => signups[activity.id] === 'confirmed').length,
      attendedCount: myPast.length,
      getSignupStatus,
      isSignedUp,
      signupCount,
      signup,
      cancelSignup,
    };
  }, [signups]);

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useActivities() {
  const context = useContext(ActivityContext);
  if (!context) throw new Error('useActivities must be used inside ActivityProvider');
  return context;
}
