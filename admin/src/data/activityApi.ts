import type {
  ActivitySignup,
  ClubActivity,
  ClubActivitySummary,
  NewActivityInput,
} from '../types/models';

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

function post<T>(path: string, payload?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: payload === undefined ? '{}' : JSON.stringify(payload) });
}

export const activityApi = {
  async listActivities(): Promise<ClubActivitySummary[]> {
    return request<ClubActivitySummary[]>('/activities');
  },

  async getActivity(id: string): Promise<ClubActivity | null> {
    try {
      return await request<ClubActivity>('/activities/' + encodeURIComponent(id));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  async listActivitySignups(activityId: string): Promise<ActivitySignup[]> {
    return request<ActivitySignup[]>('/activities/' + encodeURIComponent(activityId) + '/signups');
  },

  async createActivity(input: NewActivityInput): Promise<ClubActivity> {
    return post<ClubActivity>('/activities', input);
  },

  async publishActivity(id: string): Promise<ClubActivity> {
    return post<ClubActivity>('/activities/' + encodeURIComponent(id) + '/publish');
  },

  async endActivity(id: string): Promise<ClubActivity> {
    return post<ClubActivity>('/activities/' + encodeURIComponent(id) + '/end');
  },

  async reviewActivitySignup(id: string, decision: 'approved' | 'declined', note?: string): Promise<ActivitySignup> {
    return post<ActivitySignup>('/signups/' + encodeURIComponent(id) + '/review', { decision, note });
  },

  async recordGuardianConsent(id: string): Promise<ActivitySignup> {
    return post<ActivitySignup>('/signups/' + encodeURIComponent(id) + '/consent');
  },

  async checkinActivitySignup(id: string, result: 'attended' | 'absent'): Promise<ActivitySignup> {
    return post<ActivitySignup>('/signups/' + encodeURIComponent(id) + '/checkin', { result });
  },

  async resetActivityCheckin(id: string): Promise<ActivitySignup> {
    return post<ActivitySignup>('/signups/' + encodeURIComponent(id) + '/reset-checkin');
  },

  async resetDemo(): Promise<void> {
    await post('/reset');
  },
};
