import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9235;
const BASE = 'http://127.0.0.1:5173';
const OUT = 'E:/QPTapp/admin/shots';
mkdirSync(OUT, { recursive: true });

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-admin3', 'about:blank',
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
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  writeFileSync(OUT + '/' + name + '.png', Buffer.from(shot.data, 'base64'));
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return result.result.value;
}
async function pageInfo() {
  return evaluate('(() => ({ path: location.pathname, vw: innerWidth, sw: document.documentElement.scrollWidth, title: document.title, text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 160) }))()');
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: BASE + '/login' });
await sleep(1000);
await evaluate('localStorage.clear()');
await send('Page.reload');
await sleep(1800);
await screenshot('login');
const loginInfo = await pageInfo();

const clicked = await evaluate('(() => { const button = document.querySelector(".login-submit"); if (!button) return { ok: false, reason: "no submit" }; button.click(); return { ok: true }; })()');
await sleep(2200);
await screenshot('overview');
const overviewInfo = await pageInfo();

const pages = [
  ['members', '/members'],
  ['invites', '/invites'],
  ['announcements', '/announcements'],
  ['challenges', '/challenges'],
  ['records', '/records'],
];
const pageResults = [];
for (const [name, path] of pages) {
  const result = await evaluate('(() => { const link = document.querySelector(\'a[href="' + path + '"]\'); if (!link) return { ok: false }; link.click(); return { ok: true }; })()');
  await sleep(1100);
  await screenshot(name);
  pageResults.push({ name, click: result, info: await pageInfo() });
}

console.log(JSON.stringify({ loginInfo, clicked, overviewInfo, pages: pageResults, events: events.slice(0, 20) }, null, 2));
try { await send('Browser.close'); } catch {}
ws.close();
edge.kill();
await sleep(300);
process.exit(0);
