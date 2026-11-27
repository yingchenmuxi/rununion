import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9273;
const ADMIN = process.env.ADMIN_BASE || 'http://127.0.0.1:8081';
const OUT = 'E:/QPTapp/admin/shots/empty';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const checks = [];
const consoleErrors = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass: Boolean(pass), detail });
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' | ' + detail : ''));
}

const browser = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=E:/QPTapp/.edge-cdp-empty',
  'about:blank',
], { stdio: 'ignore' });

async function getTargets() {
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      if (response.ok) return await response.json();
    } catch {}
    await sleep(200);
  }
  throw new Error('CDP not ready');
}

const targets = await getTargets();
const page = targets.find((target) => target.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve);
  ws.addEventListener('error', reject);
});

let nextId = 1;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const handler = pending.get(message.id);
    pending.delete(message.id);
    message.error ? handler.reject(new Error(JSON.stringify(message.error))) : handler.resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description ?? arg.type).join(' '));
  }
});

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ' ' + (result.exceptionDetails.exception?.description || ''));
  return result.result.value;
}
async function bodyText() {
  return (await evaluate('document.body.innerText')).replace(/\s+/g, ' ').trim();
}
async function waitForText(text, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if ((await bodyText()).includes(text)) return true;
    await sleep(250);
  }
  return false;
}
async function navigate(url) {
  await send('Page.navigate', { url });
  await sleep(800);
}
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  writeFileSync(OUT + '/' + name + '.png', Buffer.from(shot.data, 'base64'));
}
const setInput = (selector, value) => evaluate('(() => { const el=document.querySelector(' + JSON.stringify(selector) + '); if(!el) return {ok:false}; const setter=Object.getOwnPropertyDescriptor(el.constructor.prototype,"value")?.set||Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set; setter.call(el,' + JSON.stringify(value) + '); el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true})); return {ok:true,value:el.value}; })()');
const clearSession = () => evaluate("localStorage.removeItem('qingrun.admin.session.v1')");

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

async function login(email, password, expected) {
  await navigate(ADMIN + '/');
  await clearSession();
  await navigate(ADMIN + '/login');
  check('登录页加载 ' + email, await waitForText('登录管理后台', 12000), (await bodyText()).slice(0, 80));
  await setInput('#login-email', email);
  await setInput('#login-password', password);
  await evaluate('document.querySelector(".login-form button[type=submit]").click()');
  return await waitForText(expected, 15000);
}

check('社团后台登录', await login('admin@qingrun.local', 'Qingrun-Dev-2026', '今天，社团还好吗？'), (await bodyText()).slice(0, 120));
const dash = await bodyText();
check('概览无演示数字与动态', !dash.includes('1284') && !dash.includes('十一月 · 80 公里挑战进行中') && !dash.includes('公告《周六校园环湖 5K》已发布'), dash.slice(0, 220));
check('概览统计为 0', dash.includes('0 人') && dash.includes('本周总里程 0'), dash.slice(0, 220));
check('概览最近动态空态', dash.includes('还没有社团动态'), dash.slice(-220));
await screenshot('01-owner-dashboard-empty');

const ownerPages = [
  ['成员', '/members', ['陈予安', '周子墨']],
  ['邀请码', '/invites', ['KANGFU-2026']],
  ['公告', '/announcements', ['周六校园环湖', '跑团公告']],
  ['活动', '/activities', ['周六校园环湖', '秋季体测']],
  ['挑战', '/challenges', ['80 公里挑战', '60 公里挑战', '40 公里加练']],
  ['记录与导出', '/records', ['陈予安', '172.4']],
];
for (const [name, path, forbidden] of ownerPages) {
  await navigate(ADMIN + path);
  await sleep(1400);
  const text = await bodyText();
  const hits = forbidden.filter((item) => text.includes(item));
  const expectedEmpty = name === '成员' ? '这个分组还没有成员' : name === '记录与导出' ? '还没有社团可见记录' : '';
  const emptyOk = !expectedEmpty || text.includes(expectedEmpty);
  check(name + ' 空态且无演示数据', text.length > 50 && emptyOk && hits.length === 0, hits.length ? '命中 ' + hits.join('、') : text.slice(0, 120));
  if (name === '成员') await screenshot('02-owner-members-empty');
  if (name === '记录与导出') await screenshot('05-owner-records-empty');
}

await navigate(ADMIN + '/');
await clearSession();
check('平台后台登录', await login('ops@qingrun.local', 'Qingrun-Dev-2026', '全国社团，今天在发生什么？'), (await bodyText()).slice(0, 120));
const platformDash = await bodyText();
check('平台总览统计为 0', platformDash.includes('入驻社团') && platformDash.includes('0') && platformDash.includes('0.0 km'), platformDash.slice(0, 220));
check('平台总览无演示社团', !platformDash.includes('康福') && !platformDash.includes('浦江') && !platformDash.includes('成都七中') && !platformDash.includes('广州天河'), platformDash.slice(0, 220));
check('平台总览图表空态', platformDash.includes('还没有平台里程') && platformDash.includes('还没有城市数据') && platformDash.includes('还没有平台动态'), platformDash.slice(-260));
await screenshot('03-platform-dashboard-empty');

const platformPages = [
  ['学校与社团', '/platform/clubs', ['康福外国语学校长跑社', '浦江', '成都七中', '广州天河']],
  ['全部用户', '/platform/users', ['林小满', '陈予安']],
  ['内容与活动', '/platform/content', ['周六校园环湖', '校园环湖']],
  ['跑步记录', '/platform/records', ['林小满', '陈予安']],
  ['审核与举报', '/platform/moderation', ['康福外国语学校长跑社']],
  ['系统与权限', '/platform/system', ['林小满']],
];
for (const [name, path, forbidden] of platformPages) {
  await navigate(ADMIN + path);
  await sleep(1400);
  const text = await bodyText();
  const hits = forbidden.filter((item) => text.includes(item));
  check(name + ' 空态且无演示数据', text.length > 50 && hits.length === 0, hits.length ? '命中 ' + hits.join('、') : text.slice(0, 120));
  if (name === '学校与社团') await screenshot('04-platform-clubs-empty');
  if (name === '系统与权限') await screenshot('06-platform-system-empty');
}

check('无前端异常', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

const failed = checks.filter((item) => !item.pass);
console.log('\n' + (checks.length - failed.length) + '/' + checks.length + ' 项通过');
if (failed.length) {
  console.log('FAILED: ' + failed.map((item) => item.name).join(', '));
  process.exitCode = 1;
}
try { await send('Browser.close'); } catch {}
browser.kill();
