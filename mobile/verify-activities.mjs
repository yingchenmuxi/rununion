import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9254;
const BASE = 'http://127.0.0.1:8090';
const OUT = 'E:/QPTapp/mobile/shots';
mkdirSync(OUT, { recursive: true });

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-mobile-activities', 'about:blank',
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
const clickText = (text) => evaluate('(() => { const nodes = [...document.querySelectorAll("button,[role=button],[role=tab],div")].reverse(); const target = nodes.find((n) => (n.innerText || "").includes(' + JSON.stringify(text.trim()) + ') && n.getBoundingClientRect().width > 0); if (!target) return { ok: false, buttons: [...document.querySelectorAll("button,[role=button],[role=tab]")].map((b) => (b.innerText || "").trim()).filter(Boolean) }; target.click(); return { ok: true, text: (target.innerText || "").replace(/\s+/g, " ").trim().slice(0, 80) }; })()');
const clickButton = (text) => evaluate('(() => { const norm = (s) => (s || "").replace(/\\s+/g, " ").trim(); const all = [...document.querySelectorAll("[role=button]")].filter((n) => n.getBoundingClientRect().width > 0); const exact = all.find((n) => norm(n.innerText) === ' + JSON.stringify(text) + '); const partial = all.find((n) => norm(n.innerText).includes(' + JSON.stringify(text) + ')); const target = exact || partial; if (!target) return { ok: false, buttons: all.map((b) => norm(b.innerText)).filter(Boolean).slice(0, 12) }; target.click(); return { ok: true, text: norm(target.innerText).slice(0, 80) }; })()');
const bodyText = async () => (await evaluate('document.body.innerText')).replace(/\s+/g, ' ').trim();
const path = () => evaluate('location.pathname');
const scrollToText = (text) => evaluate('(() => { const target = [...document.querySelectorAll("div")].reverse().find((n) => (n.innerText || "").includes(' + JSON.stringify(text) + ') && n.getBoundingClientRect().width > 0); if (!target) return { ok: false }; target.scrollIntoView({ block: "center" }); return { ok: true }; })()');
async function waitForText(text, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const body = await bodyText();
    if (body.includes(text)) return true;
    await sleep(200);
  }
  return false;
}
async function waitForPath(part, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await path();
    if (value.includes(part)) return value;
    await sleep(200);
  }
  return await path();
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: BASE + '/' });
await sleep(1800);

const result = { initial: { path: await path(), body: (await bodyText()).slice(0, 150) } };
result.loginFill = await clickText('填入演示账号');
await sleep(250);
result.loginClick = await clickText('进入跑团');
await sleep(1200);
result.homeReady = await waitForText('本周活动');
result.homeCard = {
  title: (await bodyText()).includes('校园环湖 5K'),
  count: (await bodyText()).includes('24 人已报名'),
  join: (await bodyText()).includes('报名'),
};
await screenshot('activities-01-home-card');

result.openDetail = await clickButton('校园环湖 5K');
await sleep(900);
result.detailPath = await waitForPath('/activity/a1');
let body = await bodyText();
result.detailLocked = {
  title: body.includes('校园环湖 5K'),
  meetingHidden: body.includes('报名确认后显示具体集合点'),
  detailHidden: !body.includes('东门内侧银杏树下'),
  joinButton: body.includes('报名参加'),
  capacity: body.includes('24 / 40 人'),
};
await screenshot('activities-02-detail-locked');
await scrollToText('报名状态');
await sleep(300);
await screenshot('activities-03-detail-signup-section');

result.signupClick = await clickButton('报名参加');
await sleep(700);
body = await bodyText();
result.afterSignup = {
  feedback: body.includes('报名已提交'),
  pending: body.includes('待团长确认') || body.includes('待确认'),
  meetingStillHidden: !body.includes('东门内侧银杏树下') && body.includes('团长确认后显示具体集合点'),
  capacity: body.includes('25 / 40 人'),
  cancel: body.includes('取消报名（待确认）'),
};
await scrollToText('报名状态');
await sleep(300);
await screenshot('activities-04-detail-pending');

