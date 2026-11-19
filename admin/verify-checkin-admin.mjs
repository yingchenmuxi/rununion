import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9243;
const BASE = 'http://127.0.0.1:5173';
const OUT = 'E:/QPTapp/admin/shots/checkin';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-checkin', 'about:blank',
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
const target = targets.find((item) => item.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
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
const pageState = () => evaluate('(() => ({ path: location.pathname, toast: [...document.querySelectorAll(".toast")].map((n) => n.innerText.trim()).join(" | "), modal: document.querySelector(".modal") ? document.querySelector(".modal").innerText.slice(0, 320) : null, h1: document.querySelector("h1") ? document.querySelector("h1").innerText.trim() : null }))()');
const waitFor = async (expression, timeout = 7000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try { if (await evaluate(expression)) return true; } catch {}
    await sleep(150);
  }
  return false;
};
const clickModalButton = (text) => evaluate('(() => { const target = [...document.querySelectorAll(".modal-footer button")].find((b) => (b.innerText || "").trim() === ' + JSON.stringify(text) + '); if (!target) return { ok: false, buttons: [...document.querySelectorAll(".modal-footer button")].map((b) => (b.innerText || "").trim()) }; target.click(); return { ok: true }; })()');
const clickFilter = (text) => evaluate('(() => { const target = [...document.querySelectorAll("[role=tab]")].find((b) => (b.innerText || "").trim().startsWith(' + JSON.stringify(text) + ')); if (!target) return { ok: false }; target.click(); return { ok: true, text: (target.innerText || "").trim() }; })()');
const clickRowButton = (rowText, buttonText) => evaluate('(() => { const row = [...document.querySelectorAll("tbody tr")].find((r) => (r.innerText || "").includes(' + JSON.stringify(rowText) + ')); const button = [...(row ? row.querySelectorAll("button") : [])].find((b) => (b.innerText || "").trim() === ' + JSON.stringify(buttonText) + '); if (!button) return { ok: false, row: row ? row.innerText.split(String.fromCharCode(10)).join(" ").trim() : null, buttons: [...(row ? row.querySelectorAll("button") : [])].map((b) => (b.innerText || "").trim()) }; button.click(); return { ok: true }; })()');
const rows = () => evaluate('[...document.querySelectorAll("tbody tr")].map((row) => row.innerText.split(String.fromCharCode(10)).join(" ").trim())');
const stats = () => evaluate('[...document.querySelectorAll(".stat-card")].map((card) => card.innerText.split(String.fromCharCode(10)).join(" ").trim())');
const summary = () => evaluate('[...document.querySelectorAll(".detail-summary > div")].map((n) => n.innerText.split(String.fromCharCode(10)).join(" ").trim())');
const checkinCounts = () => evaluate('[...document.querySelectorAll(".checkin-counts > div")].map((n) => n.innerText.split(String.fromCharCode(10)).join(" ").trim())');
const checkinText = () => evaluate('document.querySelector(".checkin-card") ? document.querySelector(".checkin-card").innerText.split(String.fromCharCode(10)).join(" ").trim() : null');
const rowActions = (rowText) => evaluate('(() => { const row = [...document.querySelectorAll("tbody tr")].find((r) => (r.innerText || "").includes(' + JSON.stringify(rowText) + ')); return [...(row ? row.querySelectorAll("button") : [])].map((b) => (b.innerText || "").trim()); })()');
const openActivity = async (id) => {
  await clickNav('/activities');
  await waitFor('document.querySelector(".activity-table")');
  await evaluate('document.querySelector(' + JSON.stringify('a[href="/activities/' + id + '"]') + ')?.click()');
  await waitFor('location.pathname === ' + JSON.stringify('/activities/' + id));
  await sleep(450);
};

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail });

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: BASE + '/login' });
await sleep(1200);
await evaluate('localStorage.clear()');
await send('Page.reload');
await sleep(1600);
await evaluate('document.querySelectorAll(".demo-account button")[0]?.click()');
await sleep(300);
await evaluate('document.querySelector(".login-submit")?.click()');
await waitFor('location.pathname !== "/login"');
await sleep(600);

