import type { RunSource } from './RunContext';

const API_BASE = (process.env.EXPO_PUBLIC_ACTIVITY_API || 'http://127.0.0.1:8090/api').replace(/\/$/, '');

export type ApiRun = {
  id: string;
  memberId: string;
  memberName?: string;
  date: string;
  title: string;
  distanceKm: number;
  durationMin: number;
  source: RunSource;
  note?: string;
  pace?: string;
  createdAt?: string;
};

export class RunApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'RunApiError';
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
    throw new RunApiError(0, '连不上演示数据服务，请确认 Mock API 已启动。');
  }

  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new RunApiError(response.status, payload?.error ?? '跑步记录服务返回了错误。');
  }
  return payload as T;
}

export function fetchMemberRuns(memberId: string) {
  return request<ApiRun[]>('/runs?memberId=' + encodeURIComponent(memberId));
}

export function createRun(input: {
  memberId: string;
  title: string;
  date: string;
  distanceKm: number;
  durationMin: number;
  source: RunSource;
}) {
  return request<ApiRun>('/runs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
