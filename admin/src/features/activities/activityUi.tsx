import { Badge } from '../../components/ui/primitives';
import type { ActivitySignupStatus, ClubActivityStatus, ClubActivityTag } from '../../types/models';

type Tone = 'green' | 'coral' | 'gold' | 'gray' | 'blue';

const activityStatus: Record<ClubActivityStatus, { label: string; tone: Tone }> = {
  published: { label: '报名中', tone: 'green' },
  draft: { label: '草稿', tone: 'gray' },
  ended: { label: '已结束', tone: 'gray' },
};

const signupStatus: Record<ActivitySignupStatus, { label: string; tone: Tone }> = {
  pending: { label: '待确认', tone: 'gold' },
  approved: { label: '已确认', tone: 'green' },
  declined: { label: '已取消', tone: 'gray' },
  attended: { label: '已参加', tone: 'blue' },
};

const tagTone: Record<ClubActivityTag, Tone> = {
  轻松跑: 'green',
  训练: 'gold',
  同城: 'blue',
  公益: 'coral',
};

export const activityTagOptions: ClubActivityTag[] = ['轻松跑', '训练', '同城', '公益'];

export const activityStatusLabels: Record<ClubActivityStatus, string> = {
  published: '报名中',
  draft: '草稿',
  ended: '已结束',
};

export const signupStatusLabels: Record<ActivitySignupStatus, string> = {
  pending: '待确认',
  approved: '已确认',
  declined: '已取消',
  attended: '已参加',
};

export function ActivityStatusBadge({ status }: { status: ClubActivityStatus }) {
  const meta = activityStatus[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function SignupStatusBadge({ status }: { status: ActivitySignupStatus }) {
  const meta = signupStatus[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function ActivityTagBadge({ tag }: { tag: ClubActivityTag }) {
  return <Badge tone={tagTone[tag]}>{tag}</Badge>;
}

export function formatActivityDate(date: string): string {
  const parsed = new Date(date + 'T12:00:00');
  if (Number.isNaN(parsed.getTime())) return date;
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return (parsed.getMonth() + 1) + '月' + parsed.getDate() + '日 · ' + weekdays[parsed.getDay()];
}
