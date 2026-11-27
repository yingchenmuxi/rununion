import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9262;
const BASE = 'http://127.0.0.1:8090';
const API = BASE + '/api';
const OUT = 'E:/QPTapp/mobile/shots/activities-shared';
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
const health = await api('/health');
check('API 初始 4 场活动 / 19 条报名', health.ok === true && health.activities === 4 && health.signups === 19, JSON.stringify(health));
let activities = await api('/activities');
const act001 = activities.find((item) => item.id === 'act-001');
const act004 = activities.find((item) => item.id === 'act-004');
check('act-001 初始 7/40 已报名', act001 && act001.signupCount === 7 && act001.capacity === 40);
check('act-004 初始出勤 3 已参加 / 3 待签到', act004 && act004.attendedCount === 3 && act004.pendingCheckinCount === 3);

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=E:/QPTapp/.edge-cdp-mobile-shared-verify',
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
    events.push({
      kind: 'console:' + message.params.type,
      text: message.params.args.map((arg) => arg.value ?? arg.description ?? arg.type).join(' '),
    });
  }
});
function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text + ' ' + (result.exceptionDetails.exception?.description || ''));
  }
  return result.result.value;
}
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', {
    format: 'png', fromSurface: true, captureBeyondViewport: false,
  });
  writeFileSync(OUT + '/' + name + '.png', Buffer.from(shot.data, 'base64'));
}
const bodyText = async () => (await evaluate('document.body.innerText')).replace(/\s+/g, ' ').trim();
const path = () => evaluate('location.pathname');
const clickText = (text) => evaluate('(() => { const nodes=[...document.querySelectorAll("button,[role=button],[role=tab],div")].reverse(); const target=nodes.find((node)=>(node.innerText||"").includes(' + JSON.stringify(text) + ')&&node.getBoundingClientRect().width>0); if(!target) return {ok:false,body:document.body.innerText.slice(0,400)}; target.click(); return {ok:true,text:(target.innerText||"").replace(/\s+/g," ").trim().slice(0,100)}; })()');
const clickButton = (text) => evaluate('(() => { const norm=(value)=>(value||"").replace(/\s+/g," ").trim(); const want=' + JSON.stringify(text) + '; const all=[...document.querySelectorAll("[role=button],[role=tab],button")].filter((node)=>node.getBoundingClientRect().width>0); const target=all.find((node)=>norm(node.innerText)===want)||all.find((node)=>norm(node.innerText).includes(want)); if(!target) return {ok:false,buttons:all.map((node)=>norm(node.innerText)).filter(Boolean).slice(0,20)}; target.click(); return {ok:true,text:norm(target.innerText).slice(0,100)}; })()');
const cnDay = (iso) => { const [, month, day] = iso.split('-').map(Number); return month + ' 月 ' + day + ' 日'; };
const clickCard = (text) => evaluate('(() => { const norm=(value)=>(value||"").replace(/\s+/g," ").trim(); const want=' + JSON.stringify(text) + '; const all=[...document.querySelectorAll("[role=button]")].filter((node)=>node.getBoundingClientRect().width>0); const target=all.find((node)=>norm(node.innerText).includes(want)&&norm(node.innerText).length>20); if(!target) return {ok:false,cards:all.map((node)=>norm(node.innerText)).filter(Boolean).slice(0,15)}; target.click(); return {ok:true,text:norm(target.innerText).slice(0,120)}; })()');
const scrollToText = (text) => evaluate('(() => { const want=' + JSON.stringify(text) + '; const nodes=[...document.querySelectorAll("div")]; const target=nodes.reverse().find((node)=>(node.innerText||"").includes(want)&&node.getBoundingClientRect().width>0); if(!target) return {ok:false}; target.scrollIntoView({block:"center"}); return {ok:true}; })()');
async function waitForText(text, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if ((await bodyText()).includes(text)) return true;
    await sleep(200);
  }
  return false;
}
async function waitForPath(part, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await path();
    if (value.includes(part)) return value;
    await sleep(200);
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
    const loginReady = await waitForText('填入演示账号', 9000);
    check('登录页可用', loginReady);
    await clickText('填入演示账号');
    await sleep(250);
    await clickText('进入跑团');
    const loggedIn = await waitForText('首页', 9000);
    if (!loggedIn) return false;
    await clickText('首页');
    return await waitForText('本周活动', 9000);
  }

  async function reloadAndLogin() {
    await send('Page.reload', { ignoreCache: true });
    await sleep(1800);
    const ok = await login();
    check('刷新后重新登录成功', ok);
  }

  check('首次登录成功', await login());
  let body = await bodyText();
  check('首页显示共享活动 7 人已报名', body.includes('7 人已报名') && body.includes('校园环湖 5K'));
  check('首页显示已报名状态', body.includes('已报名'));
  await screenshot('01-home');

  check('打开全部活动', (await clickText('全部活动')).ok);
  check('活动列表路径正确', (await waitForPath('/activities')) === '/activities');
  check('活动列表加载 3 场共享数据', await waitForText('共 3 场 · 共享演示数据'));
  body = await bodyText();
  check('列表同时显示 3 场活动', ['校园环湖 5K', '操场间歇入门', '已参加'].every((text) => body.includes(text)));
  await screenshot('02-list-all');

  check('可报名筛选打开', (await clickButton('可报名')).ok);
  check('可报名筛选为空态', await waitForText('这里还没有活动'));
  await screenshot('03-list-open-empty');
  await clickButton('全部');
  await sleep(300);

  check('已报名筛选打开', (await clickButton('已报名')).ok);
  check('已报名筛选 2 场', await waitForText('共 2 场'));
  await screenshot('04-list-mine');
  await clickButton('全部');
  await sleep(300);

  check('打开 act-001 详情', (await clickCard('校园环湖 5K')).ok);
  check('详情路径 act-001', (await waitForPath('/activity/act-001')) === '/activity/act-001');
  check('详情显示 7/40、已报名与集合点', await waitForText('7 / 40 人'), '7/40');
  body = await bodyText();
  check('已确认成员可见详细集合点', body.includes('东门内侧银杏树下'));
  check('详情按钮为取消报名', body.includes('取消报名'));
  await screenshot('05-detail-signup');
  await scrollToText('报名与出勤');
  await sleep(350);
  await screenshot('06-detail-signup-section');

  await clickText('我的');
  await sleep(800);
  check('打开我的页', (await path()) === '/profile');
  await scrollToText('共享活动数据');
  await sleep(350);
  await screenshot('07-profile-demo');
  body = await bodyText();
  check('我的页有共享数据说明与重置按钮', body.includes('共享活动数据') && body.includes('重置活动演示数据'));

  check('打开我的活动', (await clickText('我的活动')).ok);
  check('我的活动路径', (await waitForPath('/my-activities')) === '/my-activities');
  check('我的活动显示 2 场待参加', await waitForText('2 场待参加'));
  body = await bodyText();
  check('我的活动显示已参加 1 场', body.includes('已参加') && body.includes('团长已核对出勤'));
  await screenshot('08-my-initial');

  const signups = await api('/activities/act-004/signups');
  const mySignup = signups.find((item) => item.memberId === 'm-001');
  check('后台找到 m-001 的已结束报名', Boolean(mySignup), mySignup?.id);
  const markedAbsent = await api('/signups/' + mySignup.id + '/checkin', { method: 'POST', body: { result: 'absent' } });
  check('后台可把 m-001 标记为未到', markedAbsent.status === 'absent');
  const afterAbsent = await api('/activities/act-004');
  check('后台 act-004 未到数变为 1', afterAbsent.absentCount === 1 && afterAbsent.attendedCount === 2);
  const act004Day = cnDay(afterAbsent.date);

  await reloadAndLogin();
  await clickText('我的');
  await sleep(700);
  await clickText('我的活动');
  await sleep(900);
  body = await bodyText();
  check('手机端刷新后看到未到', body.includes('未到') && body.includes('另有 1 场未到'));
  check('手机端已参加数降为 0', body.includes('0') && body.includes('未到'));
  await screenshot('09-my-absent');

  check('打开已结束 act-004 卡片', (await clickCard(act004Day)).ok);
  check('act-004 详情路径', (await waitForPath('/activity/act-004')) === '/activity/act-004');
  await scrollToText('报名与出勤');
  await sleep(900);
  await scrollToText('报名与出勤');
  await sleep(500);
  body = await bodyText();
  check('详情显示团长记录为未到', body.includes('团长记录为未到'));
  check('详情显示已核对出勤记录', body.includes('团长已核对出勤') && body.includes('记录已同步到社团后台'));
  await screenshot('10-detail-absent');

  const resetCheckin = await api('/signups/' + mySignup.id + '/reset-checkin', { method: 'POST', body: {} });
  check('后台可撤销签到回到待核对', resetCheckin.status === 'approved');
  await reloadAndLogin();
  await clickText('我的');
  await sleep(700);
  await clickText('我的活动');
  await sleep(900);
  body = await bodyText();
  check('手机端刷新后显示待核对', body.includes('待核对') && body.includes('1'));
  await screenshot('11-my-awaiting');

  check('再次打开 act-004 卡片', (await clickCard(act004Day)).ok);
  await waitForPath('/activity/act-004');
  await scrollToText('报名与出勤');
  await sleep(350);
  body = await bodyText();
  check('详情显示等待团长核对出勤', body.includes('等待团长核对出勤'));
  check('待核对时不显示已核对记录', !body.includes('团长已核对出勤'));
  await screenshot('12-detail-awaiting');

  await reloadAndLogin();
  await clickText('首页');
  await sleep(700);
  await clickText('全部活动');
  await sleep(900);
  check('重新打开 act-001', (await clickCard('校园环湖 5K')).ok);
  await waitForPath('/activity/act-001');
  await scrollToText('报名与出勤');
  await sleep(350);
  check('取消报名按钮可用', (await clickButton('取消报名')).ok);
  check('手机端取消报名反馈', await waitForText('已取消报名，名额已经释放。'));
  body = await bodyText();
  check('取消后名额变为 6/40', body.includes('6 / 40 人') && body.includes('剩余 34 个名额'));
  const afterCancel = await api('/activities/act-001');
  check('后台 act-001 报名数释放到 6', afterCancel.signupCount === 6);
  const memberAfterCancel = await api('/member/activities?memberId=m-001');
  const act001Member = memberAfterCancel.find((item) => item.id === 'act-001');
  check('后台 m-001 报名状态为已取消', act001Member.mySignup.status === 'declined');
  await screenshot('13-detail-cancelled');

  await clickText('返回');
  await sleep(800);
  check('回到活动列表', (await waitForPath('/activities')) === '/activities');
  body = await bodyText();
  check('列表 act-001 人数变 6', body.includes('6 人已报名'));
  check('可报名筛选出现 1 场', (await clickButton('可报名')).ok && (await waitForText('共 1 场')));
  await screenshot('14-list-after-cancel');

  await clickText('我的');
  await sleep(800);
  await scrollToText('重置活动演示数据');
  await sleep(350);
  check('点击重置活动演示数据', (await clickButton('重置活动演示数据')).ok);
  check('重置成功提示出现', await waitForText('活动演示数据、消息和挑战已重置'));
  const afterReset = await api('/health');
  check('重置后 API 回到 4 场 / 19 条报名', afterReset.activities === 4 && afterReset.signups === 19, JSON.stringify(afterReset));
  const resetAct001 = await api('/activities/act-001');
  check('重置后 act-001 回到 7/40', resetAct001.signupCount === 7);
  await scrollToText('活动演示数据、消息和挑战已重置');
  await sleep(400);
  await screenshot('15-profile-reset-result');

  await reloadAndLogin();
  await clickText('我的');
  await sleep(700);
  await clickText('我的活动');
  await sleep(900);
  body = await bodyText();
  check('重置后手机端回到 2 场待参加', body.includes('2 场待参加'));
  check('重置后手机端回到 1 场已参加', body.includes('已参加') && body.includes('团长已核对出勤'));
  await screenshot('16-my-after-reset');

  await clickText('首页');
  await sleep(800);
  body = await bodyText();
  check('重置后首页活动回到 7 人已报名', body.includes('7 人已报名'));
  await screenshot('17-home-after-reset');
} catch (error) {
  result.error = String(error && error.stack ? error.stack : error);
  console.error('FAILED:', result.error);
} finally {
  result.events = events;
  result.failures = failures;
  result.passed = checks.filter((item) => item.pass).length;
  result.total = checks.length;
  writeFileSync(OUT + '/report.json', JSON.stringify(result, null, 2));
  console.log('SUMMARY ' + result.passed + '/' + result.total + ' passed; events=' + events.length);
  ws.close();
  edge.kill();
}
if (failures.length || events.length || result.error) process.exit(1);
