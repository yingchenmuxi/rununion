// ============================================================
// 接口分组挂载说明：
//   - 知识文章 / 排行榜：公开，未登录也能访问（公开阅读产品）
//   - 其他（社长申请、社团、计划、个人中心、通知）：要求登录
// Express 路由顺序决定优先级：公开路由写在 authRequired 之前
// ============================================================
const express = require('express');
const db = require('./db');
const { authRequired } = require('./auth');
const { buildPlanStatusFor } = require('./coach');
const { notify, notifyClub } = require('./notify');

const router = express.Router();

// ---------- 公开接口组：知识文章 ----------
router.get('/articles', (req, res) => {
  const q = String(req.query.q || '').trim();
  const category = String(req.query.category || '').trim();

  let sql = 'SELECT id, category, title, summary, content, tags, image_url, attachment_url, created_at FROM articles WHERE 1=1';
  const params = [];

  if (category && category !== '全部') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (q) {
    sql += ' AND (title LIKE ? OR summary LIKE ? OR content LIKE ? OR tags LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY id DESC';

  // 分页：LIMIT page_size+1 判断 has_more
  const page = Math.max(1, Math.floor(Number(req.query.page || 1)));
  const pageSize = Math.min(200, Math.max(10, Math.floor(Number(req.query.page_size || 30))));
  const all = db.prepare(sql + ' LIMIT ? OFFSET ?').all(...params, pageSize + 1, (page - 1) * pageSize);
  const hasMore = all.length > pageSize;
  res.json({ list: all.slice(0, pageSize), has_more: hasMore, page, page_size: pageSize });
});

// 返回所有已使用的分类（前端做筛选条用，公开）
router.get('/articles/categories', (req, res) => {
  const rows = db.prepare(
    `SELECT DISTINCT category FROM articles ORDER BY CASE
       WHEN category = '🌱 入门必读' THEN 1
       WHEN category = '🌿 减肥塑形' THEN 2
       WHEN category = '🏃 进阶训练' THEN 3
       WHEN category = '🏅 赛事备赛' THEN 4
       WHEN category = '🥗 营养补给' THEN 5
       WHEN category = '🩹 伤病预防' THEN 6
       ELSE 99 END, id`
  ).all();
  res.json(rows.map((r) => r.category));
});

// 知识文章详情（公开）
router.get('/articles/:id', (req, res) => {
  const id = Number(req.params.id);
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
  if (!article) return res.status(404).json({ error: '文章不存在' });
  res.json(article);
});

// ---------- 公开接口组：排行榜 ----------
// 统一支持前端全部 13 个榜单：week / month / total / club / progress / streak / longest / pb1000 ~ pb42195
// 排行榜本身公开（不带 token 也能看总体榜）；带 token 时只用来：
//   1) scope=club 时锁定"我的社团"
//   2) 社团榜高亮我所在的社团
// 返回格式统一为数组（前端 LeaderboardEntry 按数组解析）
router.get('/leaderboard', (req, res) => {
  const type = String(req.query.type || 'total');
  const scope = String(req.query.scope || 'club'); // club 社团内 | all 总体
  const limitN = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit || 50))));

  // 从 Authorization 解析"我是谁"；解析不到就当匿名访客（只看总体榜）
  let myClubId = null;
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (token) {
    const myRow = db.prepare(
      `SELECT u.club_id FROM tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token = ? AND u.deleted_at IS NULL
         AND (t.expires_at IS NULL OR t.expires_at > datetime('now','localtime'))`
    ).get(token);
    if (myRow) myClubId = myRow.club_id;
  }

  // 社团榜是全平台社团之间对比，不受"社团内/总体"影响
  if (type === 'club') {
    const rows = db.prepare(`
      SELECT c.id AS club_id, c.name AS club_name,
             s.name AS school_name,
             COUNT(DISTINCT u.id) AS member_count,
             COUNT(r.id) AS run_count,
             COALESCE(SUM(r.distance_km), 0) AS total_km
      FROM clubs c
      LEFT JOIN schools s ON s.id = c.school_id
      LEFT JOIN users u ON u.club_id = c.id AND u.deleted_at IS NULL
      LEFT JOIN runs r ON r.user_id = u.id
      GROUP BY c.id
    `).all();
    const list = rows
      .map((r) => ({
        user_id: r.club_id,          // 复用 user_id 字段装社团 id（前端不需要感知）
        nickname: r.school_name || r.club_name, // 每个社团都叫"长跑社"，用学校名做主显示名
        gender: '',
        avatar: '',
        value: Math.round(r.total_km * 100) / 100,
        run_count: r.run_count,
        detail: `${r.club_name} · ${r.member_count} 名成员 · ${r.run_count} 次跑步`,
        is_mine: myClubId != null && r.club_id === myClubId,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, limitN);
    return res.json(list);
  }

  // 社团内榜：没有社团就没有可比的成员，直接返回空列表（不要报错，避免页面显示故障）
  if (scope !== 'all' && myClubId == null) return res.json([]);

  // 范围过滤：总体 = 全部用户；社团内 = 只看本社团；软删除用户一律不上榜
  const whereClub = scope === 'all' ? 'WHERE u.deleted_at IS NULL' : 'WHERE u.club_id = ? AND u.deleted_at IS NULL';
  const clubArgs = scope === 'all' ? [] : [myClubId];

  // ---------- 跑量类：本周距离 / 月跑量 / 总距离（公里数越大越好） ----------
  if (type === 'week' || type === 'month' || type === 'total') {
    let dateCond = '';
    if (type === 'week') dateCond = `AND r.run_date >= '${dateStr(thisMonday())}'`;
    if (type === 'month') {
      const now = new Date();
      dateCond = `AND r.run_date >= '${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01'`;
    }
    const rows = db.prepare(`
      SELECT u.id AS user_id, u.nickname, u.gender, u.avatar,
             COUNT(r.id) AS run_count,
             COALESCE(SUM(r.distance_km), 0) AS total_km
      FROM users u
      LEFT JOIN runs r ON r.user_id = u.id ${dateCond}
      ${whereClub}
      GROUP BY u.id
    `).all(...clubArgs);
    const list = rows
      .filter((r) => r.total_km > 0)
      .map((r) => ({
        user_id: r.user_id,
        nickname: r.nickname,
        gender: r.gender,
        avatar: r.avatar,
        value: Math.round(r.total_km * 100) / 100,
        run_count: r.run_count,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limitN);
    return res.json(list);
  }

  // ---------- 进步之星：本周跑量 − 上周跑量，只显示正增长 ----------
  if (type === 'progress') {
    const monday = thisMonday();
    const lastMonday = new Date(monday);
    lastMonday.setDate(monday.getDate() - 7);
    const mondayStr = dateStr(monday);
    const lastMondayStr = dateStr(lastMonday);
    const rows = db.prepare(`
      SELECT u.id AS user_id, u.nickname, u.gender, u.avatar,
             COALESCE(SUM(CASE WHEN r.run_date >= ? THEN r.distance_km END), 0) AS this_week,
             COALESCE(SUM(CASE WHEN r.run_date >= ? AND r.run_date < ? THEN r.distance_km END), 0) AS last_week
      FROM users u
      LEFT JOIN runs r ON r.user_id = u.id
      ${whereClub}
      GROUP BY u.id
    `).all(mondayStr, lastMondayStr, mondayStr, ...clubArgs);
    const list = rows
      .map((r) => ({
        user_id: r.user_id,
        nickname: r.nickname,
        gender: r.gender,
        avatar: r.avatar,
        value: Math.round((r.this_week - r.last_week) * 100) / 100,
        detail: `本周 ${Math.round(r.this_week * 100) / 100} km · 上周 ${Math.round(r.last_week * 100) / 100} km`,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, limitN);
    return res.json(list);
  }

  // ---------- 连续打卡王：当前连续跑步天数（最近一次必须是今天或昨天） ----------
  if (type === 'streak') {
    const rows = db.prepare(`
      SELECT DISTINCT r.user_id, u.nickname, u.gender, u.avatar, r.run_date
      FROM runs r JOIN users u ON u.id = r.user_id
      ${whereClub}
    `).all(...clubArgs);
    // 按用户分组：user_id -> 日期数组（降序）
    const byUser = new Map();
    for (const row of rows) {
      if (!byUser.has(row.user_id)) byUser.set(row.user_id, { info: row, dates: [] });
      byUser.get(row.user_id).dates.push(row.run_date);
    }
    const today = dateStr(new Date());
    const yd = new Date();
    yd.setDate(yd.getDate() - 1);
    const yesterday = dateStr(yd);
    const list = [];
    for (const { info, dates } of byUser.values()) {
      dates.sort((a, b) => (a < b ? 1 : -1)); // 日期降序
      // 最近一次不是今天/昨天 = 连续已中断，不上榜
      if (dates[0] !== today && dates[0] !== yesterday) continue;
      let streak = 1;
      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1] + 'T00:00:00');
        prev.setDate(prev.getDate() - 1);
        if (dates[i] === dateStr(prev)) streak++;
        else break;
      }
      list.push({
        user_id: info.user_id,
        nickname: info.nickname,
        gender: info.gender,
        avatar: info.avatar,
        value: streak,
        run_date: dates[0], // 最近打卡日期
      });
    }
    list.sort((a, b) => b.value - a.value);
    return res.json(list.slice(0, limitN));
  }

  // ---------- 单次最长距离 ----------
  if (type === 'longest') {
    const rows = db.prepare(`
      SELECT u.id AS user_id, u.nickname, u.gender, u.avatar,
             r.distance_km, r.run_date
      FROM runs r JOIN users u ON u.id = r.user_id
      ${whereClub}
    `).all(...clubArgs);
    const best = new Map();
    for (const row of rows) {
      const cur = best.get(row.user_id);
      if (!cur || row.distance_km > cur.value) {
        best.set(row.user_id, {
          user_id: row.user_id,
          nickname: row.nickname,
          gender: row.gender,
          avatar: row.avatar,
          value: Math.round(row.distance_km * 100) / 100,
          run_date: row.run_date,
        });
      }
    }
    const list = [...best.values()].sort((a, b) => b.value - a.value);
    return res.json(list.slice(0, limitN));
  }

  // ---------- PB 榜：必须实际跑满目标距离，按该次跑步的全程平均速度换算 ----------
  const pbTargets = { pb1000: 1, pb3000: 3, pb5000: 5, pb10000: 10, pb21097: 21.0975, pb42195: 42.195 };
  const targetKm = pbTargets[type];
  if (!targetKm) return res.status(400).json({ error: '排行榜类型不正确' });

  const rows = db.prepare(`
    SELECT u.id AS user_id, u.nickname, u.gender, u.avatar,
           r.distance_km, r.duration_seconds, r.run_date
    FROM runs r
    JOIN users u ON u.id = r.user_id
    ${whereClub}
  `).all(...clubArgs);
  const best = new Map();
  for (const row of rows) {
    const t = equivalentTime(row.distance_km, row.duration_seconds, targetKm);
    if (t === null) continue;
    const cur = best.get(row.user_id);
    if (!cur || t < cur.value) {
      best.set(row.user_id, {
        user_id: row.user_id,
        nickname: row.nickname,
        gender: row.gender,
        avatar: row.avatar,
        value: t,
        run_date: row.run_date,
      });
    }
  }
  const list = [...best.values()].sort((a, b) => a.value - b.value);
  res.json(list.slice(0, limitN));
});

// ---------- 以下接口全部要求登录 ----------
router.use(authRequired);

// 无社团用户拦截：所有 /club/* 接口都要求已加入社团
// （社长申请中的用户 club_id 为 NULL，访问社团接口时给出明确提示，而不是报 500）
router.use('/club', (req, res, next) => {
  if (req.user.club_id == null) {
    return res.status(400).json({ error: '你还没有加入社团' });
  }
  next();
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ============================================================
// 0. 社长申请（无社团用户提交 / 查询自己的申请状态）
// ============================================================

// 提交社长申请：仅限"无社团"用户（已加入社团的人不需要申请）
// 前端传：{ schoolName, clubName?, province?, city?, note? }
router.post('/apply/president', (req, res) => {
  if (req.user.club_id != null) {
    return res.status(400).json({ error: '你已经有社团了，无需申请' });
  }
  const { schoolName, clubName, province, city, note } = req.body || {};
  if (!schoolName || String(schoolName).trim().length < 2) {
    return res.status(400).json({ error: '学校名称至少要 2 个字' });
  }
  // 同一用户同时只能有一条"待审批"申请，防止重复提交刷屏
  const pending = db.prepare(
    "SELECT id FROM president_applications WHERE user_id = ? AND status = 'pending'"
  ).get(req.user.id);
  if (pending) {
    return res.status(400).json({ error: '你已有一条待审批的申请，请耐心等待管理员处理' });
  }
  const info = db.prepare(
    'INSERT INTO president_applications (user_id, school_name, club_name, province, city, note) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    req.user.id,
    String(schoolName).trim(),
    (clubName && String(clubName).trim()) || '长跑社',
    String(province || '').trim(),
    String(city || '').trim(),
    String(note || '').trim()
  );
  res.json({ id: Number(info.lastInsertRowid), message: '申请已提交，请等待管理员审批' });
});

// 查询我最近一条申请（社团 tab 用来展示申请进度）
router.get('/apply/my', (req, res) => {
  const row = db.prepare(
    'SELECT id, school_name, club_name, province, city, note, status, reject_reason, created_at, handled_at FROM president_applications WHERE user_id = ? ORDER BY id DESC LIMIT 1'
  ).get(req.user.id);
  res.json(row || null);
});

// ============================================================
// 0.5 无社团用户：浏览并加入已有社团
// ============================================================

// 可加入的社团列表（登录即可查看）：带学校名、成员数
router.get('/clubs/available', (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.name, c.intro, c.training_time, c.training_place, c.contact,
           s.name AS school_name, s.province, s.city,
           (SELECT COUNT(*) FROM users u WHERE u.club_id = c.id AND u.deleted_at IS NULL) AS member_count
    FROM clubs c
    LEFT JOIN schools s ON s.id = c.school_id
    ORDER BY s.name, c.id
  `).all();
  res.json(rows);
});

// 申请加入社团：仅限无社团用户；提交后由该社团社长或管理员审批
// 前端传：{ clubId, reason? }
router.post('/clubs/join', (req, res) => {
  if (req.user.club_id != null) {
    return res.status(400).json({ error: '你已经加入社团了' });
  }
  const clubId = Number((req.body || {}).clubId);
  const club = db.prepare('SELECT id, name FROM clubs WHERE id = ?').get(clubId);
  if (!club) return res.status(400).json({ error: '社团不存在或已被删除' });

  // 同一用户只能有一条"待审批的入社申请"，避免向多个社团同时刷申请
  const pending = db.prepare(
    "SELECT id, club_id FROM membership_requests WHERE user_id = ? AND type = 'join' AND status = 'pending'"
  ).get(req.user.id);
  if (pending) {
    return res.status(400).json({
      error: pending.club_id === club.id ? '你已提交过该社团的申请，请等待社长审批' : '你已有一条待审批的入社申请，请先撤回再申请其他社团',
    });
  }

  const info = db.prepare(
    "INSERT INTO membership_requests (user_id, club_id, type, reason) VALUES (?, ?, 'join', ?)"
  ).run(req.user.id, club.id, String((req.body || {}).reason || '').trim());

  res.json({
    id: Number(info.lastInsertRowid),
    message: `已向「${club.name}」提交入社申请，请等待社长审批`,
  });
});

// 申请退出社团：已加入社团的用户提交，由社长或管理员审批
// 社长不能直接退社（需要先转让社长或解散社团）
router.post('/clubs/leave', (req, res) => {
  if (req.user.club_id == null) {
    return res.status(400).json({ error: '你还没有加入社团' });
  }
  if (req.user.role === 'president') {
    return res.status(400).json({ error: '社长不能退出社团，请先转让社长或解散社团' });
  }
  // 管理员账号不参与社团成员关系，直接拦截
  if (req.user.role === 'admin') {
    return res.status(400).json({ error: '管理员无需退出社团' });
  }

  const pending = db.prepare(
    "SELECT id FROM membership_requests WHERE user_id = ? AND type = 'leave' AND status = 'pending'"
  ).get(req.user.id);
  if (pending) {
    return res.status(400).json({ error: '你已提交过退社申请，请等待社长审批' });
  }

  const club = db.prepare('SELECT name FROM clubs WHERE id = ?').get(req.user.club_id);
  const info = db.prepare(
    "INSERT INTO membership_requests (user_id, club_id, type, reason) VALUES (?, ?, 'leave', ?)"
  ).run(req.user.id, req.user.club_id, String((req.body || {}).reason || '').trim());

  res.json({
    id: Number(info.lastInsertRowid),
    message: `退社申请已提交，等待「${club ? club.name : '社团'}」社长审批`,
  });
});

// 查询我最近的入社申请和退社申请（社团页展示申请进度）
router.get('/membership/my', (req, res) => {
  const pick = (type) => db.prepare(`
    SELECT r.id, r.club_id, r.type, r.reason, r.status, r.reject_reason, r.created_at, r.handled_at,
           c.name AS club_name, s.name AS school_name
    FROM membership_requests r
    LEFT JOIN clubs c ON c.id = r.club_id
    LEFT JOIN schools s ON s.id = c.school_id
    WHERE r.user_id = ? AND r.type = ?
    ORDER BY r.id DESC LIMIT 1
  `).get(req.user.id, type) || null;
  res.json({ join: pick('join'), leave: pick('leave') });
});

// 撤回自己待审批的申请（入社/退社都可撤回，只能撤回 pending 状态的）
router.post('/membership/requests/:id/cancel', (req, res) => {
  const row = db.prepare('SELECT * FROM membership_requests WHERE id = ?').get(Number(req.params.id));
  if (!row || row.user_id !== req.user.id) {
    return res.status(404).json({ error: '申请不存在' });
  }
  if (row.status !== 'pending') {
    return res.status(400).json({ error: '该申请已被处理，无法撤回' });
  }
  db.prepare(
    "UPDATE membership_requests SET status = 'canceled', handled_at = datetime('now','localtime') WHERE id = ?"
  ).run(row.id);
  res.json({ message: '申请已撤回' });
});

// 待审批的入社/退社申请列表
// 社长：只看自己社团；管理员：可看全部（可传 ?clubId= 过滤某个社团）
router.get('/membership/requests', (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const isPresident = req.user.role === 'president';
  if (!isAdmin && !isPresident) {
    return res.status(403).json({ error: '只有社长或管理员可以查看申请列表' });
  }

  let clubId = null;
  if (isAdmin) {
    if (req.query.clubId) clubId = Number(req.query.clubId);
  } else {
    if (req.user.club_id == null) return res.status(400).json({ error: '你还没有加入社团' });
    clubId = req.user.club_id;
  }

  let sql = `
    SELECT r.id, r.user_id, r.club_id, r.type, r.reason, r.status, r.created_at,
           u.nickname, u.phone, u.gender, u.avatar,
           c.name AS club_name, s.name AS school_name
    FROM membership_requests r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN clubs c ON c.id = r.club_id
    LEFT JOIN schools s ON s.id = c.school_id
    WHERE r.status = 'pending'
  `;
  const params = [];
  if (clubId != null) {
    sql += ' AND r.club_id = ?';
    params.push(clubId);
  }
  sql += ' ORDER BY r.id';

  res.json(db.prepare(sql).all(...params));
});

// 审批前的公共校验：申请必须存在且仍待审批，审批人必须对该社团有权限
function loadRequestForHandle(req, res) {
  const row = db.prepare('SELECT * FROM membership_requests WHERE id = ?').get(Number(req.params.id));
  if (!row) {
    res.status(404).json({ error: '申请不存在' });
    return null;
  }
  if (row.status !== 'pending') {
    res.status(400).json({ error: '该申请已被处理，请刷新列表' });
    return null;
  }
  // 管理员可处理所有社团；社长只能处理自己社团的申请
  if (req.user.role !== 'admin' &&
      !(req.user.role === 'president' && req.user.club_id === row.club_id)) {
    res.status(403).json({ error: '你没有权限审批该申请' });
    return null;
  }
  return row;
}

// 通过申请：入社 → 加入社团并清掉其他待审申请；退社 → 变回无社团用户
router.post('/membership/requests/:id/approve', (req, res) => {
  const row = loadRequestForHandle(req, res);
  if (!row) return;

  const user = db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(row.user_id);
  if (!user) {
    db.prepare(
      "UPDATE membership_requests SET status = 'rejected', reject_reason = '申请人账号已不存在', handled_by = ?, handled_at = datetime('now','localtime') WHERE id = ?"
    ).run(req.user.id, row.id);
    return res.status(400).json({ error: '申请人账号已不存在，已自动驳回' });
  }
  // 社团名称用于通知文案
  const clubRow = db.prepare('SELECT name FROM clubs WHERE id = ?').get(row.club_id);
  const clubName = clubRow ? clubRow.name : '该社团';

  db.exec('BEGIN');
  try {
    if (row.type === 'join') {
      // 申请人已经加入了别的社团：自动驳回
      if (user.club_id != null) {
        db.prepare(
          "UPDATE membership_requests SET status = 'rejected', reject_reason = '该用户已加入其他社团', handled_by = ?, handled_at = datetime('now','localtime') WHERE id = ?"
        ).run(req.user.id, row.id);
        db.exec('COMMIT');
        notify(user.id, 'join', '入社申请未通过', `「${clubName}」已自动驳回：你已加入其他社团`);
        return res.status(400).json({ error: '该用户已加入其他社团，已自动驳回' });
      }
      const club = db.prepare('SELECT id, school_id FROM clubs WHERE id = ?').get(row.club_id);
      if (!club) {
        db.prepare(
          "UPDATE membership_requests SET status = 'rejected', reject_reason = '该社团已被删除', handled_by = ?, handled_at = datetime('now','localtime') WHERE id = ?"
        ).run(req.user.id, row.id);
        db.exec('COMMIT');
        notify(user.id, 'join', '入社申请未通过', '该社团已被删除');
        return res.status(400).json({ error: '该社团已被删除，已自动驳回' });
      }
      // 加入社团：学校归属跟随社团
      db.prepare('UPDATE users SET club_id = ?, school_id = ? WHERE id = ?')
        .run(club.id, club.school_id, user.id);
      // 已经入社后，待审批的社长申请作废，避免管理员批到一半
      db.prepare(
        "UPDATE president_applications SET status = 'rejected', reject_reason = '用户已加入其他社团', handled_at = datetime('now','localtime') WHERE user_id = ? AND status = 'pending'"
      ).run(user.id);
      // 同一个人其他社团的入社申请一并驳回
      db.prepare(
        "UPDATE membership_requests SET status = 'rejected', reject_reason = '该用户已加入其他社团', handled_at = datetime('now','localtime') WHERE user_id = ? AND type = 'join' AND status = 'pending' AND id != ?"
      ).run(user.id, row.id);
    } else if (row.type === 'leave') {
      if (user.club_id !== row.club_id) {
        db.prepare(
          "UPDATE membership_requests SET status = 'rejected', reject_reason = '该用户已不在本社团', handled_by = ?, handled_at = datetime('now','localtime') WHERE id = ?"
        ).run(req.user.id, row.id);
        db.exec('COMMIT');
        return res.status(400).json({ error: '该用户已不在本社团，已自动驳回' });
      }
      if (user.role === 'president') {
        db.exec('ROLLBACK');
        return res.status(400).json({ error: '社长不能退出社团，请先转让社长或解散社团' });
      }
      // 退社：变回无社团用户，学校归属一并清空
      db.prepare('UPDATE users SET club_id = NULL, school_id = NULL WHERE id = ?').run(user.id);
      // 该用户其他待审申请一并作废
      db.prepare(
        "UPDATE membership_requests SET status = 'canceled', handled_at = datetime('now','localtime') WHERE user_id = ? AND status = 'pending' AND id != ?"
      ).run(user.id, row.id);
    }

    db.prepare(
      "UPDATE membership_requests SET status = 'approved', handled_by = ?, handled_at = datetime('now','localtime') WHERE id = ?"
    ).run(req.user.id, row.id);
    db.exec('COMMIT');
    // 审批结果通过站内通知告诉申请人
    if (row.type === 'join') {
      notify(row.user_id, 'join', '入社申请已通过', `你已成功加入「${clubName}」`);
    } else {
      notify(row.user_id, 'leave', '退社申请已通过', `你已退出「${clubName}」，现在是无社团用户`);
    }
    res.json({ message: row.type === 'join' ? '已同意加入社团' : '已同意退出社团' });
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('审批社团申请失败：', e);
    res.status(500).json({ error: '审批失败，请稍后重试' });
  }
});

// 驳回申请：需要填写驳回原因（前端可留空，后端给默认文案）
router.post('/membership/requests/:id/reject', (req, res) => {
  const row = loadRequestForHandle(req, res);
  if (!row) return;

  // 驳回原因强制必填：申请人收到驳回通知需要知道原因
  const reason = String((req.body || {}).reason || '').trim();
  if (reason.length < 2) return res.status(400).json({ error: '请填写驳回原因（至少 2 个字）' });
  db.prepare(
    "UPDATE membership_requests SET status = 'rejected', reject_reason = ?, handled_by = ?, handled_at = datetime('now','localtime') WHERE id = ?"
  ).run(reason, req.user.id, row.id);
  // 通知申请人被驳回（附上原因）
  const c = db.prepare('SELECT name FROM clubs WHERE id = ?').get(row.club_id);
  notify(
    row.user_id,
    row.type,
    row.type === 'join' ? '入社申请未通过' : '退社申请未通过',
    `「${c ? c.name : '社团'}」：${reason}`
  );
  res.json({ message: '已驳回申请' });
});

// ============================================================
// 0. 消息中心（站内通知）
// 所有登录用户都可以看自己的通知；未读数用于首页红点角标
// ============================================================

// 我的通知列表（默认最近 50 条，?onlyUnread=1 只看未读）
router.get('/notifications', (req, res) => {
  const onlyUnread = String(req.query.onlyUnread || '') === '1';
  let sql = 'SELECT id, type, title, content, club_id, is_read, created_at FROM notifications WHERE user_id = ?';
  if (onlyUnread) sql += ' AND is_read = 0';
  sql += ' ORDER BY id DESC LIMIT 50';
  res.json(db.prepare(sql).all(req.user.id));
});

// 未读数量（首页铃铛角标用）
router.get('/notifications/unread-count', (req, res) => {
  const row = db.prepare(
    'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(req.user.id);
  res.json({ count: row.c });
});

// 把一条通知标记为已读（只能操作自己的）
router.post('/notifications/:id/read', (req, res) => {
  const info = db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
  ).run(Number(req.params.id), req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: '通知不存在' });
  res.json({ message: '已读' });
});

// 一键全部已读
router.post('/notifications/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
  res.json({ message: '已全部标记为已读' });
});

// ============================================================
// 全员沟通（广播）：管理员发的全员消息，所有登录用户可查看并回复
// ============================================================
// 全员消息列表（最近 50 条，带回复数）
router.get('/broadcasts', (req, res) => {
  const rows = db.prepare(`
    SELECT b.id, b.title, b.content, b.created_at,
           u.nickname AS admin_nickname,
           (SELECT COUNT(*) FROM broadcast_replies r WHERE r.broadcast_id = b.id) AS reply_count
    FROM broadcasts b
    LEFT JOIN users u ON u.id = b.admin_id
    ORDER BY b.id DESC
    LIMIT 50
  `).all();
  res.json(rows);
});

// 用户回复某条全员消息
router.post('/broadcasts/:id/reply', (req, res) => {
  const id = Number(req.params.id);
  const b = db.prepare('SELECT id FROM broadcasts WHERE id = ?').get(id);
  if (!b) return res.status(404).json({ error: '消息不存在' });
  const content = String((req.body || {}).content || '').trim();
  if (content.length < 1 || content.length > 500) {
    return res.status(400).json({ error: '回复内容需 1-500 字' });
  }
  db.prepare(
    'INSERT INTO broadcast_replies (broadcast_id, user_id, content) VALUES (?, ?, ?)'
  ).run(id, req.user.id, content);
  res.json({ message: '回复已发送' });
});

// ============================================================
// 1. 跑步知识
// ============================================================

// 所有人都能看知识列表（登录即可）
// 支持 ?q=关键词 模糊搜索（标题/摘要/内容/标签）+ ?category=分类 精确筛选
router.get('/articles', (req, res) => {
  const q = String(req.query.q || '').trim();
  const category = String(req.query.category || '').trim();

  let sql = 'SELECT id, category, title, summary, content, tags, image_url, attachment_url, created_at FROM articles WHERE 1=1';
  const params = [];

  if (category && category !== '全部') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (q) {
    sql += ' AND (title LIKE ? OR summary LIKE ? OR content LIKE ? OR tags LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY id DESC';

  // 分页：LIMIT page_size+1 判断 has_more
  const page = Math.max(1, Math.floor(Number(req.query.page || 1)));
  const pageSize = Math.min(200, Math.max(10, Math.floor(Number(req.query.page_size || 30))));
  const all = db.prepare(sql + ' LIMIT ? OFFSET ?').all(...params, pageSize + 1, (page - 1) * pageSize);
  const hasMore = all.length > pageSize;
  res.json({ list: all.slice(0, pageSize), has_more: hasMore, page, page_size: pageSize });
});

// 返回所有已使用的分类（前端做筛选条用）
// 按"跑步人群"的学习逻辑排序：入门 → 减肥 → 进阶 → 赛事 → 营养 → 损伤
// 管理员新增的其它分类自动排在最后
router.get('/articles/categories', (req, res) => {
  const rows = db.prepare(
    `SELECT DISTINCT category FROM articles ORDER BY CASE
       WHEN category = '🌱 入门必读' THEN 1
       WHEN category = '⚖️ 减肥专区' THEN 2
       WHEN category = '🚀 进阶提升' THEN 3
       WHEN category = '🏆 赛事备赛' THEN 4
       WHEN category = '🥗 营养恢复' THEN 5
       WHEN category = '🩹 损伤防护' THEN 6
       ELSE 99 END, category`
  ).all();
  res.json(rows.map((r) => r.category));
});

// 发文章：只有管理员可以（保证内容质量，避免任何人乱发）
router.post('/articles', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '只有管理员能发布知识文章' });
  }
  const { category, title, summary, content, tags, image_url, attachment_url } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: '标题不能为空' });
  }
  if (!content || !String(content).trim()) {
    return res.status(400).json({ error: '内容不能为空' });
  }
  const info = db.prepare(
    'INSERT INTO articles (category, title, summary, content, tags, image_url, attachment_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    String(category || '基础知识').trim(),
    String(title).trim(),
    String(summary || '').trim(),
    String(content).trim(),
    String(tags || '').trim(),
    String(image_url || '').trim(),
    String(attachment_url || '').trim()
  );
  res.json({ id: Number(info.lastInsertRowid), message: '发布成功' });
});

// 编辑文章：只有管理员可以（后台"知识文章"页签用）
router.put('/articles/:id', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '只有管理员能编辑知识文章' });
  }
  const id = Number(req.params.id);
  const old = db.prepare('SELECT id FROM articles WHERE id = ?').get(id);
  if (!old) return res.status(404).json({ error: '文章不存在' });

  const { category, title, summary, content, tags, image_url, attachment_url } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: '标题不能为空' });
  }
  if (!content || !String(content).trim()) {
    return res.status(400).json({ error: '内容不能为空' });
  }
  db.prepare(`
    UPDATE articles
    SET category = ?, title = ?, summary = ?, content = ?, tags = ?, image_url = ?, attachment_url = ?
    WHERE id = ?
  `).run(
    String(category || '基础知识').trim(),
    String(title).trim(),
    String(summary || '').trim(),
    String(content).trim(),
    String(tags || '').trim(),
    String(image_url || '').trim(),
    String(attachment_url || '').trim(),
    id
  );
  res.json({ message: '已保存' });
});

// 删文章：只有管理员可以
router.delete('/articles/:id', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '只有管理员能删除知识文章' });
  }
  db.prepare('DELETE FROM articles WHERE id = ?').run(Number(req.params.id));
  res.json({ message: '已删除' });
});

// ============================================================
// 2. 跑步计划 2.0（五大目标类型 + 进度跟踪 + 周课表打卡）
// 目标类型：volume 跑量 / speed 速度 / habit 习惯 / race 赛事 / weight 体重
// 进度、状态、课表打卡全部由后端统一计算，前端只负责展示
// ============================================================

// 工具：解析 goal_data JSON（存坏了也不让接口 500，返回空对象兜底）
function parseGoalData(s) {
  try { return JSON.parse(s || '{}') || {}; } catch { return {}; }
}

// 工具：两个 YYYY-MM-DD 相差的天数（a - b，正数表示 a 更晚）
function daysBetween(a, b) {
  return Math.round((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 86400000);
}

// 工具：日期加 n 天，返回 YYYY-MM-DD
function addDays(dateStrIn, n) {
  const d = new Date(dateStrIn + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return dateStr(d);
}

// 工具：返回某日期所在周的周一（YYYY-MM-DD）
// 为什么需要：课表的 day=1 指周一，但用户可能是周三、周四才创建计划；
// 如果直接把 start_date 当成周一，周四的任务会被算成周日，当天就打卡不了。
// 统一规则：计划第 1 周 = 开始日期所在的那个周一 ~ 周日。
function weekMondayOf(dateString) {
  const d = new Date(dateString + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7; // 周一=0 ... 周日=6
  d.setDate(d.getDate() - dow);
  return dateStr(d);
}

// 工具：秒数格式化成 "分:秒" 或 "时:分:秒"（进度文案用）
function fmtSec(total) {
  const s = Math.max(0, Math.round(total));
  if (s >= 3600) {
    return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// 查我的所有计划：每条都带上实时进度（百分比 / 状态 / 一句话进度 / 附加数据）
router.get('/plans', (req, res) => {
  const plans = db.prepare('SELECT * FROM plans WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  const runs = db.prepare('SELECT run_date, distance_km, duration_seconds FROM runs WHERE user_id = ? ORDER BY run_date').all(req.user.id);
  const todayStr = dateStr(new Date());
  const mondayStr = dateStr(thisMonday());
  const weekKm = Math.round(
    runs.filter((r) => r.run_date >= mondayStr && r.run_date <= todayStr)
      .reduce((s, r) => s + r.distance_km, 0) * 100
  ) / 100;

  const out = plans.map((p) => {
    const g = parseGoalData(p.goal_data);
    // 统一按"周一~周日"为一周：第 1 周从开始日期所在周的周一算起
    const planStart = weekMondayOf(p.start_date);
    const endStr = addDays(planStart, p.weeks * 7 - 1); // 计划最后一天（最后一周的周日）
    const inWindow = runs.filter((r) => r.run_date >= p.start_date && r.run_date <= endStr);
    const doneKm = Math.round(inWindow.reduce((s, r) => s + r.distance_km, 0) * 100) / 100;

    let percent = 0;
    let achieved = false;
    let statLine = '';
    const extra = {};

    // ---------- 跑量目标：累计公里数 ----------
    if (p.goal_type === 'volume') {
      percent = p.target_km > 0 ? (doneKm / p.target_km) * 100 : 0;
      achieved = p.target_km > 0 && doneKm >= p.target_km;
      statLine = `已跑 ${doneKm} / ${p.target_km} km`;
      extra.done_km = doneKm;
      // 本周跑量超过周均值 130% → 过量训练提醒（对接"超量恢复"知识）
      const weeklyTarget = p.target_km / p.weeks;
      if (weeklyTarget > 0 && weekKm > weeklyTarget * 1.3) extra.overtrain = true;
    }

    // ---------- 速度目标：该距离的最好成绩 ----------
    else if (p.goal_type === 'speed') {
      const dist = Number(g.distance_km) || p.target_km || 1;
      let best = null;
      for (const r of runs) {
        const t = equivalentTime(r.distance_km, r.duration_seconds, dist);
        if (t !== null && (best === null || t < best)) best = t;
      }
      const targetSec = Math.round(Number(g.target_seconds) || 0);
      extra.distance_km = dist;
      extra.target_seconds = targetSec;
      extra.best_seconds = best;
      if (best === null) {
        statLine = `还没有跑满 ${dist} km 的记录，先完成一次吧`;
      } else if (targetSec > 0) {
        achieved = best <= targetSec;
        percent = Math.min(100, (targetSec / best) * 100);
        statLine = achieved
          ? `目标达成！当前最好 ${fmtSec(best)}`
          : `当前最好 ${fmtSec(best)}，距目标还差 ${fmtSec(best - targetSec)}`;
      } else {
        // 没填目标成绩：跑出该距离的完整成绩就算达成
        achieved = true;
        percent = 100;
        statLine = `当前最好 ${fmtSec(best)}`;
      }
    }

    // ---------- 习惯目标：每周 N 次 或 连续 N 天 ----------
    else if (p.goal_type === 'habit') {
      if (g.freq_type === 'streak') {
        // 连续打卡：窗口内最长连续天数
        const dates = [...new Set(inWindow.map((r) => r.run_date))].sort();
        let maxS = 0;
        let curS = 0;
        let prev = null;
        for (const d of dates) {
          curS = prev !== null && daysBetween(d, prev) === 1 ? curS + 1 : 1;
          if (curS > maxS) maxS = curS;
          prev = d;
        }
        // 当前连胜：最近一次是今天或昨天才算"活着"
        let curStreak = 0;
        if (dates.length) {
          const last = dates[dates.length - 1];
          if (last === todayStr || last === addDays(todayStr, -1)) {
            curStreak = 1;
            for (let i = dates.length - 1; i > 0; i--) {
              if (daysBetween(dates[i], dates[i - 1]) === 1) curStreak++;
              else break;
            }
          }
        }
        const goal = Math.round(Number(g.freq_value) || 21);
        extra.freq_type = 'streak';
        extra.max_streak = maxS;
        extra.current_streak = curStreak;
        percent = Math.min(100, (maxS / goal) * 100);
        achieved = maxS >= goal;
        statLine = `当前连续 ${curStreak} 天 · 最长 ${maxS} / ${goal} 天`;
      } else {
        // 每周 N 次：统计达标周数
        const perWeek = Math.round(Number(g.freq_value) || 3);
        const weeksDone = [];
        let doneWeeks = 0;
        for (let wi = 0; wi < p.weeks; wi++) {
          const ws = addDays(planStart, wi * 7);
          const we = addDays(ws, 6);
          const c = inWindow.filter((r) => r.run_date >= ws && r.run_date <= we).length;
          weeksDone.push(c >= perWeek);
          if (c >= perWeek) doneWeeks++;
        }
        extra.freq_type = 'week';
        extra.freq_value = perWeek;
        extra.weeks_done = weeksDone;
        percent = Math.min(100, (doneWeeks / p.weeks) * 100);
        achieved = doneWeeks >= p.weeks;
        statLine = `${doneWeeks} / ${p.weeks} 周达标（每周 ${perWeek} 次）`;
      }
    }

    // ---------- 赛事目标：训练量 + 倒计时 ----------
    else if (p.goal_type === 'race') {
      const weeklyKm = Number(g.weekly_km) || 0;
      const plannedTotal = Math.round(weeklyKm * p.weeks * 10) / 10;
      percent = plannedTotal > 0 ? (doneKm / plannedTotal) * 100 : 0;
      extra.race_name = g.race_name || '';
      extra.race_date = g.race_date || '';
      extra.done_km = doneKm;
      extra.planned_total = plannedTotal;
      if (g.race_date) extra.countdown_days = daysBetween(g.race_date, todayStr);
      // 目标成绩：跑满比赛距离的最好成绩
      const raceKm = Number(g.race_km) || p.target_km || 1;
      const t = Math.round(Number(g.target_seconds) || 0);
      if (t > 0) {
        let best = null;
        for (const r of runs) {
          const tt = equivalentTime(r.distance_km, r.duration_seconds, raceKm);
          if (tt !== null && (best === null || tt < best)) best = tt;
        }
        extra.target_seconds = t;
        extra.best_seconds = best;
        if (best !== null && best <= t) achieved = true;
      }
      statLine = `已训练 ${doneKm} / ${plannedTotal} km`;
      if (g.race_date) {
        const cd = extra.countdown_days;
        statLine += cd > 0 ? ` · 距比赛还有 ${cd} 天` : ' · 比赛日已到/已过，冲吧！';
      }
      // 过量提醒
      if (weeklyKm > 0 && weekKm > weeklyKm * 1.3) extra.overtrain = true;
    }

    // ---------- 体重目标：体重曲线 ----------
    else if (p.goal_type === 'weight') {
      const logs = db.prepare('SELECT log_date, weight_kg FROM weight_logs WHERE user_id = ? ORDER BY log_date').all(req.user.id);
      extra.weight_logs = logs;
      const start = Number(g.start_kg) || 0;
      const target = Number(g.target_kg) || 0;
      const latest = logs.length ? logs[logs.length - 1].weight_kg : start;
      extra.start_kg = start;
      extra.target_kg = target;
      extra.latest_weight = latest;
      const total = Math.abs(start - target);
      percent = total > 0 ? Math.min(100, (Math.abs(start - latest) / total) * 100) : 0;
      achieved = total > 0 && ((target <= start && latest <= target) || (target > start && latest >= target));
      statLine = logs.length
        ? `当前 ${latest} kg · 距目标还差 ${Math.abs(latest - target).toFixed(1)} kg`
        : '还没有体重记录，去详情页记一笔吧';
    }

    // 状态：achieved 达成 > pending 未开始 > expired 逾期 > active 进行中
    const status = achieved
      ? 'achieved'
      : (todayStr < p.start_date ? 'pending' : (todayStr > endStr ? 'expired' : 'active'));

    return {
      ...p,
      goal_data: g,
      status,
      percent: Math.round(percent),
      stat_line: statLine,
      end_date: endStr,
      extra,
    };
  });

  // N3：附带每个计划的课表打卡记录（["1-2", ...] 表示 第1周周二 已打卡）
  // 一次查全量，避免前端逐计划请求；打卡数据量很小（每周最多 7 条）
  const planIds = plans.map((p) => p.id);
  const checkinRows = planIds.length
    ? db.prepare(`SELECT plan_id, week_no, day FROM plan_checkins WHERE plan_id IN (${planIds.map(() => '?').join(',')})`).all(...planIds)
    : [];
  const checkinMap = {};
  for (const r of checkinRows) {
    (checkinMap[r.plan_id] = checkinMap[r.plan_id] || []).push(`${r.week_no}-${r.day}`);
  }
  for (const o of out) o.checkins = checkinMap[o.id] || [];

  res.json(out);
});

// ---------- 课表打卡（N3）：跑完在课表上打勾 ----------
// 切换打卡状态：已打卡 → 取消；未打卡 → 打卡
// body: { week_no: 1..weeks, day: 1..7 }
// 规则：
//   1. 只能给自己的计划打卡（社长能改社员计划，但打卡是本人行为）
//   2. 只能打卡"训练日"（课表中有安排的日期，休息日不可打卡）
//   3. 只能打卡计划周期内的周次
//   4. 不允许给未来日期打卡（week_no/day 对应的日期必须 <= 今天）
router.post('/plans/:id/checkins/toggle', (req, res) => {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(Number(req.params.id));
  if (!plan) return res.status(404).json({ error: '计划不存在' });
  if (plan.user_id !== req.user.id) {
    return res.status(403).json({ error: '只能给自己的计划打卡' });
  }
  const weekNo = Math.round(Number(req.body?.week_no));
  const day = Math.round(Number(req.body?.day));
  if (!Number.isFinite(weekNo) || weekNo < 1 || weekNo > plan.weeks) {
    return res.status(400).json({ error: `周次需在 1-${plan.weeks} 之间` });
  }
  if (!Number.isFinite(day) || day < 1 || day > 7) {
    return res.status(400).json({ error: '星期需在 1-7 之间' });
  }
  // 该天必须是训练日（课表里有安排，且不是"休息"）
  const g = parseGoalData(plan.goal_data);
  const sched = Array.isArray(g.schedule) ? g.schedule : [];
  const item = sched.find((s) => Math.round(Number(s?.day)) === day);
  if (!item || item.type === '休息') {
    return res.status(400).json({ error: '这一天没有安排训练，无需打卡' });
  }
  // 计算该节课对应的具体日期：第 1 周从 start_date 所在周的周一算起，
  // 这样周四创建的计划，周四的课就对应今天，可以正常打卡
  const planStart = weekMondayOf(plan.start_date);
  const targetDate = addDays(planStart, (weekNo - 1) * 7 + (day - 1));
  const todayStr = dateStr(new Date());
  if (targetDate < plan.start_date) {
    return res.status(400).json({ error: '计划开始前的日子不能打卡' });
  }
  if (targetDate > todayStr) {
    return res.status(400).json({ error: '还没到那一天，不能提前打卡' });
  }

  const existing = db.prepare(
    'SELECT id FROM plan_checkins WHERE plan_id = ? AND week_no = ? AND day = ?'
  ).get(plan.id, weekNo, day);
  if (existing) {
    db.prepare('DELETE FROM plan_checkins WHERE id = ?').run(existing.id);
    return res.json({ checked: false, message: '已取消打卡' });
  }
  db.prepare(
    'INSERT INTO plan_checkins (plan_id, user_id, week_no, day) VALUES (?, ?, ?, ?)'
  ).run(plan.id, req.user.id, weekNo, day);
  res.json({ checked: true, message: '打卡成功' });
});

// ---------- 计划参数校验与权限（POST 新建 / PUT 修改共用） ----------

// 校验并规范化计划参数；通过返回字段对象，失败返回 { error }
function validatePlanPayload(body) {
  const { title, target_km, weeks, start_date, intensity, note, goal_type, goal_data } = body || {};
  if (!title || !String(title).trim()) return { error: '计划名称不能为空' };
  const w = Math.round(Number(weeks));
  if (!Number.isFinite(w) || w < 1 || w > 52) return { error: '周期必须是 1-52 周' };
  if (!DATE_RE.test(String(start_date || ''))) return { error: '开始日期格式不正确' };
  const inten = ['低', '中等', '高'].includes(intensity) ? intensity : '中等';
  const type = ['volume', 'speed', 'habit', 'race', 'weight'].includes(goal_type) ? goal_type : 'volume';
  const gd = goal_data || {};

  let km = Number(target_km);
  let data = {};

  if (type === 'volume') {
    // 跑量目标：总公里数
    if (!Number.isFinite(km) || km <= 0) return { error: '目标跑量必须大于 0' };
  } else if (type === 'speed') {
    // 速度目标：距离 + 可选目标成绩（秒）
    const dist = Number(gd.distance_km);
    if (!Number.isFinite(dist) || dist <= 0) return { error: '目标距离不正确' };
    km = dist;
    data = { distance_km: dist, target_seconds: Math.max(0, Math.round(Number(gd.target_seconds) || 0)) };
  } else if (type === 'habit') {
    // 习惯目标：每周 N 次 或 连续 N 天
    const ft = gd.freq_type === 'streak' ? 'streak' : 'week';
    const fv = Math.round(Number(gd.freq_value));
    if (!Number.isFinite(fv) || fv < 1 || fv > 365) return { error: '打卡目标不正确' };
    if (ft === 'week' && fv > 7) return { error: '每周次数不能超过 7' };
    km = Number.isFinite(km) && km > 0 ? km : 10; // 跑量仅作参考展示
    data = { freq_type: ft, freq_value: fv };
  } else if (type === 'race') {
    // 赛事目标：比赛名 / 日期 / 距离 / 周跑量 / 可选目标成绩
    const raceName = String(gd.race_name || '').trim();
    if (!raceName) return { error: '请填写比赛名称' };
    if (gd.race_date && !DATE_RE.test(String(gd.race_date))) return { error: '比赛日期格式不正确' };
    const raceKm = Number(gd.race_km);
    const weeklyKm = Number(gd.weekly_km);
    if (!Number.isFinite(raceKm) || raceKm <= 0) return { error: '比赛距离必须大于 0' };
    if (!Number.isFinite(weeklyKm) || weeklyKm <= 0) return { error: '每周目标跑量必须大于 0' };
    km = Math.round(weeklyKm * w * 10) / 10; // 总跑量 = 周跑量 × 周数
    data = {
      race_name: raceName,
      race_date: String(gd.race_date || ''),
      race_km: raceKm,
      weekly_km: weeklyKm,
      target_seconds: Math.max(0, Math.round(Number(gd.target_seconds) || 0)),
    };
  } else {
    // 体重目标：起始体重 → 目标体重
    const sk = Number(gd.start_kg);
    const tk = Number(gd.target_kg);
    if (!Number.isFinite(sk) || sk < 20 || sk > 300) return { error: '起始体重需在 20-300 kg 之间' };
    if (!Number.isFinite(tk) || tk < 20 || tk > 300) return { error: '目标体重需在 20-300 kg 之间' };
    if (sk === tk) return { error: '目标体重不能等于起始体重' };
    km = 0;
    data = { start_kg: sk, target_kg: tk };
  }

  // 周课表（可选）：day=星期几(1周一~7周日)，type=课表类型，km=建议距离
  // 课表类型校验：力量训练为新名称；交叉训练是旧数据兼容别名，新计划统一用力量训练
  const scheduleTypes = ['轻松跑', '配速跑', '间歇', '长距离', '休息', '力量训练', '交叉训练'];
  if (Array.isArray(gd.schedule)) {
    data.schedule = gd.schedule.slice(0, 7).map((it) => ({
      day: Math.min(7, Math.max(1, Math.round(Number(it?.day) || 1))),
      type: scheduleTypes.includes(it?.type) ? it.type : '轻松跑',
      km: Math.max(0, Number(it?.km) || 0),
    }));
  }

  return {
    title: String(title).trim(),
    km,
    w,
    startDate: String(start_date),
    intensity: inten,
    note: String(note || '').trim(),
    type,
    data,
  };
}

// 计划管理权限：本人 / 管理员 / 计划归属者的本社社长
function canManagePlan(req, plan) {
  if (plan.user_id === req.user.id) return true;
  if (req.user.role === 'admin') return true;
  if (req.user.role === 'president') {
    const owner = db.prepare('SELECT club_id FROM users WHERE id = ?').get(plan.user_id);
    // owner.club_id 为 NULL（无社团用户）时不允许任何社长代管，防止 null === null 误判
    return !!owner && owner.club_id != null && owner.club_id === req.user.club_id;
  }
  return false;
}

// 新建计划：按目标类型分别校验参数
// 支持 for_user_id：社长/管理员给本社社员制定计划（仅社长/管理员可用）
router.post('/plans', (req, res) => {
  const { for_user_id } = req.body || {};

  // 决定计划归属用户：默认是自己；社长/管理员可指定本社社员
  let ownerId = req.user.id;
  if (for_user_id != null) {
    if (req.user.role !== 'president' && req.user.role !== 'admin') {
      return res.status(403).json({ error: '只有社长或管理员可以为社员制定计划' });
    }
    const target = db.prepare('SELECT id, club_id FROM users WHERE id = ?').get(Number(for_user_id));
    if (!target) return res.status(404).json({ error: '社员不存在' });
    if (target.club_id !== req.user.club_id) {
      return res.status(403).json({ error: '只能为本社团社员制定计划' });
    }
    ownerId = target.id;
  }

  const v = validatePlanPayload(req.body);
  if (v.error) return res.status(400).json({ error: v.error });

  const info = db.prepare(
    'INSERT INTO plans (user_id, title, target_km, weeks, start_date, intensity, note, goal_type, goal_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(ownerId, v.title, v.km, v.w, v.startDate, v.intensity, v.note, v.type, JSON.stringify(v.data));
  res.json({ id: Number(info.lastInsertRowid), message: '创建成功' });
});

// 修改计划：本人 / 管理员 / 本社社长（社长可改本社社员的计划）
router.put('/plans/:id', (req, res) => {
  const plan = db.prepare('SELECT user_id FROM plans WHERE id = ?').get(Number(req.params.id));
  if (!plan) return res.status(404).json({ error: '计划不存在' });
  if (!canManagePlan(req, plan)) {
    return res.status(403).json({ error: '没有权限修改这个计划' });
  }
  const v = validatePlanPayload(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  db.prepare(
    'UPDATE plans SET title = ?, target_km = ?, weeks = ?, start_date = ?, intensity = ?, note = ?, goal_type = ?, goal_data = ? WHERE id = ?'
  ).run(v.title, v.km, v.w, v.startDate, v.intensity, v.note, v.type, JSON.stringify(v.data), Number(req.params.id));
  res.json({ message: '已保存' });
});

// 删除计划：本人 / 管理员 / 本社社长（社长可删本社社员的计划）
router.delete('/plans/:id', (req, res) => {
  const plan = db.prepare('SELECT user_id FROM plans WHERE id = ?').get(Number(req.params.id));
  if (!plan) return res.status(404).json({ error: '计划不存在' });
  if (!canManagePlan(req, plan)) {
    return res.status(403).json({ error: '没有权限删除这个计划' });
  }
  // 先删课表打卡记录，再删计划（避免留下孤儿打卡数据）
  db.prepare('DELETE FROM plan_checkins WHERE plan_id = ?').run(Number(req.params.id));
  db.prepare('DELETE FROM plans WHERE id = ?').run(Number(req.params.id));
  res.json({ message: '已删除' });
});

// ---------- 计划模板库：所有人可看，管理员可增删 ----------

// 模板列表（按 sort_order 排序）
router.get('/plan-templates', (req, res) => {
  const rows = db.prepare('SELECT * FROM plan_templates ORDER BY sort_order, id').all();
  res.json(rows.map((t) => ({ ...t, goal_data: parseGoalData(t.goal_data) })));
});

// ---------- 体重记录（体重目标计划配套） ----------

// 查我的全部体重记录（按日期升序，画曲线用）
router.get('/weights', (req, res) => {
  const rows = db.prepare('SELECT log_date, weight_kg FROM weight_logs WHERE user_id = ? ORDER BY log_date').all(req.user.id);
  res.json(rows);
});

// 记/改一天的体重（同一天重复记录 = 覆盖）
router.post('/weights', (req, res) => {
  const { log_date, weight_kg } = req.body || {};
  if (!DATE_RE.test(String(log_date || ''))) {
    return res.status(400).json({ error: '日期格式不正确' });
  }
  const kg = Number(weight_kg);
  if (!Number.isFinite(kg) || kg < 20 || kg > 300) {
    return res.status(400).json({ error: '体重需在 20-300 kg 之间' });
  }
  db.prepare(`
    INSERT INTO weight_logs (user_id, log_date, weight_kg) VALUES (?, ?, ?)
    ON CONFLICT(user_id, log_date) DO UPDATE SET weight_kg = excluded.weight_kg
  `).run(req.user.id, String(log_date), kg);
  res.json({ message: '已记录' });
});

// ============================================================
// 3. 社团公告 / 社团任务
// ============================================================

// 查看本社团公告（按时间倒序）
router.get('/club/announcements', (req, res) => {
  const rows = db.prepare(`
    SELECT a.id, a.title, a.content, a.created_at,
           u.nickname AS author_nickname, u.avatar AS author_avatar
    FROM announcements a
    JOIN users u ON u.id = a.user_id
    WHERE a.club_id = ?
    ORDER BY a.id DESC
  `).all(req.user.club_id);
  res.json(rows);
});

// 发公告：只有本社团社长可以
router.post('/club/announcements', (req, res) => {
  if (req.user.role !== 'president' && req.user.role !== 'admin') {
    return res.status(403).json({ error: '只有社长能发布公告' });
  }
  const { title, content } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: '公告标题不能为空' });
  }
  if (!content || !String(content).trim()) {
    return res.status(400).json({ error: '公告内容不能为空' });
  }
  const info = db.prepare(
    'INSERT INTO announcements (club_id, user_id, title, content) VALUES (?, ?, ?, ?)'
  ).run(req.user.club_id, req.user.id, String(title).trim(), String(content).trim());
  // 通知本社团其他成员（发布人自己不用收）
  notifyClub(
    req.user.club_id,
    'announcement',
    `新公告：${String(title).trim()}`,
    String(content).trim().slice(0, 60),
    req.user.id
  );
  res.json({ id: Number(info.lastInsertRowid), message: '发布成功' });
});

// 删公告：本社团社长或管理员
router.delete('/club/announcements/:id', (req, res) => {
  const a = db.prepare('SELECT club_id FROM announcements WHERE id = ?').get(Number(req.params.id));
  if (!a) return res.status(404).json({ error: '公告不存在' });
  const isMyClubPresident = req.user.role === 'president' && a.club_id === req.user.club_id;
  if (!isMyClubPresident && req.user.role !== 'admin') {
    return res.status(403).json({ error: '只有本社团社长能删除公告' });
  }
  db.prepare('DELETE FROM announcements WHERE id = ?').run(Number(req.params.id));
  res.json({ message: '已删除' });
});

// 查看本社团任务
router.get('/club/tasks', (req, res) => {
  const rows = db.prepare(`
    SELECT t.id, t.title, t.content, t.deadline, t.created_at,
           u.nickname AS author_nickname, u.avatar AS author_avatar
    FROM club_tasks t
    JOIN users u ON u.id = t.user_id
    WHERE t.club_id = ?
    ORDER BY t.id DESC
  `).all(req.user.club_id);
  res.json(rows);
});

// 发任务：只有本社团社长可以
router.post('/club/tasks', (req, res) => {
  if (req.user.role !== 'president' && req.user.role !== 'admin') {
    return res.status(403).json({ error: '只有社长能发布任务' });
  }
  const { title, content, deadline } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: '任务标题不能为空' });
  }
  if (!content || !String(content).trim()) {
    return res.status(400).json({ error: '任务内容不能为空' });
  }
  // 截止日期可空，不空就必须是 YYYY-MM-DD
  let dl = String(deadline || '').trim();
  if (dl && !DATE_RE.test(dl)) {
    return res.status(400).json({ error: '截止日期格式不正确' });
  }
  const info = db.prepare(
    'INSERT INTO club_tasks (club_id, user_id, title, content, deadline) VALUES (?, ?, ?, ?, ?)'
  ).run(req.user.club_id, req.user.id, String(title).trim(), String(content).trim(), dl);
  // 通知本社团其他成员
  notifyClub(
    req.user.club_id,
    'task',
    `新任务：${String(title).trim()}`,
    (dl ? `截止 ${dl}｜` : '') + String(content).trim().slice(0, 60),
    req.user.id
  );
  res.json({ id: Number(info.lastInsertRowid), message: '发布成功' });
});

// 删任务：本社团社长或管理员
router.delete('/club/tasks/:id', (req, res) => {
  const t = db.prepare('SELECT club_id FROM club_tasks WHERE id = ?').get(Number(req.params.id));
  if (!t) return res.status(404).json({ error: '任务不存在' });
  const isMyClubPresident = req.user.role === 'president' && t.club_id === req.user.club_id;
  if (!isMyClubPresident && req.user.role !== 'admin') {
    return res.status(403).json({ error: '只有本社团社长能删除任务' });
  }
  db.prepare('DELETE FROM club_tasks WHERE id = ?').run(Number(req.params.id));
  res.json({ message: '已删除' });
});

// 本社团成员列表
// 普通社员：只返回名单字段（头像 / 昵称 / 角色），不暴露别人的跑量和计划状态
// 社长 / 管理员：额外返回本周跑量、最近跑步日期、计划状态、已达成徽章数
router.get('/club/members', (req, res) => {
  const isCoach = req.user.role === 'president' || req.user.role === 'admin';

  // 普通社员名单：社长置顶，其余按注册顺序；已软删除的用户不显示
  const users = db.prepare(
    "SELECT id, nickname, gender, role, avatar FROM users WHERE club_id = ? AND deleted_at IS NULL ORDER BY CASE role WHEN 'president' THEN 0 ELSE 1 END, id"
  ).all(req.user.club_id);

  // 普通社员：只给名单，直接返回
  if (!isCoach) return res.json(users);

  const todayStr = dateStr(new Date());
  const mondayStr = dateStr(thisMonday());

  // 一次查出全社所有人的跑量汇总（避免逐个成员查数据库）
  const runRows = db.prepare(`
    SELECT r.user_id,
           COUNT(*) AS run_count,
           COALESCE(SUM(r.distance_km), 0) AS total_km,
           MAX(r.run_date) AS last_run_date,
           COALESCE(SUM(CASE WHEN r.run_date >= ? AND r.run_date <= ? THEN r.distance_km ELSE 0 END), 0) AS week_km
    FROM runs r
    JOIN users u ON u.id = r.user_id
    WHERE u.club_id = ? AND u.deleted_at IS NULL
    GROUP BY r.user_id
  `).all(mondayStr, todayStr, req.user.club_id);
  const runMap = new Map(runRows.map((r) => [r.user_id, r]));

  const out = users.map((u) => {
    const s = runMap.get(u.id) || { run_count: 0, total_km: 0, last_run_date: '', week_km: 0 };
    const plans = buildPlanStatusFor(u.id);
    const achieved = plans.filter((p) => p.status === 'achieved');
    const active = plans.filter((p) => p.status === 'active');
    const expired = plans.filter((p) => p.status === 'expired');

    // 四色规则：有进行中计划 = active（蓝）；否则有逾期未达成 = expired（橙）；
    // 否则 no_plan（灰）。已达成数量单独作为金色徽章叠加显示。
    let planState = 'no_plan';
    let planTitle = '';
    let progress = 0;
    let expiredDays = 0;

    if (active.length) {
      planState = 'active';
      const p = active.reduce((a, b) => (b.percent > a.percent ? b : a));
      planTitle = p.title;
      progress = p.percent;
    } else if (expired.length) {
      planState = 'expired';
      const p = expired[0];
      planTitle = p.title;
      progress = p.percent;
      expiredDays = Math.max(...expired.map((e) => daysBetween(todayStr, e.end_date)));
    }

    return {
      id: u.id,
      nickname: u.nickname,
      gender: u.gender,
      role: u.role,
      avatar: u.avatar,
      run_count: s.run_count,
      total_km: Math.round(s.total_km * 100) / 100,
      week_km: Math.round(s.week_km * 100) / 100,
      last_run_date: s.last_run_date || '',
      days_since_last: s.last_run_date ? daysBetween(todayStr, s.last_run_date) : null,
      plan_state: planState,
      plan_title: planTitle,
      progress,
      expired_days: expiredDays,
      achieved_count: achieved.length,
    };
  });

  // 社长置顶，其余按本周跑量降序（活跃的人先看到），没跑的沉底
  out.sort((a, b) =>
    (a.role === 'president' ? 0 : 1) - (b.role === 'president' ? 0 : 1) ||
    b.week_km - a.week_km || b.total_km - a.total_km
  );
  res.json(out);
});

// ============================================================
// 3.1 社团名片（简介 / 训练时间 / 训练地点 / 联系方式）
// ============================================================

// 查看本社团名片：所有成员都能看
router.get('/club/profile', (req, res) => {
  const row = db.prepare(`
    SELECT c.id, c.name, c.intro, c.training_time, c.training_place, c.contact,
           s.name AS school_name,
           (SELECT COUNT(*) FROM users u WHERE u.club_id = c.id AND u.deleted_at IS NULL) AS member_count
    FROM clubs c
    LEFT JOIN schools s ON s.id = c.school_id
    WHERE c.id = ?
  `).get(req.user.club_id);
  if (!row) return res.status(404).json({ error: '社团不存在' });
  res.json(row);
});

// 修改社团名片：只有本社团社长或管理员
router.put('/club/profile', (req, res) => {
  if (req.user.role !== 'president' && req.user.role !== 'admin') {
    return res.status(403).json({ error: '只有社长或管理员可以修改社团名片' });
  }
  const { intro, training_time, training_place, contact } = req.body || {};
  // 长度限制：防止把整篇文章塞进名片
  const fields = { intro, training_time, training_place, contact };
  for (const [k, v] of Object.entries(fields)) {
    if (v != null && String(v).length > 500) {
      return res.status(400).json({ error: `${k} 内容过长（最多 500 字）` });
    }
  }
  db.prepare(
    'UPDATE clubs SET intro = ?, training_time = ?, training_place = ?, contact = ? WHERE id = ?'
  ).run(
    String(intro ?? '').trim(),
    String(training_time ?? '').trim(),
    String(training_place ?? '').trim(),
    String(contact ?? '').trim(),
    req.user.club_id
  );
  res.json({ message: '已保存' });
});

// 社长转让：本社团社长可以把社长身份转让给本社团另一个普通社员
// 与管理员任命社长逻辑一致，但权限换成社长自己（不需要管理员身份）
// 转让后原社长降级为普通社员，全社团成员踢下线（角色变了，重新登录拿新身份）
router.post('/club/transfer-president', (req, res) => {
  if (req.user.role !== 'president') {
    return res.status(403).json({ error: '只有社长可以转让社长身份' });
  }
  const clubId = req.user.club_id;
  const userId = Number((req.body || {}).user_id);
  if (!Number.isFinite(userId)) return res.status(400).json({ error: '请选择要转让给谁' });
  if (userId === req.user.id) return res.status(400).json({ error: '不能转让给自己' });

  const club = db.prepare('SELECT id, school_id, name FROM clubs WHERE id = ?').get(clubId);
  if (!club) return res.status(404).json({ error: '社团不存在' });
  const target = db.prepare('SELECT id, role, club_id, deleted_at FROM users WHERE id = ?').get(userId);
  if (!target || target.deleted_at) return res.status(404).json({ error: '目标用户不存在或已被删除' });
  if (target.club_id !== clubId) return res.status(400).json({ error: '只能转让给本社团成员' });
  if (target.role === 'president') return res.status(400).json({ error: '该成员已是社长' });

  db.exec('BEGIN');
  try {
    // 原社长（含其他历史社长）降级为普通社员
    db.prepare("UPDATE users SET role = 'member' WHERE club_id = ? AND role = 'president'").run(clubId);
    // 新社长上任
    db.prepare("UPDATE users SET role = 'president', school_id = ? WHERE id = ?").run(club.school_id, userId);
    // 全社团踢下线，强制重新登录以获取新身份和社团权限
    db.prepare('DELETE FROM tokens WHERE user_id IN (SELECT id FROM users WHERE club_id = ?)').run(clubId);
    db.exec('COMMIT');
    res.json({ message: `已把「${club.name}」社长身份转让给该成员，请全体重新登录` });
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('社长转让失败：', e);
    res.status(500).json({ error: '转让失败，请稍后重试' });
  }
});

// 删除本社团：只有本社团社长可以操作（管理员请用后台）
// 删除规则（与管理员后台一致）：社团的公告 / 任务 / 约跑活动 / 报名记录一并清除；
// 社团成员不会被删除，而是变成"无社团用户"，可以重新申请或被管理员分配到其他社团
router.delete('/club', (req, res) => {
  if (req.user.role !== 'president') {
    return res.status(403).json({ error: '只有社长可以删除本社团' });
  }
  const clubId = req.user.club_id;
  const club = db.prepare('SELECT id, name FROM clubs WHERE id = ?').get(clubId);
  if (!club) return res.status(404).json({ error: '社团不存在' });

  db.exec('BEGIN');
  try {
    // 1）所有成员（含社长自己）变为无社团用户；社长降级为普通社员
    const memberIds = db.prepare('SELECT id FROM users WHERE club_id = ?').all(clubId).map((r) => r.id);
    db.prepare('UPDATE users SET school_id = NULL, club_id = NULL WHERE club_id = ?').run(clubId);
    db.prepare("UPDATE users SET role = 'member' WHERE id = ?").run(req.user.id);
    // 2）清除社团内容：活动签到 → 活动报名 → 活动 → 公告 → 任务 → 入社/退社申请
    db.prepare('DELETE FROM event_checkins WHERE event_id IN (SELECT id FROM club_events WHERE club_id = ?)').run(clubId);
    db.prepare('DELETE FROM event_signups WHERE event_id IN (SELECT id FROM club_events WHERE club_id = ?)').run(clubId);
    db.prepare('DELETE FROM club_events WHERE club_id = ?').run(clubId);
    db.prepare('DELETE FROM announcements WHERE club_id = ?').run(clubId);
    db.prepare('DELETE FROM club_tasks WHERE club_id = ?').run(clubId);
    db.prepare('DELETE FROM membership_requests WHERE club_id = ?').run(clubId);
    // 3）删除社团本身
    db.prepare('DELETE FROM clubs WHERE id = ?').run(clubId);
    // 4）把全社团成员踢下线（身份变了，客户端会残留旧社团界面，强制重新登录）
    for (const uid of memberIds) {
      db.prepare('DELETE FROM tokens WHERE user_id = ?').run(uid);
    }
    db.exec('COMMIT');
    res.json({ message: '社团已删除，所有成员已变为无社团用户，请重新登录' });
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('社长删除社团失败：', e);
    res.status(500).json({ error: '删除失败，请稍后重试' });
  }
});

// ============================================================
// 3.2 约跑活动（所有社员都能发起，社团内所有人可报名）
// ============================================================

// 查询本社团活动：未开始的按日期升序排前面，已结束的按日期倒序沉底
// N6 新增：返回 max_participants（人数上限）、checkin_count（已签到人数）、
//         checked（我是否被签到），用于前端展示报名进度与签到状态
router.get('/club/events', (req, res) => {
  const rows = db.prepare(`
    SELECT e.id, e.user_id, e.title, e.event_date, e.event_time, e.place, e.note,
           e.max_participants, e.created_at,
           u.nickname AS author_nickname, u.avatar AS author_avatar,
           (SELECT COUNT(*) FROM event_signups s WHERE s.event_id = e.id) AS signup_count,
           EXISTS(SELECT 1 FROM event_signups s2 WHERE s2.event_id = e.id AND s2.user_id = ?) AS signed,
           (SELECT COUNT(*) FROM event_checkins c WHERE c.event_id = e.id) AS checkin_count,
           EXISTS(SELECT 1 FROM event_checkins c2 WHERE c2.event_id = e.id AND c2.user_id = ?) AS checked
    FROM club_events e
    JOIN users u ON u.id = e.user_id
    WHERE e.club_id = ?
  `).all(req.user.id, req.user.id, req.user.club_id);

  const todayStr = dateStr(new Date());
  rows.sort((a, b) => {
    const aPast = a.event_date < todayStr;
    const bPast = b.event_date < todayStr;
    if (aPast !== bPast) return aPast ? 1 : -1;
    return aPast
      ? b.event_date.localeCompare(a.event_date)
      : a.event_date.localeCompare(b.event_date);
  });
  res.json(rows.map((r) => ({ ...r, signed: !!r.signed, checked: !!r.checked })));
});

// 发起约跑活动：本社团所有成员都可以
// N6 新增：接受 max_participants（人数上限，不传或 0 表示不限）
router.post('/club/events', (req, res) => {
  const { title, event_date, event_time, place, note, max_participants } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: '活动名称不能为空' });
  }
  if (!DATE_RE.test(String(event_date || ''))) {
    return res.status(400).json({ error: '活动日期格式应为 YYYY-MM-DD' });
  }
  const time = String(event_time || '').trim();
  if (time && !/^\d{1,2}:\d{2}$/.test(time)) {
    return res.status(400).json({ error: '集合时间格式应为 HH:MM' });
  }
  if (String(title).length > 50 || String(place || '').length > 100 || String(note || '').length > 300) {
    return res.status(400).json({ error: '内容过长，请精简后再发布' });
  }
  const mp = Math.max(0, Math.round(Number(max_participants || 0)));
  const info = db.prepare(
    'INSERT INTO club_events (club_id, user_id, title, event_date, event_time, place, note, max_participants) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    req.user.club_id,
    req.user.id,
    String(title).trim(),
    String(event_date),
    time,
    String(place || '').trim(),
    String(note || '').trim(),
    mp
  );
  // 通知本社团其他成员：有新约跑了
  notifyClub(
    req.user.club_id,
    'event',
    `新约跑：${String(title).trim()}`,
    `${event_date}${time ? ' ' + time : ''}${place ? '｜' + String(place).trim() : ''}`,
    req.user.id
  );
  res.json({ id: Number(info.lastInsertRowid), message: '发布成功' });
});

// 删除活动：发起人本人 / 本社团社长 / 管理员
router.delete('/club/events/:id', (req, res) => {
  const ev = db.prepare('SELECT user_id, club_id FROM club_events WHERE id = ?').get(Number(req.params.id));
  if (!ev) return res.status(404).json({ error: '活动不存在' });
  if (ev.club_id !== req.user.club_id) {
    return res.status(403).json({ error: '只能删除本社团的活动' });
  }
  const canDelete =
    ev.user_id === req.user.id ||
    req.user.role === 'president' ||
    req.user.role === 'admin';
  if (!canDelete) {
    return res.status(403).json({ error: '只有发起人、社长或管理员可以删除活动' });
  }
  db.prepare('DELETE FROM event_checkins WHERE event_id = ?').run(Number(req.params.id));
  db.prepare('DELETE FROM event_signups WHERE event_id = ?').run(Number(req.params.id));
  db.prepare('DELETE FROM club_events WHERE id = ?').run(Number(req.params.id));
  res.json({ message: '已删除' });
});

// 报名 / 取消报名（同一个人再点一次 = 取消）
// N6 新增：报名时若已达 max_participants（>0）则拦截
router.post('/club/events/:id/signup', (req, res) => {
  const eventId = Number(req.params.id);
  const ev = db.prepare('SELECT club_id, max_participants FROM club_events WHERE id = ?').get(eventId);
  if (!ev) return res.status(404).json({ error: '活动不存在' });
  if (ev.club_id !== req.user.club_id) {
    return res.status(403).json({ error: '只能报名本社团的活动' });
  }
  const existing = db.prepare(
    'SELECT id FROM event_signups WHERE event_id = ? AND user_id = ?'
  ).get(eventId, req.user.id);
  if (existing) {
    db.prepare('DELETE FROM event_signups WHERE id = ?').run(existing.id);
  } else {
    // 检查人数上限（max_participants > 0 表示有限制）
    if (ev.max_participants > 0) {
      const current = db.prepare('SELECT COUNT(*) AS c FROM event_signups WHERE event_id = ?').get(eventId).c;
      if (current >= ev.max_participants) {
        return res.status(400).json({ error: '报名人数已满' });
      }
    }
    db.prepare('INSERT INTO event_signups (event_id, user_id) VALUES (?, ?)').run(eventId, req.user.id);
  }
  const count = db.prepare('SELECT COUNT(*) AS c FROM event_signups WHERE event_id = ?').get(eventId).c;
  res.json({ signed: !existing, signup_count: count });
});

// N6 活动签到接口：发起人 / 社长 / 管理员对已报名的成员打勾/取消打勾
// body: { user_id: number }（要签到的成员 id）
router.post('/club/events/:id/checkin', (req, res) => {
  const eventId = Number(req.params.id);
  const targetUserId = Number((req.body || {}).user_id);
  if (!Number.isFinite(targetUserId)) {
    return res.status(400).json({ error: '请选择要签到的成员' });
  }
  const ev = db.prepare('SELECT user_id, club_id FROM club_events WHERE id = ?').get(eventId);
  if (!ev) return res.status(404).json({ error: '活动不存在' });
  if (ev.club_id !== req.user.club_id) {
    return res.status(403).json({ error: '只能操作本社团的活动' });
  }
  // 权限：发起人 / 社长 / 管理员
  const canCheckin = ev.user_id === req.user.id || req.user.role === 'president' || req.user.role === 'admin';
  if (!canCheckin) {
    return res.status(403).json({ error: '只有发起人、社长或管理员可以签到' });
  }
  // 被签到的用户必须已报名
  const signed = db.prepare('SELECT id FROM event_signups WHERE event_id = ? AND user_id = ?').get(eventId, targetUserId);
  if (!signed) {
    return res.status(400).json({ error: '该成员未报名此活动，无法签到' });
  }
  const existing = db.prepare('SELECT id FROM event_checkins WHERE event_id = ? AND user_id = ?').get(eventId, targetUserId);
  if (existing) {
    db.prepare('DELETE FROM event_checkins WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO event_checkins (event_id, user_id, checked_by) VALUES (?, ?, ?)').run(eventId, targetUserId, req.user.id);
  }
  const count = db.prepare('SELECT COUNT(*) AS c FROM event_checkins WHERE event_id = ?').get(eventId).c;
  res.json({ checked: !existing, checkin_count: count });
});

// N6 查询某个活动的签到名单：发起人 / 社长 / 管理员可见
router.get('/club/events/:id/checkins', (req, res) => {
  const eventId = Number(req.params.id);
  const ev = db.prepare('SELECT user_id, club_id FROM club_events WHERE id = ?').get(eventId);
  if (!ev) return res.status(404).json({ error: '活动不存在' });
  if (ev.club_id !== req.user.club_id) {
    return res.status(403).json({ error: '只能查看本社团的活动' });
  }
  const canView = ev.user_id === req.user.id || req.user.role === 'president' || req.user.role === 'admin';
  if (!canView) {
    return res.status(403).json({ error: '只有发起人、社长或管理员可以查看签到名单' });
  }
  // 返回全部已报名成员 + 是否签到
  const rows = db.prepare(`
    SELECT u.id, u.nickname, u.avatar,
           EXISTS(SELECT 1 FROM event_checkins c WHERE c.event_id = ? AND c.user_id = u.id) AS checked
    FROM event_signups s
    JOIN users u ON u.id = s.user_id
    WHERE s.event_id = ?
    ORDER BY u.nickname
  `).all(eventId, eventId);
  res.json(rows.map((r) => ({ ...r, checked: !!r.checked })));
});

// ============================================================
// 4. 多维度排行榜
// 范围：scope=club（社团内，默认）| all（总体：跨学校所有用户）
// 榜单：
//   跑量类：week 本周距离 / month 月跑量 / total 总距离
//   社团榜：club 各学校的长跑社之间比总跑量（不受 scope 影响）
//   坚持类：progress 进步之星 / streak 连续打卡王 / longest 单次最长距离
//   速度类：pb1000 / pb3000 / pb5000 / pb10000 / pb21097 / pb42195
//           （必须跑满目标距离，按平均配速换算用时，越小越好）
// ============================================================

// 工具：用全程平均配速换算目标距离的用时（秒）
// 规则：原记录距离必须 ≥ 目标距离（真的跑满才算数），然后用平均配速 × 目标距离
function equivalentTime(distanceKm, durationSeconds, targetKm) {
  if (distanceKm < targetKm) return null;
  // 平均配速 × 目标距离
  return Math.round((durationSeconds / distanceKm) * targetKm);
}

// 工具：把 Date 格式化为 'YYYY-MM-DD'（与 runs 表 run_date 格式一致）
function dateStr(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// 工具：本周一的日期对象（周一为一周起点）
function thisMonday() {
  const now = new Date();
  const diff = (now.getDay() + 6) % 7; // 距离本周一过了几天
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return monday;
}

// 5. 个人中心
// ============================================================

// 修改我的资料：昵称 / 头像（emoji）
router.put('/me', (req, res) => {
  const { nickname, avatar } = req.body || {};

  // 两个字段至少要给一个
  if (nickname === undefined && avatar === undefined) {
    return res.status(400).json({ error: '没有需要修改的内容' });
  }

  if (nickname !== undefined) {
    const n = String(nickname).trim();
    if (n.length < 2) {
      return res.status(400).json({ error: '昵称至少要 2 个字' });
    }
    db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(n, req.user.id);
  }
  if (avatar !== undefined) {
    // 头像支持：空字符串（恢复默认）/ emoji（短字符）/ 图片 URL（/uploads/xxx.jpg 或 http(s)://...）
    const a = String(avatar).trim();
    if (a.length > 200) {
      return res.status(400).json({ error: '头像内容过长' });
    }
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(a, req.user.id);
  }

  // 返回最新用户信息
  const u = db.prepare('SELECT id, nickname, gender, role, avatar FROM users WHERE id = ?').get(req.user.id);
  res.json({ message: '保存成功', user: u });
});

// 我的统计数据：总公里、总次数、各项目 PB、最近 N 条记录（用于趋势图）
router.get('/me/stats', (req, res) => {
  const summary = db.prepare(`
    SELECT COUNT(*) AS run_count, COALESCE(SUM(distance_km), 0) AS total_km
    FROM runs WHERE user_id = ?
  `).get(req.user.id);

  // 取所有记录用于算 PB 和画趋势
  const runs = db.prepare(`
    SELECT id, run_date, distance_km, duration_seconds
    FROM runs WHERE user_id = ?
    ORDER BY run_date ASC, id ASC
  `).all(req.user.id);

  // 计算各项目 PB
  function bestFor(targetKm) {
    let best = null;
    for (const r of runs) {
      const t = equivalentTime(r.distance_km, r.duration_seconds, targetKm);
      if (t === null) continue;
      if (best === null || t < best) best = t;
    }
    return best;
  }

  res.json({
    run_count: summary.run_count,
    total_km: Math.round(summary.total_km * 100) / 100,
    // 6 项 PB，与排行榜的 6 个距离榜口径完全一致
    pb_1000: bestFor(1),
    pb_3000: bestFor(3),
    pb_5000: bestFor(5),
    pb_10000: bestFor(10),
    pb_21097: bestFor(21.0975),
    pb_42195: bestFor(42.195),
    runs, // 全部记录按时间升序，前端用来画趋势图
  });
});

module.exports = router;
