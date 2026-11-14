// ============================================================
// 文件上传模块：接收前端传来的 base64 图片/附件，保存到 uploads/ 目录
// 使用方式：
//   POST /api/upload
//   Body: { "data": "data:image/jpeg;base64,xxxxx", "filename": "可选.jpg" }
//   返回: { "url": "/uploads/1729...abc.jpg" }
// ============================================================
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { authRequired } = require('./auth');

const router = express.Router();

// uploads 目录的绝对路径（与 server.js 同级）
const UPLOAD_DIR = path.join(__dirname, 'uploads');
// 启动时确保目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 支持的图片类型 -> 扩展名
const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  // 常见文档附件
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt',
  'text/markdown': '.md',
};

// 单文件最大 10 MB（base64 后约 13.3MB）
const MAX_SIZE = 10 * 1024 * 1024;

// 上传接口：前端把文件 base64 编码后传过来（单独挂 authRequired，不再全局拦截）
router.post('/upload', authRequired, (req, res) => {
  const { data } = req.body || {};
  if (!data || typeof data !== 'string') {
    return res.status(400).json({ error: '缺少 data 字段（base64 编码）' });
  }

  // 解析 "data:image/jpeg;base64,xxxxxx" 这种格式
  const match = data.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: 'data 格式不正确，应为 data:<mime>;base64,<内容>' });
  }
  const mime = match[1].toLowerCase();
  const base64Body = match[2];

  // 校验类型
  const ext = MIME_TO_EXT[mime];
  if (!ext) {
    return res.status(400).json({ error: `不支持的文件类型：${mime}` });
  }

  // 解码并校验大小
  let buffer;
  try {
    buffer = Buffer.from(base64Body, 'base64');
  } catch (e) {
    return res.status(400).json({ error: 'base64 解码失败' });
  }
  if (buffer.length === 0) {
    return res.status(400).json({ error: '文件内容为空' });
  }
  if (buffer.length > MAX_SIZE) {
    return res.status(400).json({ error: `文件过大，最大支持 ${MAX_SIZE / 1024 / 1024} MB` });
  }

  // 生成文件名：时间戳 + 随机串，避免冲突
  const filename = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  try {
    fs.writeFileSync(filepath, buffer);
  } catch (e) {
    console.error('写入文件失败：', e);
    return res.status(500).json({ error: '保存文件失败' });
  }

  // 返回可访问的相对 URL，前端拼上后端地址即可访问
  res.json({ url: `/uploads/${filename}`, size: buffer.length, mime });
});

module.exports = router;
