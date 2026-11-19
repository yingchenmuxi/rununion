import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9250;
const BASE = 'http://127.0.0.1:8090';
const OUT = 'E:/QPTapp/mobile/shots';
mkdirSync(OUT, { recursive: true });

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-mobile-run', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function getTargets() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      if (res.ok) return await res.json();
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
const events = [];
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const handler = pending.get(message.id);
    pending.delete(message.id);
    message.error ? handler.reject(new Error(JSON.stringify(message.error))) : handler.resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') {
    const details = message.params.exceptionDetails;
    events.push({ kind: 'exception', text: details.exception?.description || details.text });
  }
  if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
    events.push({ kind: 'console:' + message.params.type, text: message.params.args.map((arg) => arg.value ?? arg.description ?? arg.type).join(' ') });
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
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  writeFileSync(OUT + '/' + name + '.png', Buffer.from(shot.data, 'base64'));
}
const clickText = (text) => evaluate('(() => { const clean = (s) => (s || "").replace(/\\s+/g, ""); const nodes = [...document.querySelectorAll("button,[role=button],[role=tab],div")].reverse(); const target = nodes.find((n) => clean(n.innerText).includes(' + JSON.stringify(text.replace(/s+/g, '')) + ') && n.getBoundingClientRect().width > 0); if (!target) return { ok: false, buttons: [...document.querySelectorAll("button,[role=button],[role=tab]")].map((b) => (b.innerText || "").trim()).filter(Boolean) }; target.click(); return { ok: true, text: (target.innerText || "").replace(/\\s+/g, " ").trim() }; })()');
const setInput = (selector, value) => evaluate('(() => { const el = document.querySelector(' + JSON.stringify(selector) + '); if (!el) return { ok: false }; Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, ' + JSON.stringify(value) + '); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); return { ok: true, value: el.value }; })()');
const bodyText = () => evaluate('document.body.innerText.replace(/\\s+/g, " ").trim()');
const scrollToText = (text) => evaluate('(() => { const target = [...document.querySelectorAll("div")].reverse().find((n) => (n.innerText || "").includes(' + JSON.stringify(text) + ')); if (!target) return { ok: false }; target.scrollIntoView({ block: "center" }); return { ok: true }; })()');
const pageState = () => evaluate('({ path: location.pathname, body: document.body.innerText.replace(/\\s+/g, " ").trim().slice(0, 260) })');

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: BASE + '/' });
await sleep(1800);
await screenshot('run-sync-00-login');

const result = { initial: await pageState() };
result.loginFill = await evaluate('(() => { const link = [...document.querySelectorAll("div")].reverse().find((n) => (n.innerText || "").includes("填入演示账号")); if (!link) return { ok: false }; link.click(); return { ok: true }; })()');
await sleep(250);
result.username = await evaluate('document.querySelector(\'input[placeholder="输入用户名"]\')?.value || null');
result.passwordLength = await evaluate('document.querySelector(\'input[placeholder="输入密码"]\')?.value?.length || 0');
result.loginClick = await clickText('进入跑团');
await sleep(1200);
result.home = await pageState();
await screenshot('run-sync-01-home');

result.toRun = await clickText('开跑');
await sleep(600);
result.runBefore = await pageState();

result.manualEmpty = await clickText('保存记录');
await sleep(250);
result.manualError = (await bodyText()).includes('距离请填 0.1–100 km 之间的数字');

result.distanceSet = await setInput('input[placeholder="距离 km"]', '2.5');
result.durationSet = await setInput('input[placeholder="时长 分钟"]', '15');
result.noteSet = await setInput('input[placeholder="备注，如校园环湖（选填）"]', '补记测试');
result.manualSave = await clickText('保存记录');
await sleep(450);
result.manualSaved = {
  body: (await bodyText()).includes('已记录 2.5 km'),
  weekly: (await bodyText()).includes('21.1'),
};
await screenshot('run-sync-02-manual-saved');
result.manualScroll = await scrollToText('手动记录');
await sleep(250);
await screenshot('run-sync-08-manual-section');

await clickText('首页');
await sleep(500);
result.homeAfter = {
  body: (await bodyText()).includes('21.1'),
  note: (await bodyText()).includes('补记测试'),
  state: await pageState(),
};
await screenshot('run-sync-03-home-synced');
result.homeScroll = await scrollToText('最近记录');
await sleep(250);
await screenshot('run-sync-09-home-records');

await clickText('成长');
await sleep(500);
result.growthAfter = {
  month: (await bodyText()).includes('44.8'),
  note: (await bodyText()).includes('补记测试'),
  state: await pageState(),
};
await screenshot('run-sync-04-growth-synced');
result.growthScroll = await scrollToText('最近记录');
await sleep(250);
await screenshot('run-sync-10-growth-records');

await clickText('开跑');
await sleep(400);
result.startTimer = await clickText('开始跑步');
await sleep(2200);
result.stopTimer = await clickText('结束并保存');
await sleep(350);
result.timerPending = {
  body: (await bodyText()).includes('本次计时'),
  pending: (await bodyText()).includes('待保存'),
};
await screenshot('run-sync-05-timer-pending');
result.timerDistanceSet = await setInput('input[placeholder="本次距离 km"]', '0.5');
result.timerSave = await clickText('保存本次');
await sleep(500);
result.timerSaved = {
  body: (await bodyText()).includes('已记录 0.5 km'),
  weekly: (await bodyText()).includes('21.6'),
};
await screenshot('run-sync-06-timer-saved');

await clickText('首页');
await sleep(450);
result.homeFinal = {
  body: (await bodyText()).includes('21.6'),
  timerNote: (await bodyText()).includes('轻松跑 · 5K'),
};
await screenshot('run-sync-07-home-final');
await clickText('我的');
await sleep(450);
result.profile = (await bodyText()).includes('45.3');
await screenshot('run-sync-11-profile');

result.events = events.slice(0, 30);
writeFileSync(OUT + '/run-sync-report.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
try { await send('Browser.close'); } catch {}
ws.close();
edge.kill();
await sleep(300);
process.exit(0);
