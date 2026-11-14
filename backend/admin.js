// ============================================================
// 管理员后台接口：只有 role = 'admin' 的用户能访问
// 管理范围（完完全全管理）：
//   1. 系统概览
//   2. 用户：查询 / 新增 / 编辑（昵称、性别、角色、手机号、学校、社团、头像）/ 重置密码 / 删除
//   3. 跑步记录：查询 / 修改 / 删除
//   4. 训练计划：查询 / 修改 / 删除
//   5. 学校 / 社团：查询 / 新增 / 修改 / 删除
//   6. 社团内容：公告 / 任务 / 约跑活动 的查询与删除
//   7. 计划模板：新增 / 删除
// 所有接口都要求管理员身份（adminRequired）
// ============================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { authRequired } = require('./auth');
// 审批结果通过站内通知告诉申请人
const { notify, notifyAll } = require('./notify');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const GOAL_TYPES = ['volume', 'speed', 'habit', 'race', 'weight'];
const ROLES = ['member', 'president', 'admin'];

// 管理员权限校验：先校验登录，再校验角色是 admin
function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '只有管理员能访问后台' });
    }
    next();
  });
}

// 这个文件里的所有接口都要求管理员
router.use(adminRequired);

// ============================================================
// 通用小工具
// ============================================================

// 删除一个用户的全部关联数据（用户管理 / 学校社团清理都会用到）
// 说明：数据库里没有外键级联，所以必须手动按顺序删干净，避免留下孤儿数据
function deleteUserCascade(id) {
  // 他发起的活动：先删签到与报名，再删活动
  db.prepare('DELETE FROM event_checkins WHERE event_id IN (SELECT id FROM club_events WHERE user_id = ?)').run(id);
  db.prepare('DELETE FROM event_signups WHERE event_id IN (SELECT id FROM club_events WHERE user_id = ?)').run(id);
  db.prepare('DELETE FROM club_events WHERE user_id = ?').run(id);
  // 他报名的活动 / 被签到的记录
  db.prepare('DELETE FROM event_signups WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM event_checkins WHERE user_id = ?').run(id);
  // 他发的公告 / 任务
  db.prepare('DELETE FROM announcements WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM club_tasks WHERE user_id = ?').run(id);
  // 他的社长申请记录 / 入社退社申请记录
  db.prepare('DELETE FROM president_applications WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM membership_requests WHERE user_id = ?').run(id);
  // 跑步详细数据 → 跑步记录
  db.prepare('DELETE FROM run_details WHERE run_id IN (SELECT id FROM runs WHERE user_id = ?)').run(id);
  db.prepare('DELETE FROM runs WHERE user_id = ?').run(id);
  // 计划（含课表打卡记录）/ 体重 / 静息心率 / 登录凭证
  db.prepare('DELETE FROM plan_checkins WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM plans WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM weight_logs WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM resting_heart_logs WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM tokens WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

// 删除一个社团及其全部内容（不删用户；有成员时外部已拦截）
function deleteClubCascade(clubId) {
  db.prepare('DELETE FROM event_checkins WHERE event_id IN (SELECT id FROM club_events WHERE club_id = ?)').run(clubId);
  db.prepare('DELETE FROM event_signups WHERE event_id IN (SELECT id FROM club_events WHERE club_id = ?)').run(clubId);
  db.prepare('DELETE FROM club_events WHERE club_id = ?').run(clubId);
  db.prepare('DELETE FROM announcements WHERE club_id = ?').run(clubId);
  db.prepare('DELETE FROM club_tasks WHERE club_id = ?').run(clubId);
  // 该社团的入社 / 退社申请记录
  db.prepare('DELETE FROM membership_requests WHERE club_id = ?').run(clubId);
}

// 校验学校 / 社团归属：社团必须属于该学校
// 返回 { schoolId, clubId } 或 { error }
function resolveSchoolClub(schoolIdRaw, clubIdRaw) {
  const schoolId = Number(schoolIdRaw);
  const clubId = Number(clubIdRaw);
  if (!Number.isFinite(schoolId) || schoolId <= 0) return { error: '学校编号不正确' };
  const school = db.prepare('SELECT id FROM schools WHERE id = ?').get(schoolId);
  if (!school) return { error: '学校不存在' };
  if (Number.isFinite(clubId) && clubId > 0) {
    const club = db.prepare('SELECT id, school_id FROM clubs WHERE id = ?').get(clubId);
    if (!club) return { error: '社团不存在' };
    if (club.school_id !== schoolId) return { error: '该社团不属于所选学校' };
    return { schoolId, clubId };
  }
  // 没传社团：自动落到该校第一个社团；学校还没社团则报错
  const first = db.prepare('SELECT id FROM clubs WHERE school_id = ? ORDER BY id LIMIT 1').get(schoolId);
  if (!first) return { error: '该学校还没有社团，请先在"学校社团"里创建' };
  return { schoolId, clubId: first.id };
}

// ============================================================
// 1. 系统概览
// ============================================================
router.get('/overview', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) c FROM users WHERE deleted_at IS NULL').get().c;
  const totalRuns = db.prepare('SELECT COUNT(*) c FROM runs').get().c;
  const totalKm = db.prepare('SELECT COALESCE(SUM(distance_km), 0) s FROM runs').get().s;
  const totalSchools = db.prepare('SELECT COUNT(*) c FROM schools').get().c;
  const totalClubs = db.prepare('SELECT COUNT(*) c FROM clubs').get().c;
  const totalPlans = db.prepare('SELECT COUNT(*) c FROM plans').get().c;
  const totalEvents = db.prepare('SELECT COUNT(*) c FROM club_events').get().c;
  const totalArticles = db.prepare('SELECT COUNT(*) c FROM articles').get().c;
  const pendingApplications = db.prepare("SELECT COUNT(*) c FROM president_applications WHERE status = 'pending'").get().c;
  res.json({
    totalUsers,
    totalRuns,
    totalKm: Number(totalKm),
    totalSchools,
    totalClubs,
    totalPlans,
    totalEvents,
    totalArticles,
    pendingApplications,
  });
});

