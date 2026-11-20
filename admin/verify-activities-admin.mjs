import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9241;
const BASE = 'http://127.0.0.1:5173';
const OUT = 'E:/QPTapp/admin/shots/activities';
mkdirSync(OUT, { recursive: true });

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-activities', 'about:blank',
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

const waitFor = async (expression, timeout = 6000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try { if (await evaluate(expression)) return true; } catch {}
    await sleep(150);
  }
  return false;
};
const clickModalButton = (text) => evaluate('(() => { const target = [...document.querySelectorAll(".modal-footer button")].find((b) => (b.innerText || "").trim() === ' + JSON.stringify(text) + '); if (!target) return { ok: false, buttons: [...document.querySelectorAll(".modal-footer button")].map((b) => (b.innerText || "").trim()) }; target.click(); return { ok: true }; })()');
const clickFilter = (text) => evaluate('(() => { const target = [...document.querySelectorAll("[role=tab]")].find((b) => (b.innerText || "").trim().startsWith(' + JSON.stringify(text) + ')); if (!target) return { ok: false }; target.click(); return { ok: true, text: (target.innerText || "").trim() }; })()');
const clickRowButton = (rowText, buttonText) => evaluate('(() => { const row = [...document.querySelectorAll("tbody tr")].find((r) => (r.innerText || "").includes(' + JSON.stringify(rowText) + ')); const button = [...(row?.querySelectorAll("button") || [])].find((b) => (b.innerText || "").trim() === ' + JSON.stringify(buttonText) + '); if (!button) return { ok: false, row: row?.innerText?.replace(/\\s+/g, " ").trim() || null, buttons: [...(row?.querySelectorAll("button") || [])].map((b) => (b.innerText || "").trim()) }; button.click(); return { ok: true }; })()');
const rows = () => evaluate('[...document.querySelectorAll("tbody tr")].map((row) => row.innerText.replace(/\\s+/g, " ").trim())');
const stats = () => evaluate('[...document.querySelectorAll(".stat-card")].map((card) => card.innerText.replace(/\\s+/g, " ").trim())');
const summary = () => evaluate('[...document.querySelectorAll(".detail-summary > div")].map((n) => n.innerText.replace(/\\s+/g, " ").trim())');
const tabs = () => evaluate('[...document.querySelectorAll("[role=tab]")].map((b) => (b.innerText || "").trim())');
const openActivity = async (id) => {
  await clickNav('/activities');
  await waitFor('document.querySelector(".activity-table")');
  await evaluate('document.querySelector(' + JSON.stringify('a[href="/activities/' + id + '"]') + ')?.click()');
  await waitFor('location.pathname === ' + JSON.stringify('/activities/' + id));
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: BASE + '/login' });
await sleep(1100);
await evaluate('localStorage.clear()');
await send('Page.reload');
await sleep(1500);
await evaluate('document.querySelectorAll(".demo-account button")[0]?.click()');
await sleep(300);
await evaluate('document.querySelector(".login-submit")?.click()');
await waitFor('location.pathname !== "/login"');
await sleep(500);

const result = { login: await pageState() };

await clickNav('/activities');
await waitFor('document.querySelectorAll(".activity-table tbody tr").length === 4');
await sleep(250);
result.listStats = await stats();
result.listRows = await rows();
await screenshot('01-activity-list');
result.pendingFilter = await clickFilter('待确认');
await sleep(300);
result.pendingRows = await rows();
await screenshot('02-pending-activities');

await clickFilter('全部');
await sleep(250);
await openActivity('act-001');
await waitFor('document.querySelectorAll(".signup-table tbody tr").length === 8');
await sleep(250);
result.detailSummary = await summary();
result.detailRows = await rows();
await screenshot('03-activity-detail');
await clickFilter('待确认');
await sleep(300);
result.pendingSignupRows = await rows();
result.sg006Before = await evaluate('(() => { const row = [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("李思远")); const approve = [...(row?.querySelectorAll("button") || [])].find((b) => b.innerText.trim() === "通过"); return { row: row?.innerText.replace(/\\s+/g, " ").trim(), approveDisabled: approve?.disabled ?? null }; })()');
await clickRowButton('李思远', '补登记同意');
await sleep(350);
result.consentModal = await pageState();
await screenshot('04-consent-confirm');
await clickModalButton('已联系监护人');
await waitFor('(() => { const row = [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("李思远")); return row && row.innerText.includes("同意已登记"); })()');
await sleep(300);
result.sg006AfterConsent = await evaluate('(() => { const row = [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("李思远")); const approve = [...(row?.querySelectorAll("button") || [])].find((b) => b.innerText.trim() === "通过"); return { row: row?.innerText.replace(/\\s+/g, " ").trim(), approveDisabled: approve?.disabled ?? null, hasConsentButton: [...(row?.querySelectorAll("button") || [])].some((b) => b.innerText.trim() === "补登记同意") }; })()');
await screenshot('05-consent-registered');

