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

function buildSeed() {
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
      title: '报名已确认：校园环湖 5K', body: '团长已确认你的报名。11 月 22 日 07:00 在学校东门集合，具体位置：东门内侧银杏树下。',
      createdAt: isoOffset(-2, 20, 6), readAt: undefined,
    },
    {
      id: 'ntf-002', memberId: 'm-001', type: 'activity_reminder', activityId: 'act-002',
      title: '活动提醒：操场间歇入门', body: '11 月 23 日 16:30 在学校田径场集合。第一次练间歇不用追配速，带水和毛巾，吃过午饭 2 小时后再来。',
      createdAt: isoOffset(-1, 18, 0), readAt: undefined,
    },
    {
      id: 'ntf-003', memberId: 'm-001', type: 'attendance', activityId: 'act-004',
      title: '出勤已记录：已参加', body: '校园环湖 5K 的出勤已由团长核对，记录为“已参加”。活动里程单独统计，不会和跑步记录重复计算。',
      createdAt: isoOffset(-5, 9, 8), readAt: isoOffset(-5, 9, 30),
    },
  ];

  return { activities, signups, notifications };
}

let state = buildSeed();

function addNotification({ memberId, type, title, body, activityId }) {
  const notification = {
    id: 'ntf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    memberId, type, title, body,
    activityId: activityId || undefined,
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
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function fail(res, status, message, code) {
  json(res, status, { error: message, code: code || 'bad_request' });
}

function findActivity(id) { return state.activities.find((a) => a.id === id); }
function findSignup(id) { return state.signups.find((s) => s.id === id); }

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
      return json(res, 200, { ok: true, activities: state.activities.length, signups: state.signups.length, notifications: state.notifications.length, serves: 'mobile/dist' });
    }

    if (method === 'POST' && path === '/reset') {
      state = buildSeed();
      return json(res, 200, { ok: true, activities: activitySummaryList(), notifications: state.notifications.length });
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