// ============================================================
// 1.5 数据看板（N10）：趋势 / 分布 / 对比 数据，只读统计，不影响任何业务
// ============================================================
// 返回结构：
//   new_users_trend      近 30 天每天新增用户数       [{date, count}]
//   active_users_trend   近 30 天每天有跑步的去重用户数 [{date, count}]
//   weekly_km_trend      近 12 周每周总跑量           [{week_start, km}]
//   club_comparison      社团总跑量 TOP10（含成员数）  [{club_name, school_name, km, members}]
//   role_distribution    用户角色分布                 [{role, count}]
//   plan_status_distribution 计划状态分布（按日期推算） [{status, count}]
//   extra                今日新增 / 今日跑步 / 本周活跃 / 人均跑量
router.get('/dashboard', (req, res) => {
  // ---- 工具：生成最近 n 天的日期序列（YYYY-MM-DD，含今天，升序）----
  function lastNDays(n) {
    const out = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      out.push(`${y}-${m}-${day}`);
    }
    return out;
  }
  // 某个日期所在周的周一（YYYY-MM-DD）
  function mondayOf(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7);
    const y = monday.getFullYear();
    const m = String(monday.getMonth() + 1).padStart(2, '0');
    const day = String(monday.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const days30 = lastNDays(30);
  const start30 = days30[0];
  const today = days30[days30.length - 1];

  // ---- 近 30 天新增用户趋势（created_at 是 datetime，取日期部分）----
  const newUserRows = db.prepare(
    "SELECT date(created_at) AS d, COUNT(*) AS c FROM users WHERE date(created_at) >= ? GROUP BY date(created_at)"
  ).all(start30);
  const newUserMap = Object.fromEntries(newUserRows.map((r) => [r.d, r.c]));
  const newUsersTrend = days30.map((d) => ({ date: d, count: newUserMap[d] || 0 }));

  // ---- 近 30 天活跃用户趋势（当天有跑步记录的去重用户数）----
  const activeRows = db.prepare(
    'SELECT run_date AS d, COUNT(DISTINCT user_id) AS c FROM runs WHERE run_date >= ? GROUP BY run_date'
  ).all(start30);
  const activeMap = Object.fromEntries(activeRows.map((r) => [r.d, r.c]));
  const activeUsersTrend = days30.map((d) => ({ date: d, count: activeMap[d] || 0 }));

  // ---- 近 12 周跑量趋势：先查近 84 天所有记录，再按周一聚合 ----
  const kmRows = db.prepare(
    'SELECT run_date, distance_km FROM runs WHERE run_date >= ?'
  ).all(lastNDays(84)[0]);
  const weekMap = {};
  for (const r of kmRows) {
    const w = mondayOf(r.run_date);
    weekMap[w] = (weekMap[w] || 0) + r.distance_km;
  }
  // 生成近 12 周周一序列（升序）
  const thisMonday = mondayOf(today);
  const weeks12 = [];
  {
    const d = new Date(`${thisMonday}T00:00:00`);
    for (let i = 11; i >= 0; i--) {
      const w = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i * 7);
      const y = w.getFullYear();
      const m = String(w.getMonth() + 1).padStart(2, '0');
      const day = String(w.getDate()).padStart(2, '0');
      weeks12.push(`${y}-${m}-${day}`);
    }
  }
  const weeklyKmTrend = weeks12.map((w) => ({
    week_start: w,
    km: Math.round((weekMap[w] || 0) * 100) / 100,
  }));

  // ---- 社团对比：总跑量 TOP10（含成员数；无社团用户不参与）----
  const clubComparison = db.prepare(`
    SELECT c.id AS club_id, c.name AS club_name, s.name AS school_name,
           COUNT(DISTINCT u.id) AS members,
           ROUND(COALESCE(SUM(r.distance_km), 0), 1) AS km
    FROM clubs c
    LEFT JOIN schools s ON s.id = c.school_id
    LEFT JOIN users u ON u.club_id = c.id AND u.deleted_at IS NULL
    LEFT JOIN runs r ON r.user_id = u.id
    GROUP BY c.id
    ORDER BY km DESC, c.id
    LIMIT 10
  `).all();

  // ---- 用户角色分布 ----
  const roleDistribution = db.prepare(
    'SELECT role, COUNT(*) AS count FROM users WHERE deleted_at IS NULL GROUP BY role'
  ).all();

  // ---- 计划状态分布：plans 表无 status 字段，按日期窗口推算 ----
  // 未开始：start_date 在今天之后；已结束：最后一周的周日（周一为一周起点）在今天之前；其余进行中
  const planStatusDistribution = db.prepare(`
    SELECT CASE
             WHEN start_date > date('now','localtime') THEN '未开始'
             WHEN date(start_date,
                       '-' || ((CAST(strftime('%w', start_date) AS INTEGER) + 6) % 7) || ' days',
                       '+' || (weeks * 7 - 1) || ' days') < date('now','localtime') THEN '已结束'
             ELSE '进行中'
           END AS status,
           COUNT(*) AS count
    FROM plans
    GROUP BY status
  `).all();

  // ---- 额外核心指标 ----
  const todayNewUsers = db.prepare(
    "SELECT COUNT(*) c FROM users WHERE date(created_at) = ? AND deleted_at IS NULL"
  ).get(today).c;
  const todayRuns = db.prepare('SELECT COUNT(*) c FROM runs WHERE run_date = ?').get(today).c;
  const weekActiveUsers = db.prepare(
    'SELECT COUNT(DISTINCT user_id) c FROM runs WHERE run_date >= ?'
  ).get(thisMonday).c;
  const totals = db.prepare(`
    SELECT (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS users,
           COALESCE((SELECT SUM(distance_km) FROM runs), 0) AS km
  `).get();
  const avgKmPerUser = totals.users > 0 ? Math.round((totals.km / totals.users) * 100) / 100 : 0;

  res.json({
    new_users_trend: newUsersTrend,
    active_users_trend: activeUsersTrend,
    weekly_km_trend: weeklyKmTrend,
    club_comparison: clubComparison,
    role_distribution: roleDistribution,
    plan_status_distribution: planStatusDistribution,
    extra: {
      today_new_users: todayNewUsers,
      today_runs: todayRuns,
      week_active_users: weekActiveUsers,
      avg_km_per_user: avgKmPerUser,
    },
  });
});

// ============================================================
// 2. 用户管理
// ============================================================

// 所有用户列表（支持 ?q=昵称/手机号关键词，?role=角色，?club_id=社团，?deleted=1 查回收站）
router.get('/users', (req, res) => {
  const q = String(req.query.q || '').trim();
  const role = String(req.query.role || '').trim();
  const clubId = Number(req.query.club_id);
  const inBin = String(req.query.deleted || '') === '1'; // 回收站模式：只看已软删除的

  let sql = `
    SELECT u.id, u.phone, u.nickname, u.gender, u.role, u.avatar,
           u.school_id, u.club_id, u.created_at, u.deleted_at,
           s.name AS school_name, c.name AS club_name,
           COUNT(r.id) AS run_count,
           COALESCE(SUM(r.distance_km), 0) AS total_km
    FROM users u
    LEFT JOIN schools s ON s.id = u.school_id
    LEFT JOIN clubs c ON c.id = u.club_id
    LEFT JOIN runs r ON r.user_id = u.id
    WHERE ${inBin ? 'u.deleted_at IS NOT NULL' : 'u.deleted_at IS NULL'}`;
  const params = [];
  if (q) {
    sql += ' AND (u.nickname LIKE ? OR u.phone LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  if (ROLES.includes(role)) {
    sql += ' AND u.role = ?';
    params.push(role);
  }
  if (Number.isFinite(clubId) && clubId > 0) {
    sql += ' AND u.club_id = ?';
    params.push(clubId);
  }
  // 社长永远排在本社团用户列表最上面，方便管理员先看到社长
  sql += " GROUP BY u.id ORDER BY (u.role = 'president') DESC, u.id DESC";
  // 分页：LIMIT page_size+1 来判断 has_more，offset 计算好跳过前 (page-1)*page_size 条
  const page = Math.max(1, Math.floor(Number(req.query.page || 1)));
  const pageSize = Math.min(200, Math.max(10, Math.floor(Number(req.query.page_size || 50))));
  const all = db.prepare(sql + ' LIMIT ? OFFSET ?').all(...params, pageSize + 1, (page - 1) * pageSize);
  const hasMore = all.length > pageSize;
  res.json({ list: all.slice(0, pageSize), has_more: hasMore, page, page_size: pageSize });
});

