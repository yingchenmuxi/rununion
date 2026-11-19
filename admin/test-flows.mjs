import { spawn } from 'node:child_process';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9236;
const BASE = 'http://127.0.0.1:5173';
const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-admin-test', 'about:blank',
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
  return result.result.value;
}
async function info() {
  return evaluate('(() => ({ path: location.pathname, text: (document.body.innerText || "").replace(/\s+/g, " "), toast: [...document.querySelectorAll(".toast")].map((el) => el.innerText).join(" | ") }))()');
}
async function go(path) {
  await evaluate('(() => { const link = document.querySelector(\'a[href="' + path + '"]\'); if (!link) return false; link.click(); return true; })()');
  await sleep(700);
}
async function clickText(text) {
  return evaluate('(() => { const el = [...document.querySelectorAll("button")].find((node) => node.textContent.trim() === ' + JSON.stringify(text) + '); if (!el) return false; el.click(); return true; })()');
}
async function fill(selector, value) {
  return evaluate('(() => { const el = document.querySelector(' + JSON.stringify(selector) + '); if (!el) return false; const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ' + JSON.stringify(value) + '); el.dispatchEvent(new Event("input", { bubbles: true })); return true; })()');
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: BASE + '/login' });
await sleep(1400);
await evaluate('localStorage.clear()');
await send('Page.reload');
await sleep(1600);

const results = {};
results.loginVisible = (await info()).path;
await evaluate('document.querySelector(".login-submit").click()');
await sleep(1500);
results.afterLogin = await info();

await go('/members');
results.membersBefore = (await info()).text.includes('待审批 3');
const approved = await evaluate('(() => { const row = [...document.querySelectorAll("tbody tr")].find((tr) => tr.innerText.includes("待审批")); const button = row && [...row.querySelectorAll("button")].find((b) => b.textContent.trim() === "通过"); if (!button) return false; button.click(); return true; })()');
await sleep(1100);
results.approveClicked = approved;
results.approveState = await info();

await go('/invites');
const inviteOpened = await evaluate('(() => { const button = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "生成邀请码"); if (!button) return false; button.click(); return true; })()');
await sleep(300);
const inviteFilled = await fill('.modal input', '自动化测试邀请码');
const inviteSubmitted = await evaluate('(() => { const button = document.querySelector(".modal .btn-primary"); if (!button) return false; button.click(); return true; })()');
await sleep(1100);
results.invite = { opened: inviteOpened, filled: inviteFilled, submitted: inviteSubmitted, state: await info() };

await go('/announcements');
const announcementOpened = await clickText('新建公告');
await sleep(300);
const titleFilled = await fill('#announcement-title', '测试公告 · 请忽略');
const contentFilled = await fill('#announcement-content', '这是一条自动化流程测试公告。');
const announcementSubmitted = await clickText('保存草稿');
await sleep(1100);
results.announcement = { opened: announcementOpened, titleFilled, contentFilled, submitted: announcementSubmitted, state: await info() };

await go('/challenges');
const challengeOpened = await clickText('新建挑战');
await sleep(300);
const challengeTitle = await fill('#challenge-title', '测试挑战 · 20 公里');
const challengeDesc = await fill('#challenge-desc', '自动化流程测试，仅用于验证创建。');
const challengeSubmitted = await clickText('创建挑战');
await sleep(1100);
results.challenge = { opened: challengeOpened, challengeTitle, challengeDesc, submitted: challengeSubmitted, state: await info() };

await go('/records');
const exportClicked = await clickText('导出 CSV');
await sleep(800);
results.records = { exported: exportClicked, state: await info() };

const logoutClicked = await clickText('退出');
await sleep(800);
results.logout = { clicked: logoutClicked, state: await info() };

results.events = events.slice(0, 20);
console.log(JSON.stringify(results, null, 2));
try { await send('Browser.close'); } catch {}
ws.close();
edge.kill();
await sleep(300);
process.exit(0);
