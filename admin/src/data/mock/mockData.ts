import type {
  ActivitySignup,
  Announcement,
  Challenge,
  ClubActivity,
  InviteCode,
  Member,
  RunRecord,
} from '../../types/models';

export const CLUB_NAME = '康福外国语学校长跑社';
export const CLUB_ID = 'club-kangfu';
export const ADMIN_EMAIL = 'admin@qingrun.local';
export const ADMIN_PASSWORD = 'Qingrun-Dev-2026';
export const PLATFORM_EMAIL = 'ops@qingrun.local';
export const PLATFORM_PASSWORD = 'Qingrun-Dev-2026';
export const PLATFORM_DISPLAY_NAME = '周明';

export const seedMembers: Member[] = [
  {
    id: 'm-001', name: '林小满', username: 'linxiaoman', grade: '高一', gender: '女',
    status: 'active', role: 'owner', joinedAt: '2026-09-01T08:00:00+08:00',
    lastActiveAt: '2026-11-17T06:40:00+08:00', weeklyKm: 18.6, totalKm: 126.4,
  },
  {
    id: 'm-002', name: '陈予安', username: 'chenyuan', grade: '初二', gender: '男',
    status: 'pending', role: 'member', joinedAt: '2026-11-16T20:12:00+08:00',
    lastActiveAt: '2026-11-16T20:12:00+08:00', weeklyKm: 0, totalKm: 0,
    note: '同班同学推荐，想参加周末环湖跑。',
  },
  {
    id: 'm-003', name: '周子墨', username: 'zhouzimo', grade: '初三', gender: '男',
    status: 'pending', role: 'member', joinedAt: '2026-11-16T19:05:00+08:00',
    lastActiveAt: '2026-11-16T19:05:00+08:00', weeklyKm: 0, totalKm: 0,
    note: '1500 米校队，希望跟练。',
  },
  {
    id: 'm-004', name: '许知远', username: 'xuzhiyuan', grade: '高二', gender: '男',
    status: 'pending', role: 'member', joinedAt: '2026-11-15T21:30:00+08:00',
    lastActiveAt: '2026-11-15T21:30:00+08:00', weeklyKm: 0, totalKm: 0,
    note: '想从 3 公里开始，零基础。',
  },
  {
    id: 'm-005', name: '陈一诺', username: 'chenyinuo', grade: '高一', gender: '女',
    status: 'active', role: 'member', joinedAt: '2026-09-03T08:00:00+08:00',
    lastActiveAt: '2026-11-17T06:10:00+08:00', weeklyKm: 22.4, totalKm: 148.2,
  },
  {
    id: 'm-006', name: '周雨桐', username: 'zhouyutong', grade: '高二', gender: '女',
    status: 'active', role: 'member', joinedAt: '2026-09-05T08:00:00+08:00',
    lastActiveAt: '2026-11-16T18:20:00+08:00', weeklyKm: 16.8, totalKm: 112.7,
  },
  {
    id: 'm-007', name: '许嘉禾', username: 'xujiahe', grade: '初三', gender: '男',
    status: 'active', role: 'member', joinedAt: '2026-09-08T08:00:00+08:00',
    lastActiveAt: '2026-11-16T17:35:00+08:00', weeklyKm: 24.0, totalKm: 168.9,
  },
  {
    id: 'm-008', name: '王予辰', username: 'wangyuchen', grade: '高一', gender: '男',
    status: 'active', role: 'member', joinedAt: '2026-09-12T08:00:00+08:00',
    lastActiveAt: '2026-11-15T19:05:00+08:00', weeklyKm: 12.5, totalKm: 86.3,
  },
  {
    id: 'm-009', name: '李思远', username: 'lisiyuan', grade: '高二', gender: '男',
    status: 'active', role: 'member', joinedAt: '2026-09-15T08:00:00+08:00',
    lastActiveAt: '2026-11-15T06:50:00+08:00', weeklyKm: 28.2, totalKm: 192.1,
  },
  {
    id: 'm-010', name: '赵清和', username: 'zhaoqinghe', grade: '初二', gender: '女',
    status: 'active', role: 'member', joinedAt: '2026-10-02T08:00:00+08:00',
    lastActiveAt: '2026-11-14T18:40:00+08:00', weeklyKm: 9.6, totalKm: 54.8,
  },
  {
    id: 'm-011', name: '孙可欣', username: 'sunkexin', grade: '高一', gender: '女',
    status: 'active', role: 'member', joinedAt: '2026-10-10T08:00:00+08:00',
    lastActiveAt: '2026-11-13T17:20:00+08:00', weeklyKm: 8.4, totalKm: 41.5,
  },
  {
    id: 'm-012', name: '吴亦然', username: 'wuyiran', grade: '初三', gender: '男',
    status: 'rejected', role: 'member', joinedAt: '2026-11-12T20:00:00+08:00',
    lastActiveAt: '2026-11-12T20:00:00+08:00', weeklyKm: 0, totalKm: 0,
    note: '信息填写不完整，已请对方补充学校信息。',
  },
];

