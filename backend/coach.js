// ============================================================
// 教练功能模块：社长查看社员数据 / 静息心率 / 燃脂消耗
// 包含 4 组接口：
//   1. 社长查看社员详情：GET /api/club/members/:id/detail
//      → 社员跑步记录、PB 成绩、训练计划（仅社长/管理员本社成员）
//   2. 社长为社员制定计划：POST /api/plans（支持 for_user_id）
//      → 仅社长/管理员可给本社社员制定；普通社员只能给自己
//   3. 静息心率：POST /api/heart-rate（记/改某天）、GET /api/heart-rates（历史曲线）
//   4. 燃脂消耗：GET /api/calories → 燃脂用户每日/每周/总跑步消耗
// 所有接口都要求登录（authRequired）
// ============================================================
const express = require('express');
const db = require('./db');
const { authRequired } = require('./auth');

const router = express.Router();
// 说明：不再使用 router.use(authRequired) 全局拦截，因为 server.js 多个 router 都挂载在 /api 下，
// 全局拦截会导致 /api/articles /api/leaderboard 等其他模块的公开接口也被拦截。
// 改为每个具体路由单独挂 authRequired 中间件。

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_FMT = /^\d{4}-\d{2}-\d{2}$/;

// ============================================================
// 通用小工具
// ============================================================
function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseDate(s) {
  const [y, m, dd] = s.split('-').map(Number);
  return new Date(y, m - 1, dd);
}
function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return dateStr(d);
}
// 某日期所在周的周一（计划统一按"周一~周日"为一周，与 extras.js 保持一致）
function weekMondayOf(s) {
  const d = parseDate(s);
  const dow = (d.getDay() + 6) % 7; // 周一=0 ... 周日=6
  d.setDate(d.getDate() - dow);
  return dateStr(d);
}
function daysBetween(a, b) {
  return Math.round((parseDate(a) - parseDate(b)) / 86400000);
}
function thisMonday() {
  const d = new Date();
  const dow = d.getDay() === 0 ? 7 : d.getDay(); // 周一=1
  d.setDate(d.getDate() - dow + 1);
  return d;
}
function parseGoalData(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch (_) {
    return {};
  }
}
// 折算：跑满 targetKm 的实际用时；没跑满返回 null（与排行榜口径一致）
function equivalentTime(distanceKm, durationSeconds, targetKm) {
  if (distanceKm < targetKm - 1e-6) return null; // 没跑满
  if (targetKm <= 0) return null;
  return Math.round((durationSeconds / distanceKm) * targetKm);
}
function fmtSec(s) {
  if (s == null) return '-';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ============================================================
// 1. 社长查看社员详情
// ============================================================
// 权限：社长看本社社员；管理员看本社社员（管理员是社长超集，本社更通用）
router.get('/club/members/:id/detail', authRequired, (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isFinite(targetId)) return res.status(400).json({ error: '社员编号不正确' });

  // 目标社员必须存在且与当前用户同社团
  const member = db.prepare('SELECT id, nickname, gender, role, avatar, club_id FROM users WHERE id = ?').get(targetId);
  if (!member) return res.status(404).json({ error: '社员不存在' });
  if (member.club_id !== req.user.club_id) {
    return res.status(403).json({ error: '只能查看本社团社员' });
  }
  // 当前用户必须是社长或管理员（普通社员无权查看他人详情）
  if (req.user.role !== 'president' && req.user.role !== 'admin') {
    return res.status(403).json({ error: '只有社长或管理员可以查看社员详情' });
  }

  // 1) 跑步记录（按日期倒序）
  const runs = db.prepare(
    'SELECT id, run_date, distance_km, duration_seconds FROM runs WHERE user_id = ? ORDER BY run_date DESC, id DESC'
  ).all(targetId);

  // 2) PB 成绩（6 个距离，口径与排行榜一致：必须跑满目标距离，按全程平均速度换算）
  const ascRuns = db.prepare('SELECT run_date, distance_km, duration_seconds FROM runs WHERE user_id = ? ORDER BY run_date').all(targetId);
  function bestFor(targetKm) {
    let best = null;
    for (const r of ascRuns) {
      const t = equivalentTime(r.distance_km, r.duration_seconds, targetKm);
      if (t === null) continue;
      if (best === null || t < best) best = t;
    }
    return best;
  }
  const pbs = {
    pb_1000: bestFor(1),
    pb_3000: bestFor(3),
    pb_5000: bestFor(5),
    pb_10000: bestFor(10),
    pb_21097: bestFor(21.0975),
    pb_42195: bestFor(42.195),
  };

  // 3) 训练计划（与 /api/plans 列表相同的状态计算，但目标是社员）
  const plans = buildPlanStatusFor(targetId);

  res.json({ member, runs, pbs, plans });
});

