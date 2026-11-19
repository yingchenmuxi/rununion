import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9236;
const BASE = 'http://127.0.0.1:5173';
const OUT = 'E:/QPTapp/admin/shots/platform';
mkdirSync(OUT, { recursive: true });

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-platform1', 'about:blank',
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
async function inspect(name) {
  const info = await evaluate(`(() => {
    const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim();
    const buttons = [...document.querySelectorAll('button')].map((b) => clean(b.innerText) || b.getAttribute('aria-label') || b.className).filter(Boolean);
    return {
      path: location.pathname,
      h1: clean(document.querySelector('h1')?.innerText),
      title: document.title,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: innerWidth,
      rows: document.querySelectorAll('tbody tr').length,
      buttons: buttons.slice(0, 30),
      headings: [...document.querySelectorAll('h2,h3')].map((h) => clean(h.innerText)).slice(0, 12),
      text: clean(document.body.innerText).slice(0, 220),
    };
  })()`);
  await screenshot(name);
  return info;
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: BASE + '/login' });
await sleep(1200);
await evaluate('localStorage.clear()');
await send('Page.reload');
await sleep(1600);

const demoCards = await evaluate('document.querySelectorAll(".demo-account").length');
await evaluate('document.querySelectorAll(".demo-account button")[1]?.click()');
await sleep(400);
const filled = await evaluate('({ email: document.querySelector("#login-email")?.value, passwordLength: document.querySelector("#login-password")?.value.length })');
await screenshot('01-login-platform');
await evaluate('document.querySelector(".login-submit")?.click()');
await sleep(1600);
const login = await evaluate('({ path: location.pathname, user: document.querySelector(".topbar-user")?.innerText, toast: document.querySelector(".toast")?.innerText })');

const pages = [
  ['02-overview', '/platform'],
  ['03-clubs', '/platform/clubs'],
  ['04-club-detail', '/platform/clubs/club-kangfu'],
  ['05-users', '/platform/users'],
  ['06-user-detail', '/platform/users/user-linxiaoman'],
  ['07-content', '/platform/content'],
  ['08-records', '/platform/records'],
  ['09-moderation', '/platform/moderation'],
  ['10-system', '/platform/system'],
];
const results = [];
for (const [name, path] of pages) {
  await send('Page.navigate', { url: BASE + path });
  await sleep(1300);
  results.push({ name, ...(await inspect(name)) });
}
await send('Page.navigate', { url: BASE + '/platform/records' });
await sleep(1200);
const recordsButtons = await evaluate('[...document.querySelectorAll("button")].map((b) => ({ text: (b.innerText||"").replace(/\\s+/g," ").trim(), cls: b.className, aria: b.getAttribute("aria-label") })).filter((b) => b.text || b.aria).slice(-20)');
await send('Page.navigate', { url: BASE + '/platform/moderation' });
await sleep(1200);
const moderationButtons = await evaluate('[...document.querySelectorAll("button")].map((b) => ({ text: (b.innerText||"").replace(/\\s+/g," ").trim(), cls: b.className })).filter((b) => b.text).slice(-20)');
await send('Page.navigate', { url: BASE + '/platform/system' });
await sleep(1200);
const systemButtons = await evaluate('[...document.querySelectorAll("button")].map((b) => ({ text: (b.innerText||"").replace(/\\s+/g," ").trim(), cls: b.className })).filter((b) => b.text).slice(-20)');

const report = { demoCards, filled, login, results, recordsButtons, moderationButtons, systemButtons, events: events.slice(0, 40) };
writeFileSync(OUT + '/report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
try { await send('Browser.close'); } catch {}
ws.close();
edge.kill();
await sleep(300);
process.exit(0);
