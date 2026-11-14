// ============================================================
// 认证模块：处理"你是谁"的问题
// 包含：注册接口、登录接口、token 校验中间件、我的信息接口
// 2026-10 改版：社长注册改为"申请制"——注册即成为无社团用户并自动提交社长申请，
// 由管理员在后台审批通过后才真正建校建社并任命为社长
// ============================================================
const express = require('express');
const crypto = require('crypto');           // Node 自带模块，用来生成随机 token
const bcrypt = require('bcryptjs');         // 用来加密密码（数据库里不存明文密码）
const db = require('./db');

const router = express.Router();

// 工具函数：生成一个足够随机的 token 字符串（相当于发一张无法伪造的通行证）
function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ---------- 注册公共逻辑 ----------

// 校验"社员和社长都要填"的公共字段（手机号/昵称/性别/密码）
// 有问题返回错误提示文字，没问题返回 null
function validateCommonFields(phone, nickname, gender, password) {
  if (!phone || !nickname || !gender || !password) {
    return '手机号、昵称、性别、密码都不能为空';
  }
  // 手机号格式：1 开头的 11 位数字（没有短信服务，只能校验格式）
  if (!/^1\d{10}$/.test(String(phone))) {
    return '手机号格式不正确，应为 1 开头的 11 位数字';
  }
  if (String(nickname).trim().length < 2) {
    return '昵称至少要 2 个字';
  }
  if (gender !== '男' && gender !== '女') {
    return '性别只能是 男 或 女';
  }
  if (String(password).length < 6) {
    return '密码至少要 6 位';
  }
  return null;
}

// 判断手机号是否已经被注册过（昵称允许重复，不查重）
function phoneExists(phone) {
  return !!db.prepare('SELECT id FROM users WHERE phone = ?').get(String(phone));
}

