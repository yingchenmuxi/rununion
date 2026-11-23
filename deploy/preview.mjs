import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import http from 'node:http';
import https from 'node:https';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mobileDir = resolve(process.env.MOBILE_DIR || resolve(root, 'mobile', 'dist'));
const adminDir = resolve(process.env.ADMIN_DIR || resolve(root, 'admin', 'dist'));
const apiTarget = new URL(process.env.API_TARGET || 'http://127.0.0.1:8090');
const port = Number(process.env.PORT || 8080);
const adminPort = Number(process.env.ADMIN_PORT || 8081);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

function proxy(req, res) {
  const client = apiTarget.protocol === 'https:' ? https : http;
  const headers = { ...req.headers, host: apiTarget.host };
  const request = client.request({
    protocol: apiTarget.protocol,
    hostname: apiTarget.hostname,
    port: apiTarget.port || (apiTarget.protocol === 'https:' ? 443 : 80),
    path: req.url,
    method: req.method,
    headers,
  }, (upstream) => {
    res.writeHead(upstream.statusCode || 502, upstream.headers);
    upstream.pipe(res);
  });
  request.on('error', (error) => {
    if (!res.headersSent) sendJson(res, 502, { error: 'API 不可用：' + error.message });
    else res.destroy();
  });
  req.pipe(request);
}

async function serveStatic(req, res, baseDir) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (url.pathname === '/healthz') return sendJson(res, 200, { ok: true });

  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  let filePath = resolve(baseDir, relative || 'index.html');
  if (filePath !== baseDir && !filePath.startsWith(baseDir + sep)) {
    return sendJson(res, 403, { error: '禁止访问。' });
  }

  let info;
  try {
    info = await stat(filePath);
    if (info.isDirectory()) {
      filePath = resolve(filePath, 'index.html');
      info = await stat(filePath);
    }
  } catch {
    if (extname(url.pathname)) return sendJson(res, 404, { error: '文件不存在。' });
    filePath = resolve(baseDir, 'index.html');
    try {
      info = await stat(filePath);
    } catch {
      return sendJson(res, 404, { error: '静态文件尚未构建。' });
    }
  }

  const ext = extname(filePath);
  const headers = {
    'content-type': MIME[ext] || 'application/octet-stream',
    'content-length': info.size,
    'x-content-type-options': 'nosniff',
  };
  if (filePath.endsWith('index.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
    headers['cache-control'] = 'no-cache, no-store, must-revalidate';
  } else if (filePath.includes('/_expo/') || filePath.includes('/assets/')) {
    headers['cache-control'] = 'public, max-age=31536000, immutable';
  } else {
    headers['cache-control'] = 'public, max-age=86400';
  }

  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  createReadStream(filePath).pipe(res);
}

function makeServer(baseDir, label) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (url.pathname.startsWith('/api/')) return proxy(req, res);
      return await serveStatic(req, res, baseDir);
    } catch (error) {
      if (!res.headersSent) sendJson(res, 500, { error: error.message });
      else res.destroy();
    }
  }).listen(label === 'mobile' ? port : adminPort, '127.0.0.1', () => {
    console.log(label + ' preview: http://127.0.0.1:' + (label === 'mobile' ? port : adminPort));
  });
}

makeServer(mobileDir, 'mobile');
makeServer(adminDir, 'admin');
console.log('API target:', apiTarget.href);