// 新增用户（管理员直接创建账号，无需走注册流程）
router.post('/users', (req, res) => {
  const { phone, nickname, gender, password, role, school_id, club_id } = req.body || {};
  if (!/^1\d{10}$/.test(String(phone || ''))) {
    return res.status(400).json({ error: '手机号格式不正确，应为 1 开头的 11 位数字' });
  }
  if (String(nickname || '').trim().length < 2) {
    return res.status(400).json({ error: '昵称至少要 2 个字' });
  }
  if (gender !== '男' && gender !== '女') {
    return res.status(400).json({ error: '性别只能是 男 或 女' });
  }
  if (String(password || '').length < 6) {
    return res.status(400).json({ error: '密码至少要 6 位' });
  }
  const r = ROLES.includes(role) ? role : 'member';
  if (db.prepare('SELECT id FROM users WHERE phone = ?').get(String(phone))) {
    return res.status(400).json({ error: '这个手机号已经被注册了' });
  }
  const sc = resolveSchoolClub(school_id ?? 1, club_id);
  if (sc.error) return res.status(400).json({ error: sc.error });

  const hash = bcrypt.hashSync(String(password), 10);
  const info = db.prepare(
    'INSERT INTO users (school_id, club_id, phone, nickname, gender, password_hash, role) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(sc.schoolId, sc.clubId, String(phone), String(nickname).trim(), String(gender), hash, r);
  res.json({ id: Number(info.lastInsertRowid), message: '用户已创建' });
});

// 编辑用户：昵称 / 性别 / 角色 / 手机号 / 头像 / 学校 / 社团
router.put('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const b = req.body || {};
  const nickname = b.nickname != null ? String(b.nickname).trim() : user.nickname;
  const gender = b.gender != null ? String(b.gender) : user.gender;
  const role = b.role != null ? String(b.role) : user.role;
  const phone = b.phone != null ? String(b.phone).trim() : user.phone;
  const avatar = b.avatar != null ? String(b.avatar) : (user.avatar || '');

  if (nickname.length < 2) return res.status(400).json({ error: '昵称至少要 2 个字' });
  if (gender !== '男' && gender !== '女') return res.status(400).json({ error: '性别只能是 男 或 女' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: '角色不正确' });
  if (!/^1\d{10}$/.test(phone)) return res.status(400).json({ error: '手机号格式不正确' });

  // 手机号唯一
  const dup = db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(phone, id);
  if (dup) return res.status(400).json({ error: '这个手机号已经被其他用户使用了' });

  // 安全保护：不能把自己降级；系统里至少要保留一个管理员
  if (user.role === 'admin' && role !== 'admin') {
    if (id === req.user.id) return res.status(400).json({ error: '不能取消自己的管理员身份' });
    const admins = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin' AND deleted_at IS NULL").get().c;
    if (admins <= 1) return res.status(400).json({ error: '系统至少要保留一个管理员' });
  }

  // 学校 / 社团归属
  let schoolId = user.school_id;
  let clubId = user.club_id;
  const schoolChanged = b.school_id != null && Number(b.school_id) !== user.school_id;
  const clubChanged = b.club_id != null && Number(b.club_id) !== user.club_id;
  if (schoolChanged || clubChanged) {
    const sc = resolveSchoolClub(b.school_id ?? user.school_id, b.club_id ?? user.club_id);
    if (sc.error) return res.status(400).json({ error: sc.error });
    schoolId = sc.schoolId;
    clubId = sc.clubId;
  }

  db.prepare(
    'UPDATE users SET nickname = ?, gender = ?, role = ?, phone = ?, avatar = ?, school_id = ?, club_id = ? WHERE id = ?'
  ).run(nickname, gender, role, phone, avatar, schoolId, clubId, id);
  res.json({ message: '用户信息已保存' });
});

// 重置密码：管理员给用户设一个新密码
router.post('/users/:id/reset-password', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const password = String((req.body || {}).password || '');
  if (password.length < 6) return res.status(400).json({ error: '密码至少要 6 位' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), id);
  // 重置别人的密码时，把他已登录的设备全部踢下线（自己改自己则保留当前登录）
  if (id !== req.user.id) {
    db.prepare('DELETE FROM tokens WHERE user_id = ?').run(id);
  }
  res.json({ message: '密码已重置' });
});

// 删除用户 = 软删除：只标记 deleted_at 并踢下线，数据全部保留
// 误删后可以在"回收站"里一键恢复；彻底删除要走 /users/:id/permanent
router.delete('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT id, role, deleted_at FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.deleted_at) return res.status(400).json({ error: '该用户已在回收站中' });
  if (user.role === 'admin') {
    if (id === req.user.id) return res.status(400).json({ error: '不能删除自己' });
    const admins = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin' AND deleted_at IS NULL").get().c;
    if (admins <= 1) return res.status(400).json({ error: '系统至少要保留一个管理员' });
  }
  db.prepare("UPDATE users SET deleted_at = datetime('now','localtime') WHERE id = ?").run(id);
  // 软删除的同时踢下线，被删用户立即无法继续操作
  db.prepare('DELETE FROM tokens WHERE user_id = ?').run(id);
  res.json({ message: '已移入回收站（数据保留，可随时恢复）' });
});

// 恢复用户：从回收站还原（角色、社团、数据原样恢复）
router.post('/users/:id/restore', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT id, deleted_at, club_id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (!user.deleted_at) return res.status(400).json({ error: '该用户不在回收站中' });
  // 恢复原社团时校验社团还在不在：社团已被删除的话，恢复为无社团用户
  let clubId = user.club_id;
  let schoolId = null;
  if (clubId != null) {
    const club = db.prepare('SELECT id, school_id FROM clubs WHERE id = ?').get(clubId);
    if (club) {
      schoolId = club.school_id;
    } else {
      clubId = null; // 原社团没了，恢复成无社团用户
    }
  }
  db.prepare('UPDATE users SET deleted_at = NULL, club_id = ?, school_id = COALESCE(?, school_id) WHERE id = ?')
    .run(clubId, schoolId, id);
  res.json({ message: clubId == null ? '已恢复（原社团已不存在，现为无社团用户）' : '已恢复' });
});

// 彻底删除：物理清除该用户的全部数据（仅回收站中的用户可操作，不可恢复！）
router.delete('/users/:id/permanent', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT id, role, deleted_at FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (!user.deleted_at) return res.status(400).json({ error: '请先把该用户移入回收站，再从回收站彻底删除' });
  if (id === req.user.id) return res.status(400).json({ error: '不能彻底删除自己' });
  if (user.role === 'admin') {
    const admins = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin' AND deleted_at IS NULL").get().c;
    if (admins <= 1) return res.status(400).json({ error: '系统至少要保留一个管理员' });
  }
  deleteUserCascade(id);
  res.json({ message: '已彻底删除该用户及其全部数据' });
});

// ============================================================
// 2.2 批量操作（N13）：批量导入新生 / 批量转社团 / 批量调角色
// 设计原则：逐行处理、逐行报错，一条失败不影响其他行；
// 最后返回 {成功数, 失败明细}，管理员可根据明细修正后重试
// ============================================================