// 创建用户并发放 token，返回 { token, user }
function createUser(schoolId, clubId, phone, nickname, gender, password, role) {
  // 加密密码后存库（就算数据库文件被拿走也看不到原始密码）
  const passwordHash = bcrypt.hashSync(String(password), 10);
  const info = db.prepare(
    'INSERT INTO users (school_id, club_id, phone, nickname, gender, password_hash, role) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(schoolId, clubId, String(phone), String(nickname).trim(), String(gender), passwordHash, role);

  // 注册成功直接发 token（注册即登录，不用再输一遍密码）
  const token = newToken();
  // token 7 天后过期，防止被盗用后永久有效
  db.prepare("INSERT INTO tokens (token, user_id, expires_at) VALUES (?, ?, datetime('now','localtime','+7 days'))")
    .run(token, Number(info.lastInsertRowid));

  return {
    token,
    // 把学校/社团归属一起返回：APP 靠它判断"是否无社团用户"
    user: {
      id: Number(info.lastInsertRowid),
      nickname: String(nickname).trim(),
      gender: String(gender),
      role,
      school_id: schoolId,
      club_id: clubId,
      avatar: '',
    },
  };
}

// ---------- 社长申请注册接口 ----------
// 前端传：{ phone, nickname, gender, password, province, city, schoolName, clubName?, note? }
// 新流程（2026-10 改版）：
//   1）创建一个"无社团"账号（school_id / club_id 为 NULL，role=member），立即可登录
//   2）自动提交一条社长申请（pending 状态）
//   3）管理员在后台批准后，才会创建学校+社团并把该用户任命为社长
router.post('/register/president', (req, res) => {
  const { phone, nickname, gender, password, province, city, schoolName, clubName, note } = req.body || {};

  // 公共字段（手机号/昵称/性别/密码）校验
  const commonErr = validateCommonFields(phone, nickname, gender, password);
  if (commonErr) return res.status(400).json({ error: commonErr });

  // 学校名称必填；社团名称不填默认"长跑社"
  if (!schoolName || String(schoolName).trim().length < 2) {
    return res.status(400).json({ error: '学校名称至少要 2 个字' });
  }
  const finalClubName = (clubName && String(clubName).trim()) || '长跑社';

  if (phoneExists(phone)) {
    return res.status(400).json({ error: '这个手机号已经注册过了' });
  }

  // 用事务保证：账号和申请要么一起成功，要么一起失败
  db.exec('BEGIN');
  try {
    // 1）创建无社团账号（school_id / club_id 为 NULL）
    const result = createUser(null, null, phone, nickname, gender, password, 'member');
    // 2）提交社长申请
    db.prepare(
      'INSERT INTO president_applications (user_id, school_name, club_name, province, city, note) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(result.user.id, String(schoolName).trim(), finalClubName, String(province || '').trim(), String(city || '').trim(), String(note || '').trim());
    db.exec('COMMIT');
    // 返回时告诉前端：这是"申请中"状态，前端提示等待审批
    res.json({ ...result, applied: true });
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('社长申请注册失败：', e);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

// ---------- 社员注册接口 ----------
// 前端传：{ phone, nickname, gender, password, clubId, reason? }
// 社员注册时可选择一个社团提交"入社申请"（需该社团社长审批通过后才真正加入）；
// 也可以选择"暂不加入社团"，先注册为无社团用户，之后在社团页再申请
router.post('/register/member', (req, res) => {
  const { phone, nickname, gender, password, clubId, schoolId, reason } = req.body || {};

  const commonErr = validateCommonFields(phone, nickname, gender, password);
  if (commonErr) return res.status(400).json({ error: commonErr });

  if (phoneExists(phone)) {
    return res.status(400).json({ error: '这个手机号已经注册过了' });
  }

  // 兼容老客户端：只传 schoolId 时，取该学校下第一个社团作为申请目标
  let targetClubId = clubId == null || clubId === '' ? null : Number(clubId);
  if (targetClubId == null && schoolId != null && schoolId !== '') {
    const firstClub = db.prepare('SELECT id FROM clubs WHERE school_id = ? ORDER BY id LIMIT 1').get(Number(schoolId));
    if (firstClub) targetClubId = firstClub.id;
  }

  // 没有选择社团：直接创建无归属账号
  if (targetClubId == null) {
    return res.json(createUser(null, null, phone, nickname, gender, password, 'member'));
  }

  const club = db.prepare('SELECT id, name FROM clubs WHERE id = ?').get(targetClubId);
  if (!club) {
    return res.status(400).json({ error: '请选择有效的社团' });
  }

  // 注册 + 提交入社申请：要么一起成功，要么一起失败
  db.exec('BEGIN');
  try {
    const result = createUser(null, null, phone, nickname, gender, password, 'member');
    db.prepare(
      "INSERT INTO membership_requests (user_id, club_id, type, reason) VALUES (?, ?, 'join', ?)"
    ).run(result.user.id, club.id, String(reason || '').trim());
    db.exec('COMMIT');
    // applied = true 告诉前端"已提交入社申请，等待社长审批"
    res.json({ ...result, applied: true, message: `入社申请已提交，请等待「${club.name}」社长审批` });
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('社员注册失败：', e);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

// ---------- 学校列表接口（公开，社员注册用）----------
// 返回全部真实学校（保留给老版本客户端）
router.get('/schools', (req, res) => {
  const rows = db.prepare(
    'SELECT id, name, province, city FROM schools ORDER BY id'
  ).all();
  res.json(rows);
});

// ---------- 社团列表接口（公开，注册页选择入社目标用）----------
// 注册时还没登录，所以这个接口不能走 token 校验
router.get('/clubs/public', (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.name, s.name AS school_name, s.province, s.city,
           (SELECT COUNT(*) FROM users u WHERE u.club_id = c.id AND u.deleted_at IS NULL) AS member_count
    FROM clubs c
    LEFT JOIN schools s ON s.id = c.school_id
    ORDER BY s.name, c.id
  `).all();
  res.json(rows);
});

// ---------- 登录接口 ----------
// 前端传：{ phone: 手机号, password: 密码 }
router.post('/login', (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || !password) {
    return res.status(400).json({ error: '手机号和密码不能为空' });
  }

  const user = db.prepare("SELECT * FROM users WHERE phone = ? AND deleted_at IS NULL").get(String(phone));
  // 用户不存在 或 密码对不上，都返回同一个提示（不暴露"这个手机号有没有被注册"）
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(400).json({ error: '手机号或密码错误' });
  }

  // 登录成功，发 token，APP 会把它存在手机本地
  const token = newToken();
  // token 7 天后过期，防止被盗用后永久有效
  db.prepare("INSERT INTO tokens (token, user_id, expires_at) VALUES (?, ?, datetime('now','localtime','+7 days'))")
    .run(token, user.id);

  res.json({
    token,
    // 登录也要带学校/社团：否则无社团判断会出错，社长登录后可能被当成普通社员
    user: {
      id: user.id,
      nickname: user.nickname,
      gender: user.gender,
      role: user.role,
      school_id: user.school_id,
      club_id: user.club_id,
      avatar: user.avatar || '',
    },
  });
});

// ---------- token 校验中间件 ----------
// 写在需要登录的接口前面，它负责：
// 1. 从请求头里取出 token
// 2. 查这个 token 属于哪个用户
// 3. 把用户信息挂到 req.user 上，后面的接口代码直接用 req.user 就行
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  if (!token) {
    return res.status(401).json({ error: '请先登录' });
  }
  // 同时校验：token 存在 + 所属用户没被软删除 + token 没过期
  const row = db.prepare(
    `SELECT u.*, t.expires_at FROM tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token = ? AND u.deleted_at IS NULL
       AND (t.expires_at IS NULL OR t.expires_at > datetime('now','localtime'))`
  ).get(token);
  if (!row) {
    // token 不存在 或 已过期（过期了就顺便清掉）
    db.prepare("DELETE FROM tokens WHERE token = ? AND expires_at IS NOT NULL AND expires_at <= datetime('now','localtime')").run(token);
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
  req.user = row;
  next();
}

// ---------- 我的信息接口 ----------
// APP 启动时用它校验本地保存的 token 还有没有效
router.get('/me', authRequired, (req, res) => {
  res.json({
    id: req.user.id,
    nickname: req.user.nickname,
    gender: req.user.gender,
    role: req.user.role,
    school_id: req.user.school_id,
    club_id: req.user.club_id,
    avatar: req.user.avatar || '',
  });
});

module.exports = { router, authRequired };
