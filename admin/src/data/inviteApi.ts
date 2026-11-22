import type { InviteCode } from '../types/models';

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

export const inviteApi = {
  async listInvites(): Promise<InviteCode[]> {
    return request<InviteCode[]>('/invites');
  },

  async createInvite(payload: { note: string; maxUses: number; expiresInDays: number }): Promise<InviteCode> {
    return request<InviteCode>('/invites', { method: 'POST', body: JSON.stringify(payload) });
  },

  async disableInvite(id: string): Promise<InviteCode> {
    return request<InviteCode>('/invites/' + id, { method: 'PATCH', body: JSON.stringify({ status: 'disabled' }) });
  },
};
