import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9248;
const BASE = 'http://127.0.0.1:5173';
const API = 'http://127.0.0.1:8090/api';
const OUT = 'E:/QPTapp/admin/shots/runs-challenges';
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
function inputDate(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

await api('/reset', { method: 'POST' });
const health = await api('/health');
check('API 初始 25 条记录 / 3 个挑战', health.runs === 25 && health.challenges === 3, JSON.stringify(health));
const runs = await api('/runs');
const totalKm = Math.round(runs.reduce((sum, run) => sum + run.distanceKm, 0) * 10) / 10;
const memberCount = new Set(runs.map((run) => run.memberId)).size;
check('记录接口 25 条 / 8 名成员', runs.length === 25 && memberCount === 8, String(memberCount));

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-admin-runs-challenges', 'about:blank',
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
const pageState = () => evaluate('(() => ({ path: location.pathname, body: document.body.innerText.replace(/\s+/g," ").trim(), toast: [...document.querySelectorAll(".toast")].map((n)=>n.innerText.trim()).join(" | ") }))()');
const clickButton = (text) => evaluate('(() => { const want=' + JSON.stringify(text) + '; const all=[...document.querySelectorAll("button")].filter((b)=>b.getBoundingClientRect().width>0); const target=all.find((b)=>(b.innerText||"").trim()===want); if(!target) return {ok:false,buttons:all.map((b)=>(b.innerText||"").trim()).filter(Boolean)}; target.click(); return {ok:true}; })()');
const clickNav = (href) => evaluate('(() => { const link=document.querySelector(' + JSON.stringify('a[href="' + href + '"]') + '); if(!link) return {ok:false}; link.click(); return {ok:true}; })()');
const setValue = (selector, value, index = 0) => evaluate('(() => { const el=document.querySelectorAll(' + JSON.stringify(selector) + ')[' + index + ']; if(!el) return {ok:false}; const proto=el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,"value").set.call(el,' + JSON.stringify(value) + '); el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true})); return {ok:true,value:el.value}; })()');
const scrollChallenge = (title) => evaluate('(() => { const card=[...document.querySelectorAll(".challenge-card")].find((c)=>(c.innerText||"").includes(' + JSON.stringify(title) + ')); if(!card) return {ok:false}; card.scrollIntoView({block:"center"}); return {ok:true}; })()');
const clickChallengeButton = (title, text) => evaluate('(() => { const want=' + JSON.stringify(text) + '; const card=[...document.querySelectorAll(".challenge-card")].find((c)=>(c.innerText||"").includes(' + JSON.stringify(title) + ')); if(!card) return {ok:false}; const target=[...card.querySelectorAll("button")].find((b)=>(b.innerText||"").trim()===want); if(!target) return {ok:false,buttons:[...card.querySelectorAll("button")].map((b)=>(b.innerText||"").trim())}; target.click(); return {ok:true}; })()');

const TITLE = '十一月 · 40 公里加练';
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
  await sleep(3400);

  check('打开记录页', (await clickNav('/records')).ok);
  check('记录页加载', await waitFor('!!document.querySelector(".records-table")'));
  let state = await pageState();
  check('记录页统计卡显示条数、里程与人数', state.body.includes('当前记录') && state.body.includes('合计里程') && state.body.includes('参与成员'));
  check('记录表 25 行', await evaluate('document.querySelectorAll(".records-table tbody tr").length === 25'));
  check('记录页合计里程 ' + totalKm + ' km', state.body.includes(String(totalKm)));
  check('记录页参与成员 ' + memberCount + ' 人', state.body.includes(String(memberCount)));
  await screenshot('01-records-list');

  check('搜索成员林小满', (await setValue('.records-toolbar input[placeholder="搜索成员或备注"]', '林小满')).ok);
  await sleep(400);
  state = await pageState();
  check('筛选后 7 条记录', await evaluate('document.querySelectorAll(".records-table tbody tr").length === 7'), state.body.slice(0, 80));
  check('筛选后统计为 7 条', state.body.includes('当前记录') && (state.body.match(/7/g) || []).length >= 2);
  await screenshot('02-records-filter');
  check('清除筛选', (await clickButton('清除筛选')).ok);
  await sleep(300);
  check('恢复 25 条记录', await evaluate('document.querySelectorAll(".records-table tbody tr").length === 25'));

  check('打开挑战页', (await clickNav('/challenges')).ok);
  check('挑战页加载', await waitFor('!!document.querySelector(".challenge-card")'));
  state = await pageState();
  check('挑战页 3 张卡片', await evaluate('document.querySelectorAll(".challenge-card").length === 3'));
  check('挑战统计 进行中 1 / 未开始 1 / 参与人次 8', state.body.includes('进行中') && state.body.includes('未开始') && state.body.includes('参与人次') && state.body.includes('8'));
  await screenshot('03-challenges');

  check('点击新建挑战', (await clickButton('新建挑战')).ok);
  check('新建挑战弹窗打开', await waitFor('document.querySelector(".modal")?.innerText.includes("新建挑战")'));
  check('填写挑战名称', (await setValue('#challenge-title', TITLE)).ok);
  check('填写挑战说明', (await setValue('#challenge-desc', '给自己加一点量：从今天起累计 40 公里，跑走结合也算，不追配速。')).ok);
  check('设置个人目标 40 km', (await setValue('.modal input[type="number"]', '40')).ok);
  check('设置开始日期为今天', (await setValue('.modal input[type="date"]', inputDate(0))).ok);
  check('设置结束日期', (await setValue('.modal input[type="date"]', inputDate(20), 1)).ok);
  await sleep(250);
  check('提交新建挑战', (await evaluate('(() => { const b=[...document.querySelectorAll(".modal-footer button")].find((x)=>(x.innerText||"").trim()==="创建挑战"); if(!b) return {ok:false}; b.click(); return {ok:true}; })()')).ok);
  check('创建后弹窗关闭', await waitFor('!document.querySelector(".modal")'));
  await waitFor('document.body.innerText.includes(' + JSON.stringify(TITLE) + ')');
  state = await pageState();
  check('创建 toast 出现', state.toast.includes('新的挑战已创建'), state.toast);
  check('列表出现新挑战卡片', await evaluate('[...document.querySelectorAll(".challenge-card")].some((c)=>c.innerText.includes(' + JSON.stringify(TITLE) + '))'));
  const afterCreate = await api('/challenges');
  const created = afterCreate.find((item) => item.title === TITLE);
  const expectedStart = inputDate(0);
  const expectedEnd = inputDate(20);
  check('API 新挑战为进行中且目标 40 km', created?.status === 'active' && created?.targetKm === 40, JSON.stringify(created && { status: created.status, target: created.targetKm }));
  check('API 新挑战日期正确', created?.startDate === expectedStart && created?.endDate === expectedEnd, JSON.stringify({ start: created?.startDate, end: created?.endDate }));
  const inbox = await api('/member/notifications?memberId=m-001');
  const challengeNote = inbox.items.find((item) => item.type === 'challenge');
  check('成员收到挑战站内消息', inbox.items.length === 4 && inbox.unread === 3 && challengeNote?.challengeId === created?.id, JSON.stringify({ total: inbox.items.length, unread: inbox.unread, title: challengeNote?.title }));
  check('挑战消息标题与正文正确', challengeNote?.title === '跑团挑战：' + TITLE && challengeNote?.body.includes('40 公里'), JSON.stringify({ title: challengeNote?.title, body: challengeNote?.body }));
  await scrollChallenge(TITLE);
  await sleep(500);
  await screenshot('04-challenge-created');

  check('点击结束新挑战', (await clickChallengeButton(TITLE, '结束挑战')).ok);
  check('结束确认弹窗出现', await waitFor('document.querySelector(".modal")?.innerText.includes("结束")'));
  await sleep(300);
  check('确认结束挑战', (await evaluate('(() => { const b=[...document.querySelectorAll(".modal-footer button")].find((x)=>(x.innerText||"").trim()==="结束挑战"); if(!b) return {ok:false}; b.click(); return {ok:true}; })()')).ok);
  check('结束后弹窗关闭', await waitFor('!document.querySelector(".modal")'));
  await sleep(800);
  const ended = (await api('/challenges')).find((item) => item.id === created.id);
  check('API 新挑战已结束', ended?.status === 'ended', JSON.stringify({ status: ended?.status }));
  check('结束后卡片显示只读', await evaluate('[...document.querySelectorAll(".challenge-card")].some((c)=>c.innerText.includes(' + JSON.stringify(TITLE) + ') && c.innerText.includes("已结束"))'));
  await scrollChallenge(TITLE);
  await sleep(3200);
  await screenshot('05-challenge-ended');

  result_events: {
    writeFileSync(OUT + '/admin-runs-challenges.json', JSON.stringify({ checks, failures, totalKm, memberCount, events: events.slice(0, 30) }, null, 2));
  }
} catch (error) {
  failures.push('脚本异常: ' + error.message);
  console.error(error);
} finally {
  console.log('SUMMARY ' + (checks.length - failures.length) + '/' + checks.length + ' events=' + events.length);
  if (failures.length) console.log('FAILURES ' + JSON.stringify(failures, null, 2));
  try { await send('Browser.close'); } catch {}
  ws.close();
  edge.kill();
  await sleep(300);
  process.exit(failures.length ? 1 : 0);
}
