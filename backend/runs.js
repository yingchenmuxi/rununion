// ============================================================
// 业务模块：跑步记录相关接口
// 包含：提交记录、查我的记录、社长查社团总览
// 注意：这个文件里的接口都要求登录
// ============================================================
const express = require('express');
const db = require('./db');
const { authRequired } = require('./auth');

const router = express.Router();

// 日期格式检查：必须是 YYYY-MM-DD（例如 2026-10-19）
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 注意：不再使用 router.use(authRequired) 全局拦截，因为多个 router 都挂载在 /api 下，
// 全局拦截会导致 /api/articles /api/leaderboard 等其他模块的公开接口也被拦截。
// 改为每个具体路由单独挂 authRequired 中间件。

// ---------- 提交跑步记录 ----------
router.post('/runs', authRequired, (req, res) => {
  const { run_date, distance_km, duration_seconds } = req.body || {};

  if (!DATE_RE.test(String(run_date || ''))) {
    return res.status(400).json({ error: '日期格式不正确' });
  }
  const dist = Number(distance_km);
  const dur = Math.round(Number(duration_seconds));
  if (!Number.isFinite(dist) || dist <= 0) {
    return res.status(400).json({ error: '距离必须大于 0 公里' });
  }
  if (!Number.isFinite(dur) || dur < 0) {
    return res.status(400).json({ error: '用时格式不正确' });
  }

  const info = db.prepare(
    'INSERT INTO runs (user_id, run_date, distance_km, duration_seconds) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, run_date, dist, dur);

  res.json({ id: Number(info.lastInsertRowid), message: '提交成功' });
});

// ---------- 我的记录列表 ----------
// 返回当前登录用户自己的所有跑步记录，按日期从近到远排
router.get('/runs', authRequired, (req, res) => {
  const rows = db.prepare(
    'SELECT id, run_date, distance_km, duration_seconds FROM runs WHERE user_id = ? ORDER BY run_date DESC, id DESC'
  ).all(req.user.id);
  res.json(rows);
});

// ---------- 修改自己的一条跑步记录 ----------
// 用途：记录填错了但不想删掉重填（比如已经填了详细数据），可以直接改日期/距离/用时。
// 安全点：WHERE 里同时带 id 和 user_id = 当前登录用户，只能改自己的记录。
router.put('/runs/:id', authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: '记录编号不正确' });
  }
  const run = db.prepare('SELECT * FROM runs WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!run) {
    return res.status(404).json({ error: '记录不存在或不属于你' });
  }

  const { run_date, distance_km, duration_seconds } = req.body || {};
  const newDate = run_date != null ? String(run_date) : run.run_date;
  const newDist = distance_km != null ? Number(distance_km) : run.distance_km;
  const newDur = duration_seconds != null ? Math.round(Number(duration_seconds)) : run.duration_seconds;

  if (!DATE_RE.test(newDate)) {
    return res.status(400).json({ error: '日期格式不正确' });
  }
  if (!Number.isFinite(newDist) || newDist <= 0 || newDist > 1000) {
    return res.status(400).json({ error: '距离应在 0-1000 公里之间' });
  }
  if (!Number.isFinite(newDur) || newDur < 0) {
    return res.status(400).json({ error: '用时格式不正确' });
  }

  db.prepare('UPDATE runs SET run_date = ?, distance_km = ?, duration_seconds = ? WHERE id = ?')
    .run(newDate, newDist, newDur, id);
  res.json({ message: '已保存修改' });
});

// ---------- 删除自己的一条跑步记录 ----------
// 用途：记录填错了（比如距离多打一个 0）时，用户可以自己删掉重新填，不用找管理员。
// 安全点：SQL 里同时带上 id 和 user_id = 当前登录用户，所以只能删自己的记录，
// 别人的记录即使猜到编号也删不掉（会返回 404）。
router.delete('/runs/:id', authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: '记录编号不正确' });
  }
  const info = db.prepare('DELETE FROM runs WHERE id = ? AND user_id = ?').run(id, req.user.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: '记录不存在或不属于你' });
  }
  res.json({ message: '已删除' });
});