const result = { login: await pageState() };

await clickNav('/activities');
await waitFor('document.querySelectorAll(".activity-table tbody tr").length === 4');
await sleep(350);
result.listStats = await stats();
result.listRows = await rows();
await screenshot('01-list');
check('活动列表有 4 张统计卡', result.listStats.length === 4, result.listStats);
check('列表显示待签到 3 人', result.listStats.some((text) => text.startsWith('待签到') && text.includes('3')), result.listStats);
check('act-004 行提示 3 人待签到', result.listRows.some((text) => text.includes('校园环湖') && text.includes('3 人待签到')), result.listRows);

await openActivity('act-004');
await waitFor('document.querySelectorAll(".signup-table tbody tr").length === 6');
await sleep(300);
result.detailSummary = await summary();
result.checkinText = await checkinText();
result.checkinCounts = await checkinCounts();
result.detailRows = await rows();
result.initialActions = {
  lin: await rowActions('林小满'),
  xu: await rowActions('许嘉禾'),
  li: await rowActions('李思远'),
};
await screenshot('02-ended-detail');
check('已结束活动显示签到区', Boolean(result.checkinText), result.checkinText);
check('签到区初始 3 / 6', (result.checkinText || '').includes('已核对 3 / 6'), result.checkinText);
check('已参加人数初始为 3', result.checkinCounts[0] === '3 已参加', result.checkinCounts);
check('待签到人数初始为 3', result.checkinCounts[2] === '3 待签到', result.checkinCounts);
check('已参加行可撤销签到', result.initialActions.lin.includes('撤销签到'), result.initialActions.lin);
check('待签到行显示签到和未到', result.initialActions.xu.includes('签到') && result.initialActions.xu.includes('未到'), result.initialActions.xu);

const clickXu = await clickRowButton('许嘉禾', '签到');
check('点击许嘉禾签到成功', clickXu.ok, clickXu);
await sleep(400);
result.attendedModal = await pageState();
await screenshot('03-attended-confirm');
check('出现标记已参加弹窗', (result.attendedModal.modal || '').includes('标记为已参加'), result.attendedModal.modal);
await clickModalButton('确认签到');
await waitFor('!document.querySelector(".modal")');
await sleep(800);
result.afterAttended = {
  text: await checkinText(),
  counts: await checkinCounts(),
  actions: await rowActions('许嘉禾'),
  toast: (await pageState()).toast,
};
await screenshot('04-attended');
check('许嘉禾签到后变成已参加', result.afterAttended.actions.includes('撤销签到'), result.afterAttended.actions);
check('签到后已核对 4 / 6', (result.afterAttended.text || '').includes('已核对 4 / 6'), result.afterAttended.text);
check('签到后待签到为 2', result.afterAttended.counts[2] === '2 待签到', result.afterAttended.counts);

const clickWang = await clickRowButton('王予辰', '未到');
check('点击王予辰未到成功', clickWang.ok, clickWang);
await sleep(400);
result.absentModal = await pageState();
await screenshot('05-absent-confirm');
check('出现标记未到弹窗', (result.absentModal.modal || '').includes('标记为未到'), result.absentModal.modal);
await clickModalButton('确认未到');
await waitFor('!document.querySelector(".modal")');
await sleep(800);
result.afterAbsent = {
  text: await checkinText(),
  counts: await checkinCounts(),
  actions: await rowActions('王予辰'),
  toast: (await pageState()).toast,
};
check('未到后显示 1 人未到', result.afterAbsent.counts[1] === '1 未到', result.afterAbsent.counts);
check('未到后已核对 5 / 6', (result.afterAbsent.text || '').includes('已核对 5 / 6'), result.afterAbsent.text);
await clickFilter('未到');
await sleep(350);
result.absentFilterRows = await rows();
await screenshot('06-absent-filter');
check('未到筛选只剩王予辰', result.absentFilterRows.length === 1 && result.absentFilterRows[0].includes('王予辰'), result.absentFilterRows);

