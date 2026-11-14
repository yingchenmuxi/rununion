// ============================================================
// 服务器入口：启动 HTTP 服务，把各个模块的接口挂载上来
// 启动方式：在本目录（backend）下执行  node server.js
// ============================================================
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { PORT, APP_VERSION, APP_UPDATE_NOTE } = require('./config');

const app = express();

// 允许跨域请求（APP、浏览器调试都能访问）
app.use(cors());
// 让后端能解析前端发来的 JSON 数据
// limit 调到 15mb，因为图片 base64 上传体积较大（10MB 图片约 13.3MB base64）
app.use(express.json({ limit: '15mb' }));

// 请求日志：每个请求都记一行（时间、来源IP、方法、路径、状态码）
// 排查"手机上登录不进去"这类问题时，看日志就知道手机到底发没发请求、发了什么
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const time = new Date().toLocaleString('zh-CN', { hour12: false });
    const line = `[${time}] ${req.ip} ${req.method} ${req.originalUrl} -> ${res.statusCode}`;
    console.log(line);
    // 登录/注册失败时把原因也记下来
    if (res.statusCode >= 400 && (req.originalUrl.includes('login') || req.originalUrl.includes('register'))) {
      console.log(`    参数: phone=${req.body?.phone || '(空)'} nickname=${req.body?.nickname || '(空)'}`);
    }
  });
  next();
});

// ============================================================
// APP 版本检查（公开接口，不需要登录）
// 必须放在所有 /api 路由挂载之前：后面的路由模块里带有鉴权中间件，
// 放在后面会被误拦截返回 401
// ============================================================
app.get('/api/app-version', (req, res) => {
  res.json({
    version: APP_VERSION,
    notes: APP_UPDATE_NOTE,
    download_url: '/app-release.apk',
  });
});

// 挂载接口：注册 / 登录 / 我的信息
app.use('/api', require('./auth').router);
// 挂载接口：跑步记录 / 社团总览
app.use('/api', require('./runs'));
// 挂载接口：知识 / 计划 / 社团公告任务 / 排行榜 / 个人中心
app.use('/api', require('./extras'));
// 挂载接口：管理员后台（只有 admin 角色能访问）
app.use('/api/admin', require('./admin'));
// 挂载接口：图片/附件上传（base64 → 存到 uploads/）
app.use('/api', require('./upload'));
// 挂载接口：Keep 截图识别（OCR 提取距离/用时/配速，用于预填跑步记录）
app.use('/api', require('./ocr'));
// 挂载接口：GPX 文件导入（华为/小米/Keep 导出，数据 100% 准）
app.use('/api', require('./gpx'));
// 挂载接口：教练功能（社长看社员详情/制定计划、静息心率、燃脂消耗）
app.use('/api', require('./coach'));

// 静态托管 uploads 目录：所有上传的图片/附件都能通过 /uploads/xxx 访问
// 例如：http://10.192.184.107:3000/uploads/1729...abc.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================================
// Web 网页版（苹果 iPhone / iPad 用浏览器打开的就是这一套）
// 打包命令：在 client 目录执行  flutter build web --release
// 产物在 client/build/web，这里直接托管它 —— 改完代码重新打包即生效，不用复制文件
// 注意：必须放在所有 /api 路由之后，否则会把接口请求也当成静态文件去找
// ============================================================
const WEB_PATH = path.join(__dirname, '..', 'client', 'build', 'web');
app.use(express.static(WEB_PATH));

// 根路径：苹果手机打开 http://电脑IP:3000/ 看到的就是网页版 APP
// 如果还没打包过网页版，返回一句人话提示，方便排查
app.get('/', (req, res) => {
  const indexFile = path.join(WEB_PATH, 'index.html');
  if (!fs.existsSync(indexFile)) {
    return res
      .status(503)
      .send('网页版还没打包：请在电脑上进入 client 目录执行 flutter build web --release');
  }
  res.sendFile(indexFile);
});

// ---------- 手机下载 APK 用 ----------
// 打包好的安装包路径（双击"打包APK"快捷方式后生成）
const APK_PATH = path.join(
  __dirname, '..', 'client', 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk'
);

// 手机在系统浏览器打开这个地址就会下载 APK。
// 注意：微信内置浏览器会拦截 APK 下载，一定要用系统自带浏览器打开。
app.get('/app-release.apk', (req, res) => {
  if (!fs.existsSync(APK_PATH)) {
    return res.status(404).send('还没有 APK，请先在电脑上双击"打包APK"快捷方式打包一次');
  }
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="running-club.apk"');
  res.setHeader('Content-Length', fs.statSync(APK_PATH).size);
  fs.createReadStream(APK_PATH).pipe(res);
});

// 找出电脑在局域网里的 IP，手机要用这个地址访问电脑
function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // 只要 IPv4、且不是 127.0.0.1 本机回环地址
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const lanIp = getLanIp();

// 兜底路由：前端页面刷新时若访问到不存在的路径，统一交回网页版入口，由前端自己接管路由
// （放在所有 /api 和 /app-release.apk 路由之后，避免误拦接口）
app.get('*', (req, res) => {
  const indexFile = path.join(WEB_PATH, 'index.html');
  if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  res.status(404).send('未找到该地址');
});

app.listen(PORT, () => {
  // 启动数据库定时备份（启动时先备份一次，之后每小时检查）
  require('./backup').startBackupSchedule();
  console.log('==========================================');
  console.log(`  长跑社后端已启动: http://localhost:${PORT}`);
  console.log(`  苹果手机网页版:   http://${lanIp}:${PORT}/`);
  console.log(`  安卓手机下载APP:  http://${lanIp}:${PORT}/app-release.apk`);
  console.log('  社长采用申请制：用户提交申请后由管理员在后台审批');
  console.log('  数据库自动备份：每天一份，保留最近 7 份（data/backups/）');
  console.log('  保持这个窗口开着，关掉窗口 = 停止后端');
  console.log('==========================================');
});