// ---------- 社团总览（社长专用）----------
// 返回"和社长同一个社团"的所有人的记录，按人分组并算好汇总
// 注意 WHERE 条件用的是 club_id —— 这就是为多社团扩展留的口子：
// 以后新学校新社团只是 club_id 不同，这条 SQL 一个字都不用改
router.get('/club/overview', authRequired, (req, res) => {
  if (req.user.role !== 'president') {
    return res.status(403).json({ error: '只有社长能查看社团总览' });
  }

  const rows = db.prepare(`
    SELECT u.id AS user_id, u.nickname, u.gender,
           r.id AS run_id, r.run_date, r.distance_km, r.duration_seconds
    FROM runs r
    JOIN users u ON u.id = r.user_id
    WHERE u.club_id = ? AND u.deleted_at IS NULL
    ORDER BY u.id, r.run_date DESC, r.id DESC
  `).all(req.user.club_id);

  // 按社员分组，顺便算出每个人的总次数、总公里数
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.user_id)) {
      map.set(row.user_id, {
        user_id: row.user_id,
        nickname: row.nickname,
        gender: row.gender,
        total_km: 0,
        run_count: 0,
        records: [],
      });
    }
    const member = map.get(row.user_id);
    member.total_km = Math.round((member.total_km + row.distance_km) * 100) / 100;
    member.run_count += 1;
    member.records.push({
      id: row.run_id,
      run_date: row.run_date,
      distance_km: row.distance_km,
      duration_seconds: row.duration_seconds,
    });
  }

  res.json({ club_id: req.user.club_id, members: [...map.values()] });
});

// ============ 详细跑步数据（心率/触地时间/垂直振幅/步幅/步频） ============
// 一条跑步记录最多对应一条详细数据，所有指标都可空——填几个算几个

// ---------- 查某条跑步记录的详细数据 ----------
router.get('/runs/:id/detail', authRequired, (req, res) => {
  const runId = Number(req.params.id);
  if (!Number.isInteger(runId) || runId <= 0) {
    return res.status(400).json({ error: '记录编号不正确' });
  }
  // 先确认这条跑步记录属于当前用户
  const run = db.prepare('SELECT id FROM runs WHERE id = ? AND user_id = ?').get(runId, req.user.id);
  if (!run) {
    return res.status(404).json({ error: '记录不存在或不属于你' });
  }
  const detail = db.prepare(
    'SELECT id, run_id, heart_rate, ground_contact_ms, vertical_oscillation_cm, stride_length_cm, cadence_spm, updated_at FROM run_details WHERE run_id = ?'
  ).get(runId);
  res.json(detail || null);
});