export const seedInvites: InviteCode[] = [
  {
    id: 'inv-001', code: 'QINGRUN-1101', note: '高一（3）班专场',
    createdAt: '2026-11-01T09:00:00+08:00', expiresAt: '2026-11-30T23:59:59+08:00',
    maxUses: 10, usedCount: 7, status: 'active',
  },
  {
    id: 'inv-002', code: 'QINGRUN-1015', note: '校运会招募',
    createdAt: '2026-10-15T09:00:00+08:00', expiresAt: '2026-10-31T23:59:59+08:00',
    maxUses: 20, usedCount: 20, status: 'expired',
  },
  {
    id: 'inv-003', code: 'QINGRUN-0920', note: '开学季体验码',
    createdAt: '2026-09-20T09:00:00+08:00', expiresAt: '2026-09-30T23:59:59+08:00',
    maxUses: 30, usedCount: 18, status: 'disabled',
  },
];

export const seedAnnouncements: Announcement[] = [
  {
    id: 'ann-001', title: '周六校园环湖 5K，7:00 东门集合',
    content: '本周六早上 7:00 在学校东门集合，统一热身。路线为环湖一圈 5 公里，配速自由，不设排名。请穿反光条或浅色上衣，跑前吃一点东西，不要空腹。',
    status: 'published', pinned: true, author: '林小满',
    createdAt: '2026-11-16T20:30:00+08:00', publishedAt: '2026-11-16T20:35:00+08:00',
  },
  {
    id: 'ann-002', title: '降温提醒：跑后及时加衣',
    content: '本周气温下降，跑完不要立刻停在风口。建议带一件干外套，跑后 10 分钟内换上。若有咳嗽、胸闷，先休息，不要硬撑。',
    status: 'published', pinned: false, author: '林小满',
    createdAt: '2026-11-15T07:20:00+08:00', publishedAt: '2026-11-15T07:30:00+08:00',
  },
  {
    id: 'ann-003', title: '新成员审批说明（草稿）',
    content: '邀请码入群后，需要在 24 小时内完成昵称、年级和紧急联系人信息填写。信息不完整的申请会先退回补充。',
    status: 'draft', pinned: false, author: '林小满',
    createdAt: '2026-11-14T21:00:00+08:00',
  },
];

export const seedChallenges: Challenge[] = [
  {
    id: 'ch-001', title: '十一月 · 80 公里挑战',
    description: '本月累计跑满 80 公里。按个人进度记录，不排名；私密记录不计入。',
    targetKm: 80, startAt: '2026-11-01T00:00:00+08:00', endAt: '2026-11-30T23:59:59+08:00',
    status: 'active', participantCount: 64, completedCount: 21, clubProgressKm: 41.6,
  },
  {
    id: 'ch-002', title: '冬训 30 天 · 60 公里',
    description: '12 月每天动一动，30 天累计 60 公里即可完成。',
    targetKm: 60, startAt: '2026-12-01T00:00:00+08:00', endAt: '2026-12-30T23:59:59+08:00',
    status: 'upcoming', participantCount: 38, completedCount: 0, clubProgressKm: 0,
  },
  {
    id: 'ch-003', title: '国庆 7 天 · 21 公里',
    description: '假期不躺平，7 天累计 21 公里。',
    targetKm: 21, startAt: '2026-10-01T00:00:00+08:00', endAt: '2026-10-07T23:59:59+08:00',
    status: 'ended', participantCount: 52, completedCount: 37, clubProgressKm: 21,
  },
];

