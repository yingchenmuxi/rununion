// ============================================================
// 业务模块：数据库定时备份
// 用途：每天自动把 running_club.db 复制一份到 data/backups/，
//       文件名带日期（如 running_club_2026-10-22.db），最多保留最近 7 份，
//       防止误删数据后无法找回（配合回收站是双保险）。
// 说明：在 server.js 启动时挂载，无需额外操作。
// ============================================================
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'running_club.db');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');
const KEEP_COUNT = 7; // 最多保留几份备份（最旧的自动删除）
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 每小时检查一次"今天有没有备份过"

// 执行一次备份：复制数据库文件到 backups 目录，并清理超出保留数量的旧备份
function backupOnce() {
  try {
    if (!fs.existsSync(DB_FILE)) return;
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    // 文件名带日期：同一天重复备份会覆盖，保证一天最多一份
    const day = new Date().toLocaleDateString('zh-CN', { hour12: false })
      .replace(/\//g, '-'); // 例如 2026-10-22
    const target = path.join(BACKUP_DIR, `running_club_${day}.db`);
    fs.copyFileSync(DB_FILE, target);
    console.log(`[备份] 数据库已备份到 ${path.basename(target)}`);

    // 清理旧备份：按文件名排序（日期前缀天然可排序），只留最近 KEEP_COUNT 份
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('running_club_') && f.endsWith('.db'))
      .sort();
    while (files.length > KEEP_COUNT) {
      const oldest = files.shift();
      fs.unlinkSync(path.join(BACKUP_DIR, oldest));
      console.log(`[备份] 已清理旧备份 ${oldest}`);
    }
  } catch (err) {
    // 备份失败不影响主服务运行，只打日志
    console.error('[备份] 备份失败：', err.message);
  }
}

// 启动定时备份：启动时立即备份一次，之后每小时检查一次
function startBackupSchedule() {
  backupOnce();
  setInterval(backupOnce, CHECK_INTERVAL_MS);
}

module.exports = { startBackupSchedule, backupOnce };
