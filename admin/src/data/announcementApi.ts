const API_BASE = ((import.meta.env.VITE_ACTIVITY_API as string | undefined) || 'http://127.0.0.1:8090/api').replace(/\/$/, '');

class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = 'bad_request') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(body.error || '请求失败，请稍后再试。', response.status, body.code);
  }
  return body as T;
}

export type AnnouncementCategory = 'notice' | 'training' | 'safety';

export interface AdminAnnouncement {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  pinned: boolean;
  author: string;
  status: 'draft' | 'published';
  createdAt: string;
  publishedAt?: string;
  readCount: number;
}

export interface AnnouncementInput {
  title: string;
  content: string;
  category: AnnouncementCategory;
  pinned: boolean;
}

export const announcementApi = {
  listAnnouncements(): Promise<AdminAnnouncement[]> {
    return request<AdminAnnouncement[]>('/announcements');
  },

  createAnnouncement(input: AnnouncementInput): Promise<AdminAnnouncement> {
    return request<AdminAnnouncement>('/announcements', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  setStatus(id: string, status: 'draft' | 'published'): Promise<AdminAnnouncement> {
    return request<AdminAnnouncement>('/announcements/' + encodeURIComponent(id), {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  setPinned(id: string, pinned: boolean): Promise<AdminAnnouncement> {
    return request<AdminAnnouncement>('/announcements/' + encodeURIComponent(id), {
      method: 'PATCH',
      body: JSON.stringify({ pinned }),
    });
  },

  removeAnnouncement(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>('/announcements/' + encodeURIComponent(id), { method: 'DELETE' });
  },
};
