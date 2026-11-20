import type { MemberNotification } from './notificationData';

const API_BASE = (process.env.EXPO_PUBLIC_ACTIVITY_API || 'http://127.0.0.1:8090/api').replace(/\/$/, '');

async function request<T>(path: string, init?: { method?: string; body?: string }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API_BASE + path, {
      method: init?.method ?? 'GET',
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body,
    });
  } catch {
    throw new Error('连不上演示数据服务，请确认 Mock API 已启动。');
  }
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(payload?.error ?? '消息加载失败，请稍后再试。');
  return payload as T;
}

export function fetchMemberNotifications(memberId: string) {
  return request<{ items: MemberNotification[]; unread: number }>(
    '/member/notifications?memberId=' + encodeURIComponent(memberId),
  );
}

export function markNotificationRead(id: string) {
  return request<MemberNotification>('/notifications/' + encodeURIComponent(id) + '/read', {
    method: 'POST',
    body: '{}',
  });
}

export function markAllNotificationsRead(memberId: string) {
  return request<{ ok: boolean; changed: number }>('/member/notifications/read-all', {
    method: 'POST',
    body: JSON.stringify({ memberId }),
  });
}
