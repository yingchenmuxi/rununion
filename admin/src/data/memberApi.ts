import type { Member, MemberStatus } from '../types/models';

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

export const memberApi = {
  async listMembers(): Promise<Member[]> {
    return request<Member[]>('/members');
  },

  async updateMemberStatus(id: string, status: MemberStatus, reviewNote?: string): Promise<Member> {
    return request<Member>('/members/' + encodeURIComponent(id), {
      method: 'PATCH',
      body: JSON.stringify({ status, reviewNote }),
    });
  },

  async resetMemberPassword(id: string): Promise<string> {
    const result = await request<{ password: string }>('/members/' + encodeURIComponent(id) + '/reset-password', {
      method: 'POST',
      body: '{}',
    });
    return result.password;
  },
};
