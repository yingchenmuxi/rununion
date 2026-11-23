import type { Challenge, NewChallengeInput } from '../types/models';

const API_BASE = ((import.meta.env.VITE_ACTIVITY_API as string | undefined) || 'http://127.0.0.1:8090/api').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((body as { error?: string }).error || '请求失败，请稍后再试。');
  }
  return body as T;
}

export const challengeApi = {
  async listChallenges(): Promise<Challenge[]> {
    return request<Challenge[]>('/challenges');
  },

  async createChallenge(input: NewChallengeInput): Promise<Challenge> {
    return request<Challenge>('/challenges', { method: 'POST', body: JSON.stringify(input) });
  },

  async endChallenge(id: string): Promise<Challenge> {
    return request<Challenge>('/challenges/' + encodeURIComponent(id), {
      method: 'PATCH',
      body: JSON.stringify({ status: 'ended' }),
    });
  },
};
