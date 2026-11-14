// ============================================================
// 站内通知模块：统一往 notifications 表里写消息
//
// 为什么单独一个文件：auth.js / extras.js / admin.js 都需要发通知，
// 放在这里避免每个文件各写一遍 SQL，也避免模块之间互相 require 造成循环依赖
//
// 注意：本模块不开启事务。调用方如果已经在 BEGIN...COMMIT 里，
// 这里直接 INSERT 会跟随外层事务一起提交/回滚，不会报错
// ============================================================
const db = require('./db');

// 给单个用户发一条通知
function notify(userId, type, title, content = '', clubId = null) {
  if (!userId) return;
  try {
    db.prepare(
      'INSERT INTO notifications (user_id, type, title, content, club_id) VALUES (?, ?, ?, ?, ?)'
    ).run(Number(userId), String(type || 'system'), String(title), String(content || ''), clubId);
  } catch (e) {
    // 通知失败不能影响主业务（例如审批已经成功了）
    console.error('发送通知失败：', e);
  }
}

// 给某个社团的所有成员发通知（可排除操作人自己）
function notifyClub(clubId, type, title, content = '', excludeUserId = null) {
  if (!clubId) return;
  try {
    const rows = db.prepare(
      'SELECT id FROM users WHERE club_id = ? AND deleted_at IS NULL'
    ).all(Number(clubId));
    const stmt = db.prepare(
      'INSERT INTO notifications (user_id, type, title, content, club_id) VALUES (?, ?, ?, ?, ?)'
    );
    for (const r of rows) {
      if (excludeUserId != null && r.id === excludeUserId) continue; // 自己操作的不提醒自己
      stmt.run(r.id, String(type || 'system'), String(title), String(content || ''), Number(clubId));
    }
  } catch (e) {
    console.error('发送社团通知失败：', e);
  }
}

// 给所有未删除的用户发通知（管理员全员广播用，可排除发布人自己）
function notifyAll(type, title, content = '', excludeUserId = null) {
  try {
    const rows = db.prepare('SELECT id FROM users WHERE deleted_at IS NULL').all();
    const stmt = db.prepare(
      'INSERT INTO notifications (user_id, type, title, content, club_id) VALUES (?, ?, ?, ?, NULL)'
    );
    for (const r of rows) {
      if (excludeUserId != null && r.id === excludeUserId) continue;
      stmt.run(r.id, String(type || 'system'), String(title), String(content || ''), null);
    }
  } catch (e) {
    console.error('发送全员通知失败：', e);
  }
}

module.exports = { notify, notifyClub, notifyAll };
