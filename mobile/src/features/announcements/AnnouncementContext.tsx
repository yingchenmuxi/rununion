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
import type { MemberAnnouncement } from './announcementData';
import { fetchMemberAnnouncements, markAnnouncementRead } from './announcementApi';

type AnnouncementContextValue = {
  announcements: MemberAnnouncement[];
  unread: number;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
};

const AnnouncementContext = createContext<AnnouncementContextValue | undefined>(undefined);

export function AnnouncementProvider({ children }: { children: ReactNode }) {
  const [announcements, setAnnouncements] = useState<MemberAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchMemberAnnouncements(DEMO_MEMBER_ID);
      setAnnouncements(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '公告加载失败。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    setAnnouncements((rows) =>
      rows.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
    try {
      await markAnnouncementRead(id, DEMO_MEMBER_ID);
    } catch {
      void refresh();
    }
  }, [refresh]);

  const unread = announcements.filter((item) => !item.read).length;

  const value = useMemo<AnnouncementContextValue>(
    () => ({ announcements, unread, loading, error, refresh, markRead }),
    [announcements, unread, loading, error, refresh, markRead],
  );

  return <AnnouncementContext.Provider value={value}>{children}</AnnouncementContext.Provider>;
}

export function useAnnouncements() {
  const value = useContext(AnnouncementContext);
  if (!value) throw new Error('useAnnouncements 必须在 AnnouncementProvider 内使用。');
  return value;
}
