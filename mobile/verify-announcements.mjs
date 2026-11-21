import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9265;
const BASE = 'http://127.0.0.1:8090';
const API = BASE + '/api';
const OUT = 'E:/QPTapp/mobile/shots/announcements';
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
check('API 初始 4 活动 / 3 条已发布公告 / 1 条草稿', health.ok === true && health.activities === 4 && health.announcements === 4, JSON.stringify(health));
let adminList = await api('/announcements');
check('后台公告列表 3 已发布 + 1 草稿', adminList.length === 4 && adminList.filter((item) => item.status === 'published').length === 3, JSON.stringify(adminList.map((item) => item.status)));
let memberList = await api('/member/announcements?memberId=m-001');
check('成员端只看到 3 条已发布公告', memberList.length === 3, String(memberList.length));
check('置顶公告排在最前', memberList[0]?.id === 'ann-001' && memberList[0]?.pinned === true, memberList[0]?.title);
check('初始 2 条未读公告', memberList.filter((item) => !item.read).length === 2);
let inbox = await api('/member/notifications?memberId=m-001');
check('初始消息 3 条 / 未读 2 条', inbox.items.length === 3 && inbox.unread === 2);

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=E:/QPTapp/.edge-cdp-mobile-announcements',
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
const clickText = (text) => evaluate('(() => { const nodes=[...document.querySelectorAll("button,[role=button],[role=tab],div")].reverse(); const target=nodes.find((node)=>(node.innerText||"").includes(' + JSON.stringify(text) + ')&&node.getBoundingClientRect().width>0); if(!target) return {ok:false,body:document.body.innerText.slice(0,500)}; target.click(); return {ok:true,text:(target.innerText||"").replace(/\s+/g," ").trim().slice(0,100)}; })()');
const clickButton = (text) => evaluate('(() => { const norm=(value)=>(value||"").replace(/\s+/g," ").trim(); const want=' + JSON.stringify(text) + '; const all=[...document.querySelectorAll("[role=button],[role=tab],button")].filter((node)=>node.getBoundingClientRect().width>0); const target=all.find((node)=>norm(node.innerText)===want)||all.find((node)=>norm(node.innerText).includes(want)); if(!target) return {ok:false,buttons:all.map((node)=>norm(node.innerText)).filter(Boolean).slice(0,30)}; target.click(); return {ok:true,text:norm(target.innerText).slice(0,100)}; })()');
const clickCard = (text) => evaluate('(() => { const norm=(value)=>(value||"").replace(/\s+/g," ").trim(); const want=' + JSON.stringify(text) + '; const all=[...document.querySelectorAll("[role=button]")].filter((node)=>node.getBoundingClientRect().width>0); const target=all.find((node)=>norm(node.innerText).includes(want)&&norm(node.innerText).length>20); if(!target) return {ok:false,cards:all.map((node)=>norm(node.innerText)).filter(Boolean).slice(0,20)}; target.click(); return {ok:true,text:norm(target.innerText).slice(0,120)}; })()');
const clickAria = (label) => evaluate('(() => { const target=document.querySelector(' + JSON.stringify('[aria-label="' + label + '"]') + '); if(!target) return {ok:false}; target.click(); return {ok:true}; })()');
const clickTab = (text) => evaluate('(() => { const norm=(value)=>(value||"").replace(/\s+/g," ").trim(); const want=' + JSON.stringify(text) + '; const all=[...document.querySelectorAll("[role=tab]")].filter((node)=>node.getBoundingClientRect().width>0); const target=all.find((node)=>norm(node.innerText).includes(want)); if(!target) return {ok:false,tabs:all.map((node)=>norm(node.innerText))}; target.click(); return {ok:true,text:norm(target.innerText)}; })()');
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
  let body = '';

  check('进入跑团页', (await clickTab('跑团')).ok);
  check('跑团页加载公告', await waitForText('跑团公告'));
  body = await bodyText();
  check('跑团页显示置顶和最新公告', body.includes('雾霾天训练调整') && body.includes('周六校园环湖 5K 集合提醒') && body.includes('全部公告'));
  await screenshot('01-school-announcements');

  check('打开跑团主页', (await clickButton('查看跑团')).ok);
  check('跑团主页路径正确', (await waitForPath('/club')) === '/club');
  check('跑团主页加载', await waitForText('跑团主页'));
  body = await bodyText();
  check('跑团主页展示公告、活动与跑团信息', body.includes('跑团公告') && body.includes('近期活动') && body.includes('跑团信息') && body.includes('128'));
  await screenshot('02-club-home');

  check('打开置顶公告', (await clickCard('雾霾天训练调整')).ok);
  check('公告详情路径正确', (await waitForPath('/announcements/ann-001')) === '/announcements/ann-001');
  check('公告详情加载', await waitForText('体育馆二楼'));
  body = await bodyText();
  check('公告详情显示分类、作者与安全提示', body.includes('安全') && body.includes('林建国') && body.includes('看到了吗'));
  await sleep(500);
  memberList = await api('/member/announcements?memberId=m-001');
  check('打开后公告标记已读', memberList.find((item) => item.id === 'ann-001')?.read === true);
  await screenshot('03-announcement-detail');

  await evaluate('history.back()');
  check('返回跑团主页', (await waitForPath('/club')) === '/club');
  check('打开全部公告', (await clickButton('全部公告')).ok);
  check('公告列表路径正确', (await waitForPath('/announcements')) === '/announcements');
  check('公告列表加载', await waitForText('全部 3'));
  body = await bodyText();
  check('列表显示 1 条未读', body.includes('未读 1') && body.includes('已全部读完') === false);
  await screenshot('04-announcements-list');

  check('切换到未读筛选', (await clickButton('未读 1')).ok);
  await sleep(300);
  body = await bodyText();
  check('未读筛选只剩周六集合提醒', body.includes('周六校园环湖 5K 集合提醒') && !body.includes('雾霾天训练调整'));
  await screenshot('05-announcements-unread');

  check('打开周六集合提醒', (await clickCard('周六校园环湖 5K 集合提醒')).ok);
  check('打开第二条公告详情', (await waitForPath('/announcements/ann-002')) === '/announcements/ann-002');
  check('公告详情正文加载', await waitForText('06:30 前发公告取消'));
  await sleep(500);
  memberList = await api('/member/announcements?memberId=m-001');
  check('两条公告都已读', memberList.every((item) => item.read === true));

  const created = await api('/announcements', {
    method: 'POST',
    body: {
      title: '周末集合改到南门',
      content: '这周六的校园环湖改到学校南门集合，07:00 出发。南门在修路，骑车来的同学停到图书馆西侧车棚。',
      category: 'notice',
      pinned: true,
    },
  });
  await api('/announcements/' + created.id, { method: 'PATCH', body: { status: 'published' } });
  inbox = await api('/member/notifications?memberId=m-001');
  check('发布公告后消息增至 4 条 / 未读 3 条', inbox.items.length === 4 && inbox.unread === 3, JSON.stringify({ n: inbox.items.length, unread: inbox.unread }));
  check('新增消息类型为跑团公告', inbox.items[0]?.type === 'announcement' && inbox.items[0]?.announcementId === created.id, JSON.stringify(inbox.items[0] || {}));
  memberList = await api('/member/announcements?memberId=m-001');
  check('成员端公告增至 4 条且置顶在前', memberList.length === 4 && memberList[0]?.id === created.id, JSON.stringify(memberList.map((item) => item.id)));

  check('回首页看铃铛', (await clickTab('首页')).ok);
  await waitForText('本周活动');
  await sleep(600);
  const bellText = await evaluate("document.querySelector('[aria-label=\"消息中心\"]')?.innerText || ''");
  check('铃铛显示 3 条未读', bellText.includes('3'), bellText);
  await screenshot('06-home-bell');

  check('进入消息中心', (await clickAria('消息中心')).ok);
  check('消息中心加载公告消息', await waitForText('跑团公告：周末集合改到南门'));
  body = await bodyText();
  check('消息中心显示 4 条 / 3 条未读', body.includes('全部 4') && body.includes('3 条未读'));
  check('公告消息带公告入口', body.includes('查看公告详情'));
  await screenshot('07-message-announcement');

  check('打开公告消息', (await clickCard('跑团公告：周末集合改到南门')).ok);
  check('消息跳转到公告详情', (await waitForPath('/announcements/' + created.id)) === '/announcements/' + created.id);
  check('公告详情显示南门集合', await waitForText('南门在修路'));
  await screenshot('08-announcement-from-message');

  await api('/announcements/' + created.id, { method: 'PATCH', body: { status: 'draft' } });
  inbox = await api('/member/notifications?memberId=m-001');
  check('撤回后公告消息被清理，回到 3 条 / 未读 2 条', inbox.items.length === 3 && inbox.unread === 2, JSON.stringify({ n: inbox.items.length, unread: inbox.unread }));
  memberList = await api('/member/announcements?memberId=m-001');
  check('撤回后成员端只剩 3 条公告', memberList.length === 3 && !memberList.some((item) => item.id === created.id));

  check('回到跑团页', (await clickTab('跑团')).ok);
  await waitForText('跑团公告');
  await sleep(500);
  body = await bodyText();
  check('跑团页不再显示撤回公告', !body.includes('周末集合改到南门'));
  check('进入公告列表', (await clickButton('全部公告')).ok);
  await waitForText('全部 3');
  await screenshot('09-after-withdraw');

  await api('/reset', { method: 'POST' });
  const restored = await api('/announcements');
  check('测试结束恢复 3 条已发布 + 1 条草稿', restored.length === 4, String(restored.length));

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