// 批量导入用户：一次创建多个账号（开学导入新生场景）
// body: { users: [{phone, nickname, gender, password, club_id?}], school_id?, club_id? }
// 顶层 school_id/club_id 作为默认值，行内 club_id 可覆盖（用于一次导入分到不同社团）
router.post('/users/batch-import', (req, res) => {
  const list = Array.isArray(req.body?.users) ? req.body.users : [];
  if (list.length === 0) return res.status(400).json({ error: '导入列表不能为空' });
  if (list.length > 200) return res.status(400).json({ error: '一次最多导入 200 人，请分批导入' });

  const defaultSchoolId = req.body.school_id;
  const defaultClubId = req.body.club_id;

  const okRows = [];   // 校验通过的待插入行
  const failed = [];   // 失败明细：{行号, phone, 原因}

  // 第一步：逐行校验（格式、手机号唯一——含库内查重与本批次内查重）
  const seenPhones = new Set();
  for (let i = 0; i < list.length; i++) {
    const row = list[i] || {};
    const phone = String(row.phone || '').trim();
    const nickname = String(row.nickname || '').trim();
    const gender = String(row.gender || '').trim();
    const password = String(row.password || '');

    if (!/^1\d{10}$/.test(phone)) { failed.push({ row: i + 1, phone, error: '手机号格式不正确' }); continue; }
    if (nickname.length < 2) { failed.push({ row: i + 1, phone, error: '昵称至少要 2 个字' }); continue; }
    if (gender !== '男' && gender !== '女') { failed.push({ row: i + 1, phone, error: '性别只能是 男 或 女' }); continue; }
    if (password.length < 6) { failed.push({ row: i + 1, phone, error: '密码至少要 6 位' }); continue; }
    if (seenPhones.has(phone)) { failed.push({ row: i + 1, phone, error: '本批次内手机号重复' }); continue; }
    if (db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)) {
      failed.push({ row: i + 1, phone, error: '该手机号已注册' }); continue;
    }

    // 社团归属：行内 club_id 优先，否则用顶层默认；都没有则为无社团用户
    const clubId = row.club_id ?? defaultClubId ?? null;
    let schoolId = row.school_id ?? defaultSchoolId ?? null;
    if (clubId != null) {
      const club = db.prepare('SELECT id, school_id FROM clubs WHERE id = ?').get(Number(clubId));
      if (!club) { failed.push({ row: i + 1, phone, error: `社团不存在(id=${clubId})` }); continue; }
      schoolId = club.school_id; // 学校自动跟随社团
    }

    seenPhones.add(phone);
    okRows.push({ phone, nickname, gender, password, schoolId, clubId: clubId == null ? null : Number(clubId) });
  }

  // 第二步：批量插入校验通过的行
  const insert = db.prepare(
    'INSERT INTO users (school_id, club_id, phone, nickname, gender, password_hash, role) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  let created = 0;
  for (const r of okRows) {
    try {
      insert.run(r.schoolId, r.clubId, r.phone, r.nickname, r.gender, bcrypt.hashSync(r.password, 10), 'member');
      created++;
    } catch (e) {
      failed.push({ row: 0, phone: r.phone, error: `写入失败：${e.message}` });
    }
  }
  res.json({ created, failed, message: `成功导入 ${created} 人${failed.length ? `，失败 ${failed.length} 人` : ''}` });
});

// 批量转社团：把一批用户移动到目标社团（学校自动跟随社团）
// body: { user_ids: [1,2,3], club_id: 5 }（club_id 传 null = 移出社团，变为无社团用户）
router.post('/users/batch-transfer', (req, res) => {
  const ids = Array.isArray(req.body?.user_ids) ? req.body.user_ids.map(Number).filter(Number.isFinite) : [];
  if (ids.length === 0) return res.status(400).json({ error: '请先选择要转移的用户' });
  const clubId = req.body.club_id == null ? null : Number(req.body.club_id);

  let targetSchoolId = null;
  if (clubId != null) {
    const club = db.prepare('SELECT id, school_id FROM clubs WHERE id = ?').get(clubId);
    if (!club) return res.status(400).json({ error: '目标社团不存在' });
    targetSchoolId = club.school_id;
  }

  // 社长不能通过批量操作转走（社团必须有社长，先转让再转社）
  const failed = [];
  let moved = 0;
  const stmt = db.prepare('UPDATE users SET club_id = ?, school_id = COALESCE(?, school_id) WHERE id = ?');
  const sel = db.prepare('SELECT id, role, deleted_at, nickname FROM users WHERE id = ?'); // 提到循环外复用
  for (const id of ids) {
    const u = sel.get(id);
    if (!u) { failed.push({ id, error: '用户不存在' }); continue; }
    if (u.deleted_at) { failed.push({ id, error: `${u.nickname} 在回收站中` }); continue; }
    if (u.role === 'president') { failed.push({ id, error: `${u.nickname} 是社长，请先转让社长身份` }); continue; }
    stmt.run(clubId, targetSchoolId, id);
    moved++;
  }
  res.json({ moved, failed, message: `已转移 ${moved} 人${failed.length ? `，${failed.length} 人未转移` : ''}` });
});

// 批量调角色：把一批用户统一设为 member / president / admin
// body: { user_ids: [1,2,3], role: 'member' }
// 安全护栏（与单个编辑一致）：不能改自己的角色；系统至少保留一个管理员
router.post('/users/batch-role', (req, res) => {
  const ids = Array.isArray(req.body?.user_ids) ? req.body.user_ids.map(Number).filter(Number.isFinite) : [];
  if (ids.length === 0) return res.status(400).json({ error: '请先选择要调整的用户' });
  const role = String(req.body?.role || '');
  if (!ROLES.includes(role)) return res.status(400).json({ error: '角色不正确' });

  if (ids.includes(req.user.id)) {
    return res.status(400).json({ error: '批量操作中不能包含自己，请单独调整' });
  }
  // 若会把管理员降级，先算一下降级后系统还剩几个管理员
  if (role !== 'admin') {
    const admins = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin' AND deleted_at IS NULL").get().c;
    const demoteCount = db.prepare(
      `SELECT COUNT(*) c FROM users WHERE role = 'admin' AND deleted_at IS NULL AND id IN (${ids.map(() => '?').join(',')})`
    ).get(...ids).c;
    if (admins - demoteCount < 1) {
      return res.status(400).json({ error: '系统至少要保留一个管理员，本次操作会把所有管理员都降级' });
    }
  }

  const stmt = db.prepare('UPDATE users SET role = ? WHERE id = ?');
  let updated = 0;
  for (const id of ids) {
    const info = stmt.run(role, id);
    if (info.changes > 0) updated++;
  }
  res.json({ updated, failed: [], message: `已调整 ${updated} 人的角色` });
});


// ============================================================
// 2.1 社长申请审批（申请制：无社团用户申请 → 管理员批准建校建社并任命）
// ============================================================

// 申请列表：?status=pending/approved/rejected（默认全部，pending 排前面）
router.get('/applications', (req, res) => {
  const status = String(req.query.status || '').trim();
  let sql = `
    SELECT a.id, a.user_id, a.school_name, a.club_name, a.province, a.city, a.note,
           a.status, a.reject_reason, a.created_at, a.handled_at,
           u.nickname, u.phone, u.gender,
           h.nickname AS handler_nickname
    FROM president_applications a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN users h ON h.id = a.handled_by`;
  const params = [];
  if (['pending', 'approved', 'rejected'].includes(status)) {
    sql += ' WHERE a.status = ?';
    params.push(status);
  }
  sql += " ORDER BY CASE a.status WHEN 'pending' THEN 0 ELSE 1 END, a.id DESC";
  res.json(db.prepare(sql).all(...params));
});

