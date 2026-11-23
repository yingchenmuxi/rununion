import type { MemberChallenge } from './challengeData';

const API_BASE = (process.env.EXPO_PUBLIC_ACTIVITY_API || 'http://127.0.0.1:8090/api').replace(/\/$/, '');

export class ChallengeApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ChallengeApiError';
    this.status = status;
  }
}

export async function fetchMemberChallenges(memberId: string): Promise<MemberChallenge[]> {
  let response: Response;
  try {
    response = await fetch(API_BASE + '/challenges?memberId=' + encodeURIComponent(memberId));
  } catch {
    throw new ChallengeApiError(0, '连不上演示数据服务，请确认 Mock API 已启动。');
  }
  const payload = (await response.json().catch(() => null)) as
    | (MemberChallenge[] & { error?: string })
    | null;
  if (!response.ok) {
    throw new ChallengeApiError(response.status, (payload as { error?: string } | null)?.error ?? '挑战数据服务返回了错误。');
  }
  return payload as MemberChallenge[];
}
