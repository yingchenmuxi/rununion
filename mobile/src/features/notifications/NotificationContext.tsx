import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DEMO_MEMBER_ID } from '@/features/activities/activityData';
import { fetchMemberNotifications, markAllNotificationsRead, markNotificationRead } from './notificationApi';
import type { MemberNotification } from './notificationData';

type NotificationContextValue = {
  items: MemberNotification[];
  unread: number;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<MemberNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchMemberNotifications(DEMO_MEMBER_ID);
      setItems(result.items);
      setUnread(result.unread);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '消息加载失败，请稍后再试。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<NotificationContextValue>(() => {
    const markRead = async (id: string) => {
      const target = items.find((item) => item.id === id);
      if (!target || target.readAt) return;
      try {
        await markNotificationRead(id);
        setItems((rows) => rows.map((row) => (row.id === id ? { ...row, readAt: new Date().toISOString() } : row)));
        setUnread((count) => Math.max(0, count - 1));
      } catch {
        await refresh();
      }
    };

    const markAllRead = async () => {
      if (unread === 0) return;
      try {
        await markAllNotificationsRead(DEMO_MEMBER_ID);
        setItems((rows) => rows.map((row) => ({ ...row, readAt: row.readAt ?? new Date().toISOString() })));
        setUnread(0);
      } catch {
        await refresh();
      }
    };

    return { items, unread, loading, error, refresh, markRead, markAllRead };
  }, [items, unread, loading, error, refresh]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider');
  return context;
}
