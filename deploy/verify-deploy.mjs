const base = (process.env.BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const admin = (process.env.ADMIN_URL || 'http://127.0.0.1:8081').replace(/\/$/, '');
const checks = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    checks.push({ name, ok: true, detail });
    console.log('PASS ' + name + (detail ? ' — ' + detail : ''));
  } catch (error) {
    checks.push({ name, ok: false, detail: error.message });
    console.log('FAIL ' + name + ' — ' + error.message);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await check('手机首页返回 200 且带 PWA 头', async () => {
  const response = await fetch(base + '/');
  assert(response.ok, 'HTTP ' + response.status);
  const html = await response.text();
  assert(html.includes('lang="zh-CN"'), '缺少 zh-CN');
  assert(html.includes('/manifest.webmanifest'), '缺少 manifest');
  assert(html.includes("serviceWorker"), '缺少 SW 注册');
  return 'index.html ' + html.length + ' bytes';
});

await check('manifest 可解析', async () => {
  const response = await fetch(base + '/manifest.webmanifest');
  assert(response.ok, 'HTTP ' + response.status);
  assert((response.headers.get('content-type') || '').includes('manifest+json'), 'Content-Type 不对');
  const manifest = await response.json();
  assert(manifest.name.includes('青跑团'), 'name 不对');
  assert(manifest.icons.length >= 3, 'icons 不足');
  assert(manifest.display === 'standalone', 'display 不对');
  return manifest.name + ' / ' + manifest.icons.length + ' icons';
});

await check('Service Worker 可访问', async () => {
  const response = await fetch(base + '/sw.js');
  assert(response.ok, 'HTTP ' + response.status);
  const text = await response.text();
  assert(text.includes('qingrun-shell-v1'), '缓存版本缺失');
  assert((response.headers.get('cache-control') || '').includes('no-cache'), 'SW 不应被强缓存');
  return 'sw.js ' + text.length + ' bytes';
});

await check('PWA 图标可访问', async () => {
  const response = await fetch(base + '/icons/icon-192.png');
  assert(response.ok, 'HTTP ' + response.status);
  assert((response.headers.get('content-type') || '').includes('image/png'), '不是 PNG');
  const bytes = (await response.arrayBuffer()).byteLength;
  assert(bytes > 1000, '图标过小');
  return bytes + ' bytes';
});

await check('手机路由回退到 SPA', async () => {
  const response = await fetch(base + '/school');
  assert(response.ok, 'HTTP ' + response.status);
  const html = await response.text();
  assert(html.includes('<div id="root"></div>'), '不是应用壳');
  return 'SPA fallback';
});

await check('API 经反向代理可用', async () => {
  const response = await fetch(base + '/api/health');
  assert(response.ok, 'HTTP ' + response.status);
  const data = await response.json();
  assert(data.ok === true, 'ok 不为 true');
  assert(data.activities >= 4, '活动数量异常');
  assert(data.runs >= 25, '跑步记录数量异常');
  return data.activities + ' 活动 / ' + data.runs + ' 记录 / ' + data.members + ' 成员';
});

await check('后台首页返回 200', async () => {
  const response = await fetch(admin + '/');
  assert(response.ok, 'HTTP ' + response.status);
  const html = await response.text();
  assert(html.includes('<div id="root"></div>'), '不是后台应用壳');
  const match = html.match(/src="([^"]+\.js)"/);
  assert(match, '找不到入口脚本');
  const script = await fetch(new URL(match[1], admin + '/'));
  assert(script.ok, '入口脚本 HTTP ' + script.status);
  return '入口脚本 ' + (await script.text()).length + ' bytes';
});

const failed = checks.filter((item) => !item.ok);
console.log('\n' + (checks.length - failed.length) + '/' + checks.length + ' 项通过');
if (failed.length) process.exitCode = 1;