// 批准申请：自动创建学校 + 社团，把申请人任命为社长（事务，要么全成要么全败）
router.post('/applications/:id/approve', (req, res) => {
  const id = Number(req.params.id);
  const app = db.prepare('SELECT * FROM president_applications WHERE id = ?').get(id);
  if (!app) return res.status(404).json({ error: '申请不存在' });
  if (app.status !== 'pending') return res.status(400).json({ error: '该申请已处理过了' });
  const user = db.prepare('SELECT id, club_id, deleted_at FROM users WHERE id = ?').get(app.user_id);
  if (!user || user.deleted_at) return res.status(400).json({ error: '申请人账号不存在或已被删除' });
  if (user.club_id != null) return res.status(400).json({ error: '申请人已加入其他社团，请先将其移出' });

  // 查重：同名学校直接复用，避免同一个学校被重复创建；同校同名社团直接拦截
  const existSchool = db.prepare('SELECT id FROM schools WHERE name = ? ORDER BY id LIMIT 1')
    .get(String(app.school_name).trim());
  const clubName = String(app.club_name || '长跑社').trim() || '长跑社';
  if (existSchool) {
    const dupClub = db.prepare('SELECT id, name FROM clubs WHERE school_id = ? AND name = ?')
      .get(existSchool.id, clubName);
    if (dupClub) {
      return res.status(400).json({ error: `该学校下已存在「${clubName}」，请驳回申请或更换社团名称` });
    }
  }

  db.exec('BEGIN');
  try {
    // 1）学校：已存在同名学校就复用，否则新建
    let schoolId;
    if (existSchool) {
      schoolId = existSchool.id;
    } else {
      const sInfo = db.prepare('INSERT INTO schools (name, province, city) VALUES (?, ?, ?)')
        .run(app.school_name, app.province, app.city);
      schoolId = Number(sInfo.lastInsertRowid);
    }
    // 2）创建社团
    const cInfo = db.prepare('INSERT INTO clubs (school_id, name) VALUES (?, ?)')
      .run(schoolId, clubName);
    const clubId = Number(cInfo.lastInsertRowid);
    // 3）任命申请人为社长
    db.prepare("UPDATE users SET school_id = ?, club_id = ?, role = 'president' WHERE id = ?")
      .run(schoolId, clubId, app.user_id);
    // 4）标记申请已批准
    db.prepare("UPDATE president_applications SET status = 'approved', handled_by = ?, handled_at = datetime('now','localtime') WHERE id = ?")
      .run(req.user.id, id);
    // 5）踢下线：角色变了，强制重新登录拿到社长身份
    db.prepare('DELETE FROM tokens WHERE user_id = ?').run(app.user_id);
    db.exec('COMMIT');
    notify(
      app.user_id,
      'president',
      '社长申请已通过',
      `「${app.school_name} · ${clubName}」已创建，请重新登录使用社长权限`
    );
    res.json({ message: '已批准：学校与社团已创建，申请人已任命为社长', schoolId, clubId });
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('批准社长申请失败：', e);
    res.status(500).json({ error: '操作失败，请稍后重试' });
  }
});

// 拒绝申请：填写拒绝原因，申请人会看到
router.post('/applications/:id/reject', (req, res) => {
  const id = Number(req.params.id);
  const app = db.prepare('SELECT * FROM president_applications WHERE id = ?').get(id);
  if (!app) return res.status(404).json({ error: '申请不存在' });
  if (app.status !== 'pending') return res.status(400).json({ error: '该申请已处理过了' });
  const reason = String((req.body || {}).reason || '').trim();
  if (reason.length < 2) return res.status(400).json({ error: '请填写驳回原因（至少 2 个字）' });
  db.prepare("UPDATE president_applications SET status = 'rejected', reject_reason = ?, handled_by = ?, handled_at = datetime('now','localtime') WHERE id = ?")
    .run(reason, req.user.id, id);
  notify(
    app.user_id,
    'president',
    '社长申请未通过',
    reason ? `驳回原因：${reason}` : '申请未通过'
  );
  res.json({ message: '已拒绝该申请' });
});

// 任命社长：把指定用户设为某社团的社长（该社原社长自动降级为普通社员）
// 前端传：{ user_id }
router.post('/clubs/:id/president', (req, res) => {
  const clubId = Number(req.params.id);
  const userId = Number((req.body || {}).user_id);
  const club = db.prepare('SELECT id, school_id, name FROM clubs WHERE id = ?').get(clubId);
  if (!club) return res.status(404).json({ error: '社团不存在' });
  const target = db.prepare('SELECT id, role, club_id, deleted_at FROM users WHERE id = ?').get(userId);
  if (!target || target.deleted_at) return res.status(404).json({ error: '用户不存在或已被删除' });
  if (target.club_id !== clubId) {
    return res.status(400).json({ error: '只能任命本社团成员为社长，请先把该用户调入本社团' });
  }

  db.exec('BEGIN');
  try {
    // 原社长降级为普通社员（可能有多位历史社长，一起降）
    db.prepare("UPDATE users SET role = 'member' WHERE club_id = ? AND role = 'president'").run(clubId);
    // 新社长上任
    db.prepare("UPDATE users SET role = 'president', school_id = ? WHERE id = ?").run(club.school_id, userId);
    // 角色变化的用户全部踢下线，重新登录获取新身份
    db.prepare('DELETE FROM tokens WHERE user_id IN (SELECT id FROM users WHERE club_id = ?)').run(clubId);
    db.exec('COMMIT');
    res.json({ message: `已任命「${club.name}」的新社长` });
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('任命社长失败：', e);
    res.status(500).json({ error: '操作失败，请稍后重试' });
  }
});

// ============================================================
// 3. 跑步记录管理
// ============================================================

// 所有跑步记录（支持 ?q=昵称/手机号，?club_id=社团）
router.get('/runs', (req, res) => {
  const q = String(req.query.q || '').trim();
  const clubId = Number(req.query.club_id);
  let sql = `
    SELECT r.id, r.user_id, r.run_date, r.distance_km, r.duration_seconds,
           u.nickname, u.phone, s.name AS school_name, c.name AS club_name
    FROM runs r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN schools s ON s.id = u.school_id
    LEFT JOIN clubs c ON c.id = u.club_id
    WHERE u.deleted_at IS NULL`;
  const params = [];
  if (q) {
    sql += ' AND (u.nickname LIKE ? OR u.phone LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  if (Number.isFinite(clubId) && clubId > 0) {
    sql += ' AND u.club_id = ?';
    params.push(clubId);
  }
  sql += ' ORDER BY r.run_date DESC, r.id DESC';
  const page = Math.max(1, Math.floor(Number(req.query.page || 1)));
  const pageSize = Math.min(200, Math.max(10, Math.floor(Number(req.query.page_size || 50))));
  const all = db.prepare(sql + ' LIMIT ? OFFSET ?').all(...params, pageSize + 1, (page - 1) * pageSize);
  const hasMore = all.length > pageSize;
  res.json({ list: all.slice(0, pageSize), has_more: hasMore, page, page_size: pageSize });
});

