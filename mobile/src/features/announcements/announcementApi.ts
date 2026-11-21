import type { MemberAnnouncement } from './announcementData';

const API_BASE = (process.env.EXPO_PUBLIC_ACTIVITY_API || 'http://127.0.0.1:8090/api').replace(/\/$/, '');

export class AnnouncementApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AnnouncementApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: { method?: string; body?: string }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API_BASE + path, {
      method: init?.method ?? 'GET',
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body,
    });
  } catch {
    throw new AnnouncementApiError(0, '连不上演示数据服务，请确认 Mock API 已启动。');
  }

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok) {
    throw new AnnouncementApiError(response.status, payload?.error ?? '公告数据服务返回了错误。');
  }
  return payload as T;
}

export function fetchMemberAnnouncements(memberId: string) {
  return request<MemberAnnouncement[]>(
    '/member/announcements?memberId=' + encodeURIComponent(memberId),
  );
}

export function markAnnouncementRead(id: string, memberId: string) {
  return request<{ id: string; read: boolean }>(
    '/announcements/' + encodeURIComponent(id) + '/read',
    { method: 'POST', body: JSON.stringify({ memberId }) },
  );
}