const clickReset = await clickRowButton('王予辰', '撤销签到');
check('点击撤销签到成功', clickReset.ok, clickReset);
await sleep(400);
result.resetModal = await pageState();
await screenshot('07-reset-confirm');
check('出现撤销签到弹窗', (result.resetModal.modal || '').includes('撤销这条签到'), result.resetModal.modal);
await clickModalButton('撤销签到');
await waitFor('!document.querySelector(".modal")');
await sleep(800);
result.afterReset = { rows: await rows(), toast: (await pageState()).toast };
check('撤销后未到分组为空', result.afterReset.rows.length === 0, result.afterReset.rows);
await clickFilter('全部');
await sleep(350);
result.afterResetActions = await rowActions('王予辰');
check('撤销后回到已确认可再次签到', result.afterResetActions.includes('签到') && result.afterResetActions.includes('未到'), result.afterResetActions);

await clickRowButton('王予辰', '未到');
await sleep(350);
await clickModalButton('确认未到');
await waitFor('!document.querySelector(".modal")');
await sleep(800);
result.reMarked = { counts: await checkinCounts(), actions: await rowActions('王予辰') };

await clickNav('/activities');
await waitFor('document.querySelectorAll(".activity-table tbody tr").length === 4');
await sleep(350);
result.listAfterPartial = { stats: await stats(), rows: await rows() };
await screenshot('08-list-pending');
check('列表待签到更新为 1 人', result.listAfterPartial.stats.some((text) => text.startsWith('待签到') && text.includes('1')), result.listAfterPartial.stats);
check('act-004 行更新为 1 人待签到', result.listAfterPartial.rows.some((text) => text.includes('校园环湖') && text.includes('1 人待签到')), result.listAfterPartial.rows);

await openActivity('act-004');
await waitFor('document.querySelectorAll(".signup-table tbody tr").length === 6');
result.partialDetail = { counts: await checkinCounts(), text: await checkinText() };
await screenshot('09-detail-pending');
check('再次进入仍有 1 人待签到', result.partialDetail.counts[2] === '1 待签到', result.partialDetail.counts);
await clickRowButton('李思远', '签到');
await sleep(350);
await clickModalButton('确认签到');
await waitFor('!document.querySelector(".modal")');
await sleep(800);
result.completed = { counts: await checkinCounts(), text: await checkinText(), toast: (await pageState()).toast };
await screenshot('10-completed');
check('全部核对后待签到为 0', result.completed.counts[2] === '0 待签到', result.completed.counts);
check('出现出勤核对完提示', (result.completed.text || '').includes('出勤已经核对完'), result.completed.text);

await clickNav('/activities');
await waitFor('document.querySelectorAll(".activity-table tbody tr").length === 4');
await sleep(350);
result.listComplete = { stats: await stats(), rows: await rows() };
await screenshot('11-list-complete');
check('列表待签到归零', result.listComplete.stats.some((text) => text.startsWith('待签到') && text.includes('0')), result.listComplete.stats);
check('列表行显示未到 1 人', result.listComplete.rows.some((text) => text.includes('校园环湖') && text.includes('1 人未到')), result.listComplete.rows);

await openActivity('act-001');
await waitFor('document.querySelectorAll(".signup-table tbody tr").length === 8');
await sleep(350);
result.publishedButtons = await evaluate('[...document.querySelectorAll(".signup-table tbody button")].map((b) => (b.innerText || "").trim())');
await screenshot('12-published-no-checkin');
check('报名中的活动没有签到按钮', !result.publishedButtons.includes('签到') && !result.publishedButtons.includes('未到'), result.publishedButtons);

result.events = events.slice(0, 30);
check('浏览器无 console 错误或异常', events.length === 0, result.events);
result.checks = checks;
result.passed = checks.every((item) => item.pass);
writeFileSync(OUT + '/checkin-report.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ passed: result.passed, checks, events: result.events, listStats: result.listStats, initial: result.checkinCounts, afterAttended: result.afterAttended.counts, afterAbsent: result.afterAbsent.counts, completed: result.completed.counts }, null, 2));
try { await send('Browser.close'); } catch {}
ws.close();
edge.kill();
await sleep(300);
process.exit(result.passed ? 0 : 1);