// 修改一条跑步记录（日期 / 距离 / 用时）
router.put('/runs/:id', (req, res) => {
  const id = Number(req.params.id);
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(id);
  if (!run) return res.status(404).json({ error: '记录不存在' });
  const b = req.body || {};
  const runDate = b.run_date != null ? String(b.run_date) : run.run_date;
  const distance = b.distance_km != null ? Number(b.distance_km) : run.distance_km;
  const duration = b.duration_seconds != null ? Math.round(Number(b.duration_seconds)) : run.duration_seconds;
  if (!DATE_RE.test(runDate)) return res.status(400).json({ error: '日期格式应为 YYYY-MM-DD' });
  if (!Number.isFinite(distance) || distance <= 0 || distance > 1000) {
    return res.status(400).json({ error: '距离需大于 0 且不超过 1000 公里' });
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    return res.status(400).json({ error: '用时必须大于 0 秒' });
  }
  db.prepare('UPDATE runs SET run_date = ?, distance_km = ?, duration_seconds = ? WHERE id = ?')
    .run(runDate, distance, duration, id);
  res.json({ message: '记录已保存' });
});

// 删除一条跑步记录（连带详细数据）
router.delete('/runs/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM run_details WHERE run_id = ?').run(id);
  const info = db.prepare('DELETE FROM runs WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: '记录不存在' });
  res.json({ message: '已删除该记录' });
});

// ============================================================
// 4. 训练计划管理
// ============================================================

// 所有计划（支持 ?q=昵称/手机号，?goal_type=类型）
router.get('/plans', (req, res) => {
  const q = String(req.query.q || '').trim();
  const goalType = String(req.query.goal_type || '').trim();
  let sql = `
    SELECT p.id, p.user_id, p.title, p.target_km, p.weeks, p.start_date,
           p.intensity, p.note, p.goal_type, p.goal_data, p.created_at,
           u.nickname AS owner_nickname, u.phone AS owner_phone,
           c.name AS club_name
    FROM plans p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN clubs c ON c.id = u.club_id
    WHERE u.deleted_at IS NULL`;
  const params = [];
  if (q) {
    sql += ' AND (u.nickname LIKE ? OR u.phone LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  if (GOAL_TYPES.includes(goalType)) {
    sql += ' AND p.goal_type = ?';
    params.push(goalType);
  }
  sql += ' ORDER BY p.id DESC';
  const page = Math.max(1, Math.floor(Number(req.query.page || 1)));
  const pageSize = Math.min(200, Math.max(10, Math.floor(Number(req.query.page_size || 50))));
  const all = db.prepare(sql + ' LIMIT ? OFFSET ?').all(...params, pageSize + 1, (page - 1) * pageSize);
  const hasMore = all.length > pageSize;
  res.json({ list: all.slice(0, pageSize), has_more: hasMore, page, page_size: pageSize });
});

// 修改计划
router.put('/plans/:id', (req, res) => {
  const id = Number(req.params.id);
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
  if (!plan) return res.status(404).json({ error: '计划不存在' });
  const b = req.body || {};

  const title = b.title != null ? String(b.title).trim() : plan.title;
  if (!title) return res.status(400).json({ error: '计划名称不能为空' });
  const weeks = b.weeks != null ? Math.round(Number(b.weeks)) : plan.weeks;
  if (!Number.isFinite(weeks) || weeks < 1 || weeks > 52) {
    return res.status(400).json({ error: '周期必须是 1-52 周' });
  }
  const startDate = b.start_date != null ? String(b.start_date) : plan.start_date;
  if (!DATE_RE.test(startDate)) return res.status(400).json({ error: '开始日期格式应为 YYYY-MM-DD' });
  const targetKm = b.target_km != null ? Number(b.target_km) : plan.target_km;
  if (!Number.isFinite(targetKm) || targetKm < 0) return res.status(400).json({ error: '目标跑量不正确' });
  const intensity = b.intensity != null ? String(b.intensity) : plan.intensity;
  if (!['低', '中等', '高'].includes(intensity)) return res.status(400).json({ error: '强度只能是 低/中等/高' });
  const goalType = b.goal_type != null ? String(b.goal_type) : plan.goal_type;
  if (!GOAL_TYPES.includes(goalType)) return res.status(400).json({ error: '目标类型不正确' });

  let goalDataStr = plan.goal_data;
  if (b.goal_data !== undefined && b.goal_data !== null) {
    try {
      goalDataStr = JSON.stringify(typeof b.goal_data === 'string' ? JSON.parse(b.goal_data) : b.goal_data);
    } catch {
      return res.status(400).json({ error: 'goal_data 必须是合法的 JSON' });
    }
  }

  db.prepare(`
    UPDATE plans SET title = ?, target_km = ?, weeks = ?, start_date = ?,
                     intensity = ?, note = ?, goal_type = ?, goal_data = ?
    WHERE id = ?
  `).run(
    title, targetKm, weeks, startDate, intensity,
    b.note != null ? String(b.note) : plan.note,
    goalType, goalDataStr, id
  );
  res.json({ message: '计划已保存' });
});

// 删除计划（先清课表打卡记录，再删计划本身）
router.delete('/plans/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM plan_checkins WHERE plan_id = ?').run(id);
  const info = db.prepare('DELETE FROM plans WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: '计划不存在' });
  res.json({ message: '计划已删除' });
});

// ============================================================
// 5. 学校 / 社团管理
// ============================================================

// 学校列表（带社团数、成员数）
router.get('/schools', (req, res) => {
  const rows = db.prepare(`
    SELECT s.id, s.name, s.province, s.city, s.created_at,
           (SELECT COUNT(*) FROM clubs c WHERE c.school_id = s.id) AS club_count,
           (SELECT COUNT(*) FROM users u WHERE u.school_id = s.id AND u.deleted_at IS NULL) AS user_count
    FROM schools s
    ORDER BY s.id
  `).all();
  res.json(rows);
});

// 新增学校
router.post('/schools', (req, res) => {
  const { name, province, city } = req.body || {};
  if (String(name || '').trim().length < 2) {
    return res.status(400).json({ error: '学校名称至少要 2 个字' });
  }
  const info = db.prepare('INSERT INTO schools (name, province, city) VALUES (?, ?, ?)')
    .run(String(name).trim(), String(province || '').trim(), String(city || '').trim());
  res.json({ id: Number(info.lastInsertRowid), message: '学校已创建' });
});

// 修改学校
router.put('/schools/:id', (req, res) => {
  const id = Number(req.params.id);
  const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(id);
  if (!school) return res.status(404).json({ error: '学校不存在' });
  const b = req.body || {};
  const name = b.name != null ? String(b.name).trim() : school.name;
  if (name.length < 2) return res.status(400).json({ error: '学校名称至少要 2 个字' });
  db.prepare('UPDATE schools SET name = ?, province = ?, city = ? WHERE id = ?').run(
    name,
    b.province != null ? String(b.province).trim() : school.province,
    b.city != null ? String(b.city).trim() : school.city,
    id
  );
  res.json({ message: '学校信息已保存' });
});

// 删除学校：还有社团/成员时不允许删（先清理再删，避免误删大量数据）
router.delete('/schools/:id', (req, res) => {
  const id = Number(req.params.id);
  const school = db.prepare('SELECT id FROM schools WHERE id = ?').get(id);
  if (!school) return res.status(404).json({ error: '学校不存在' });
  const clubs = db.prepare('SELECT COUNT(*) c FROM clubs WHERE school_id = ?').get(id).c;
  // 只统计未被软删除的成员（回收站成员不应该阻止学校删除）
  const users = db.prepare('SELECT COUNT(*) c FROM users WHERE school_id = ? AND deleted_at IS NULL').get(id).c;
  if (clubs > 0 || users > 0) {
    return res.status(400).json({
      error: `该学校还有 ${clubs} 个社团、${users} 名成员。请先删除/转移社团和成员后再删除学校`,
    });
  }
  db.prepare('DELETE FROM schools WHERE id = ?').run(id);
  res.json({ message: '学校已删除' });
});