// 计算某个用户全部计划的状态（与 /api/plans 一致，供社长查看用）
function buildPlanStatusFor(userId) {
  const plans = db.prepare('SELECT * FROM plans WHERE user_id = ? ORDER BY id DESC').all(userId);
  const runs = db.prepare('SELECT run_date, distance_km, duration_seconds FROM runs WHERE user_id = ? ORDER BY run_date').all(userId);
  const todayStr = dateStr(new Date());
  const mondayStr = dateStr(thisMonday());
  const weekKm = Math.round(
    runs.filter((r) => r.run_date >= mondayStr && r.run_date <= todayStr).reduce((s, r) => s + r.distance_km, 0) * 100
  ) / 100;

  return plans.map((p) => {
    const g = parseGoalData(p.goal_data);
    // 与 extras.js 保持一致：第 1 周从开始日期所在周的周一开始
    const planStart = weekMondayOf(p.start_date);
    const endStr = addDays(planStart, p.weeks * 7 - 1);
    const inWindow = runs.filter((r) => r.run_date >= p.start_date && r.run_date <= endStr);
    const doneKm = Math.round(inWindow.reduce((s, r) => s + r.distance_km, 0) * 100) / 100;

    let percent = 0;
    let achieved = false;
    let statLine = '';
    const extra = {};

    if (p.goal_type === 'volume') {
      percent = p.target_km > 0 ? (doneKm / p.target_km) * 100 : 0;
      achieved = p.target_km > 0 && doneKm >= p.target_km;
      statLine = `已跑 ${doneKm} / ${p.target_km} km`;
      extra.done_km = doneKm;
      const weeklyTarget = p.target_km / p.weeks;
      if (weeklyTarget > 0 && weekKm > weeklyTarget * 1.3) extra.overtrain = true;
    } else if (p.goal_type === 'speed') {
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
        statLine = `还没有跑满 ${dist} km 的记录`;
      } else if (targetSec > 0) {
        achieved = best <= targetSec;
        percent = Math.min(100, (targetSec / best) * 100);
        statLine = achieved ? `目标达成！当前最好 ${fmtSec(best)}` : `当前最好 ${fmtSec(best)}，距目标还差 ${fmtSec(best - targetSec)}`;
      } else {
        achieved = true;
        percent = 100;
        statLine = `已完成 ${fmtSec(best)}`;
      }
    } else if (p.goal_type === 'habit') {
      if (g.freq_type === 'streak') {
        const dates = [...new Set(inWindow.map((r) => r.run_date))].sort();
        let maxS = 0, curS = 0, prev = null;
        for (const d of dates) {
          curS = prev !== null && daysBetween(d, prev) === 1 ? curS + 1 : 1;
          if (curS > maxS) maxS = curS;
          prev = d;
        }
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
    } else if (p.goal_type === 'race') {
      const weeklyKm = Number(g.weekly_km) || 0;
      const plannedTotal = Math.round(weeklyKm * p.weeks * 10) / 10;
      percent = plannedTotal > 0 ? (doneKm / plannedTotal) * 100 : 0;
      extra.race_name = g.race_name || '';
      extra.race_date = g.race_date || '';
      extra.done_km = doneKm;
      extra.planned_total = plannedTotal;
      if (g.race_date) extra.countdown_days = daysBetween(g.race_date, todayStr);
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
      statLine = `已跑 ${doneKm} / ${plannedTotal} km`;
    } else if (p.goal_type === 'weight') {
      const logs = db.prepare('SELECT log_date, weight_kg FROM weight_logs WHERE user_id = ? ORDER BY log_date').all(userId);
      extra.weight_logs = logs;
      const start = Number(g.start_kg) || 0;
      const target = Number(g.target_kg) || 0;
      const latest = logs.length ? logs[logs.length - 1].weight_kg : start;
      extra.latest_weight = latest;
      const totalSpan = Math.abs(start - target);
      const doneSpan = Math.abs(start - latest);
      percent = totalSpan > 0 ? Math.min(100, (doneSpan / totalSpan) * 100) : 0;
      achieved = totalSpan > 0 && Math.abs(latest - target) < 0.3;
      statLine = logs.length ? `当前 ${latest} kg · 距目标还差 ${Math.abs(latest - target).toFixed(1)} kg` : '还没有体重记录';
    }

    const status = achieved ? 'achieved' : todayStr < p.start_date ? 'pending' : todayStr > endStr ? 'expired' : 'active';
    return { ...p, goal_data: g, status, percent: Math.round(percent), stat_line: statLine, end_date: endStr, extra };
  });
}

