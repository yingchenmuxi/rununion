export type ClubActivityStatus = 'draft' | 'published' | 'ended';

export type ActivityTag = '轻松跑' | '训练' | '同城' | '公益';

export type SignupStatus = 'pending' | 'approved' | 'declined' | 'attended' | 'absent';

export type ActivitySignup = {
  id: string;
  activityId: string;
  memberId: string;
  memberName: string;
  grade: string;
  gender: string;
  guardianName: string;
  guardianPhone: string;
  guardianConsent: boolean;
  note: string;
  status: SignupStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewNote?: string;
  checkinAt?: string;
  checkinNote?: string;
};

export type ApiActivity = {
  id: string;
  title: string;
  tag: ActivityTag;
  date: string;
  startTime: string;
  meetingArea: string;
  meetingDetail: string;
  distanceKm: number;
  durationMin: number;
  capacity: number;
  coach: string;
  intensity: string;
  description: string;
  preparation: string[];
  notes: string;
  status: ClubActivityStatus;
  createdAt: string;
  signupCount: number;
  pendingCount: number;
  confirmedCount: number;
  pendingCheckinCount: number;
  attendedCount: number;
  absentCount: number;
  mySignup: ActivitySignup | null;
};

export type Activity = ApiActivity & {
  club: string;
  clubShort: string;
  dateISO: string;
  paceHint: string;
  checklist: string[];
  notice: string;
};

export const CLUB_NAME = '康福外国语学校长跑社';
export const CLUB_SHORT = '康福长跑社';
export const DEMO_MEMBER_ID = 'm-001';

export const SIGNUP_LABELS: Record<SignupStatus, string> = {
  pending: '待团长确认',
  approved: '已报名',
  declined: '已取消',
  attended: '已参加',
  absent: '未到',
};

export function isActiveSignup(status: SignupStatus | null | undefined) {
  return status === 'pending' || status === 'approved' || status === 'attended' || status === 'absent';
}

export function mapActivity(raw: ApiActivity): Activity {
  return {
    ...raw,
    club: CLUB_NAME,
    clubShort: CLUB_SHORT,
    dateISO: raw.date,
    paceHint: raw.intensity,
    checklist: raw.preparation ?? [],
    notice: raw.notes,
  };
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function parseDateISO(iso: string) {
  const [year, month, day] = iso.split('-').map((part) => Number(part));
  return new Date(year, month - 1, day);
}

export function formatActivityDate(iso: string) {
  const date = parseDateISO(iso);
  return date.getMonth() + 1 + ' 月 ' + date.getDate() + ' 日 · ' + WEEKDAYS[date.getDay()];
}

export function formatActivityDay(iso: string) {
  return WEEKDAYS[parseDateISO(iso).getDay()];
}

export function formatActivityMonthDay(iso: string) {
  const date = parseDateISO(iso);
  return date.getMonth() + 1 + '/' + date.getDate();
}

export function activityDateTime(iso: string, startTime: string) {
  return formatActivityDate(iso) + ' ' + startTime;
}

export function compareActivityDate(a: Activity, b: Activity) {
  return a.dateISO.localeCompare(b.dateISO) || a.startTime.localeCompare(b.startTime);
}