export const seedRecords: RunRecord[] = [
  {
    id: 'run-001', memberId: 'm-001', memberName: '林小满', date: '2026-11-17',
    distanceKm: 5.2, durationMin: 32, pace: '6\'09"', note: '校园环湖，轻松跑。',
    visibility: 'club', createdAt: '2026-11-17T06:42:00+08:00',
  },
  {
    id: 'run-002', memberId: 'm-005', memberName: '陈一诺', date: '2026-11-17',
    distanceKm: 3.0, durationMin: 18, pace: '6\'00"', note: '早起慢跑，状态不错。',
    visibility: 'club', createdAt: '2026-11-17T06:20:00+08:00',
  },
  {
    id: 'run-003', memberId: 'm-006', memberName: '周雨桐', date: '2026-11-16',
    distanceKm: 10.0, durationMin: 62, pace: '6\'12"', note: '第一次跑 10 公里，最后两公里降速。',
    visibility: 'club', createdAt: '2026-11-16T18:25:00+08:00',
  },
  {
    id: 'run-004', memberId: 'm-007', memberName: '许嘉禾', date: '2026-11-16',
    distanceKm: 4.2, durationMin: 24, pace: '5\'43"', note: '节奏跑。',
    visibility: 'club', createdAt: '2026-11-16T17:40:00+08:00',
  },
  {
    id: 'run-005', memberId: 'm-008', memberName: '王予辰', date: '2026-11-15',
    distanceKm: 6.5, durationMin: 40, pace: '6\'09"', note: '和同学一起跑。',
    visibility: 'club', createdAt: '2026-11-15T19:10:00+08:00',
  },
  {
    id: 'run-006', memberId: 'm-009', memberName: '李思远', date: '2026-11-15',
    distanceKm: 8.0, durationMin: 44, pace: '5\'30"', note: '长距离，后半程有点顶。',
    visibility: 'club', createdAt: '2026-11-15T06:55:00+08:00',
  },
  {
    id: 'run-007', memberId: 'm-010', memberName: '赵清和', date: '2026-11-14',
    distanceKm: 3.5, durationMin: 23, pace: '6\'34"', note: '跑走结合。',
    visibility: 'club', createdAt: '2026-11-14T18:45:00+08:00',
  },
  {
    id: 'run-008', memberId: 'm-011', memberName: '孙可欣', date: '2026-11-13',
    distanceKm: 5.0, durationMin: 33, pace: '6\'36"', note: '按体感跑，没有看表。',
    visibility: 'club', createdAt: '2026-11-13T17:25:00+08:00',
  },
];