result.toHome = await clickText('首页');
await sleep(900);
result.homePath = await path();
result.homePending = {
  waitText: await waitForText('25 人已报名'),
  pending: (await bodyText()).includes('待确认'),
};
await screenshot('activities-05-home-pending');

result.toProfile = await clickText('我的');
await sleep(800);
body = await bodyText();
result.profile = {
  path: await path(),
  subtitle: body.includes('已报名 2 场 · 待确认 1 场'),
};
await screenshot('activities-06-profile-summary');

result.openMine = await clickText('我的活动');
await sleep(800);
result.minePath = await waitForPath('/my-activities');
body = await bodyText();
result.myActivities = {
  count: body.includes('2 场待参加'),
  pending: body.includes('待确认'),
  pendingHint: body.includes('1 场待确认'),
  attended: body.includes('已参加'),
};
await screenshot('activities-07-my-activities');

result.reopen = await clickButton('校园环湖 5K');
await sleep(800);
result.reopenPath = await waitForPath('/activity/a1');
result.cancelClick = await clickButton('取消报名（待确认）');
await sleep(700);
body = await bodyText();
result.cancelled = {
  feedback: body.includes('已取消报名'),
  noSignup: body.includes('还没报名'),
  meetingHiddenAgain: body.includes('报名确认后显示具体集合点'),
  joinAgain: body.includes('报名参加'),
};
await scrollToText('报名状态');
await sleep(300);
await screenshot('activities-08-detail-cancelled');

result.toHomeAgain = await clickText('首页');
await sleep(800);
result.openAll = await clickButton('全部活动');
await sleep(900);
result.activitiesPath = await waitForPath('/activities');
body = await bodyText();
result.activityList = {
  count: body.includes('共 4 场'),
  tags: body.includes('可报名') && body.includes('已报名') && body.includes('已结束'),
};
await screenshot('activities-09-list-all');

result.filterOpen = await clickButton('可报名');
await sleep(500);
body = await bodyText();
result.openFilter = {
  count: body.includes('共 2 场'),
  campus: body.includes('校园环湖 5K'),
  aosen: body.includes('奥森夜跑 6K'),
  noTraining: !body.includes('操场间歇入门'),
};
await screenshot('activities-10-filter-open');

result.filterPast = await clickButton('已结束');
await sleep(500);
body = await bodyText();
result.pastFilter = {
  count: body.includes('共 1 场'),
  card: body.includes('校园环湖 5K'),
};
await screenshot('activities-11-filter-past');

result.openPast = await clickButton('校园环湖 5K');
await sleep(800);
result.pastPath = await waitForPath('/activity/p1');
body = await bodyText();
result.pastDetail = {
  attended: body.includes('已参加这场活动'),
  meetingVisible: body.includes('东门内侧银杏树下'),
  ended: body.includes('活动已结束'),
};
await screenshot('activities-12-detail-past');

result.toHomeThird = await clickText('首页');
await sleep(800);
result.openAllAgain = await clickButton('全部活动');
await sleep(800);
result.filterMine = await clickButton('已报名');
await sleep(500);
body = await bodyText();
result.mineFilter = {
  count: body.includes('共 1 场'),
  training: body.includes('操场间歇入门'),
};
await screenshot('activities-13-filter-mine');
result.openConfirmed = await clickButton('操场间歇入门');
await sleep(800);
result.confirmedPath = await waitForPath('/activity/a2');
body = await bodyText();
result.confirmedDetail = {
  status: body.includes('已报名'),
  meeting: body.includes('田径场北侧看台下集合'),
  cancel: body.includes('取消报名'),
};
await screenshot('activities-14-detail-confirmed');

result.events = events;
console.log(JSON.stringify(result, null, 2));
ws.close();
edge.kill();