// 社团列表（带学校名、成员数、活动数）
router.get('/clubs', (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.school_id, c.name, c.intro, c.training_time, c.training_place, c.contact,
           s.name AS school_name,
           (SELECT COUNT(*) FROM users u WHERE u.club_id = c.id AND u.deleted_at IS NULL) AS member_count,
           (SELECT COUNT(*) FROM club_events e WHERE e.club_id = c.id) AS event_count,
           (SELECT u.id FROM users u WHERE u.club_id = c.id AND u.role = 'president' AND u.deleted_at IS NULL ORDER BY u.id LIMIT 1) AS president_id,
           (SELECT u.nickname FROM users u WHERE u.club_id = c.id AND u.role = 'president' AND u.deleted_at IS NULL ORDER BY u.id LIMIT 1) AS president_nickname
    FROM clubs c
    LEFT JOIN schools s ON s.id = c.school_id
    ORDER BY c.id
  `).all();
  res.json(rows);
});

// 新增社团
router.post('/clubs', (req, res) => {
  const { school_id, name, intro, training_time, training_place, contact } = req.body || {};
  const schoolId = Number(school_id);
  if (!Number.isFinite(schoolId) || !db.prepare('SELECT id FROM schools WHERE id = ?').get(schoolId)) {
    return res.status(400).json({ error: '学校不存在' });
  }
  if (String(name || '').trim().length < 2) {
    return res.status(400).json({ error: '社团名称至少要 2 个字' });
  }
  const info = db.prepare(`
    INSERT INTO clubs (school_id, name, intro, training_time, training_place, contact)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    schoolId, String(name).trim(),
    String(intro || '').trim(), String(training_time || '').trim(),
    String(training_place || '').trim(), String(contact || '').trim()
  );
  res.json({ id: Number(info.lastInsertRowid), message: '社团已创建' });
});

// 修改社团（学校变更时同步更新该社团所有成员的 school_id）
router.put('/clubs/:id', (req, res) => {
  const id = Number(req.params.id);
  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(id);
  if (!club) return res.status(404).json({ error: '社团不存在' });
  const b = req.body || {};
  const name = b.name != null ? String(b.name).trim() : club.name;
  if (name.length < 2) return res.status(400).json({ error: '社团名称至少要 2 个字' });
  const schoolId = b.school_id != null ? Number(b.school_id) : club.school_id;
  if (!Number.isFinite(schoolId) || !db.prepare('SELECT id FROM schools WHERE id = ?').get(schoolId)) {
    return res.status(400).json({ error: '学校不存在' });
  }
  db.prepare(`
    UPDATE clubs SET school_id = ?, name = ?, intro = ?, training_time = ?, training_place = ?, contact = ?
    WHERE id = ?
  `).run(
    schoolId, name,
    b.intro != null ? String(b.intro).trim() : club.intro,
    b.training_time != null ? String(b.training_time).trim() : club.training_time,
    b.training_place != null ? String(b.training_place).trim() : club.training_place,
    b.contact != null ? String(b.contact).trim() : club.contact,
    id
  );
  // 社团换学校后，成员的学校字段也跟着改，避免数据对不上
  if (schoolId !== club.school_id) {
    db.prepare('UPDATE users SET school_id = ? WHERE club_id = ?').run(schoolId, id);
  }
  res.json({ message: '社团信息已保存' });
});

// 删除社团：管理员强制删除（成员自动变成"无社团"用户，社团内容一并删除）
// 现在没有"默认社团"概念，任何社团都可以删除
router.delete('/clubs/:id', (req, res) => {
  const id = Number(req.params.id);
  const club = db.prepare('SELECT id FROM clubs WHERE id = ?').get(id);
  if (!club) return res.status(404).json({ error: '社团不存在' });
  const members = db.prepare('SELECT COUNT(*) c FROM users WHERE club_id = ?').get(id).c;

  db.exec('BEGIN');
  try {
    // 记录社团内所有用户，删除后统一强制重新登录（身份/社团已变化）
    const memberIds = db.prepare('SELECT id FROM users WHERE club_id = ?').all(id).map(r => r.id);
    // 1）成员全部解除社团归属（社长也降为普通社员，成为"无社团"用户）
    db.prepare('UPDATE users SET club_id = NULL, school_id = NULL, role = \'member\' WHERE club_id = ?').run(id);
    // 2）社团内容（公告 / 任务 / 约跑活动 / 报名）一并清除
    deleteClubCascade(id);
    // 3）删除社团本身
    db.prepare('DELETE FROM clubs WHERE id = ?').run(id);
    // 4）相关用户的登录令牌清掉，下次打开 APP 必须重新登录拿到新身份
    for (const uid of memberIds) {
      db.prepare('DELETE FROM tokens WHERE user_id = ?').run(uid);
    }
    db.exec('COMMIT');
    res.json({ message: `社团已删除，${members} 名成员已变为无社团用户` });
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('删除社团失败：', e);
    res.status(500).json({ error: '操作失败，请稍后重试' });
  }
});

// ============================================================
// 6. 社团内容管理（公告 / 任务 / 约跑活动）
// ============================================================

// 所有公告（跨社团）
router.get('/announcements', (req, res) => {
  const rows = db.prepare(`
    SELECT a.id, a.club_id, a.title, a.content, a.created_at,
           c.name AS club_name, u.nickname AS author_nickname
    FROM announcements a
    LEFT JOIN clubs c ON c.id = a.club_id
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.id DESC
  `).all();
  res.json(rows);
});

router.delete('/announcements/:id', (req, res) => {
  const info = db.prepare('DELETE FROM announcements WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: '公告不存在' });
  res.json({ message: '公告已删除' });
});

// 编辑公告（后台代改错别字、补充说明）
router.put('/announcements/:id', (req, res) => {
  const id = Number(req.params.id);
  const old = db.prepare('SELECT id FROM announcements WHERE id = ?').get(id);
  if (!old) return res.status(404).json({ error: '公告不存在' });
  const { title, content } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: '公告标题不能为空' });
  if (!content || !String(content).trim()) return res.status(400).json({ error: '公告内容不能为空' });
  db.prepare('UPDATE announcements SET title = ?, content = ? WHERE id = ?')
    .run(String(title).trim(), String(content).trim(), id);
  res.json({ message: '公告已保存' });
});

// 所有任务（跨社团）
router.get('/tasks', (req, res) => {
  const rows = db.prepare(`
    SELECT t.id, t.club_id, t.title, t.content, t.deadline, t.created_at,
           c.name AS club_name, u.nickname AS author_nickname
    FROM club_tasks t
    LEFT JOIN clubs c ON c.id = t.club_id
    LEFT JOIN users u ON u.id = t.user_id
    ORDER BY t.id DESC
  `).all();
  res.json(rows);
});

