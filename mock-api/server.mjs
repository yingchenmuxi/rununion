import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const PORT = Number(process.env.PORT || 8090);
const ROOT = resolve(process.env.DIST_DIR || 'mobile/dist');
const DATA_FILE = resolve('mock-api/data.json');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const MEMBERS = {
  'm-001': { name: '林小满', grade: '高一', gender: '女', guardianName: '林建国', guardianPhone: '138-0000-1001' },
};
const GRADES = ['初三', '高一', '高二', '高三', '大学/其他'];

function pad(value) { return String(value).padStart(2, '0'); }
function todayDate() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function dateOffset(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function isoOffset(days, hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function cnDate(iso) {
  const parts = String(iso || '').split('-');
  if (parts.length !== 3) return String(iso || '');
  return Number(parts[1]) + ' 月 ' + Number(parts[2]) + ' 日';
}

function startOfWeekDate() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function weekDate(offset) {
  const date = startOfWeekDate();
  date.setDate(date.getDate() + offset);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const safe = date > today ? today : date;
  return safe.getFullYear() + '-' + pad(safe.getMonth() + 1) + '-' + pad(safe.getDate());
}

function monthRange(offset) {
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + offset);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return {
    start: base.getFullYear() + '-' + pad(base.getMonth() + 1) + '-01',
    end: last.getFullYear() + '-' + pad(last.getMonth() + 1) + '-' + pad(last.getDate()),
  };
}

function buildSeed() {
  const members = [
    { id: 'm-001', name: '林小满', username: 'linxiaoman', grade: '高一', gender: '女', status: 'active', role: 'owner', joinedAt: '2026-09-01T08:00:00+08:00', lastActiveAt: '2026-11-17T06:40:00+08:00', weeklyKm: 18.6, totalKm: 126.4 },
    { id: 'm-002', name: '陈予安', username: 'chenyuan', grade: '初二', gender: '男', status: 'pending', role: 'member', joinedAt: '2026-11-16T20:12:00+08:00', lastActiveAt: '2026-11-16T20:12:00+08:00', weeklyKm: 0, totalKm: 0, note: '同班同学推荐，想参加周末环湖跑。' },
    { id: 'm-003', name: '周子墨', username: 'zhouzimo', grade: '初三', gender: '男', status: 'pending', role: 'member', joinedAt: '2026-11-16T19:05:00+08:00', lastActiveAt: '2026-11-16T19:05:00+08:00', weeklyKm: 0, totalKm: 0, note: '1500 米校队，希望跟练。' },
    { id: 'm-004', name: '许知远', username: 'xuzhiyuan', grade: '高二', gender: '男', status: 'pending', role: 'member', joinedAt: '2026-11-15T21:30:00+08:00', lastActiveAt: '2026-11-15T21:30:00+08:00', weeklyKm: 0, totalKm: 0, note: '想从 3 公里开始，零基础。' },
    { id: 'm-005', name: '陈一诺', username: 'chenyinuo', grade: '高一', gender: '女', status: 'active', role: 'member', joinedAt: '2026-09-03T08:00:00+08:00', lastActiveAt: '2026-11-17T06:10:00+08:00', weeklyKm: 22.4, totalKm: 148.2 },
    { id: 'm-006', name: '周雨桐', username: 'zhouyutong', grade: '高二', gender: '女', status: 'active', role: 'member', joinedAt: '2026-09-05T08:00:00+08:00', lastActiveAt: '2026-11-16T18:20:00+08:00', weeklyKm: 16.8, totalKm: 112.7 },
    { id: 'm-007', name: '许嘉禾', username: 'xujiahe', grade: '初三', gender: '男', status: 'active', role: 'member', joinedAt: '2026-09-08T08:00:00+08:00', lastActiveAt: '2026-11-16T17:35:00+08:00', weeklyKm: 24, totalKm: 168.9 },
    { id: 'm-008', name: '王予辰', username: 'wangyuchen', grade: '高一', gender: '男', status: 'active', role: 'member', joinedAt: '2026-09-12T08:00:00+08:00', lastActiveAt: '2026-11-15T19:05:00+08:00', weeklyKm: 12.5, totalKm: 86.3 },
    { id: 'm-009', name: '李思远', username: 'lisiyuan', grade: '高二', gender: '男', status: 'active', role: 'member', joinedAt: '2026-09-15T08:00:00+08:00', lastActiveAt: '2026-11-15T06:50:00+08:00', weeklyKm: 28.2, totalKm: 192.1 },
    { id: 'm-010', name: '赵清和', username: 'zhaoqinghe', grade: '初二', gender: '女', status: 'active', role: 'member', joinedAt: '2026-10-02T08:00:00+08:00', lastActiveAt: '2026-11-14T18:40:00+08:00', weeklyKm: 9.6, totalKm: 54.8 },
    { id: 'm-011', name: '孙可欣', username: 'sunkexin', grade: '高一', gender: '女', status: 'active', role: 'member', joinedAt: '2026-10-10T08:00:00+08:00', lastActiveAt: '2026-11-13T17:20:00+08:00', weeklyKm: 8.4, totalKm: 41.5 },
    { id: 'm-012', name: '吴亦然', username: 'wuyiran', grade: '初三', gender: '男', status: 'rejected', role: 'member', joinedAt: '2026-11-12T20:00:00+08:00', lastActiveAt: '2026-11-12T20:00:00+08:00', weeklyKm: 0, totalKm: 0, reviewedAt: '2026-11-13T09:10:00+08:00', reviewNote: '信息填写不完整，请补充学校和监护人信息后重新申请。' },
  ];

  const activities = [
    {
      id: 'act-001', title: '校园环湖 5K', tag: '轻松跑', date: dateOffset(2), startTime: '07:00',
      meetingArea: '学校东门', meetingDetail: '东门内侧银杏树下',
      distanceKm: 5, durationMin: 45, capacity: 40, coach: '陈教练',
      intensity: '7\'00"/km 左右，跑走结合也可以',
      description: '绕校园外圈慢跑一圈，前两公里一起热身，后三公里按自己的节奏。不设关门时间，走完也算完成。',
      preparation: ['穿跑鞋，带一件外套', '提前 10 分钟到东门', '跑前少量喝水，不要空腹'],
      notes: '如遇雾霾、雷雨或路面结冰，活动会提前在跑团公告里取消。',
      status: 'published', createdAt: isoOffset(-3, 20, 30),
    },
    {
      id: 'act-002', title: '操场间歇入门', tag: '训练', date: dateOffset(3), startTime: '16:30',
      meetingArea: '学校田径场', meetingDetail: '田径场北侧看台下集合，先做动态热身',
      distanceKm: 4, durationMin: 50, capacity: 24, coach: '周教练',
      intensity: '快 1 分钟 + 慢 2 分钟，共 6 组',
      description: '第一次接触间歇跑，不追配速。用“能说短句”的强度完成快跑段，慢跑段充分恢复，感觉不对随时停下。',
      preparation: ['吃过午饭后 2 小时再来', '带水和毛巾', '有膝盖或脚踝疼痛提前告诉教练'],
      notes: '训练前会统一做动态热身，结束后一起拉伸，不单独加练。',
      status: 'published', createdAt: isoOffset(-2, 21, 10),
    },
    {
      id: 'act-003', title: '奥森夜跑 6K', tag: '同城', date: dateOffset(6), startTime: '19:30',
      meetingArea: '奥森南园南门', meetingDetail: '南门地铁口向西 200 米，路灯下集合',
      distanceKm: 6, durationMin: 55, capacity: 30, coach: '许教练',
      intensity: '6\'30"/km 左右，分快慢两组',
      description: '和朝阳的少年跑团一起夜跑，路线全程有路灯。需要家长知情，未成年人由监护人确认后再放出集合点。',
      preparation: ['穿浅色或有反光条的衣服', '带一件干外套，跑后穿上', '提前把返程方式告诉家长'],
      notes: '夜跑不追求速度，每公里都有收队；遇到天气预警直接取消。',
      status: 'draft', createdAt: isoOffset(-1, 19, 45),
    },
    {
      id: 'act-004', title: '校园环湖 5K', tag: '轻松跑', date: dateOffset(-5), startTime: '07:00',
      meetingArea: '学校东门', meetingDetail: '东门内侧银杏树下',
      distanceKm: 5, durationMin: 42, capacity: 40, coach: '陈教练',
      intensity: '6\'50"/km 左右',
      description: '上周的校园环湖轻松跑，已结束。完成记录可以在成长档案里看到。',
      preparation: ['跑前热身', '按自己的节奏完成', '结束后拉伸'],
      notes: '活动已结束。出勤记录由团长在赛后核对，填错可以撤销。',
      status: 'ended', createdAt: isoOffset(-12, 20, 0),
    },
  ];

  const signups = [
    { id: 'sg-001', activityId: 'act-001', memberId: 'm-001', memberName: '林小满', grade: '高一', gender: '女', guardianName: '林建国', guardianPhone: '138-0000-1001', guardianConsent: true, note: '负责签到和收队。', status: 'approved', createdAt: isoOffset(-2, 19, 20), reviewedAt: isoOffset(-2, 20, 5), reviewNote: '已确认，负责签到。' },
    { id: 'sg-002', activityId: 'act-001', memberId: 'm-005', memberName: '陈一诺', grade: '高一', gender: '女', guardianName: '陈慧', guardianPhone: '138-0000-1002', guardianConsent: true, note: '想跟 7\'00" 这一组。', status: 'pending', createdAt: isoOffset(-1, 20, 12) },
    { id: 'sg-003', activityId: 'act-001', memberId: 'm-006', memberName: '周雨桐', grade: '高二', gender: '女', guardianName: '周海峰', guardianPhone: '138-0000-1003', guardianConsent: true, note: '会自己带水。', status: 'approved', createdAt: isoOffset(-2, 18, 40), reviewedAt: isoOffset(-2, 20, 12) },
    { id: 'sg-004', activityId: 'act-001', memberId: 'm-007', memberName: '许嘉禾', grade: '初三', gender: '男', guardianName: '许文', guardianPhone: '138-0000-1004', guardianConsent: true, note: '第一次参加，想跑慢组。', status: 'approved', createdAt: isoOffset(-2, 18, 10), reviewedAt: isoOffset(-2, 20, 12) },
    { id: 'sg-005', activityId: 'act-001', memberId: 'm-008', memberName: '王予辰', grade: '高一', gender: '男', guardianName: '王立新', guardianPhone: '138-0000-1005', guardianConsent: true, note: '', status: 'approved', createdAt: isoOffset(-2, 17, 35), reviewedAt: isoOffset(-2, 20, 12) },
    { id: 'sg-006', activityId: 'act-001', memberId: 'm-009', memberName: '李思远', grade: '高二', gender: '男', guardianName: '李强', guardianPhone: '138-0000-1006', guardianConsent: false, note: '家长同意书还没交，先报名。', status: 'pending', createdAt: isoOffset(-1, 21, 5) },
    { id: 'sg-007', activityId: 'act-001', memberId: 'm-010', memberName: '赵清和', grade: '初二', gender: '女', guardianName: '赵敏', guardianPhone: '138-0000-1007', guardianConsent: true, note: '当天上午有课，看看能不能赶到。', status: 'declined', createdAt: isoOffset(-1, 18, 25), reviewedAt: isoOffset(-1, 19, 0), reviewNote: '家长说明当天有课，已取消报名。' },
    { id: 'sg-008', activityId: 'act-001', memberId: 'm-011', memberName: '孙可欣', grade: '高一', gender: '女', guardianName: '孙晓梅', guardianPhone: '138-0000-1008', guardianConsent: true, note: '', status: 'approved', createdAt: isoOffset(-2, 17, 10), reviewedAt: isoOffset(-2, 20, 12) },
    { id: 'sg-009', activityId: 'act-002', memberId: 'm-001', memberName: '林小满', grade: '高一', gender: '女', guardianName: '林建国', guardianPhone: '138-0000-1001', guardianConsent: true, note: '带秒表。', status: 'approved', createdAt: isoOffset(-2, 9, 10), reviewedAt: isoOffset(-2, 12, 0) },
    { id: 'sg-010', activityId: 'act-002', memberId: 'm-005', memberName: '陈一诺', grade: '高一', gender: '女', guardianName: '陈慧', guardianPhone: '138-0000-1002', guardianConsent: true, note: '', status: 'approved', createdAt: isoOffset(-2, 8, 45), reviewedAt: isoOffset(-2, 12, 0) },
    { id: 'sg-011', activityId: 'act-002', memberId: 'm-006', memberName: '周雨桐', grade: '高二', gender: '女', guardianName: '周海峰', guardianPhone: '138-0000-1003', guardianConsent: true, note: '想试第一组。', status: 'pending', createdAt: isoOffset(-1, 7, 30) },
    { id: 'sg-012', activityId: 'act-002', memberId: 'm-007', memberName: '许嘉禾', grade: '初三', gender: '男', guardianName: '许文', guardianPhone: '138-0000-1004', guardianConsent: true, note: '', status: 'approved', createdAt: isoOffset(-2, 8, 0), reviewedAt: isoOffset(-2, 12, 0) },
    { id: 'sg-013', activityId: 'act-002', memberId: 'm-010', memberName: '赵清和', grade: '初二', gender: '女', guardianName: '赵敏', guardianPhone: '138-0000-1007', guardianConsent: true, note: '', status: 'approved', createdAt: isoOffset(-1, 19, 30), reviewedAt: isoOffset(-1, 20, 0) },
    { id: 'sg-014', activityId: 'act-004', memberId: 'm-001', memberName: '林小满', grade: '高一', gender: '女', guardianName: '林建国', guardianPhone: '138-0000-1001', guardianConsent: true, note: '收队。', status: 'attended', createdAt: isoOffset(-7, 18, 0), reviewedAt: isoOffset(-5, 8, 0), checkinAt: isoOffset(-5, 9, 5), checkinNote: '赛后签到：已到场。' },
    { id: 'sg-015', activityId: 'act-004', memberId: 'm-005', memberName: '陈一诺', grade: '高一', gender: '女', guardianName: '陈慧', guardianPhone: '138-0000-1002', guardianConsent: true, note: '', status: 'attended', createdAt: isoOffset(-7, 18, 20), reviewedAt: isoOffset(-5, 8, 0), checkinAt: isoOffset(-5, 9, 8), checkinNote: '赛后签到：已到场。' },
    { id: 'sg-016', activityId: 'act-004', memberId: 'm-006', memberName: '周雨桐', grade: '高二', gender: '女', guardianName: '周海峰', guardianPhone: '138-0000-1003', guardianConsent: true, note: '', status: 'attended', createdAt: isoOffset(-7, 18, 30), reviewedAt: isoOffset(-5, 8, 0), checkinAt: isoOffset(-5, 9, 12), checkinNote: '赛后签到：已到场。' },
    { id: 'sg-017', activityId: 'act-004', memberId: 'm-007', memberName: '许嘉禾', grade: '初三', gender: '男', guardianName: '许文', guardianPhone: '138-0000-1004', guardianConsent: true, note: '', status: 'approved', createdAt: isoOffset(-7, 19, 0), reviewedAt: isoOffset(-5, 8, 0), reviewNote: '已确认报名，等待赛后签到。' },
    { id: 'sg-018', activityId: 'act-004', memberId: 'm-008', memberName: '王予辰', grade: '高一', gender: '男', guardianName: '王立新', guardianPhone: '138-0000-1005', guardianConsent: true, note: '', status: 'approved', createdAt: isoOffset(-7, 19, 10), reviewedAt: isoOffset(-5, 8, 0), reviewNote: '已确认报名，等待赛后签到。' },
    { id: 'sg-019', activityId: 'act-004', memberId: 'm-009', memberName: '李思远', grade: '高二', gender: '男', guardianName: '李强', guardianPhone: '138-0000-1006', guardianConsent: true, note: '晚到 5 分钟。', status: 'approved', createdAt: isoOffset(-7, 19, 20), reviewedAt: isoOffset(-5, 8, 0), reviewNote: '已确认报名，等待赛后签到。' },
  ];

  const notifications = [
    {
      id: 'ntf-001', memberId: 'm-001', type: 'activity_confirmed', activityId: 'act-001',
      title: '报名已确认：校园环湖 5K', body: '团长已确认你的报名。' + cnDate(activities[0].date) + ' ' + activities[0].startTime + ' 在' + activities[0].meetingArea + '集合，具体位置：' + activities[0].meetingDetail + '。',
      createdAt: isoOffset(-2, 20, 6), readAt: undefined,
    },
    {
      id: 'ntf-002', memberId: 'm-001', type: 'activity_reminder', activityId: 'act-002',
      title: '活动提醒：操场间歇入门', body: cnDate(activities[1].date) + ' ' + activities[1].startTime + ' 在' + activities[1].meetingArea + '集合。第一次练间歇不用追配速，带水和毛巾，吃过午饭 2 小时后再来。',
      createdAt: isoOffset(-1, 18, 0), readAt: undefined,
    },
    {
      id: 'ntf-003', memberId: 'm-001', type: 'attendance', activityId: 'act-004',
      title: '出勤已记录：已参加', body: '校园环湖 5K 的出勤已由团长核对，记录为“已参加”。活动里程单独统计，不会和跑步记录重复计算。',
      createdAt: isoOffset(-5, 9, 8), readAt: isoOffset(-5, 9, 30),
    },
  ];

  const invites = [
    {
      id: 'inv-001', code: 'KANGFU-2026', note: '演示邀请码（可直接分享）', createdAt: isoOffset(-14, 9, 0),
      expiresAt: isoOffset(30, 23, 59), maxUses: 30, usedCount: 3, disabled: false,
    },
    {
      id: 'inv-002', code: 'QINGRUN-1101', note: '高一（3）班专场', createdAt: isoOffset(-21, 9, 0),
      expiresAt: isoOffset(8, 23, 59), maxUses: 10, usedCount: 7, disabled: false,
    },
    {
      id: 'inv-003', code: 'QINGRUN-1015', note: '校运会招募', createdAt: isoOffset(-38, 9, 0),
      expiresAt: isoOffset(-1, 23, 59), maxUses: 20, usedCount: 20, disabled: false,
    },
    {
      id: 'inv-004', code: 'QINGRUN-0920', note: '开学季体验码', createdAt: isoOffset(-63, 9, 0),
      expiresAt: isoOffset(-5, 23, 59), maxUses: 30, usedCount: 18, disabled: true,
    },
  ];

  const announcements = [
    {
      id: 'ann-001', title: '雾霾天训练调整：改到体育馆做核心', category: 'safety', pinned: true,
      content: '今天下午的操场训练改到体育馆二楼。\n\n到场后先做 10 分钟动态热身，再按年级分组做核心力量，最后一起拉伸。有哮喘或呼吸道不适的同学不用勉强参加，在群里和团长说一声即可。\n\n后续遇到空气质量预警，线下训练都会提前在公告里调整，不临时改集合点。',
      author: '林建国', status: 'published', createdAt: isoOffset(-1, 8, 10), publishedAt: isoOffset(-1, 8, 30), readBy: [],
    },
    {
      id: 'ann-002', title: '周六校园环湖 5K 集合提醒', category: 'notice', pinned: false,
      content: cnDate(activities[0].date) + ' ' + activities[0].startTime + ' 在学校东门内侧银杏树下集合，07:10 一起出发。\n\n穿跑鞋和一件防风外套，带水。路线绕校园外圈一圈，前两公里一起热身，后三公里按自己的节奏，走完也算完成。\n\n如遇雷雨或路面结冰，会在 06:30 前发公告取消。',
      author: '陈教练', status: 'published', createdAt: isoOffset(-2, 19, 0), publishedAt: isoOffset(-2, 19, 20), readBy: [],
    },
    {
      id: 'ann-003', title: '新队员第一次参加活动要带什么', category: 'training', pinned: false,
      content: '第一次来不用准备专业装备：一双合脚的跑鞋、一件干外套、一瓶水就够了。\n\n提前 10 分钟到集合点，先找带跑教练报到。训练不设关门时间，感觉不舒服随时停下，和收队教练说一声。\n\n未成年人参加线下活动，需要监护人知情并确认活动风险；集合点只在报名确认后对成员显示。',
      author: '周教练', status: 'published', createdAt: isoOffset(-5, 17, 40), publishedAt: isoOffset(-5, 18, 0), readBy: ['m-001'],
    },
    {
      id: 'ann-004', title: '期末接力赛报名安排（草稿）', category: 'notice', pinned: false,
      content: '期末接力赛初步定在 12 月 06 日，具体分组和棒次等体育组确认后发布。先收集想参加的同学名单，不提前承诺名额。',
      author: '林建国', status: 'draft', createdAt: isoOffset(0, 9, 10), readBy: [],
    },
  ];

  const runRows = [
    ['m-001', '林小满', 2, 7.2, 42.5, '公园慢跑', '周末补一次慢跑，全程能说短句。', 'manual'],
    ['m-001', '林小满', 1, 5.2, 28.7, '校园环湖', '和同学一起跑，最后一段走回来的。', 'gps'],
    ['m-001', '林小满', 0, 6.2, 37.3, '操场节奏跑', '按能说短句的强度跑完。', 'manual'],
    ['m-001', '林小满', -4, 7.4, 43.8, '放学慢跑', '', 'manual'],
    ['m-001', '林小满', -7, 5.6, 33.7, '校园环湖', '', 'manual'],
    ['m-001', '林小满', -12, 10.7, 63.5, '周末拉练', '第一次跑到 10 公里。', 'manual'],
    ['m-001', '林小满', -17, 8.2, 48.3, '公园慢跑', '', 'file'],
    ['m-005', '陈一诺', 0, 8.0, 48, '操场晨跑', '早起跑一圈。', 'manual'],
    ['m-005', '陈一诺', 1, 6.4, 38, '校园环湖', '', 'screenshot'],
    ['m-005', '陈一诺', 2, 5.0, 30, '放学慢跑', '', 'manual'],
    ['m-005', '陈一诺', 3, 3.0, 18, '热身跑', '活动前热身。', 'manual'],
    ['m-006', '周雨桐', 0, 10.0, 62, '周末长距离', '第一次跑 10 公里，最后两公里降速。', 'manual'],
    ['m-006', '周雨桐', 2, 6.8, 41, '校园环湖', '', 'gps'],
    ['m-007', '许嘉禾', 0, 11.0, 63, '河堤拉练', '', 'manual'],
    ['m-007', '许嘉禾', 1, 8.8, 50, '操场节奏跑', '快慢交替。', 'manual'],
    ['m-007', '许嘉禾', 3, 4.2, 24, '放松跑', '', 'manual'],
    ['m-008', '王予辰', 0, 6.5, 40, '和同学一起跑', '', 'manual'],
    ['m-008', '王予辰', 2, 6.0, 37, '校园环湖', '', 'manual'],
    ['m-009', '李思远', 0, 12.2, 67, '周末长距离', '后半程有点顶，但坚持跑完。', 'manual'],
    ['m-009', '李思远', 1, 8.0, 44, '操场间歇', '', 'manual'],
    ['m-009', '李思远', 3, 8.0, 45, '公园慢跑', '', 'screenshot'],
    ['m-010', '赵清和', 0, 6.1, 41, '跑走结合', '第一次连续跑 6 公里。', 'manual'],
    ['m-010', '赵清和', 2, 3.5, 23, '放学慢跑', '', 'manual'],
    ['m-011', '孙可欣', 1, 5.0, 33, '按体感跑', '没有看表。', 'manual'],
    ['m-011', '孙可欣', 3, 3.4, 22, '校园环湖', '', 'file'],
  ];
  const runs = runRows.map((row, index) => {
    const [memberId, memberName, weekOffset, distanceKm, durationMin, title, note, source] = row;
    const date = weekDate(weekOffset);
    return {
      id: 'run-' + String(index + 1).padStart(3, '0'),
      memberId, memberName, date, title, distanceKm, durationMin, note,
      source: source || 'manual', visibility: 'club',
      createdAt: date + 'T0' + (6 + (index % 3)) + ':30:00+08:00',
    };
  });

  const currentMonth = monthRange(0);
  const nextMonth = monthRange(1);
  const previousMonth = monthRange(-1);
  const challenges = [
    {
      id: 'chl-001', title: Number(currentMonth.start.slice(5, 7)) + ' 月 · 80 公里挑战',
      description: '本月累计跑满 80 公里。按个人进度记录，不做排名；私密记录和活动出勤不重复计入。',
      targetKm: 80, startDate: currentMonth.start, endDate: currentMonth.end, createdAt: isoOffset(-10, 9, 0),
    },
    {
      id: 'chl-002', title: Number(nextMonth.start.slice(5, 7)) + ' 月 · 60 公里挑战',
      description: '下个月每天动一动，累计 60 公里即可完成。开始后自动累计社团可见的跑步记录。',
      targetKm: 60, startDate: nextMonth.start, endDate: nextMonth.end, createdAt: isoOffset(-2, 20, 0),
    },
    {
      id: 'chl-003', title: Number(previousMonth.start.slice(5, 7)) + ' 月 · 60 公里挑战',
      description: '上个月的累计里程挑战，已经结束，进度只读；补录的记录不再计入。',
      targetKm: 60, startDate: previousMonth.start, endDate: previousMonth.end,
      createdAt: isoOffset(-40, 9, 0), endedAt: isoOffset(-30, 9, 0),
    },
  ];

  return { members, activities, signups, notifications, announcements, invites, runs, challenges };
}

let state = buildSeed();

function addNotification({ memberId, type, title, body, activityId, announcementId, challengeId }) {
  const notification = {
    id: 'ntf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    memberId, type, title, body,
    activityId: activityId || undefined,
    announcementId: announcementId || undefined,
    challengeId: challengeId || undefined,
    createdAt: new Date().toISOString(),
    readAt: undefined,
  };
  state.notifications.unshift(notification);
  return notification;
}

function notifyActivityMembers(activity, title, body, statuses) {
  const targets = state.signups.filter((s) => s.activityId === activity.id && statuses.includes(s.status));
  targets.forEach((signup) => addNotification({
    memberId: signup.memberId, type: 'activity_changed', activityId: activity.id, title, body,
  }));
}

function notifyAnnouncement(announcement) {
  const memberIds = [...new Set(state.signups.map((signup) => signup.memberId))];
  const flat = String(announcement.content || '').replace(/\s+/g, ' ').trim();
  memberIds.forEach((memberId) => addNotification({
    memberId,
    type: 'announcement',
    announcementId: announcement.id,
    title: '跑团公告：' + announcement.title,
    body: flat.length > 64 ? flat.slice(0, 64) + '…' : flat,
  }));
}

function removeAnnouncementNotifications(announcementId) {
  state.notifications = state.notifications.filter((item) => item.announcementId !== announcementId);
}

function normalizeAnnouncementCategory(value) {
  return ['notice', 'training', 'safety'].includes(value) ? value : 'notice';
}

function announcementTitle(value) {
  return String(value || '').trim();
}

function validateAnnouncement(title, content) {
  if (title.length < 2) return '公告标题至少 2 个字。';
  if (title.length > 60) return '公告标题不要超过 60 个字。';
  if (content.length < 10) return '公告正文至少 10 个字，写清楚时间、地点或注意事项。';
  if (content.length > 1000) return '公告正文不要超过 1000 个字。';
  return null;
}

function summarizeAnnouncement(announcement) {
  const { readBy, ...rest } = announcement;
  return { ...clone(rest), readCount: (readBy || []).length };
}

function paceLabel(distanceKm, durationMin) {
  if (!distanceKm || !durationMin) return '--';
  const seconds = Math.round((durationMin * 60) / distanceKm);
  return Math.floor(seconds / 60) + "'" + pad(seconds % 60) + '"';
}

function summarizeRun(run) {
  return { ...clone(run), pace: paceLabel(run.distanceKm, run.durationMin) };
}

function challengeStatus(challenge) {
  if (challenge.endedAt) return 'ended';
  const today = todayDate();
  if (today < challenge.startDate) return 'upcoming';
  if (today > challenge.endDate) return 'ended';
  return 'active';
}

function challengeKm(challenge, memberId) {
  return state.runs
    .filter((run) => run.memberId === memberId
      && run.date >= challenge.startDate
      && run.date <= challenge.endDate
      && run.visibility !== 'private'
      && (!challenge.endedAt || run.createdAt <= challenge.endedAt))
    .reduce((sum, run) => sum + run.distanceKm, 0);
}

function summarizeChallenge(challenge, memberId) {
  const status = challengeStatus(challenge);
  const activeMembers = state.members.filter((member) => member.status === 'active');
  const rows = activeMembers.map((member) => challengeKm(challenge, member.id));
  const total = rows.reduce((sum, km) => sum + km, 0);
  const summary = {
    ...clone(challenge),
    status,
    startAt: challenge.startDate + 'T00:00:00+08:00',
    endAt: challenge.endDate + 'T23:59:59+08:00',
    participantCount: activeMembers.length,
    completedCount: rows.filter((km) => km >= challenge.targetKm).length,
    clubProgressKm: rows.length ? Math.round((total / rows.length) * 10) / 10 : 0,
  };
  if (memberId) {
    const km = challengeKm(challenge, memberId);
    summary.myKm = Math.round(km * 10) / 10;
    summary.myPercent = Math.min(100, Math.round((km / challenge.targetKm) * 100));
    summary.myCompleted = km >= challenge.targetKm;
    const left = Math.ceil((new Date(challenge.endDate + 'T23:59:59+08:00').getTime() - Date.now()) / 86400000);
    summary.daysLeft = status === 'active' ? Math.max(0, left) : 0;
  }
  return summary;
}

function challengeOrder(challenge) {
  return { active: 0, upcoming: 1, ended: 2 }[challengeStatus(challenge)];
}

function validateChallenge(body) {
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  if (title.length < 2 || title.length > 60) return '挑战名称需要在 2 到 60 个字之间。';
  if (description.length < 5 || description.length > 300) return '挑战说明需要在 5 到 300 个字之间。';
  const targetKm = Number(body.targetKm);
  if (!Number.isFinite(targetKm) || targetKm < 1 || targetKm > 1000) return '个人目标需要在 1 到 1000 公里之间。';
  const startDate = String(body.startDate || body.startAt || '').slice(0, 10);
  const endDate = String(body.endDate || body.endAt || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return '请选择挑战的开始和结束日期。';
  if (endDate < startDate) return '结束日期不能早于开始日期。';
  return null;
}

function notifyChallenge(challenge) {
  const body = cnDate(challenge.startDate) + ' 至 ' + cnDate(challenge.endDate)
    + '，个人目标 ' + challenge.targetKm + ' 公里。只累计社团可见的跑步记录，不做排名。';
  state.members
    .filter((member) => member.status === 'active')
    .forEach((member) => addNotification({
      memberId: member.id, type: 'challenge', challengeId: challenge.id,
      title: '跑团挑战：' + challenge.title, body,
    }));
}

function changeSummary(before, after) {
  const changes = [];
  if (before.title !== after.title) changes.push('活动名称改为“' + after.title + '”');
  if (before.date !== after.date || before.startTime !== after.startTime) {
    changes.push('时间改为 ' + after.date + ' ' + after.startTime);
  }
  if (before.meetingArea !== after.meetingArea) changes.push('集合地点改为 ' + after.meetingArea);
  else if (before.meetingDetail !== after.meetingDetail) changes.push('具体集合位置已更新');
  if (before.coach !== after.coach) changes.push('带跑教练改为 ' + after.coach);
  if (before.distanceKm !== after.distanceKm) changes.push('距离改为 ' + after.distanceKm + ' km');
  if (before.intensity !== after.intensity) changes.push('强度说明已更新');
  if (before.description !== after.description) changes.push('活动安排已更新');
  if ((before.preparation || []).join('|') !== (after.preparation || []).join('|')) changes.push('出发前准备已更新');
  if (before.notes !== after.notes) changes.push('安全备注已更新');
  return changes.slice(0, 3).join('；');
}

function normalizePreparation(value) {
  const rows = Array.isArray(value) ? value : String(value || '').split(/\r?\n|；|;/);
  return rows.map((s) => String(s).trim()).filter(Boolean);
}

function summarize(activity) {
  const rows = state.signups.filter((s) => s.activityId === activity.id);
  const active = rows.filter((s) => s.status !== 'declined');
  return {
    ...clone(activity),
    signupCount: active.length,
    pendingCount: rows.filter((s) => s.status === 'pending').length,
    confirmedCount: rows.filter((s) => ['approved', 'attended', 'absent'].includes(s.status)).length,
    pendingCheckinCount: rows.filter((s) => s.status === 'approved').length,
    attendedCount: rows.filter((s) => s.status === 'attended').length,
    absentCount: rows.filter((s) => s.status === 'absent').length,
  };
}

function activitySummaryList() {
  const order = { published: 0, draft: 1, ended: 2 };
  return state.activities
    .slice()
    .sort((a, b) => order[a.status] - order[b.status] || a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .map(summarize);
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function fail(res, status, message, code) {
  json(res, status, { error: message, code: code || 'bad_request' });
}

function findActivity(id) { return state.activities.find((a) => a.id === id); }
function findSignup(id) { return state.signups.find((s) => s.id === id); }
function findMember(id) { return state.members.find((m) => m.id === id); }

function applicationView(member) {
  return {
    id: member.id,
    nickname: member.name,
    username: member.username,
    grade: member.grade,
    status: member.status === 'active' ? 'active' : member.status === 'rejected' ? 'rejected' : 'pending',
    submittedAt: member.joinedAt,
    reviewedAt: member.reviewedAt || null,
    reviewNote: member.reviewNote || '',
  };
}

function memberSort(a, b) {
  const order = { pending: 0, active: 1, rejected: 2, removed: 3 };
  return (order[a.status] ?? 9) - (order[b.status] ?? 9) || String(a.joinedAt).localeCompare(String(b.joinedAt));
}

function validateApplication(nickname, username, grade) {
  if (nickname.length < 2 || nickname.length > 20) return '昵称需要 2 到 20 个字。';
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return '用户名需要 3 到 20 位小写字母、数字或下划线。';
  if (!GRADES.includes(grade)) return '请选择年级。';
  return null;
}

function inviteStatus(invite) {
  if (invite.disabled) return 'disabled';
  if (new Date(invite.expiresAt).getTime() < Date.now()) return 'expired';
  if (invite.usedCount >= invite.maxUses) return 'used';
  return 'active';
}

function summarizeInvite(invite) {
  return {
    ...clone(invite),
    status: inviteStatus(invite),
    remaining: Math.max(0, invite.maxUses - invite.usedCount),
  };
}

function inviteIssue(invite) {
  const status = inviteStatus(invite);
  if (status === 'disabled') return '这个邀请码已停用，请向社长要一个新的邀请码。';
  if (status === 'expired') return '这个邀请码已过期，请向社长要一个新的邀请码。';
  if (status === 'used') return '这个邀请码已经用完了，请向社长要一个新的邀请码。';
  return null;
}

function findInviteByCode(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;
  return state.invites.find((invite) => invite.code.toUpperCase() === normalized) || null;
}

function validateActivity(activity) {
  if (!activity) return '活动不存在。';
  return null;
}

function checkinSignup(signup, result) {
  const activity = findActivity(signup.activityId);
  if (!activity) throw new Error('活动不存在。');
  if (activity.status !== 'ended') throw new Error('活动结束后才能签到。');
  if (signup.status === 'pending' || signup.status === 'declined') throw new Error('只有已确认报名的成员可以签到。');
  if (signup.status === result) throw new Error(result === 'attended' ? '这位成员已经签到。' : '这位成员已经标记为未到。');
  signup.status = result;
  signup.checkinAt = new Date().toISOString();
  signup.checkinNote = result === 'attended' ? '赛后签到：已到场。' : '赛后签到：未到场。';
  return signup;
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('请求内容过大。'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolveBody({});
      try { resolveBody(JSON.parse(raw)); } catch { reject(new Error('请求格式不正确。')); }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res, url) {
  const path = url.pathname.replace(/^\/api/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  const method = req.method || 'GET';

  if (method === 'OPTIONS') return json(res, 204, {});

  try {
    if (method === 'GET' && path === '/health') {
      return json(res, 200, { ok: true, activities: state.activities.length, signups: state.signups.length, notifications: state.notifications.length, announcements: state.announcements.length, members: state.members.length, invites: state.invites.length, runs: state.runs.length, challenges: state.challenges.length, serves: 'mobile/dist' });
    }

    if (method === 'POST' && path === '/reset') {
      state = buildSeed();
      return json(res, 200, { ok: true, activities: activitySummaryList(), notifications: state.notifications.length, announcements: state.announcements.length, members: state.members.length, invites: state.invites.length, runs: state.runs.length, challenges: state.challenges.length });
    }

    if (method === 'GET' && path === '/invites') {
      const order = { active: 0, used: 1, expired: 2, disabled: 3 };
      const items = state.invites
        .slice()
        .sort((a, b) => order[inviteStatus(a)] - order[inviteStatus(b)] || String(b.createdAt).localeCompare(String(a.createdAt)))
        .map(summarizeInvite);
      return json(res, 200, items);
    }

    if (method === 'POST' && path === '/invites') {
      const body = await readBody(req);
      const note = String(body.note || '').trim() || '成员邀请';
      const maxUses = Number(body.maxUses);
      const expiresInDays = Number(body.expiresInDays);
      if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100) return fail(res, 400, '使用次数需要在 1 到 100 之间。');
      if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 90) return fail(res, 400, '有效期需要在 1 到 90 天之间。');
      let code = '';
      do {
        code = 'QINGRUN-' + String(Math.floor(1000 + Math.random() * 9000));
      } while (state.invites.some((invite) => invite.code === code));
      const invite = {
        id: 'inv-' + Date.now(),
        code,
        note: note.slice(0, 40),
        createdAt: new Date().toISOString(),
        expiresAt: isoOffset(expiresInDays, 23, 59),
        maxUses,
        usedCount: 0,
        disabled: false,
      };
      state.invites.unshift(invite);
      return json(res, 201, summarizeInvite(invite));
    }

    if (method === 'POST' && path === '/invites/validate') {
      const body = await readBody(req);
      const invite = findInviteByCode(body.code);
      if (!invite) return fail(res, 400, '邀请码不对，请向社长要一个新的邀请码。');
      const issue = inviteIssue(invite);
      if (issue) return fail(res, 400, issue);
      return json(res, 200, { ok: true, invite: summarizeInvite(invite) });
    }

    const inviteId = parts[0] === 'invites' ? parts[1] : null;
    if (inviteId && method === 'PATCH' && parts.length === 2) {
      const invite = state.invites.find((item) => item.id === inviteId);
      if (!invite) return fail(res, 404, '邀请码不存在。', 'not_found');
      const body = await readBody(req);
      if (body.status !== 'disabled') return fail(res, 400, '邀请码状态不正确。');
      invite.disabled = true;
      return json(res, 200, summarizeInvite(invite));
    }

    if (method === 'GET' && path === '/members') {
      const items = state.members.slice().sort(memberSort).map((member) => clone(member));
      return json(res, 200, items);
    }

    if (method === 'GET' && path === '/runs') {
      const filterMemberId = url.searchParams.get('memberId');
      const items = state.runs
        .filter((run) => !filterMemberId || run.memberId === filterMemberId)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .map(summarizeRun);
      return json(res, 200, items);
    }

    if (method === 'POST' && path === '/runs') {
      const body = await readBody(req);
      const member = findMember(String(body.memberId || ''));
      if (!member) return fail(res, 404, '成员不存在。', 'not_found');
      const distanceKm = Math.round(Number(body.distanceKm) * 10) / 10;
      const durationMin = Math.round(Number(body.durationMin) * 10) / 10;
      if (!Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > 100) return fail(res, 400, '距离需要在 0.1 到 100 公里之间。');
      if (!Number.isFinite(durationMin) || durationMin <= 0 || durationMin > 1440) return fail(res, 400, '时长需要在 1 到 1440 分钟之间。');
      const date = String(body.date || todayDate()).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayDate()) return fail(res, 400, '记录日期不正确。');
      const source = ['gps', 'screenshot', 'file', 'manual'].includes(body.source) ? body.source : 'manual';
      const run = {
        id: 'run-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        memberId: member.id, memberName: member.name, date,
        title: String(body.title || '').trim().slice(0, 40) || '跑步记录',
        distanceKm, durationMin, note: String(body.note || '').trim().slice(0, 200),
        source, visibility: 'club', createdAt: new Date().toISOString(),
      };
      state.runs.unshift(run);
      return json(res, 201, summarizeRun(run));
    }

    if (method === 'GET' && path === '/challenges') {
      const filterMemberId = url.searchParams.get('memberId') || null;
      const items = state.challenges
        .slice()
        .sort((a, b) => challengeOrder(a) - challengeOrder(b) || b.startDate.localeCompare(a.startDate))
        .map((challenge) => summarizeChallenge(challenge, filterMemberId));
      return json(res, 200, items);
    }

    if (method === 'POST' && path === '/challenges') {
      const body = await readBody(req);
      const err = validateChallenge(body);
      if (err) return fail(res, 400, err);
      const challenge = {
        id: 'chl-' + Date.now(),
        title: String(body.title).trim(),
        description: String(body.description).trim(),
        targetKm: Number(body.targetKm),
        startDate: String(body.startDate || body.startAt).slice(0, 10),
        endDate: String(body.endDate || body.endAt).slice(0, 10),
        createdAt: new Date().toISOString(),
      };
      state.challenges.push(challenge);
      notifyChallenge(challenge);
      return json(res, 201, summarizeChallenge(challenge));
    }

    const challengeId = parts[0] === 'challenges' ? parts[1] : null;
    if (challengeId && method === 'PATCH' && parts.length === 2) {
      const challenge = state.challenges.find((item) => item.id === challengeId);
      if (!challenge) return fail(res, 404, '挑战不存在。', 'not_found');
      const body = await readBody(req);
      if (body.status !== 'ended') return fail(res, 400, '挑战状态不正确。');
      if (challengeStatus(challenge) === 'ended') return fail(res, 400, '这个挑战已经结束了。');
      challenge.endedAt = new Date().toISOString();
      return json(res, 200, summarizeChallenge(challenge));
    }

    if (method === 'POST' && path === '/member-applications') {
      const body = await readBody(req);
      const inviteCode = String(body.inviteCode || '').trim().toUpperCase();
      const invite = findInviteByCode(inviteCode);
      if (!invite) return fail(res, 400, '邀请码不对，请向社长要一个新的邀请码。');
      const inviteIssueMessage = inviteIssue(invite);
      if (inviteIssueMessage) return fail(res, 400, inviteIssueMessage);
      const nickname = String(body.nickname || '').trim();
      const username = String(body.username || '').trim().toLowerCase();
      const grade = String(body.grade || '').trim();
      const err = validateApplication(nickname, username, grade);
      if (err) return fail(res, 400, err);
      const existing = state.members.find((m) => m.username.toLowerCase() === username && m.status !== 'removed');
      if (existing && existing.status !== 'rejected') {
        return fail(res, 409, '这个用户名已经被占用了，换一个再试。', 'conflict');
      }
      const now = new Date().toISOString();
      let member = existing;
      if (member) {
        member.name = nickname;
        member.grade = grade;
        member.status = 'pending';
        member.joinedAt = now;
        member.lastActiveAt = now;
        member.reviewedAt = undefined;
        member.reviewNote = undefined;
        member.note = '通过邀请码 ' + invite.code + ' 重新提交申请。';
      } else {
        member = {
          id: 'm-' + Date.now(),
          name: nickname,
          username,
          grade,
          gender: '未填写',
          status: 'pending',
          role: 'member',
          joinedAt: now,
          lastActiveAt: now,
          weeklyKm: 0,
          totalKm: 0,
          note: '通过邀请码 ' + invite.code + ' 提交申请。',
        };
        state.members.unshift(member);
      }
      if (!existing) invite.usedCount = Math.min(invite.maxUses, invite.usedCount + 1);
      return json(res, 201, { application: applicationView(member), member: clone(member) });
    }

    const applicationId = parts[0] === 'member-applications' ? parts[1] : null;
    if (applicationId && method === 'GET' && parts.length === 2) {
      const member = findMember(applicationId);
      if (!member) return fail(res, 404, '入团申请不存在。', 'not_found');
      return json(res, 200, applicationView(member));
    }

    const memberId = parts[0] === 'members' ? parts[1] : null;
    if (memberId) {
      const member = findMember(memberId);
      if (!member) return fail(res, 404, '成员不存在。', 'not_found');

      if (method === 'GET' && parts.length === 2) return json(res, 200, clone(member));

      if (method === 'PATCH' && parts.length === 2) {
        const body = await readBody(req);
        const status = body.status;
        if (!['active', 'rejected', 'removed'].includes(status)) return fail(res, 400, '成员状态不正确。');
        if (member.role === 'owner' && status !== 'active') return fail(res, 400, '社长账号不能被移出或拒绝。');
        if (member.status === status) return fail(res, 400, '这条申请已经处理过了。');
        if (member.status === 'removed' && status !== 'active') return fail(res, 400, '成员已经被移出社团。');
        const now = new Date().toISOString();
        member.status = status;
        if (status === 'active') {
          member.reviewedAt = now;
          member.reviewNote = String(body.reviewNote || '').trim() || '已通过审批，成员端会同步看到结果。';
          member.lastActiveAt = now;
        } else if (status === 'rejected') {
          member.reviewedAt = now;
          member.reviewNote = String(body.reviewNote || '').trim() || '资料还不完整，请补充后重新申请。';
        } else {
          member.reviewedAt = now;
          member.reviewNote = String(body.reviewNote || '').trim() || '已由社长移出社团。';
        }
        return json(res, 200, clone(member));
      }

      if (method === 'POST' && parts[2] === 'reset-password') {
        const tail = Math.random().toString(36).slice(2, 8).toUpperCase();
        return json(res, 200, { password: 'QR-' + tail });
      }
    }

    if (method === 'GET' && path === '/member/notifications') {
      const memberId = url.searchParams.get('memberId') || 'm-001';
      const items = state.notifications
        .filter((item) => item.memberId === memberId)
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return json(res, 200, { items, unread: items.filter((item) => !item.readAt).length });
    }

    if (method === 'POST' && path === '/member/notifications/read-all') {
      const body = await readBody(req);
      const memberId = String(body.memberId || 'm-001');
      const readAt = new Date().toISOString();
      let changed = 0;
      state.notifications.forEach((item) => {
        if (item.memberId === memberId && !item.readAt) { item.readAt = readAt; changed += 1; }
      });
      return json(res, 200, { ok: true, changed });
    }

    if (method === 'GET' && path === '/announcements') {
      const order = { published: 0, draft: 1 };
      const items = state.announcements
        .slice()
        .sort((a, b) => order[a.status] - order[b.status]
          || Number(b.pinned) - Number(a.pinned)
          || (b.publishedAt || b.createdAt).localeCompare(a.publishedAt || a.createdAt))
        .map(summarizeAnnouncement);
      return json(res, 200, items);
    }

    if (method === 'POST' && path === '/announcements') {
      const body = await readBody(req);
      const title = announcementTitle(body.title);
      const content = String(body.content || '').trim();
      const err = validateAnnouncement(title, content);
      if (err) return fail(res, 400, err);
      const announcement = {
        id: 'ann-' + Date.now(),
        title,
        content,
        category: normalizeAnnouncementCategory(body.category),
        pinned: Boolean(body.pinned),
        author: '林建国',
        status: 'draft',
        createdAt: new Date().toISOString(),
        readBy: [],
      };
      state.announcements.unshift(announcement);
      return json(res, 201, summarizeAnnouncement(announcement));
    }

    if (method === 'GET' && path === '/member/announcements') {
      const memberId = url.searchParams.get('memberId') || 'm-001';
      const items = state.announcements
        .filter((item) => item.status === 'published')
        .slice()
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')))
        .map((item) => {
          const { readBy, ...rest } = item;
          return { ...clone(rest), read: (readBy || []).includes(memberId) };
        });
      return json(res, 200, items);
    }

    const announcementId = parts[0] === 'announcements' ? parts[1] : null;
    if (announcementId) {
      const announcement = state.announcements.find((item) => item.id === announcementId);
      if (!announcement) return fail(res, 404, '公告不存在。', 'not_found');

      if (method === 'PATCH' && parts.length === 2) {
        const body = await readBody(req);
        if (body.title !== undefined || body.content !== undefined) {
          const title = body.title !== undefined ? announcementTitle(body.title) : announcement.title;
          const content = body.content !== undefined ? String(body.content || '').trim() : announcement.content;
          const err = validateAnnouncement(title, content);
          if (err) return fail(res, 400, err);
          announcement.title = title;
          announcement.content = content;
        }
        if (body.category !== undefined) announcement.category = normalizeAnnouncementCategory(body.category);
        if (body.pinned !== undefined) announcement.pinned = Boolean(body.pinned);
        if (body.status !== undefined) {
          if (body.status !== 'published' && body.status !== 'draft') return fail(res, 400, '公告状态不正确。');
          if (body.status === 'published') {
            if (announcement.status === 'published') return fail(res, 400, '公告已经发布过了。');
            announcement.status = 'published';
            announcement.publishedAt = new Date().toISOString();
            notifyAnnouncement(announcement);
          } else {
            announcement.status = 'draft';
            announcement.publishedAt = undefined;
            removeAnnouncementNotifications(announcement.id);
          }
        }
        return json(res, 200, summarizeAnnouncement(announcement));
      }

      if (method === 'DELETE' && parts.length === 2) {
        state.announcements = state.announcements.filter((item) => item.id !== announcement.id);
        removeAnnouncementNotifications(announcement.id);
        return json(res, 200, { ok: true });
      }

      if (method === 'POST' && parts[2] === 'read') {
        const body = await readBody(req);
        const memberId = String(body.memberId || 'm-001');
        announcement.readBy = announcement.readBy || [];
        if (!announcement.readBy.includes(memberId)) announcement.readBy.push(memberId);
        return json(res, 200, { id: announcement.id, read: true });
      }
    }

    if (method === 'GET' && path === '/member/activities') {
      const memberId = url.searchParams.get('memberId') || 'm-001';
      const rows = activitySummaryList()
        .filter((activity) => activity.status !== 'draft')
        .map((activity) => ({
          ...activity,
          mySignup: clone(state.signups.find((s) => s.activityId === activity.id && s.memberId === memberId) || null),
        }));
      return json(res, 200, rows);
    }

    if (method === 'GET' && path === '/activities') {
      return json(res, 200, activitySummaryList());
    }

    if (method === 'POST' && path === '/activities') {
      const body = await readBody(req);
      const title = String(body.title || '').trim();
      const meetingArea = String(body.meetingArea || '').trim();
      const coach = String(body.coach || '').trim();
      const description = String(body.description || '').trim();
      if (title.length < 2) return fail(res, 400, '活动名称至少 2 个字。');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date || ''))) return fail(res, 400, '请选择活动日期。');
      if (body.date < todayDate()) return fail(res, 400, '活动日期不能早于今天。');
      if (!/^\d{2}:\d{2}$/.test(String(body.startTime || ''))) return fail(res, 400, '请选择集合时间。');
      if (!meetingArea) return fail(res, 400, '请填写集合地点。');
      if (!coach) return fail(res, 400, '请填写带跑教练。');
      if (!Number.isFinite(Number(body.distanceKm)) || Number(body.distanceKm) < 1 || Number(body.distanceKm) > 100) return fail(res, 400, '距离需要在 1 到 100 公里之间。');
      if (!Number.isFinite(Number(body.durationMin)) || Number(body.durationMin) < 5 || Number(body.durationMin) > 600) return fail(res, 400, '预计时长需要在 5 到 600 分钟之间。');
      if (!Number.isFinite(Number(body.capacity)) || Number(body.capacity) < 1 || Number(body.capacity) > 200) return fail(res, 400, '人数上限需要在 1 到 200 之间。');
      if (description.length < 10) return fail(res, 400, '活动说明至少 10 个字，写清楚路线和强度。');
      if (state.activities.some((a) => a.status !== 'ended' && a.date === body.date && a.startTime === body.startTime)) {
        return fail(res, 409, '同一天同一时间已有活动，先调整时间。', 'conflict');
      }
      const activity = {
        id: 'act-' + Date.now(), title, tag: body.tag, date: body.date, startTime: body.startTime,
        meetingArea, meetingDetail: String(body.meetingDetail || '').trim(),
        distanceKm: Number(body.distanceKm), durationMin: Number(body.durationMin), capacity: Number(body.capacity),
        coach, intensity: String(body.intensity || '').trim() || '按自己的节奏跑', description,
        preparation: normalizePreparation(body.preparation),
        notes: String(body.notes || '').trim(), status: 'published', createdAt: new Date().toISOString(),
      };
      state.activities.unshift(activity);
      return json(res, 201, { ...activity });
    }

    const activityId = parts[0] === 'activities' ? parts[1] : null;
    if (activityId) {
      const activity = findActivity(activityId);
      const err = validateActivity(activity);
      if (err) return fail(res, 404, err, 'not_found');

      if (method === 'GET' && parts.length === 2) return json(res, 200, summarize(activity));
      if (method === 'PATCH' && parts.length === 2) {
        if (activity.status === 'ended') return fail(res, 400, '活动已结束，不能再修改。');
        const body = await readBody(req);
        const title = String(body.title || '').trim();
        const meetingArea = String(body.meetingArea || '').trim();
        const coach = String(body.coach || '').trim();
        const description = String(body.description || '').trim();
        if (title.length < 2) return fail(res, 400, '活动名称至少 2 个字。');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date || ''))) return fail(res, 400, '请选择活动日期。');
        if (body.date < todayDate()) return fail(res, 400, '活动日期不能早于今天。');
        if (!/^\d{2}:\d{2}$/.test(String(body.startTime || ''))) return fail(res, 400, '请选择集合时间。');
        if (!meetingArea) return fail(res, 400, '请填写集合地点。');
        if (!coach) return fail(res, 400, '请填写带跑教练。');
        if (!Number.isFinite(Number(body.distanceKm)) || Number(body.distanceKm) < 1 || Number(body.distanceKm) > 100) return fail(res, 400, '距离需要在 1 到 100 公里之间。');
        if (!Number.isFinite(Number(body.durationMin)) || Number(body.durationMin) < 5 || Number(body.durationMin) > 600) return fail(res, 400, '预计时长需要在 5 到 600 分钟之间。');
        if (!Number.isFinite(Number(body.capacity)) || Number(body.capacity) < 1 || Number(body.capacity) > 200) return fail(res, 400, '人数上限需要在 1 到 200 之间。');
        if (description.length < 10) return fail(res, 400, '活动说明至少 10 个字，写清楚路线和强度。');
        const activeCount = state.signups.filter((s) => s.activityId === activity.id && s.status !== 'declined').length;
        if (Number(body.capacity) < activeCount) return fail(res, 400, '人数上限不能小于当前报名人数（' + activeCount + ' 人）。');
        if (state.activities.some((a) => a.id !== activity.id && a.status !== 'ended' && a.date === body.date && a.startTime === body.startTime)) {
          return fail(res, 409, '同一天同一时间已有活动，先调整时间。', 'conflict');
        }
        const before = clone(activity);
        activity.title = title;
        activity.tag = body.tag;
        activity.date = body.date;
        activity.startTime = body.startTime;
        activity.meetingArea = meetingArea;
        activity.meetingDetail = String(body.meetingDetail || '').trim();
        activity.distanceKm = Number(body.distanceKm);
        activity.durationMin = Number(body.durationMin);
        activity.capacity = Number(body.capacity);
        activity.coach = coach;
        activity.intensity = String(body.intensity || '').trim() || '按自己的节奏跑';
        activity.description = description;
        activity.preparation = normalizePreparation(body.preparation);
        activity.notes = String(body.notes || '').trim();
        if (activity.status === 'published') {
          const summary = changeSummary(before, activity);
          if (summary) {
            notifyActivityMembers(
              activity,
              '活动信息有变更：' + activity.title,
              '团长更新了活动信息：' + summary + '。出发前请再确认一次集合时间和地点。',
              ['pending', 'approved'],
            );
          }
        }
        return json(res, 200, summarize(activity));
      }
      if (method === 'GET' && parts[2] === 'signups') {
        const order = { pending: 0, approved: 1, attended: 2, absent: 3, declined: 4 };
        const rows = state.signups.filter((s) => s.activityId === activity.id).sort((a, b) => order[a.status] - order[b.status] || b.createdAt.localeCompare(a.createdAt));
        return json(res, 200, rows);
      }
      if (method === 'POST' && parts[2] === 'publish') {
        if (activity.status !== 'draft') return fail(res, 400, '只有草稿可以发布。');
        if (activity.date < todayDate()) return fail(res, 400, '活动日期已过去，请先调整日期。');
        activity.status = 'published';
        return json(res, 200, activity);
      }
      if (method === 'POST' && parts[2] === 'end') {
        if (activity.status !== 'published') return fail(res, 400, '只有报名中的活动可以结束。');
        activity.status = 'ended';
        const endedTargets = state.signups
          .filter((s) => s.activityId === activity.id && ['pending', 'approved'].includes(s.status))
          .map((s) => ({ memberId: s.memberId, wasPending: s.status === 'pending' }));
        endedTargets.forEach((target) => addNotification({
          memberId: target.memberId, type: 'activity_ended', activityId: activity.id,
          title: '活动已结束：' + activity.title,
          body: target.wasPending
            ? '这场活动已结束，未确认的报名已自动关闭。可以关注跑团下一场活动。'
            : '这场活动已结束，出勤记录会由团长在赛后核对。',
        }));
        const reviewedAt = new Date().toISOString();
        state.signups.filter((s) => s.activityId === activity.id && s.status === 'pending').forEach((s) => {
          s.status = 'declined'; s.reviewedAt = reviewedAt; s.reviewNote = '活动已结束，系统关闭未确认报名。';
        });
        return json(res, 200, activity);
      }
      if (method === 'POST' && parts[2] === 'signup') {
        const body = await readBody(req);
        const memberId = String(body.memberId || 'm-001');
        const member = MEMBERS[memberId];
        if (!member) return fail(res, 400, '演示成员不存在。');
        if (activity.status !== 'published') return fail(res, 409, '这场活动已经结束。', 'closed');
        let signup = state.signups.find((s) => s.activityId === activity.id && s.memberId === memberId);
        if (signup && ['pending', 'approved', 'attended', 'absent'].includes(signup.status)) return fail(res, 409, '你已经报过这场活动了。', 'already');
        const active = state.signups.filter((s) => s.activityId === activity.id && ['pending', 'approved', 'attended', 'absent'].includes(s.status));
        if (active.length >= activity.capacity) return fail(res, 409, '名额刚好满了，可以看看其他场次。', 'full');
        if (signup) {
          signup.status = 'pending';
          signup.reviewedAt = undefined; signup.reviewNote = undefined; signup.checkinAt = undefined; signup.checkinNote = undefined;
          signup.createdAt = new Date().toISOString();
        } else {
          signup = {
            id: 'sg-' + Date.now(), activityId: activity.id, memberId, memberName: member.name, grade: member.grade,
            gender: member.gender, guardianName: member.guardianName, guardianPhone: member.guardianPhone,
            guardianConsent: true, note: String(body.note || '成员在手机端提交报名。'), status: 'pending', createdAt: new Date().toISOString(),
          };
          state.signups.push(signup);
        }
        return json(res, 201, { signup: clone(signup), activity: summarize(activity) });
      }
    }

    const notificationId = parts[0] === 'notifications' ? parts[1] : null;
    if (notificationId && method === 'POST' && parts[2] === 'read') {
      const notification = state.notifications.find((item) => item.id === notificationId);
      if (!notification) return fail(res, 404, '消息不存在。', 'not_found');
      notification.readAt = new Date().toISOString();
      return json(res, 200, notification);
    }

    const signupId = parts[0] === 'signups' ? parts[1] : null;
    if (signupId) {
      const signup = findSignup(signupId);
      if (!signup) return fail(res, 404, '报名记录不存在。', 'not_found');
      const activity = findActivity(signup.activityId);

      if (method === 'POST' && parts[2] === 'cancel') {
        if (signup.status !== 'pending' && signup.status !== 'approved') {
          return fail(res, 400, signup.status === 'declined' ? '这条报名已经取消过了。' : '活动已经结束，签到记录不能取消。');
        }
        signup.status = 'declined';
        signup.reviewedAt = new Date().toISOString();
        signup.reviewNote = '成员在手机端取消报名。';
        return json(res, 200, { signup: clone(signup), activity: summarize(activity) });
      }
      if (method === 'POST' && parts[2] === 'consent') {
        if (signup.guardianConsent) return fail(res, 400, '监护人同意已经登记过了。');
        if (signup.status !== 'pending') return fail(res, 400, '只有待确认的报名可以补登记监护人同意。');
        signup.guardianConsent = true;
        return json(res, 200, signup);
      }
      if (method === 'POST' && parts[2] === 'review') {
        const body = await readBody(req);
        if (activity.status !== 'published') return fail(res, 400, '活动不在报名中，不能修改报名状态。');
        if (signup.status !== 'pending') return fail(res, 400, '这条报名已经处理过了。');
        const decision = body.decision;
        if (decision !== 'approved' && decision !== 'declined') return fail(res, 400, '报名处理方式不正确。');
        if (decision === 'approved') {
          if (!signup.guardianConsent) return fail(res, 400, '监护人同意还没登记，先联系监护人补充，再确认报名。');
          const confirmed = state.signups.filter((s) => s.activityId === activity.id && ['approved', 'attended', 'absent'].includes(s.status)).length;
          if (confirmed >= activity.capacity) return fail(res, 400, '名额已满，无法再确认报名。');
        }
        signup.status = decision;
        signup.reviewedAt = new Date().toISOString();
        signup.reviewNote = String(body.note || '').trim() || (decision === 'approved' ? '团长已确认，集合点已开放。' : '团长已取消报名。');
        if (decision === 'approved') {
          addNotification({
            memberId: signup.memberId, type: 'activity_confirmed', activityId: activity.id,
            title: '报名已确认：' + activity.title,
            body: '团长已确认你的报名。' + activity.date + ' ' + activity.startTime + ' 在' + activity.meetingArea + '集合，具体位置：' + (activity.meetingDetail || activity.meetingArea) + '。',
          });
        } else {
          addNotification({
            memberId: signup.memberId, type: 'activity_declined', activityId: activity.id,
            title: '报名未通过：' + activity.title,
            body: '团长取消了你在这场活动的报名。原因：' + signup.reviewNote,
          });
        }
        return json(res, 200, signup);
      }
      if (method === 'POST' && parts[2] === 'checkin') {
        const body = await readBody(req);
        if (body.result !== 'attended' && body.result !== 'absent') return fail(res, 400, '签到结果不正确。');
        try { checkinSignup(signup, body.result); } catch (e) { return fail(res, 400, e.message); }
        addNotification({
          memberId: signup.memberId, type: 'attendance', activityId: activity.id,
          title: body.result === 'attended' ? '出勤已记录：已参加' : '出勤已记录：未到',
          body: body.result === 'attended'
            ? '团长记录了你在“' + activity.title + '”的出勤：已参加。活动里程单独统计，不会和跑步记录重复计算。'
            : '团长记录了你在“' + activity.title + '”的出勤：未到。如有疑问，可以联系团长核对。',
        });
        return json(res, 200, signup);
      }
      if (method === 'POST' && parts[2] === 'reset-checkin') {
        if (activity.status !== 'ended') return fail(res, 400, '只有已结束的活动可以撤销签到。');
        if (signup.status !== 'attended' && signup.status !== 'absent') return fail(res, 400, '这条报名还没有签到记录。');
        signup.status = 'approved';
        signup.checkinAt = undefined;
        signup.checkinNote = undefined;
        addNotification({
          memberId: signup.memberId, type: 'attendance', activityId: activity.id,
          title: '出勤记录已撤销：' + activity.title,
          body: '团长撤销了这场活动的出勤记录，报名回到“已确认”。如果需要，可以联系团长重新核对。',
        });
        return json(res, 200, signup);
      }
    }

    return fail(res, 404, '接口不存在。', 'not_found');
  } catch (error) {
    return fail(res, 400, error instanceof Error ? error.message : '请求失败。');
  }
}

function resolveFile(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const target = resolve(ROOT, '.' + decoded);
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return null;
  return target;
}

async function serveStatic(req, res, url) {
  let file = resolveFile(url.pathname);
  if (!file) { res.writeHead(403); res.end('Forbidden'); return; }
  let info = null;
  try { info = await stat(file); } catch {}
  if (info?.isDirectory()) {
    file = resolve(file, 'index.html');
    try { info = await stat(file); } catch {}
  }
  if (!info?.isFile() && !extname(url.pathname)) {
    file = resolve(ROOT, 'index.html');
    try { info = await stat(file); } catch {}
  }
  if (!info?.isFile()) { res.writeHead(404); res.end('Not Found'); return; }
  const data = await readFile(file);
  res.writeHead(200, {
    'Content-Type': MIME[extname(file)] || 'application/octet-stream',
    'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600',
  });
  res.end(data);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost'));
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return await serveStatic(req, res, url);
  } catch (error) {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
    console.error('[mock-api]', error);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Qingrun prototype: http://127.0.0.1:' + PORT);
  console.log('Mock API: http://127.0.0.1:' + PORT + '/api/health');
  console.log('Static root: ' + ROOT);
  console.log('Seed data: ' + DATA_FILE);
});