function dateOffset(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function isoOffset(days: number, hour: number, minute: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

export const seedActivities: ClubActivity[] = [
  {
    id: 'act-001',
    title: '校园环湖 5K',
    tag: '轻松跑',
    date: dateOffset(2),
    startTime: '07:00',
    meetingArea: '学校东门',
    meetingDetail: '东门内侧银杏树下',
    distanceKm: 5,
    durationMin: 45,
    capacity: 40,
    coach: '陈教练',
    intensity: '7\'00"/km 左右，跑走结合也可以',
    description: '绕校园外圈慢跑一圈，前两公里一起热身，后三公里按自己的节奏。不设关门时间，走完也算完成。',
    preparation: ['穿跑鞋，带一件外套', '提前 10 分钟到东门', '跑前少量喝水，不要空腹'],
    notes: '如遇雾霾、雷雨或路面结冰，活动会提前在跑团公告里取消。',
    status: 'published',
    createdAt: isoOffset(-3, 20, 30),
  },
  {
    id: 'act-002',
    title: '操场间歇入门',
    tag: '训练',
    date: dateOffset(3),
    startTime: '16:30',
    meetingArea: '学校田径场',
    meetingDetail: '田径场北侧看台下集合，先做动态热身',
    distanceKm: 4,
    durationMin: 50,
    capacity: 24,
    coach: '周教练',
    intensity: '快 1 分钟 + 慢 2 分钟，共 6 组',
    description: '第一次接触间歇跑，不追配速。用“能说短句”的强度完成快跑段，慢跑段充分恢复，感觉不对随时停下。',
    preparation: ['吃过午饭后 2 小时再来', '带水和毛巾', '有膝盖或脚踝疼痛提前告诉教练'],
    notes: '训练前会统一做动态热身，结束后一起拉伸，不单独加练。',
    status: 'published',
    createdAt: isoOffset(-2, 21, 10),
  },
  {
    id: 'act-003',
    title: '奥森夜跑 6K',
    tag: '同城',
    date: dateOffset(6),
    startTime: '19:30',
    meetingArea: '奥森南园南门',
    meetingDetail: '南门地铁口向西 200 米，路灯下集合',
    distanceKm: 6,
    durationMin: 55,
    capacity: 30,
    coach: '许教练',
    intensity: '6\'30"/km 左右，分快慢两组',
    description: '和朝阳的少年跑团一起夜跑，路线全程有路灯。需要家长知情，未成年人由监护人确认后再放出集合点。',
    preparation: ['穿浅色或有反光条的衣服', '带一件干外套，跑后穿上', '提前把返程方式告诉家长'],
    notes: '夜跑不追求速度，每公里都有收队；遇到天气预警直接取消。',
    status: 'draft',
    createdAt: isoOffset(-1, 19, 45),
  },
  {
    id: 'act-004',
    title: '校园环湖 5K',
    tag: '轻松跑',
    date: dateOffset(-5),
    startTime: '07:00',
    meetingArea: '学校东门',
    meetingDetail: '东门内侧银杏树下',
    distanceKm: 5,
    durationMin: 42,
    capacity: 40,
    coach: '陈教练',
    intensity: '6\'50"/km 左右',
    description: '上周的校园环湖轻松跑，已结束。完成记录可以在成长档案里看到。',
    preparation: ['跑前热身', '按自己的节奏完成', '结束后拉伸'],
    notes: '活动已结束。出勤记录由团长在赛后核对，填错可以撤销。',
    status: 'ended',
    createdAt: isoOffset(-12, 20, 0),
  },
];

export const seedActivitySignups: ActivitySignup[] = [
  {
    id: 'sg-001', activityId: 'act-001', memberId: 'm-001', memberName: '林小满',
    grade: '高一', gender: '女', guardianName: '林建国', guardianPhone: '138-0000-1001',
    guardianConsent: true, note: '负责签到和收队。', status: 'approved',
    createdAt: isoOffset(-2, 19, 20), reviewedAt: isoOffset(-2, 20, 5), reviewNote: '已确认，负责签到。',
  },
  {
    id: 'sg-002', activityId: 'act-001', memberId: 'm-005', memberName: '陈一诺',
    grade: '高一', gender: '女', guardianName: '陈慧', guardianPhone: '138-0000-1002',
    guardianConsent: true, note: '想跟 7\'00" 这一组。', status: 'pending',
    createdAt: isoOffset(-1, 20, 12),
  },
  {
    id: 'sg-003', activityId: 'act-001', memberId: 'm-006', memberName: '周雨桐',
    grade: '高二', gender: '女', guardianName: '周海峰', guardianPhone: '138-0000-1003',
    guardianConsent: true, note: '会自己带水。', status: 'approved',
    createdAt: isoOffset(-2, 18, 40), reviewedAt: isoOffset(-2, 20, 12),
  },
  {
    id: 'sg-004', activityId: 'act-001', memberId: 'm-007', memberName: '许嘉禾',
    grade: '初三', gender: '男', guardianName: '许文', guardianPhone: '138-0000-1004',
    guardianConsent: true, note: '第一次参加，想跑慢组。', status: 'approved',
    createdAt: isoOffset(-2, 18, 10), reviewedAt: isoOffset(-2, 20, 12),
  },
  {
    id: 'sg-005', activityId: 'act-001', memberId: 'm-008', memberName: '王予辰',
    grade: '高一', gender: '男', guardianName: '王立新', guardianPhone: '138-0000-1005',
    guardianConsent: true, note: '', status: 'approved',
    createdAt: isoOffset(-2, 17, 35), reviewedAt: isoOffset(-2, 20, 12),
  },
  {
    id: 'sg-006', activityId: 'act-001', memberId: 'm-009', memberName: '李思远',
    grade: '高二', gender: '男', guardianName: '李强', guardianPhone: '138-0000-1006',
    guardianConsent: false, note: '家长同意书还没交，先报名。', status: 'pending',
    createdAt: isoOffset(-1, 21, 5),
  },
  {
    id: 'sg-007', activityId: 'act-001', memberId: 'm-010', memberName: '赵清和',
    grade: '初二', gender: '女', guardianName: '赵敏', guardianPhone: '138-0000-1007',
    guardianConsent: true, note: '当天上午有课，看看能不能赶到。', status: 'declined',
    createdAt: isoOffset(-1, 18, 25), reviewedAt: isoOffset(-1, 19, 0),
    reviewNote: '家长说明当天有课，已取消报名。',
  },
  {
    id: 'sg-008', activityId: 'act-001', memberId: 'm-011', memberName: '孙可欣',
    grade: '高一', gender: '女', guardianName: '孙晓梅', guardianPhone: '138-0000-1008',
    guardianConsent: true, note: '', status: 'approved',
    createdAt: isoOffset(-2, 17, 10), reviewedAt: isoOffset(-2, 20, 12),
  },
  {
    id: 'sg-009', activityId: 'act-002', memberId: 'm-001', memberName: '林小满',
    grade: '高一', gender: '女', guardianName: '林建国', guardianPhone: '138-0000-1001',
    guardianConsent: true, note: '带秒表。', status: 'approved',
    createdAt: isoOffset(-2, 9, 10), reviewedAt: isoOffset(-2, 12, 0),
  },
  {
    id: 'sg-010', activityId: 'act-002', memberId: 'm-005', memberName: '陈一诺',
    grade: '高一', gender: '女', guardianName: '陈慧', guardianPhone: '138-0000-1002',
    guardianConsent: true, note: '', status: 'approved',
    createdAt: isoOffset(-2, 8, 45), reviewedAt: isoOffset(-2, 12, 0),
  },
  {
    id: 'sg-011', activityId: 'act-002', memberId: 'm-006', memberName: '周雨桐',
    grade: '高二', gender: '女', guardianName: '周海峰', guardianPhone: '138-0000-1003',
    guardianConsent: true, note: '想试第一组。', status: 'pending',
    createdAt: isoOffset(-1, 7, 30),
  },
  {
    id: 'sg-012', activityId: 'act-002', memberId: 'm-007', memberName: '许嘉禾',
    grade: '初三', gender: '男', guardianName: '许文', guardianPhone: '138-0000-1004',
    guardianConsent: true, note: '', status: 'approved',
    createdAt: isoOffset(-2, 8, 0), reviewedAt: isoOffset(-2, 12, 0),
  },
  {
    id: 'sg-013', activityId: 'act-002', memberId: 'm-010', memberName: '赵清和',
    grade: '初二', gender: '女', guardianName: '赵敏', guardianPhone: '138-0000-1007',
    guardianConsent: true, note: '', status: 'approved',
    createdAt: isoOffset(-1, 19, 30), reviewedAt: isoOffset(-1, 20, 0),
  },
  {
    id: 'sg-014', activityId: 'act-004', memberId: 'm-001', memberName: '林小满',
    grade: '高一', gender: '女', guardianName: '林建国', guardianPhone: '138-0000-1001',
    guardianConsent: true, note: '收队。', status: 'attended',
    createdAt: isoOffset(-7, 18, 0), reviewedAt: isoOffset(-5, 8, 0), checkinAt: isoOffset(-5, 9, 5), checkinNote: '赛后签到：已到场。',
  },
  {
    id: 'sg-015', activityId: 'act-004', memberId: 'm-005', memberName: '陈一诺',
    grade: '高一', gender: '女', guardianName: '陈慧', guardianPhone: '138-0000-1002',
    guardianConsent: true, note: '', status: 'attended',
    createdAt: isoOffset(-7, 18, 20), reviewedAt: isoOffset(-5, 8, 0), checkinAt: isoOffset(-5, 9, 8), checkinNote: '赛后签到：已到场。',
  },
  {
    id: 'sg-016', activityId: 'act-004', memberId: 'm-006', memberName: '周雨桐',
    grade: '高二', gender: '女', guardianName: '周海峰', guardianPhone: '138-0000-1003',
    guardianConsent: true, note: '', status: 'attended',
    createdAt: isoOffset(-7, 18, 30), reviewedAt: isoOffset(-5, 8, 0), checkinAt: isoOffset(-5, 9, 12), checkinNote: '赛后签到：已到场。',
  },
  {
    id: 'sg-017', activityId: 'act-004', memberId: 'm-007', memberName: '许嘉禾',
    grade: '初三', gender: '男', guardianName: '许文', guardianPhone: '138-0000-1004',
    guardianConsent: true, note: '', status: 'approved',
    createdAt: isoOffset(-7, 19, 0), reviewedAt: isoOffset(-5, 8, 0), reviewNote: '已确认报名，等待赛后签到。',
  },
  {
    id: 'sg-018', activityId: 'act-004', memberId: 'm-008', memberName: '王予辰',
    grade: '高一', gender: '男', guardianName: '王立新', guardianPhone: '138-0000-1005',
    guardianConsent: true, note: '', status: 'approved',
    createdAt: isoOffset(-7, 19, 10), reviewedAt: isoOffset(-5, 8, 0), reviewNote: '已确认报名，等待赛后签到。',
  },
  {
    id: 'sg-019', activityId: 'act-004', memberId: 'm-009', memberName: '李思远',
    grade: '高二', gender: '男', guardianName: '李强', guardianPhone: '138-0000-1006',
    guardianConsent: true, note: '晚到 5 分钟。', status: 'approved',
    createdAt: isoOffset(-7, 19, 20), reviewedAt: isoOffset(-5, 8, 0), reviewNote: '已确认报名，等待赛后签到。',
  },
];