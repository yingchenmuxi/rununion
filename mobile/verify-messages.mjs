import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9263;
const BASE = 'http://127.0.0.1:8090';
const API = BASE + '/api';
const OUT = 'E:/QPTapp/mobile/shots/messages-growth-charity';
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
check('API 初始 4 场活动 / 19 条报名 / 3 条消息', health.ok === true && health.activities === 4 && health.signups === 19 && health.notifications === 3, JSON.stringify(health));
let inbox = await api('/member/notifications?memberId=m-001');
check('初始消息 3 条、未读 2 条', inbox.items.length === 3 && inbox.unread === 2);
check('初始消息包含确认、提醒、出勤', ['activity_confirmed', 'activity_reminder', 'attendance'].every((type) => inbox.items.some((item) => item.type === type)));

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=E:/QPTapp/.edge-cdp-mobile-messages',
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
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  writeFileSync(OUT + '/' + name + '.png', Buffer.from(shot.data, 'base64'));
}
const bodyText = async () => (await evaluate('document.body.innerText')).replace(/\s+/g, ' ').trim();
const path = () => evaluate('location.pathname');
const clickText = (text) => evaluate('(() => { const nodes=[...document.querySelectorAll("button,[role=button],[role=tab],div")].reverse(); const target=nodes.find((node)=>(node.innerText||"").includes(' + JSON.stringify(text) + ')&&node.getBoundingClientRect().width>0); if(!target) return {ok:false,body:document.body.innerText.slice(0,500)}; target.click(); return {ok:true,text:(target.innerText||"").replace(/\\s+/g," ").trim().slice(0,100)}; })()');
const clickButton = (text) => evaluate('(() => { const norm=(value)=>(value||"").replace(/\\s+/g," ").trim(); const want=' + JSON.stringify(text) + '; const all=[...document.querySelectorAll("[role=button],[role=tab],button")].filter((node)=>node.getBoundingClientRect().width>0); const target=all.find((node)=>norm(node.innerText)===want)||all.find((node)=>norm(node.innerText).includes(want)); if(!target) return {ok:false,buttons:all.map((node)=>norm(node.innerText)).filter(Boolean).slice(0,30)}; target.click(); return {ok:true,text:norm(target.innerText).slice(0,100)}; })()');
const clickCard = (text) => evaluate('(() => { const norm=(value)=>(value||"").replace(/\\s+/g," ").trim(); const want=' + JSON.stringify(text) + '; const all=[...document.querySelectorAll("[role=button]")].filter((node)=>node.getBoundingClientRect().width>0); const target=all.find((node)=>norm(node.innerText).includes(want)&&norm(node.innerText).length>20); if(!target) return {ok:false,cards:all.map((node)=>norm(node.innerText)).filter(Boolean).slice(0,20)}; target.click(); return {ok:true,text:norm(target.innerText).slice(0,120)}; })()');
const clickAria = (label) => evaluate('(() => { const target=document.querySelector(' + JSON.stringify('[aria-label="' + label + '"]') + '); if(!target) return {ok:false}; target.click(); return {ok:true}; })()');
const clickTab = (text) => evaluate('(() => { const norm=(value)=>(value||"").replace(/\\s+/g," ").trim(); const want=' + JSON.stringify(text) + '; const all=[...document.querySelectorAll("[role=tab]")].filter((node)=>node.getBoundingClientRect().width>0); const target=all.find((node)=>norm(node.innerText).includes(want)); if(!target) return {ok:false,tabs:all.map((node)=>norm(node.innerText))}; target.click(); return {ok:true,text:norm(target.innerText)}; })()');
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
  await sleep(1800);

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
  let body = await bodyText();
  check('首页显示共享活动 7 人已报名', body.includes('7 人已报名') && body.includes('校园环湖 5K'));
  const bellText = await evaluate("document.querySelector('[aria-label=\"消息中心\"]')?.innerText || ''");
  check('首页铃铛显示 2 条未读', bellText.includes('2'), bellText);
  await screenshot('01-home-bell');

  check('点击铃铛进入消息中心', (await clickAria('消息中心')).ok);
  check('消息中心路径正确', (await waitForPath('/notifications')) === '/notifications');
  check('消息中心加载 3 条消息', await waitForText('报名已确认：校园环湖 5K'));
  body = await bodyText();
  check('消息中心显示 2 条未读', body.includes('2 条未读') && body.includes('全部 3') && body.includes('未读 2'));
  check('消息中心显示三类消息', ['报名已确认：校园环湖 5K', '活动提醒：操场间歇入门', '出勤已记录：已参加'].every((text) => body.includes(text)));
  await screenshot('02-messages-all');

  check('切换到未读筛选', (await clickButton('未读 2')).ok);
  await sleep(300);
  body = await bodyText();
  check('未读筛选隐藏已读消息', body.includes('活动提醒：操场间歇入门') && !body.includes('出勤已记录：已参加'));
  await screenshot('03-messages-unread');

  check('切回全部消息', (await clickButton('全部 3')).ok);
  await sleep(250);
  check('打开活动提醒消息', (await clickCard('活动提醒：操场间歇入门')).ok);
  check('消息跳转到 act-002 详情', (await waitForPath('/activity/act-002')) === '/activity/act-002');
  check('详情显示操场间歇入门', await waitForText('操场间歇入门'));
  body = await bodyText();
  check('详情仍是已报名状态', body.includes('已报名') && body.includes('学校田径场'));
  await screenshot('04-activity-from-message');

  check('从消息返回首页', (await clickTab('首页')).ok);
  await waitForText('本周活动');
  const bellAfter = await evaluate("document.querySelector('[aria-label=\"消息中心\"]')?.innerText || ''");
  check('读完一条后铃铛剩 1 条', bellAfter.includes('1'), bellAfter);
  check('再次进入消息中心', (await clickAria('消息中心')).ok);
  check('未读数变为 1', await waitForText('1 条未读'));
  await screenshot('05-message-read');

  check('点击全部已读', (await clickButton('全部已读')).ok);
  check('全部已读状态出现', await waitForText('已全部读完'));
  inbox = await api('/member/notifications?memberId=m-001');
  check('API 未读归零', inbox.unread === 0, String(inbox.unread));
  await screenshot('06-all-read');

  check('从消息中心回首页', (await clickTab('首页')).ok);
  await waitForText('本周活动');
  check('进入我的页', (await clickTab('我的')).ok);
  check('我的页加载', await waitForText('演示数据'));
  await evaluate("(() => { const nodes=[...document.querySelectorAll('div')]; const target=nodes.reverse().find((node)=>(node.innerText||'').includes('重置活动演示数据')&&node.getBoundingClientRect().width>0); if(target) target.scrollIntoView({block:'center'}); return true; })()");
  await sleep(300);
  check('点击重置演示数据', (await clickButton('重置活动演示数据')).ok);
  check('重置成功提示可见', await waitForText('活动演示数据、消息和挑战已重置'));
  inbox = await api('/member/notifications?memberId=m-001');
  check('重置后消息恢复 3 条 / 未读 2 条', inbox.items.length === 3 && inbox.unread === 2, JSON.stringify({ n: inbox.items.length, unread: inbox.unread }));
  await screenshot('07-profile-reset');

  check('进入成长档案', (await clickTab('成长')).ok);
  check('成长页加载', await waitForText('活动参与'));
  body = await bodyText();
  check('成长页显示四类活动数字', ['已参加', '未到', '待核对', '待参加'].every((text) => body.includes(text)));
  check('成长页说明不重复计算跑量', body.includes('不把活动距离重复计入跑量'));
  await screenshot('08-growth-activity');

  check('回到我的页', (await clickTab('我的')).ok);
  check('我的页重新加载', (await waitForPath('/profile')) === '/profile' && await waitForText('查看透明账本'));
  await evaluate("(() => { const nodes=[...document.querySelectorAll('div')]; const target=nodes.reverse().find((node)=>(node.innerText||'').includes('查看透明账本')&&node.getBoundingClientRect().width>0); if(target) target.scrollIntoView({block:'center'}); return true; })()");
  await sleep(250);
  check('打开公益透明账本', (await clickText('查看透明账本')).ok);
  check('账本路径正确', (await waitForPath('/charity')) === '/charity');
  check('账本加载', await waitForText('公益透明账本'));
  body = await bodyText();
  check('账本摘要完整', ['12', '双跑鞋', '不募集现金', '8 个', '36 小时', '4 个'].every((text) => body.includes(text)));
  check('账本显示物资去向与规则', body.includes('本期进度') && body.includes('物资去向') && body.includes('账本规则'));
  await screenshot('09-charity-top');

  await evaluate("(() => { const nodes=[...document.querySelectorAll('div')]; const target=nodes.reverse().find((node)=>(node.innerText||'').includes('账本规则')&&node.getBoundingClientRect().width>0); if(target) target.scrollIntoView({block:'center'}); return true; })()");
  await sleep(300);
  await screenshot('10-charity-rules');

  check('回到首页看变更消息', (await clickTab('首页')).ok);
  await waitForText('本周活动');
  const beforeChange = await api('/activities/act-001');
  await api('/activities/act-001', {
    method: 'PATCH',
    body: {
      title: beforeChange.title,
      tag: beforeChange.tag,
      date: beforeChange.date,
      startTime: '07:30',
      meetingArea: beforeChange.meetingArea,
      meetingDetail: beforeChange.meetingDetail,
      distanceKm: beforeChange.distanceKm,
      durationMin: beforeChange.durationMin,
      capacity: beforeChange.capacity,
      coach: beforeChange.coach,
      intensity: beforeChange.intensity,
      description: beforeChange.description,
      preparation: beforeChange.preparation,
      notes: beforeChange.notes,
    },
  });
  const afterChange = await api('/member/notifications?memberId=m-001');
  check('后台改期后消息增至 4 条 / 未读 3 条', afterChange.items.length === 4 && afterChange.unread === 3, JSON.stringify({ n: afterChange.items.length, unread: afterChange.unread }));
  check('新增消息类型为活动变更', afterChange.items[0]?.type === 'activity_changed', afterChange.items[0]?.type);
  check('点击铃铛看到变更消息', (await clickAria('消息中心')).ok);
  check('消息中心加载 4 条', await waitForText('活动信息有变更：校园环湖 5K'));
  body = await bodyText();
  check('变更消息显示新时间 07:30', body.includes('07:30') && body.includes('全部 4') && body.includes('3 条未读'));
  await screenshot('11-change-message');

  check('打开变更消息', (await clickCard('活动信息有变更：校园环湖 5K')).ok);
  check('变更消息跳到 act-001', (await waitForPath('/activity/act-001')) === '/activity/act-001');
  check('详情已显示 07:30', await waitForText('07:30'));
  await screenshot('12-change-detail');

  await api('/reset', { method: 'POST' });
  const restored = await api('/member/notifications?memberId=m-001');
  check('测试结束恢复种子消息 3 条 / 未读 2 条', restored.items.length === 3 && restored.unread === 2, JSON.stringify({ n: restored.items.length, unread: restored.unread }));
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