import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9266;
const BASE = 'http://127.0.0.1:8090';
const API = BASE + '/api';
const OUT = 'E:/QPTapp/mobile/shots/runs-challenges';
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

const health = await api('/health');
check('共享状态：25 条记录 / 4 个挑战 / 11 条消息', health.runs === 25 && health.challenges === 4 && health.notifications === 11, JSON.stringify(health));
let inbox = await api('/member/notifications?memberId=m-001');
check('m-001 消息 4 条 / 未读 3 条', inbox.items.length === 4 && inbox.unread === 3, JSON.stringify({ n: inbox.items.length, unread: inbox.unread }));
check('最新消息是挑战通知', inbox.items[0]?.type === 'challenge' && inbox.items[0]?.title === '跑团挑战：十一月 · 40 公里加练', inbox.items[0]?.title);
let memberChallenges = await api('/challenges?memberId=m-001');
let active = memberChallenges.find((item) => item.id === 'chl-001');
const activeDays = active ? Math.max(0, Math.ceil((new Date(active.endDate + 'T23:59:59+08:00').getTime() - Date.now()) / 86400000)) : -1;
check('11 月挑战初始 50.5 / 80 km · 63% · 剩余天数一致', active?.myKm === 50.5 && active?.myPercent === 63 && active?.daysLeft === activeDays, JSON.stringify(active && { km: active.myKm, pct: active.myPercent, days: active.daysLeft, expectedDays: activeDays }));
check('后台新建挑战已结束且出现在成员端', memberChallenges.some((item) => item.title === '十一月 · 40 公里加练' && item.status === 'ended') && memberChallenges.length === 4);

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=E:/QPTapp/.edge-cdp-mobile-runs-challenges',
  'about:blank',
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
const bodyText = async () => (await evaluate('document.body.innerText')).replace(/\s+/g, ' ').trim();
const path = () => evaluate('location.pathname');
const clickText = (text) => evaluate('(() => { const nodes=[...document.querySelectorAll("button,[role=button],[role=tab],div")].reverse(); const target=nodes.find((node)=>(node.innerText||"").includes(' + JSON.stringify(text) + ')&&node.getBoundingClientRect().width>0); if(!target) return {ok:false,body:document.body.innerText.slice(0,400)}; target.click(); return {ok:true,text:(target.innerText||"").replace(/\s+/g," ").trim().slice(0,100)}; })()');
const clickButton = (text) => evaluate('(() => { const norm=(value)=>(value||"").replace(/\s+/g," ").trim(); const want=' + JSON.stringify(text) + '; const all=[...document.querySelectorAll("[role=button],[role=tab],button")].filter((node)=>node.getBoundingClientRect().width>0); const target=all.find((node)=>norm(node.innerText)===want)||all.find((node)=>norm(node.innerText).includes(want)); if(!target) return {ok:false,buttons:all.map((node)=>norm(node.innerText)).filter(Boolean).slice(0,30)}; target.click(); return {ok:true,text:norm(target.innerText).slice(0,100)}; })()');
const clickCard = (text) => evaluate('(() => { const norm=(value)=>(value||"").replace(/\s+/g," ").trim(); const want=' + JSON.stringify(text) + '; const all=[...document.querySelectorAll("[role=button]")].filter((node)=>node.getBoundingClientRect().width>0); const target=all.find((node)=>norm(node.innerText).includes(want)&&norm(node.innerText).length>20); if(!target) return {ok:false,cards:all.map((node)=>norm(node.innerText)).filter(Boolean).slice(0,20)}; target.click(); return {ok:true,text:norm(target.innerText).slice(0,120)}; })()');
const clickAria = (label) => evaluate('(() => { const target=document.querySelector(' + JSON.stringify('[aria-label="' + label + '"]') + '); if(!target) return {ok:false}; target.click(); return {ok:true}; })()');
const clickTab = (text) => evaluate('(() => { const norm=(value)=>(value||"").replace(/\s+/g," ").trim(); const want=' + JSON.stringify(text) + '; const all=[...document.querySelectorAll("[role=tab]")].filter((node)=>node.getBoundingClientRect().width>0); const target=all.find((node)=>norm(node.innerText).includes(want)); if(!target) return {ok:false,tabs:all.map((node)=>norm(node.innerText))}; target.click(); return {ok:true,text:norm(target.innerText)}; })()');
const setInput = (selector, value) => evaluate('(() => { const el=document.querySelector(' + JSON.stringify(selector) + '); if(!el) return {ok:false}; const setter=Object.getOwnPropertyDescriptor(el.constructor.prototype,"value")?.set||Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set; setter.call(el,' + JSON.stringify(value) + '); el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true})); return {ok:true,value:el.value}; })()');
async function waitForText(text, timeout = 9000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if ((await bodyText()).includes(text)) return true;
    await sleep(220);
  }
  return false;
}
async function waitForPath(part, timeout = 9000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await path();
    if (value.includes(part)) return value;
    await sleep(220);
  }
  return await path();
}