router.delete('/tasks/:id', (req, res) => {
  const info = db.prepare('DELETE FROM club_tasks WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: '任务不存在' });
  res.json({ message: '任务已删除' });
});

// 编辑任务
router.put('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const old = db.prepare('SELECT id FROM club_tasks WHERE id = ?').get(id);
  if (!old) return res.status(404).json({ error: '任务不存在' });
  const { title, content, deadline } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: '任务标题不能为空' });
  if (!content || !String(content).trim()) return res.status(400).json({ error: '任务内容不能为空' });
  const dl = String(deadline || '').trim();
  if (dl && !DATE_RE.test(dl)) return res.status(400).json({ error: '截止日期格式应为 YYYY-MM-DD' });
  db.prepare('UPDATE club_tasks SET title = ?, content = ?, deadline = ? WHERE id = ?')
    .run(String(title).trim(), String(content).trim(), dl, id);
  res.json({ message: '任务已保存' });
});

// 所有约跑活动（跨社团）
// N6 新增：返回 max_participants 与 checkin_count，便于后台查看上限与签到情况
router.get('/events', (req, res) => {
  const rows = db.prepare(`
    SELECT e.id, e.club_id, e.title, e.event_date, e.event_time, e.place, e.note, e.max_participants,
           c.name AS club_name, u.nickname AS author_nickname,
           (SELECT COUNT(*) FROM event_signups s WHERE s.event_id = e.id) AS signup_count,
           (SELECT COUNT(*) FROM event_checkins ck WHERE ck.event_id = e.id) AS checkin_count
    FROM club_events e
    LEFT JOIN clubs c ON c.id = e.club_id
    LEFT JOIN users u ON u.id = e.user_id
    ORDER BY e.event_date DESC, e.id DESC
  `).all();
  res.json(rows);
});

router.delete('/events/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM event_checkins WHERE event_id = ?').run(id);
  db.prepare('DELETE FROM event_signups WHERE event_id = ?').run(id);
  const info = db.prepare('DELETE FROM club_events WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: '活动不存在' });
  res.json({ message: '活动已删除' });
});

// 编辑约跑活动（N6 新增：支持修改 max_participants 人数上限）
router.put('/events/:id', (req, res) => {
  const id = Number(req.params.id);
  const old = db.prepare('SELECT id FROM club_events WHERE id = ?').get(id);
  if (!old) return res.status(404).json({ error: '活动不存在' });
  const { title, event_date, event_time, place, note, max_participants } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: '活动名称不能为空' });
  if (!DATE_RE.test(String(event_date || ''))) {
    return res.status(400).json({ error: '活动日期格式应为 YYYY-MM-DD' });
  }
  const time = String(event_time || '').trim();
  if (time && !/^\d{1,2}:\d{2}$/.test(time)) {
    return res.status(400).json({ error: '集合时间格式应为 HH:MM' });
  }
  const mp = Math.max(0, Math.round(Number(max_participants || 0)));
  db.prepare('UPDATE club_events SET title = ?, event_date = ?, event_time = ?, place = ?, note = ?, max_participants = ? WHERE id = ?')
    .run(String(title).trim(), String(event_date), time, String(place || '').trim(), String(note || '').trim(), mp, id);
  res.json({ message: '活动已保存' });
});

// ============================================================
// 7. 计划模板管理
// ============================================================
router.post('/plan-templates', (req, res) => {
  const { title, description, goal_type, goal_data, weeks, target_km, intensity, note, sort_order } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: '模板名称不能为空' });
  }
  const type = GOAL_TYPES.includes(goal_type) ? goal_type : 'volume';
  const w = Math.round(Number(weeks));
  if (!Number.isFinite(w) || w < 1 || w > 52) {
    return res.status(400).json({ error: '周期必须是 1-52 周' });
  }
  // goal_data 允许直接传对象，也允许传 JSON 字符串
  let dataStr = '{}';
  if (goal_data !== undefined && goal_data !== null) {
    try {
      dataStr = JSON.stringify(typeof goal_data === 'string' ? JSON.parse(goal_data) : goal_data);
    } catch {
      return res.status(400).json({ error: 'goal_data 必须是合法的 JSON' });
    }
  }
  const info = db.prepare(`
    INSERT INTO plan_templates (title, description, goal_type, goal_data, weeks, target_km, intensity, note, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(title).trim(),
    String(description || ''),
    type,
    dataStr,
    w,
    Number(target_km) || 0,
    ['低', '中等', '高'].includes(intensity) ? intensity : '中等',
    String(note || ''),
    Math.round(Number(sort_order) || 0)
  );
  res.json({ id: Number(info.lastInsertRowid), message: '模板已添加' });
});

router.delete('/plan-templates/:id', (req, res) => {
  const info = db.prepare('DELETE FROM plan_templates WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: '模板不存在' });
  res.json({ message: '模板已删除' });
});

// ============================================================
// 8. 全员沟通（广播）：管理员向所有用户发布消息，用户可回复
// ============================================================

// 发布全员消息：写入 broadcasts 表，并给所有用户插一条通知（type=broadcast）
// body: { title, content }
router.post('/broadcasts', (req, res) => {
  const { title, content } = req.body || {};
  const t = String(title || '').trim();
  const c = String(content || '').trim();
  if (t.length < 1 || t.length > 60) return res.status(400).json({ error: '标题需 1-60 字' });
  if (c.length > 2000) return res.status(400).json({ error: '内容不超过 2000 字' });

  const info = db.prepare(
    'INSERT INTO broadcasts (admin_id, title, content) VALUES (?, ?, ?)'
  ).run(req.user.id, t, c);
  const broadcastId = Number(info.lastInsertRowid);

  // 同时给所有用户发一条站内通知（发布人自己不重复收）
  notifyAll('broadcast', t, c, req.user.id);

  res.json({ id: broadcastId, message: '已发布，全员通知已推送' });
});

// 管理员查看已发布的全员消息列表（含回复数）
router.get('/broadcasts', (req, res) => {
  const rows = db.prepare(`
    SELECT b.id, b.title, b.content, b.created_at,
           u.nickname AS admin_nickname,
           (SELECT COUNT(*) FROM broadcast_replies r WHERE r.broadcast_id = b.id) AS reply_count
    FROM broadcasts b
    LEFT JOIN users u ON u.id = b.admin_id
    ORDER BY b.id DESC
    LIMIT 100
  `).all();
  res.json(rows);
});

// 查看某条全员消息的所有回复（带回复人昵称）
router.get('/broadcasts/:id/replies', (req, res) => {
  const id = Number(req.params.id);
  const b = db.prepare('SELECT id FROM broadcasts WHERE id = ?').get(id);
  if (!b) return res.status(404).json({ error: '消息不存在' });
  const rows = db.prepare(`
    SELECT r.id, r.content, r.created_at,
           u.nickname AS user_nickname, u.avatar AS user_avatar
    FROM broadcast_replies r
    LEFT JOIN users u ON u.id = r.user_id
    WHERE r.broadcast_id = ?
    ORDER BY r.id ASC
  `).all(id);
  res.json(rows);
});

// 删除某条全员消息（连带回复与对应通知）
router.delete('/broadcasts/:id', (req, res) => {
  const id = Number(req.params.id);
  const b = db.prepare('SELECT title FROM broadcasts WHERE id = ?').get(id);
  if (!b) return res.status(404).json({ error: '消息不存在' });
  db.prepare('DELETE FROM broadcasts WHERE id = ?').run(id);
  db.prepare('DELETE FROM broadcast_replies WHERE broadcast_id = ?').run(id);
  // 同时清理该条广播产生的通知（按标题+类型匹配，避免残留红点）
  db.prepare("DELETE FROM notifications WHERE type = 'broadcast' AND title = ?").run(b.title);
  res.json({ message: '消息已删除' });
});

module.exports = router;
