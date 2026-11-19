import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9239;
const BASE = 'http://127.0.0.1:5173';
const OUT = 'E:/QPTapp/admin/shots/platform';
mkdirSync(OUT, { recursive: true });

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-platform4', 'about:blank',
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
const clickText = (text) => evaluate('(() => { const target = [...document.querySelectorAll("button")].find((b) => (b.innerText || "").trim() === ' + JSON.stringify(text) + '); if (!target) return { ok: false, buttons: [...document.querySelectorAll("button")].map((b) => (b.innerText || "").trim()).filter(Boolean) }; target.click(); return { ok: true }; })()');
const clickNav = (href) => evaluate('(() => { const link = document.querySelector(' + JSON.stringify('a[href="' + href + '"]') + '); if (!link) return { ok: false }; link.click(); return { ok: true }; })()');
const setInput = (selector, value, kind) => evaluate('(() => { const el = document.querySelector(' + JSON.stringify(selector) + '); if (!el) return { ok: false }; const proto = (' + JSON.stringify(kind || 'input') + ' === "textarea") ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ' + JSON.stringify(value) + '); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); return { ok: true, value: el.value }; })()');
const pageState = () => evaluate(`(() => ({
  path: location.pathname,
  toast: [...document.querySelectorAll('.toast')].map((n) => n.innerText.trim()).join(' | '),
  modal: document.querySelector('.modal')?.innerText?.replace(/\\s+/g, ' ').trim()?.slice(0, 200) || null,
  h1: document.querySelector('h1')?.innerText?.trim() || null
}))()`);

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: BASE + '/login' });
await sleep(1100);
await evaluate('localStorage.clear()');
await send('Page.reload');
await sleep(1500);
await evaluate('document.querySelectorAll(".demo-account button")[1]?.click()');
await sleep(300);
await evaluate('document.querySelector(".login-submit")?.click()');
await sleep(1400);

const result = { login: await pageState() };

// System layout check after the account-table width fix.
await clickNav('/platform/system');
await sleep(700);
await screenshot('10-system-fixed');
result.systemLayout = await evaluate(`(() => {
  const wrap = document.querySelector('.table-wrap');
  return { scrollWidth: document.documentElement.scrollWidth, innerWidth, tableClient: wrap?.clientWidth, tableScroll: wrap?.scrollWidth };
})()`);

// 1) Record correction.
await clickNav('/platform/records');
await sleep(800);
const recordBefore = await evaluate(`(() => {
  const row = document.querySelector('tbody tr');
  return { text: row?.innerText?.replace(/\\s+/g, ' ').trim(), rows: document.querySelectorAll('tbody tr').length };
})()`);
result.recordBefore = recordBefore;
result.recordOpen = await clickText('更正');
await sleep(350);
await screenshot('11-record-edit-modal');
result.recordModal = await pageState();
result.recordFields = await evaluate(`({
  date: document.querySelector('#record-date')?.value,
  distance: document.querySelector('#record-distance')?.value,
  duration: document.querySelector('#record-duration')?.value,
  note: document.querySelector('#record-note')?.value
})`);
result.distanceSet = await setInput('#record-distance', '21.5');
result.noteSet = await setInput('#record-note', '平台复核：按计时器原始记录更正，原填写有误。', 'textarea');
await clickText('保存更正');
await sleep(900);
await screenshot('12-record-updated');
result.recordAfter = await evaluate(`(() => {
  const row = document.querySelector('tbody tr');
  return { firstRow: row?.innerText?.replace(/\\s+/g, ' ').trim(), toast: document.querySelector('.toast')?.innerText?.trim() || null };
})()`);

// 2) Resolve a high-risk report without leaving the SPA.
result.toModeration = await clickNav('/platform/moderation');
await sleep(800);
result.moderationBefore = await evaluate('({ pending: document.querySelectorAll(".report-card").length, stats: document.body.innerText.includes("待处理") })');
result.reportOpen = await clickText('处理并留痕');
await sleep(350);
await screenshot('13-moderation-modal');
result.moderationModal = await pageState();
result.quickNote = await evaluate(`(() => {
  const chip = document.querySelector('.review-form .soft-chip-button');
  if (!chip) return { ok: false };
  chip.click();
  return { ok: true, text: chip.innerText.trim() };
})()`);
await sleep(200);
await clickText('确认处理');
await sleep(900);
await screenshot('14-moderation-updated');
result.moderationAfter = await evaluate(`({
  cards: document.querySelectorAll('.report-card').length,
  toast: document.querySelector('.toast')?.innerText?.trim() || null,
  text: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 160)
})`);

// 3) Create and disable an account.
await clickNav('/platform/system');
await sleep(700);
result.systemTab = await evaluate(`(() => {
  const tab = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('操作日志'));
  return tab ? tab.innerText.replace(/\\s+/g, ' ').trim() : null;
})()`);
await clickText('新增管理员');
await sleep(300);
result.accountName = await setInput('#account-name', '测试管理员');
result.accountEmail = await setInput('#account-email', 'qa-platform@qingrun.local');
await screenshot('15-account-modal');
await clickText('创建账号');
await sleep(900);
result.accountAfterCreate = await evaluate(`(() => ({
  rows: document.querySelectorAll('.account-table tbody tr').length,
  newRow: [...document.querySelectorAll('.account-table tbody tr')].find((r) => r.innerText.includes('qa-platform@qingrun.local'))?.innerText.replace(/\\s+/g, ' ').trim() || null,
  toast: document.querySelector('.toast')?.innerText?.trim() || null
}))()`);
result.disableClick = await evaluate(`(() => {
  const row = [...document.querySelectorAll('.account-table tbody tr')].find((r) => r.innerText.includes('qa-platform@qingrun.local'));
  const button = [...(row?.querySelectorAll('button') || [])].find((b) => b.innerText.trim() === '停用');
  if (!button) return { ok: false };
  button.click();
  return { ok: true };
})()`);
await sleep(300);
result.disableConfirm = await clickText('确认停用');
await sleep(800);
result.accountAfterDisable = await evaluate(`(() => ({
  newRow: [...document.querySelectorAll('.account-table tbody tr')].find((r) => r.innerText.includes('qa-platform@qingrun.local'))?.innerText.replace(/\\s+/g, ' ').trim() || null,
  toast: document.querySelector('.toast')?.innerText?.trim() || null
}))()`);

// 4) Audit log verification.
await evaluate(`(() => {
  const tab = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('操作日志'));
  if (tab) tab.click();
  return !!tab;
})()`);
await sleep(700);
await screenshot('16-system-logs');
result.logs = await evaluate(`(() => {
  const rows = [...document.querySelectorAll('.log-table tbody tr')].slice(0, 6);
  return { count: document.querySelectorAll('.log-table tbody tr').length, rows: rows.map((r) => r.innerText.replace(/\\s+/g, ' ').trim()) };
})()`);
result.events = events.slice(0, 30);
writeFileSync(OUT + '/actions-report.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
try { await send('Browser.close'); } catch {}
ws.close();
edge.kill();
await sleep(300);
process.exit(0);