const result = { checks };
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: BASE + '/' });
  await sleep(2000);

  async function login() {
    const ready = await waitForText('填入演示账号', 9000);
    check('登录页可用', ready);
    if (!ready) return false;
    await clickText('填入演示账号');
    await sleep(250);
    await clickText('进入跑团');
    if (!(await waitForText('首页', 9000))) return false;
    await clickText('首页');
    return await waitForText('本周活动', 9000);
  }
  check('登录成功', await login());

  check('进入成长页', (await clickTab('成长')).ok);
  check('成长页加载挑战卡', await waitForText('跑团挑战'));
  let body = await bodyText();
  check('成长卡显示挑战名与进度', body.includes('11 月 · 80 公里挑战') && body.includes('50.5 / 80 km') && body.includes('63%'), body.slice(0, 200));
  check('成长卡显示剩余天数与参与人数', body.includes('还剩 ' + active.daysLeft + ' 天') && body.includes(active.participantCount + ' 人参与 · ' + active.completedCount + ' 人完成'), JSON.stringify({ days: active.daysLeft, people: active.participantCount }));
  check('成长卡显示不重复计入说明', body.includes('活动出勤不重复计入'));
  await screenshot('01-growth-challenge');

  check('打开全部挑战', (await clickButton('全部挑战')).ok);
  check('挑战列表路径正确', (await waitForPath('/challenges')) === '/challenges');
  check('挑战列表加载', await waitForText('跑团挑战'));
  body = await bodyText();
  check('挑战列表显示 4 个挑战', ['11 月 · 80 公里挑战', '12 月 · 60 公里挑战', '十一月 · 40 公里加练', '10 月 · 60 公里挑战'].every((title) => body.includes(title)));
  const added = memberChallenges.find((item) => item.title === '十一月 · 40 公里加练');
check('新挑战显示已结束只读', Boolean(added) && body.includes(added.myKm.toFixed(1) + ' / ' + added.targetKm + ' km') && body.includes(added.myPercent + '%') && body.includes('已结束 · 进度只读'), JSON.stringify(added && { km: added.myKm, pct: added.myPercent }));
  await screenshot('02-challenges-list');

  await evaluate('history.back()');
  check('返回成长页', (await waitForPath('/growth')) === '/growth');
  check('回首页', (await clickTab('首页')).ok);
  check('首页加载', await waitForText('本周活动'));
  await sleep(700);
  const bellText = await evaluate("document.querySelector('[aria-label=\"消息中心\"]')?.innerText || ''");
  check('首页铃铛显示 3 条未读', bellText.includes('3'), bellText);
  await screenshot('03-home-bell');

  check('进入消息中心', (await clickAria('消息中心')).ok);
  check('消息中心加载挑战消息', await waitForText('跑团挑战：十一月 · 40 公里加练'));
  body = await bodyText();
  check('消息中心显示 4 条 / 3 条未读', body.includes('全部 4') && body.includes('3 条未读'), body.slice(0, 160));
  check('挑战消息带挑战入口', body.includes('查看挑战进度'));
  await screenshot('04-message-challenge');

  check('打开挑战消息', (await clickCard('跑团挑战：十一月 · 40 公里加练')).ok);
  check('消息跳转到挑战页', (await waitForPath('/challenges')) === '/challenges');
  await waitForText('跑团挑战');
  await sleep(600);
  inbox = await api('/member/notifications?memberId=m-001');
  check('打开消息后未读降为 2 条', inbox.unread === 2, String(inbox.unread));
  await screenshot('05-challenge-from-message');

  await evaluate('history.back()');
  check('返回消息中心', (await waitForPath('/notifications')) === '/notifications');
  await evaluate('history.back()');
  check('回到首页', (await waitForPath('/')) === '/');
  check('进入开跑页', (await clickTab('开跑')).ok);
  check('开跑页加载', await waitForText('手动补记'));
  check('填写备注', (await setInput('input[placeholder="备注，如校园环湖（选填）"]', '挑战补记')).ok);
  check('填写距离 3 km', (await setInput('input[placeholder="距离 km"]', '3')).ok);
  check('填写时长 20 分钟', (await setInput('input[placeholder="时长 分钟"]', '20')).ok);
  await evaluate('document.querySelector(\'input[placeholder="距离 km"]\')?.scrollIntoView({block:"center"})');
  await sleep(300);
  check('保存手动记录', (await clickButton('保存记录')).ok);
  check('保存成功提示', await waitForText('已记录 3.0 km，首页和成长档案已同步。'));
  const runsAfter = await api('/runs');
  check('API 记录增至 26 条', runsAfter.length === 26, String(runsAfter.length));
  check('新增记录为挑战补记 3 km', runsAfter.some((run) => run.memberId === 'm-001' && run.title === '挑战补记' && run.distanceKm === 3));
  await sleep(500);
  await screenshot('06-run-manual');

  memberChallenges = await api('/challenges?memberId=m-001');
  active = memberChallenges.find((item) => item.id === 'chl-001');
  check('API 挑战进度更新为 53.5 / 80 · 67%', active?.myKm === 53.5 && active?.myPercent === 67, JSON.stringify(active && { km: active.myKm, pct: active.myPercent }));

  check('进入成长页', (await clickTab('成长')).ok);
  check('成长页挑战进度刷新', await waitForText('53.5 / 80 km'));
  body = await bodyText();
  check('成长页显示 67% 与本月跑量', body.includes('67%') && body.includes('53.5'), body.slice(0, 200));
  await screenshot('07-growth-after-run');

  await api('/reset', { method: 'POST' });
  const restored = await api('/health');
  check('测试结束恢复 25 条记录 / 3 个挑战 / 3 条消息', restored.runs === 25 && restored.challenges === 3 && restored.notifications === 3, JSON.stringify(restored));
} catch (error) {
  check('测试流程无异常', false, error instanceof Error ? error.message : String(error));
  try { await screenshot('99-error'); } catch {}
} finally {
  result.failures = failures;
  result.events = events;
  result.finishedAt = new Date().toISOString();
  writeFileSync(OUT + '/report.json', JSON.stringify(result, null, 2));
  try { ws.close(); } catch {}
  edge.kill();
}

console.log('\n' + (checks.length - failures.length) + '/' + checks.length + ' checks passed');
if (events.length) console.log('EVENTS ' + JSON.stringify(events, null, 2));
process.exitCode = failures.length || events.length ? 1 : 0;
