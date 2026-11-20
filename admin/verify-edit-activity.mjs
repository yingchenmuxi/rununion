import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9245;
const BASE = 'http://127.0.0.1:5173';
const API = 'http://127.0.0.1:8090/api';
const OUT = 'E:/QPTapp/admin/shots/edit-activity';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const checks = [];
const failures = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass: Boolean(pass), detail });
  if (!pass) failures.push(name);
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' | ' + detail : ''));
}
async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(path + ' -> ' + res.status + ' ' + JSON.stringify(data));
  return data;
}

await api('/reset', { method: 'POST' });
let inbox = await api('/member/notifications?memberId=m-001');
check('初始林小满消息 3 条 / 未读 2 条', inbox.items.length === 3 && inbox.unread === 2, JSON.stringify({ n: inbox.items.length, unread: inbox.unread }));
let activity = await api('/activities/act-001');
check('act-001 初始 07:00', activity.startTime === '07:00');

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-admin-edit', 'about:blank',
], { stdio: 'ignore' });

async function getTargets() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      if (res.ok) return await res.json();
    } catch {}
    await sleep(200);
  }
  throw new Error('CDP not ready');
}
const targets = await getTargets();
const page = targets.find((item) => item.type === 'page');
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
const waitFor = async (expression, timeout = 8000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (await evaluate(expression)) return true; } catch {}
    await sleep(180);
  }
  return false;
};
const pageState = () => evaluate('(() => ({ path: location.pathname, h1: document.querySelector("h1")?.innerText || "", body: document.body.innerText.replace(/\s+/g," ").trim(), toast: [...document.querySelectorAll(".toast")].map((n)=>n.innerText.trim()).join(" | ") }))()');
const clickButton = (text) => evaluate('(() => { const want=' + JSON.stringify(text) + '; const all=[...document.querySelectorAll("button")].filter((b)=>b.getBoundingClientRect().width>0); const target=all.find((b)=>(b.innerText||"").trim()===want); if(!target) return {ok:false,buttons:all.map((b)=>(b.innerText||"").trim()).filter(Boolean)}; target.click(); return {ok:true}; })()');
const clickNav = (href) => evaluate('(() => { const link=document.querySelector(' + JSON.stringify('a[href="' + href + '"]') + '); if(!link) return {ok:false}; link.click(); return {ok:true}; })()');
const openActivity = async (id) => {
  await clickNav('/activities');
  await waitFor('document.querySelector(".activity-table")');
  await evaluate('document.querySelector(' + JSON.stringify('a[href="/activities/' + id + '"]') + ')?.click()');
  await waitFor('location.pathname === ' + JSON.stringify('/activities/' + id));
  await sleep(450);
};

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE + '/login' });
  await sleep(1200);
  await evaluate('localStorage.clear()');
  await send('Page.reload');
  await sleep(1500);
  await evaluate('document.querySelectorAll(".demo-account button")[0]?.click()');
  await sleep(300);
  await evaluate('document.querySelector(".login-submit")?.click()');
  check('社团后台登录成功', await waitFor('location.pathname !== "/login"'));
  await sleep(500);

  await openActivity('act-001');
  let state = await pageState();
  check('活动详情初始显示 07:00', state.body.includes('07:00') && state.body.includes('校园环湖 5K'));
  check('详情有编辑活动按钮', await evaluate('[...document.querySelectorAll("button")].some((b)=>(b.innerText||"").trim()==="编辑活动")'));
  await screenshot('01-before-edit');

  check('点击编辑活动', (await clickButton('编辑活动')).ok);
  check('编辑弹窗打开', await waitFor('document.querySelector(".modal")?.innerText.includes("编辑活动")'));
  const modalText = await evaluate('document.querySelector(".modal")?.innerText || ""');
  const modalValues = await evaluate('(() => ({ title: document.querySelector("#activity-title")?.value || "", time: document.querySelector("#activity-time")?.value || "", area: document.querySelector("#activity-area")?.value || "" }))()');
  check('编辑弹窗预填标题和时间', modalValues.title === '校园环湖 5K' && modalValues.time === '07:00', JSON.stringify(modalValues));
  check('编辑弹窗说明变更消息', modalText.includes('已报名的成员会收到一条变更消息'));
  check('编辑按钮为保存修改', modalText.includes('保存修改'));
  await screenshot('02-edit-modal');

  const changed = await evaluate(`(() => {
    const input = document.querySelector("#activity-time");
    if (!input) return { ok: false };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, "07:20");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, value: input.value };
  })()`);
  check('集合时间改为 07:20', changed.ok && changed.value === '07:20', JSON.stringify(changed));
  await sleep(250);

  const submit = await evaluate('(() => { const button=[...document.querySelectorAll(".modal-footer button")].find((b)=>(b.innerText||"").trim()==="保存修改"); if(!button) return {ok:false}; button.click(); return {ok:true}; })()');
  check('点击保存修改', submit.ok);
  check('弹窗保存后关闭', await waitFor('!document.querySelector(".modal")'));
  await waitFor('document.body.innerText.includes("07:20")', 5000);
  state = await pageState();
  check('保存成功 toast 出现', state.toast.includes('活动已更新'), state.toast);
  check('详情显示新时间 07:20', state.body.includes('07:20'), state.body.slice(0, 200));
  await screenshot('03-saved-toast');
  await sleep(3400);
  await screenshot('04-detail-changed');

  activity = await api('/activities/act-001');
  check('API 时间已更新为 07:20', activity.startTime === '07:20', activity.startTime);
  inbox = await api('/member/notifications?memberId=m-001');
  const changedMessage = inbox.items.find((item) => item.type === 'activity_changed');
  check('后台修改生成变更消息', Boolean(changedMessage), JSON.stringify(inbox.items.map((item) => item.title)));
  check('变更消息标题正确', changedMessage?.title === '活动信息有变更：校园环湖 5K', changedMessage?.title);
  check('变更消息包含新时间', (changedMessage?.body || '').includes('07:20'), changedMessage?.body);
  check('林小满消息变为 4 条 / 未读 3 条', inbox.items.length === 4 && inbox.unread === 3, JSON.stringify({ n: inbox.items.length, unread: inbox.unread }));
} catch (error) {
  check('测试流程无异常', false, error instanceof Error ? error.message : String(error));
  try { await screenshot('99-error'); } catch {}
} finally {
  const report = { checks, failures, events, finishedAt: new Date().toISOString() };
  writeFileSync(OUT + '/report.json', JSON.stringify(report, null, 2));
  try { ws.close(); } catch {}
  edge.kill();
}

console.log(String.fromCharCode(10) + (checks.length - failures.length) + '/' + checks.length + ' checks passed');
if (events.length) console.log('EVENTS ' + JSON.stringify(events, null, 2));
process.exitCode = failures.length || events.length ? 1 : 0;