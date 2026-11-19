export type ActivityStatus = 'upcoming' | 'past';

export type ActivityTag = '轻松跑' | '训练' | '同城' | '公益';

export type Activity = {
  id: string;
  title: string;
  club: string;
  clubShort: string;
  dateISO: string;
  startTime: string;
  endTime: string;
  meetingArea: string;
  meetingDetail: string;
  distanceKm: number;
  durationMin: number;
  paceHint: string;
  capacity: number;
  signedBase: number;
  tag: ActivityTag;
  coach: string;
  description: string;
  checklist: string[];
  notice: string;
  status: ActivityStatus;
};

export type SignupStatus = 'pending' | 'confirmed' | 'attended';

export const SIGNUP_LABELS: Record<SignupStatus, string> = {
  pending: '待团长确认',
  confirmed: '已报名',
  attended: '已参加',
};

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function dateWithOffset(days: number) {
  const date = startOfToday();
  date.setDate(date.getDate() + days);
  return date;
}

function nextWeekday(target: number) {
  const today = startOfToday();
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = dateWithOffset(offset);
    if (candidate.getDay() === target) return candidate;
  }
  return today;
}

function previousWeekday(target: number) {
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = dateWithOffset(-offset);
    if (candidate.getDay() === target) return candidate;
  }
  return startOfToday();
}

function toDateISO(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
}

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

const nextSaturday = nextWeekday(6);
const nextSunday = nextWeekday(0);
const nextWednesday = nextWeekday(3);
const lastSaturday = previousWeekday(6);

export const ACTIVITIES: Activity[] = [
  {
    id: 'a1',
    title: '校园环湖 5K',
    club: '康福外国语学校长跑社',
    clubShort: '康福长跑社',
    dateISO: toDateISO(nextSaturday),
    startTime: '07:00',
    endTime: '08:00',
    meetingArea: '学校东门',
    meetingDetail: '东门内侧银杏树下，穿团服或浅色上衣',
    distanceKm: 5,
    durationMin: 45,
    paceHint: "7'00\"/km 左右，跑走结合也可以",
    capacity: 40,
    signedBase: 24,
    tag: '轻松跑',
    coach: '陈教练',
    description:
      '绕校园外圈慢跑一圈，前两公里一起热身，后三公里按自己的节奏。不设关门时间，走完也算完成。',
    checklist: ['穿跑鞋，带一件外套', '提前 10 分钟到东门', '跑前少量喝水，不要空腹'],
    notice: '如遇雾霾、雷雨或路面结冰，活动会提前在跑团公告里取消。',
    status: 'upcoming',
  },
  {
    id: 'a2',
    title: '操场间歇入门',
    club: '康福外国语学校长跑社',
    clubShort: '康福长跑社',
    dateISO: toDateISO(nextSunday),
    startTime: '16:30',
    endTime: '17:30',
    meetingArea: '学校田径场',
    meetingDetail: '田径场北侧看台下集合，先做动态热身',
    distanceKm: 4,
    durationMin: 50,
    paceHint: "快 1 分钟 + 慢 2 分钟，共 6 组",
    capacity: 24,
    signedBase: 18,
    tag: '训练',
    coach: '周教练',
    description:
      '第一次接触间歇跑，不追配速。用“能说短句”的强度完成快跑段，慢跑段充分恢复，感觉不对随时停下。',
    checklist: ['吃过午饭后再来，至少间隔 2 小时', '带水和毛巾', '有膝盖或脚踝疼痛提前告诉教练'],
    notice: '间歇训练强度较高，未满 16 岁需教练确认后才可参加。',
    status: 'upcoming',
  },
  {
    id: 'a3',
    title: '奥森夜跑 6K',
    club: '朝阳公园少年跑团',
    clubShort: '朝阳少年跑团',
    dateISO: toDateISO(nextWednesday),
    startTime: '19:30',
    endTime: '20:40',
    meetingArea: '奥森南园南门',
    meetingDetail: '南门内右侧灯柱旁，19:20 开始签到',
    distanceKm: 6,
    durationMin: 55,
    paceHint: "6'30\"/km 左右，分快慢两组",
    capacity: 30,
    signedBase: 12,
    tag: '同城',
    coach: '许教练',
    description:
      '和同城跑团一起夜跑奥森环线，全程有领跑和收队。第一次参加可以选择慢组，不要求跑完全程。',
    checklist: ['穿有反光条的上衣或佩戴臂灯', '不要独自离队', '结束后跟队回到南门再解散'],
    notice: '未成年人参加同城活动，需团长与监护人确认后才会通过报名。',
    status: 'upcoming',
  },
  {
    id: 'p1',
    title: '校园环湖 5K',
    club: '康福外国语学校长跑社',
    clubShort: '康福长跑社',
    dateISO: toDateISO(lastSaturday),
    startTime: '07:00',
    endTime: '08:00',
    meetingArea: '学校东门',
    meetingDetail: '东门内侧银杏树下',
    distanceKm: 5,
    durationMin: 42,
    paceHint: "6'50\"/km 左右",
    capacity: 40,
    signedBase: 31,
    tag: '轻松跑',
    coach: '陈教练',
    description: '上周的校园环湖轻松跑，已结束。完成记录可以在成长档案里看到。',
    checklist: ['跑前热身', '按自己的节奏完成', '结束后拉伸'],
    notice: '活动已结束。',
    status: 'past',
  },
];

export function getActivity(id: string | string[] | undefined) {
  const target = Array.isArray(id) ? id[0] : id;
  return ACTIVITIES.find((activity) => activity.id === target);
}

export function compareActivityDate(a: Activity, b: Activity) {
  return a.dateISO.localeCompare(b.dateISO);
}