// ============================================================
// 2. 静息心率
// ============================================================
// 记/改某天的静息心率（同一天重复记录 = 覆盖，与体重记录一致）
router.post('/heart-rate', authRequired, (req, res) => {
  const { log_date, heart_rate } = req.body || {};
  if (!DATE_FMT.test(String(log_date || ''))) {
    return res.status(400).json({ error: '日期格式应为 YYYY-MM-DD' });
  }
  const hr = Math.round(Number(heart_rate));
  if (!Number.isFinite(hr) || hr < 30 || hr > 220) {
    return res.status(400).json({ error: '心率需在 30-220 次/分之间' });
  }
  db.prepare(
    'INSERT INTO resting_heart_logs (user_id, log_date, heart_rate) VALUES (?, ?, ?) ON CONFLICT(user_id, log_date) DO UPDATE SET heart_rate = excluded.heart_rate'
  ).run(req.user.id, String(log_date), hr);
  res.json({ message: '已保存' });
});

// 查我的全部静息心率记录（按日期升序，画曲线用）
router.get('/heart-rates', authRequired, (req, res) => {
  const rows = db.prepare('SELECT log_date, heart_rate FROM resting_heart_logs WHERE user_id = ? ORDER BY log_date').all(req.user.id);
  res.json(rows);
});

// ============================================================
// 3. 燃脂消耗（仅燃脂/体重目标用户）
// ============================================================
// 判断：该用户是否有进行中的体重目标计划 → 燃脂用户
router.get('/calories', authRequired, (req, res) => {
  const todayStr = dateStr(new Date());
  const mondayStr = dateStr(thisMonday());

  // 是否燃脂用户：有计划窗口覆盖今天的体重目标计划（plans 表无 status 字段，按日期判断）
  const weightPlans = db.prepare(
    "SELECT start_date, weeks FROM plans WHERE user_id = ? AND goal_type = 'weight'"
  ).all(req.user.id);
  const isBurner = weightPlans.some((p) => {
    const end = addDays(weekMondayOf(p.start_date), p.weeks * 7 - 1);
    return todayStr >= p.start_date && todayStr <= end;
  });

  // 总消耗：按距离估算（体重不知道时用 60kg 估算），1 km ≈ 1 kcal/kg 体重
  // 简化：体重 = 最近体重记录 或 默认 60 kg
  const latestWeight = db.prepare(
    'SELECT weight_kg FROM weight_logs WHERE user_id = ? ORDER BY log_date DESC LIMIT 1'
  ).get(req.user.id);
  const weightKg = latestWeight ? latestWeight.weight_kg : 60;

  const allRuns = db.prepare('SELECT run_date, distance_km FROM runs WHERE user_id = ?').all(req.user.id);
  const totalKm = Math.round(allRuns.reduce((s, r) => s + r.distance_km, 0) * 100) / 100;
  const totalKcal = Math.round(totalKm * weightKg); // 1 km ≈ weight kg · kcal

  const todayKm = Math.round(allRuns.filter((r) => r.run_date === todayStr).reduce((s, r) => s + r.distance_km, 0) * 100) / 100;
  const todayKcal = Math.round(todayKm * weightKg);

  const weekKm = Math.round(allRuns.filter((r) => r.run_date >= mondayStr && r.run_date <= todayStr).reduce((s, r) => s + r.distance_km, 0) * 100) / 100;
  const weekKcal = Math.round(weekKm * weightKg);

  // 每日消耗明细（燃脂用户才返回，画曲线用）
  const daily = isBurner
    ? Object.entries(
        allRuns.reduce((acc, r) => {
          acc[r.run_date] = (acc[r.run_date] || 0) + r.distance_km;
          return acc;
        }, {})
      ).map(([date, km]) => ({
        log_date: date,
        km: Math.round(km * 100) / 100,
        kcal: Math.round(km * weightKg),
      })).sort((a, b) => a.log_date.localeCompare(b.log_date))
    : [];

  res.json({
    is_burner: isBurner, // 是否燃脂用户（有体重目标计划）
    weight_kg: weightKg, // 估算体重（最新体重记录，无则 60）
    today: { km: todayKm, kcal: todayKcal },
    week: { km: weekKm, kcal: weekKcal },
    total: { km: totalKm, kcal: totalKcal },
    daily, // 每日明细（仅燃脂用户）
  });
});

module.exports = router;
// 把"计算某个用户全部计划状态"的函数暴露出去，供社团成员列表复用
// （同级模块 extras.js 直接 require('./coach').buildPlanStatusFor 使用，避免重复实现）
module.exports.buildPlanStatusFor = buildPlanStatusFor;
