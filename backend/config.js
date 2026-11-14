// ============================================================
// 配置文件：可以自己改的参数都集中在这里
// ============================================================

// 后端监听的端口号
// 服务器（线上）默认用 80：这样域名 rununion.club 不用带端口就能访问
// 本地开发用环境变量 PORT=3000 覆盖（start_backend.ps1 已自动设置），
// 避免本地抢占系统 80 端口导致启动失败
const PORT = Number(process.env.PORT) || 80;

// 社长邀请码：注册时填这个码，注册出来的账号就是"社长"
// 想换码的话，改这里然后重启后端即可
const PRESIDENT_INVITE_CODE = 'PRESIDENT2026';

// APP 当前最新版本号：每次发布新 APK 时把它改大（例如 1.0.1 → 1.0.2）
// 客户端启动时会请求 /api/app-version 对比，版本比它旧就弹窗提示更新
const APP_VERSION = '1.0.2';

// 更新说明（客户端更新弹窗里显示的内容；管理员发布全员通知时也会自动带入此内容）
const APP_UPDATE_NOTE = '新增管理员全员通知与社团沟通功能、头像支持上传照片、修复知识文章管理界面bug';

module.exports = { PORT, PRESIDENT_INVITE_CODE, APP_VERSION, APP_UPDATE_NOTE };
