import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9241;
const BASE = 'http://127.0.0.1:5173';
const OUT = 'E:/QPTapp/admin/shots/platform';
mkdirSync(OUT, { recursive: true });
const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-platform-paging', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function getTargets() {
  for (let i = 0; i < 60; i++) {
    try { const res = await fetch('http://127.0.0.1:' + PORT + '/json/list'); if (res.ok) return await res.json(); } catch {}
    await sleep(200);
  }
  throw new Error('CDP not ready');
}
const targets = await getTargets();
const page = targets.find((target) => target.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
let nextId = 1;
const pending = new Map();
const events = [];
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const handler = pending.get(message.id); pending.delete(message.id);
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
async function go(path) {
  await send('Page.navigate', { url: BASE + path });
  await sleep(1300);
}
const pagerInfo = `(() => {
  const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const pager = document.querySelector('.table-pager');
  const rows = [...document.querySelectorAll('tbody tr')];
  return {
    rows: rows.length,
    first: clean(rows[0]?.innerText).slice(0, 60),
    last: clean(rows[rows.length - 1]?.innerText).slice(0, 60),
    pager: pager ? clean(pager.innerText) : null,
    active: clean(document.querySelector('.table-pager-buttons .is-active')?.innerText) || null,
    buttons: [...document.querySelectorAll('.table-pager-buttons button')].map((b) => clean(b.innerText)),
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: innerWidth,
  };
})()`;
async function clickPage(number) {
  return evaluate(`(() => {
    const button = [...document.querySelectorAll('.table-pager-buttons button')].find((item) => (item.innerText || '').trim() === '${number}');
    if (!button) return false;
    button.click();
    return true;
  })()`);
}
async function search(value) {
  return evaluate(`(() => {
    const input = document.querySelector('.search-box input');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '${value}');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
}

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await go('/login');
await evaluate('localStorage.clear()');
await send('Page.reload'); await sleep(1600);
await evaluate('document.querySelectorAll(".demo-account button")[1]?.click()');
await sleep(300);
await evaluate('document.querySelector(".login-submit")?.click()');
await sleep(1600);

const results = [];
await go('/platform/users');
results.push({ page: 'users-1', ...(await evaluate(pagerInfo)) });
await screenshot('17-users-page1');
await clickPage(2); await sleep(350);
results.push({ page: 'users-2', ...(await evaluate(pagerInfo)) });
await screenshot('18-users-page2');
await search('康福'); await sleep(500);
results.push({ page: 'users-search', ...(await evaluate(pagerInfo)) });
await screenshot('19-users-search');

await go('/platform/content');
results.push({ page: 'content-1', ...(await evaluate(pagerInfo)) });
await clickPage(2); await sleep(350);
results.push({ page: 'content-2', ...(await evaluate(pagerInfo)) });
await screenshot('20-content-page2');

await go('/platform/records');
results.push({ page: 'records-1', ...(await evaluate(pagerInfo)) });
await clickPage(2); await sleep(350);
results.push({ page: 'records-2', ...(await evaluate(pagerInfo)) });
await screenshot('21-records-page2');

await go('/platform/clubs');
results.push({ page: 'clubs', ...(await evaluate(pagerInfo)) });
await go('/platform/system');
await evaluate('[...document.querySelectorAll("button")].find((b) => (b.innerText || "").trim().startsWith("操作日志"))?.click()');
await sleep(500);
results.push({ page: 'logs', ...(await evaluate(pagerInfo)) });

const report = { results, events: events.slice(0, 40) };
writeFileSync(OUT + '/paging-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
try { await send('Browser.close'); } catch {}
ws.close(); edge.kill(); await sleep(300); process.exit(0);
