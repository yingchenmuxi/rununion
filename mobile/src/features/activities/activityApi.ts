import type { ApiActivity, ActivitySignup } from './activityData';

const API_BASE = (process.env.EXPO_PUBLIC_ACTIVITY_API || 'http://127.0.0.1:8090/api').replace(/\/$/, '');

export class ActivityApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ActivityApiError';
    this.status = status;
    this.code = code;
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
    throw new ActivityApiError(0, 'network', '连不上演示数据服务，请确认 Mock API 已启动。');
  }

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string; code?: string })
    | null;

  if (!response.ok) {
    throw new ActivityApiError(
      response.status,
      payload?.code ?? 'bad_request',
      payload?.error ?? '演示数据服务返回了错误。',
    );
  }
  return payload as T;
}

export function fetchMemberActivities(memberId: string) {
  return request<ApiActivity[]>('/member/activities?memberId=' + encodeURIComponent(memberId));
}

export function createActivitySignup(activityId: string, memberId: string) {
  return request<{ signup: ActivitySignup; activity: ApiActivity }>(
    '/activities/' + encodeURIComponent(activityId) + '/signup',
    { method: 'POST', body: JSON.stringify({ memberId }) },
  );
}

export function cancelActivitySignup(signupId: string) {
  return request<{ signup: ActivitySignup; activity: ApiActivity }>(
    '/signups/' + encodeURIComponent(signupId) + '/cancel',
    { method: 'POST', body: '{}' },
  );
}

export function resetActivityDemo() {
  return request<{ ok: boolean; activities: ApiActivity[] }>('/reset', { method: 'POST', body: '{}' });
}
