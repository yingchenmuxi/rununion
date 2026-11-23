import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9270;
const BASE = 'http://127.0.0.1:8080';
const ADMIN = 'http://127.0.0.1:8081';
const OUT = 'E:/QPTapp/deploy/shots';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const checks = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass: Boolean(pass), detail });
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' | ' + detail : ''));
}

const browser = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=E:/QPTapp/.edge-cdp-deploy',
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
const consoleErrors = [];
const requests = [];
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
  if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
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
  await sleep(900);
}
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  writeFileSync(OUT + '/' + name + '.png', Buffer.from(shot.data, 'base64'));
}
const setInput = (selector, value) => evaluate('(() => { const el=document.querySelector(' + JSON.stringify(selector) + '); if(!el) return {ok:false}; const setter=Object.getOwnPropertyDescriptor(el.constructor.prototype,"value")?.set||Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set; setter.call(el,' + JSON.stringify(value) + '); el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true})); return {ok:true,value:el.value}; })()');
const clickText = (text) => evaluate('(() => { const nodes=[...document.querySelectorAll("button,[role=button],[role=tab],div")].reverse(); const target=nodes.find((node)=>(node.innerText||"").includes(' + JSON.stringify(text) + ')&&node.getBoundingClientRect().width>0); if(!target) return {ok:false,body:document.body.innerText.slice(0,400)}; target.click(); return {ok:true,text:(target.innerText||"").replace(/\\s+/g," ").trim().slice(0,100)}; })()');
const clickTab = (text) => evaluate('(() => { const norm=(value)=>(value||"").replace(/\\s+/g," ").trim(); const want=' + JSON.stringify(text) + '; const all=[...document.querySelectorAll("[role=tab]")].filter((node)=>node.getBoundingClientRect().width>0); const target=all.find((node)=>norm(node.innerText).includes(want)); if(!target) return {ok:false,tabs:all.map((node)=>norm(node.innerText))}; target.click(); return {ok:true,text:norm(target.innerText)}; })()');
const clickButton = (text) => evaluate('(() => { const norm=(value)=>(value||"").replace(/\\s+/g," ").trim(); const want=' + JSON.stringify(text) + '; const all=[...document.querySelectorAll("[role=button],[role=tab],button")].filter((node)=>node.getBoundingClientRect().width>0); const target=all.find((node)=>norm(node.innerText)===want)||all.find((node)=>norm(node.innerText).includes(want)); if(!target) return {ok:false,buttons:all.map((node)=>norm(node.innerText)).filter(Boolean).slice(0,30)}; target.click(); return {ok:true,text:norm(target.innerText).slice(0,100)}; })()');

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

await navigate(BASE + '/');
check('手机登录页加载', await waitForText('填入演示账号', 12000), (await bodyText()).slice(0, 100));
await clickText('填入演示账号');
await sleep(300);
await clickText('进入跑团');
check('手机演示账号登录成功', await waitForText('本周活动', 12000), (await bodyText()).slice(0, 120));
await clickTab('首页');
check('手机首页加载', await waitForText('本周跑量', 12000), (await bodyText()).slice(0, 100));
const manifestHref = await evaluate('document.querySelector(\'link[rel="manifest"]\')?.href || ""');
check('PWA manifest 已挂载', manifestHref.endsWith('/manifest.webmanifest'), manifestHref);
const swReady = await evaluate('navigator.serviceWorker.ready.then((registration) => Boolean(registration.active)).catch(() => false)');
check('Service Worker 已激活', swReady === true, String(swReady));
const apiInPage = await evaluate('fetch("/api/health").then((response) => response.json()).then((data) => data.ok === true).catch(() => false)');
check('页面同源 API 可用', apiInPage === true, String(apiInPage));
await screenshot('01-mobile-home');

check('进入跑团页', (await clickTab('跑团')).ok);
check('跑团公告加载', await waitForText('跑团公告'));
check('打开跑团主页', (await clickButton('查看跑团')).ok);
check('跑团主页可打开', await waitForText('跑团主页'));
await screenshot('02-mobile-club');

check('进入成长页', (await clickTab('成长')).ok);
check('成长页可打开', await waitForText('跑团挑战', 12000));
await screenshot('03-mobile-growth');

check('进入我的页', (await clickTab('我的')).ok);
check('我的页加载', await waitForText('查看透明账本', 12000));
await evaluate("(() => { const nodes=[...document.querySelectorAll('div')]; const target=nodes.reverse().find((node)=>(node.innerText||'').includes('查看透明账本')&&node.getBoundingClientRect().width>0); if(target) target.scrollIntoView({block:'center'}); return true; })()");
await clickText('查看透明账本');
check('公益账本可打开', await waitForText('公益透明账本', 12000), (await bodyText()).slice(0, 100));
await screenshot('04-mobile-charity');

await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await navigate(ADMIN + '/');
await evaluate("localStorage.removeItem('qingrun.admin.session.v1')");
await navigate(ADMIN + '/login');
check('后台登录页加载', await waitForText('登录管理后台'), (await bodyText()).slice(0, 100));
await screenshot('05-admin-login');

await setInput('#login-email', 'admin@qingrun.local');
await setInput('#login-password', 'Qingrun-Dev-2026');
await evaluate('document.querySelector(".login-form button[type=submit]").click()');
check('后台登录进入工作台', await waitForText('今天，社团还好吗？', 15000), (await bodyText()).slice(0, 160));
await screenshot('06-admin-dashboard');

const paths = [...new Set(requests.map((url) => { try { return new URL(url).pathname; } catch { return url; } }))];
const apiPaths = paths.filter((path) => path.startsWith('/api/'));
check('前端请求同源 /api', apiPaths.length > 0 && !requests.some((url) => url.includes(':8090')), apiPaths.slice(0, 6).join(', '));
check('无前端异常', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

const failed = checks.filter((item) => !item.pass);
console.log('\n' + (checks.length - failed.length) + '/' + checks.length + ' 项通过');
try { await send('Browser.close'); } catch {}
browser.kill();
if (failed.length) process.exitCode = 1;