await clickRowButton('李思远', '通过');
await sleep(350);
result.approveModal = await pageState();
await setInput('#review-note', '已电话联系监护人，同意参加周六环湖。', 'textarea');
await screenshot('06-approve-modal');
await clickModalButton('确认报名');
await waitFor('!document.querySelector(".modal")');
await sleep(500);
result.afterApprove = { pendingRows: await rows(), summary: await summary(), toast: (await pageState()).toast };
await screenshot('07-approved');

await clickRowButton('陈一诺', '取消');
await sleep(350);
result.declineModal = await pageState();
await clickModalButton('确认取消');
await waitFor('document.querySelector(".form-error")');
result.declineError = await evaluate('document.querySelector(".form-error")?.innerText?.replace(/\\s+/g, " ").trim() || null');
await screenshot('08-decline-requires-reason');
await setInput('#review-note', '监护人说明周六上午有课，本次不参加。', 'textarea');
await clickModalButton('确认取消');
await waitFor('!document.querySelector(".modal")');
await sleep(500);
result.afterDecline = { pendingRows: await rows(), summary: await summary(), toast: (await pageState()).toast };
await screenshot('09-declined');

await openActivity('act-002');
await waitFor('document.querySelectorAll(".signup-table tbody tr").length === 5');
await sleep(300);
result.act002Before = await summary();
await clickText('结束活动');
await sleep(400);
result.endModal = await pageState();
await screenshot('10-end-confirm');
await clickModalButton('结束活动');
await waitFor('document.body.innerText.includes("活动已结束，报名只读")');
await sleep(500);
result.act002After = await evaluate('(() => ({ summary: [...document.querySelectorAll(".detail-summary > div")].map((n) => n.innerText.replace(/\\s+/g, " ").trim()), tabs: [...document.querySelectorAll("[role=tab]")].map((b) => (b.innerText || "").trim()), toast: document.querySelector(".toast")?.innerText?.trim() || null, body: document.body.innerText.replace(/\\s+/g, " ").slice(0, 260) }))()');
await screenshot('11-ended');

await openActivity('act-003');
await waitFor('document.body.innerText.includes("发布活动")');
await sleep(300);
await clickText('发布活动');
await sleep(350);
result.publishModal = await pageState();
await screenshot('12-publish-confirm');
await clickModalButton('发布活动');
await waitFor('document.body.innerText.includes("结束活动")');
await sleep(400);
result.act003After = { body: (await pageState()).body, toast: (await pageState()).toast };
await screenshot('13-published');

await clickNav('/activities');
await waitFor('document.querySelector(".activity-table")');
await sleep(300);
await clickText('发布活动');
await sleep(400);
result.createModal = await pageState();
result.createDefaults = await evaluate('({ date: document.querySelector("#activity-date")?.value, time: document.querySelector("#activity-time")?.value, area: document.querySelector("#activity-area")?.value, coach: document.querySelector("#activity-coach")?.value })');
await setInput('#activity-title', '周六校园慢跑');
await setInput('#activity-desc', '绕校园慢跑一圈，跑走结合，不设关门时间，感觉不适随时停下。', 'textarea');
const sharedActivities = await (await fetch('http://127.0.0.1:8090/api/activities')).json();
const firstActivity = sharedActivities.find((item) => item.id === 'act-001');
if (!firstActivity) throw new Error('共享数据里没有 act-001');
await setInput('#activity-date', firstActivity.date);
await setInput('#activity-time', '07:00');
await screenshot('14-create-modal');
await clickModalButton('发布活动');
await waitFor('document.querySelector(".form-error")');
result.createConflict = await evaluate('document.querySelector(".form-error")?.innerText?.replace(/\\s+/g, " ").trim() || null');
await screenshot('15-create-conflict');
await setInput('#activity-time', '08:00');
await clickModalButton('发布活动');
await waitFor('!document.querySelector(".modal")');
await sleep(600);
result.createSuccess = { rows: await rows(), stats: await stats(), toast: (await pageState()).toast, body: (await pageState()).body };
await screenshot('16-created');
await clickFilter('全部');
await sleep(300);
result.finalRows = await rows();
await screenshot('17-final-list');

result.events = events.slice(0, 30);
const failed = [];
if (!String(result.createConflict || '').includes('同一天同一时间')) failed.push('未出现同日同时间冲突提示');
if (result.finalRows?.length !== 5) failed.push('最终活动数不是 5');
if (result.events.length) failed.push('出现 console error 或异常');
result.failed = failed;
const fs = await import('node:fs');
fs.writeFileSync(OUT + '/activities-report.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (failed.length) console.error('FAIL: ' + failed.join('; '));
try { await send('Browser.close'); } catch {}
ws.close();
edge.kill();
await sleep(300);
process.exit(failed.length ? 1 : 0);
