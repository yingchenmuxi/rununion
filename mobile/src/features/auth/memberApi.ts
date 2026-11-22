const API_BASE = (process.env.EXPO_PUBLIC_ACTIVITY_API || 'http://127.0.0.1:8090/api').replace(/\/$/, '');

export type ApplicationStatus = 'pending' | 'active' | 'rejected';

export type MemberApplication = {
  id: string;
  nickname: string;
  username: string;
  grade: string;
  status: ApplicationStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string;
};

export type JoinInput = {
  inviteCode: string;
  nickname: string;
  username: string;
  grade: string;
};

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
  if (!response.ok) throw new Error(payload?.error ?? '申请提交失败，请稍后再试。');
  return payload as T;
}

export type ValidatedInvite = {
  code: string;
  note: string;
  status: 'active';
  maxUses: number;
  usedCount: number;
  remaining: number;
  expiresAt: string;
};

export function validateInviteCode(code: string) {
  return request<{ ok: true; invite: ValidatedInvite }>('/invites/validate', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export function submitMemberApplication(input: JoinInput) {
  return request<{ application: MemberApplication }>('/member-applications', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchMemberApplication(id: string) {
  return request<MemberApplication>('/member-applications/' + encodeURIComponent(id));
}
