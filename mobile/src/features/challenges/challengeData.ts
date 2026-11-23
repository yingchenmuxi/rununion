export type ChallengeStatus = 'upcoming' | 'active' | 'ended';

export type MemberChallenge = {
  id: string;
  title: string;
  description: string;
  targetKm: number;
  startDate: string;
  endDate: string;
  startAt?: string;
  endAt?: string;
  status: ChallengeStatus;
  participantCount: number;
  completedCount: number;
  clubProgressKm: number;
  myKm: number;
  myPercent: number;
  myCompleted: boolean;
  daysLeft: number;
};

export const CHALLENGE_STATUS_META: Record<
  ChallengeStatus,
  { label: string; tone: 'green' | 'gold' | 'neutral' }
> = {
  active: { label: '进行中', tone: 'green' },
  upcoming: { label: '未开始', tone: 'gold' },
  ended: { label: '已结束', tone: 'neutral' },
};

function monthDay(iso: string) {
  const parts = String(iso).slice(0, 10).split('-');
  if (parts.length !== 3) return String(iso);
  return Number(parts[1]) + ' 月 ' + Number(parts[2]) + ' 日';
}

export function formatChallengeRange(startDate: string, endDate: string) {
  return monthDay(startDate) + ' — ' + monthDay(endDate);
}

export function challengeProgressText(challenge: MemberChallenge) {
  if (challenge.status === 'upcoming') return monthDay(challenge.startDate) + ' 开始';
  if (challenge.status === 'ended') return '已结束 · 进度只读';
  if (challenge.myCompleted) return '已完成 ✓';
  return '还剩 ' + challenge.daysLeft + ' 天';
}