// ---------- 保存/更新某条跑步记录的详细数据 ----------
// 传：{ heart_rate: 150, ground_contact_ms: 220, vertical_oscillation_cm: 8.5, stride_length_cm: 120, cadence_spm: 180 }
// 全部可空，传几个存几个；已存在则覆盖更新
router.put('/runs/:id/detail', authRequired, (req, res) => {
  const runId = Number(req.params.id);
  if (!Number.isInteger(runId) || runId <= 0) {
    return res.status(400).json({ error: '记录编号不正确' });
  }
  // 先确认这条跑步记录属于当前用户
  const run = db.prepare('SELECT id FROM runs WHERE id = ? AND user_id = ?').get(runId, req.user.id);
  if (!run) {
    return res.status(404).json({ error: '记录不存在或不属于你' });
  }

  const { heart_rate, ground_contact_ms, vertical_oscillation_cm, stride_length_cm, cadence_spm } = req.body || {};

  // 校验：至少传一个有效指标
  const hasAny = [heart_rate, ground_contact_ms, vertical_oscillation_cm, stride_length_cm, cadence_spm]
    .some(v => v !== undefined && v !== null && v !== '');
  if (!hasAny) {
    return res.status(400).json({ error: '请至少填写一项详细数据' });
  }

  // 数值范围校验（防止明显错误的数据）
  if (heart_rate !== undefined && heart_rate !== null && heart_rate !== '') {
    const v = Number(heart_rate);
    if (!Number.isInteger(v) || v < 30 || v > 220) {
      return res.status(400).json({ error: '心率应在 30-220 之间' });
    }
  }
  if (ground_contact_ms !== undefined && ground_contact_ms !== null && ground_contact_ms !== '') {
    const v = Number(ground_contact_ms);
    if (!Number.isInteger(v) || v < 100 || v > 500) {
      return res.status(400).json({ error: '触地时间应在 100-500 毫秒之间' });
    }
  }
  if (vertical_oscillation_cm !== undefined && vertical_oscillation_cm !== null && vertical_oscillation_cm !== '') {
    const v = Number(vertical_oscillation_cm);
    if (!Number.isFinite(v) || v < 3 || v > 20) {
      return res.status(400).json({ error: '垂直振幅应在 3-20 厘米之间' });
    }
  }
  if (stride_length_cm !== undefined && stride_length_cm !== null && stride_length_cm !== '') {
    const v = Number(stride_length_cm);
    if (!Number.isFinite(v) || v < 50 || v > 250) {
      return res.status(400).json({ error: '步幅应在 50-250 厘米之间' });
    }
  }
  if (cadence_spm !== undefined && cadence_spm !== null && cadence_spm !== '') {
    const v = Number(cadence_spm);
    if (!Number.isInteger(v) || v < 100 || v > 250) {
      return res.status(400).json({ error: '步频应在 100-250 步/分钟之间' });
    }
  }

  // UPSERT：有就更新，没有就插入
  const existing = db.prepare('SELECT id FROM run_details WHERE run_id = ?').get(runId);
  if (existing) {
    db.prepare(`
      UPDATE run_details SET
        heart_rate = COALESCE(?, heart_rate),
        ground_contact_ms = COALESCE(?, ground_contact_ms),
        vertical_oscillation_cm = COALESCE(?, vertical_oscillation_cm),
        stride_length_cm = COALESCE(?, stride_length_cm),
        cadence_spm = COALESCE(?, cadence_spm),
        updated_at = datetime('now','localtime')
      WHERE run_id = ?
    `).run(
      heart_rate || null,
      ground_contact_ms || null,
      vertical_oscillation_cm || null,
      stride_length_cm || null,
      cadence_spm || null,
      runId
    );
  } else {
    db.prepare(`
      INSERT INTO run_details (run_id, heart_rate, ground_contact_ms, vertical_oscillation_cm, stride_length_cm, cadence_spm)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      runId,
      heart_rate || null,
      ground_contact_ms || null,
      vertical_oscillation_cm || null,
      stride_length_cm || null,
      cadence_spm || null
    );
  }

  const detail = db.prepare(
    'SELECT id, run_id, heart_rate, ground_contact_ms, vertical_oscillation_cm, stride_length_cm, cadence_spm, updated_at FROM run_details WHERE run_id = ?'
  ).get(runId);
  res.json(detail);
});

// ---------- 删除某条跑步记录的详细数据 ----------
router.delete('/runs/:id/detail', authRequired, (req, res) => {
  const runId = Number(req.params.id);
  if (!Number.isInteger(runId) || runId <= 0) {
    return res.status(400).json({ error: '记录编号不正确' });
  }
  // 先确认这条跑步记录属于当前用户
  const run = db.prepare('SELECT id FROM runs WHERE id = ? AND user_id = ?').get(runId, req.user.id);
  if (!run) {
    return res.status(404).json({ error: '记录不存在或不属于你' });
  }
  db.prepare('DELETE FROM run_details WHERE run_id = ?').run(runId);
  res.json({ message: '已删除详细数据' });
});

module.exports = router;
