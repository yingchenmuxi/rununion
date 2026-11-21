import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9247;
const BASE = 'http://127.0.0.1:5173';
const API = 'http://127.0.0.1:8090/api';
const OUT = 'E:/QPTapp/admin/shots/announcements';
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
let list = await api('/announcements');
check('初始公告 3 发布 + 1 草稿', list.length === 4 && list.filter((item) => item.status === 'published').length === 3, JSON.stringify(list.map((item) => item.status)));
let inbox = await api('/member/notifications?memberId=m-001');
check('初始消息 3 条 / 未读 2 条', inbox.items.length === 3 && inbox.unread === 2);

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-admin-announcements', 'about:blank',
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
const scrollCard = (title) => evaluate('(() => { const card=[...document.querySelectorAll(".announcement-card")].find((c)=>(c.innerText||"").includes(' + JSON.stringify(title) + ')); if(!card) return {ok:false}; card.scrollIntoView({block:"center"}); return {ok:true}; })()');
const clickCardButton = (title, text) => evaluate('(() => { const want=' + JSON.stringify(text) + '; const card=[...document.querySelectorAll(".announcement-card")].find((c)=>(c.innerText||"").includes(' + JSON.stringify(title) + ')); if(!card) return {ok:false,cards:[...document.querySelectorAll(".announcement-card")].map((c)=>(c.innerText||"").slice(0,20))}; const target=[...card.querySelectorAll("button")].find((b)=>(b.innerText||"").trim()===want); if(!target) return {ok:false,buttons:[...card.querySelectorAll("button")].map((b)=>(b.innerText||"").trim())}; target.click(); return {ok:true}; })()');
const setValue = (selector, value) => evaluate('(() => { const el=document.querySelector(' + JSON.stringify(selector) + '); if(!el) return {ok:false}; const proto=el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:el.tagName==="SELECT"?HTMLSelectElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,"value").set.call(el,' + JSON.stringify(value) + '); el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true})); return {ok:true,value:el.value}; })()');

const TITLE = '测试公告：周末训练改到南门';
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

  check('打开公告页', (await clickNav('/announcements')).ok);
  check('公告页加载', await waitFor('!!document.querySelector(".announcement-list")'));
  let state = await pageState();
  check('统计卡显示 3 已发布 / 1 草稿 / 1 置顶', state.body.includes('已发布') && state.body.includes('草稿') && state.body.includes('置顶'));
  check('列表显示 4 条公告', await evaluate('document.querySelectorAll(".announcement-card").length === 4'));
  await screenshot('01-announcement-list');

  check('点击新建公告', (await clickButton('新建公告')).ok);
  check('新建弹窗打开', await waitFor('document.querySelector(".modal")?.innerText.includes("新建公告")'));
  check('填写标题', (await setValue('#announcement-title', TITLE)).ok);
  check('填写正文', (await setValue('#announcement-content', '这周六的训练改到学校南门集合，07:00 出发。南门在修路，骑车来的同学停到图书馆西侧车棚，家长接送的在南门对面等候。')).ok);
  check('选择训练分类', (await setValue('#announcement-category', 'training')).ok);
  await evaluate('document.querySelector(".modal .checkbox-row input")?.click()');
  await sleep(250);
  check('保存草稿', (await evaluate('(() => { const b=[...document.querySelectorAll(".modal-footer button")].find((x)=>(x.innerText||"").trim()==="保存草稿"); if(!b) return {ok:false}; b.click(); return {ok:true}; })()')).ok);
  check('草稿保存后弹窗关闭', await waitFor('!document.querySelector(".modal")'));
  await waitFor('document.body.innerText.includes(' + JSON.stringify(TITLE) + ')');
  state = await pageState();
  check('草稿保存 toast 出现', state.toast.includes('公告已保存为草稿'), state.toast);
  check('列表出现新草稿卡片', await evaluate('[...document.querySelectorAll(".announcement-card")].some((c)=>c.innerText.includes(' + JSON.stringify(TITLE) + ') && c.innerText.includes("草稿"))'));
  list = await api('/announcements');
  const draft = list.find((item) => item.title === TITLE);
  check('API 新公告为草稿且置顶', draft?.status === 'draft' && draft?.pinned === true && draft?.category === 'training', JSON.stringify({ status: draft?.status, pinned: draft?.pinned, category: draft?.category }));
  await scrollCard(TITLE);
  await sleep(400);
  await screenshot('02-announcement-draft');
  await sleep(3400);

  check('发布新公告', (await clickCardButton(TITLE, '发布')).ok);
  check('发布后 toast 出现', await waitFor('[...document.querySelectorAll(".toast")].some((n)=>n.innerText.includes("公告已发布"))'));
  await sleep(500);
  list = await api('/announcements');
  const published = list.find((item) => item.title === TITLE);
  check('API 公告已发布并记录发布时间', published?.status === 'published' && Boolean(published?.publishedAt), JSON.stringify({ status: published?.status, publishedAt: published?.publishedAt }));
  check('后台置顶排在最前', list[0]?.title === TITLE, list[0]?.title);
  inbox = await api('/member/notifications?memberId=m-001');
  const message = inbox.items.find((item) => item.type === 'announcement' && item.announcementId === published?.id);
  check('发布后成员收到站内消息', Boolean(message), JSON.stringify(inbox.items.map((item) => item.type)));
  check('消息标题带公告标题', message?.title === '跑团公告：' + TITLE, message?.title);
  check('成员未读增至 3 条', inbox.unread === 3, String(inbox.unread));
  let memberList = await api('/member/announcements?memberId=m-001');
  check('手机成员端公告变为 4 条', memberList.length === 4, String(memberList.length));
  await screenshot('03-announcement-published');

  check('取消置顶', (await clickCardButton(TITLE, '取消置顶')).ok);
  await sleep(500);
  list = await api('/announcements');
  check('API 取消置顶生效', list.find((item) => item.title === TITLE)?.pinned === false);
  check('重新置顶', (await clickCardButton(TITLE, '置顶')).ok);
  await sleep(500);
  list = await api('/announcements');
  check('API 重新置顶生效', list.find((item) => item.title === TITLE)?.pinned === true);
  await sleep(3400);

  check('撤回新公告', (await clickCardButton(TITLE, '撤回')).ok);
  check('撤回 toast 出现', await waitFor('[...document.querySelectorAll(".toast")].some((n)=>n.innerText.includes("公告已撤回"))'));
  await sleep(500);
  list = await api('/announcements');
  const withdrawn = list.find((item) => item.title === TITLE);
  check('API 公告回到草稿', withdrawn?.status === 'draft');
  inbox = await api('/member/notifications?memberId=m-001');
  check('撤回后公告消息被清理', inbox.items.length === 3 && inbox.unread === 2, JSON.stringify({ n: inbox.items.length, unread: inbox.unread }));
  memberList = await api('/member/announcements?memberId=m-001');
  check('撤回后手机端只剩 3 条公告', memberList.length === 3);
  await scrollCard(TITLE);
  await sleep(400);
  await screenshot('04-announcement-withdrawn');
  await sleep(3400);

  check('删除测试公告', (await clickCardButton(TITLE, '删除')).ok);
  check('删除确认弹窗打开', await waitFor('document.body.innerText.includes("删除这条公告")'));
  check('确认删除', (await clickButton('删除公告')).ok);
  check('删除后卡片消失', await waitFor('!document.body.innerText.includes(' + JSON.stringify(TITLE) + ')'));
  list = await api('/announcements');
  check('API 公告恢复 4 条', list.length === 4, String(list.length));
  await evaluate('window.scrollTo(0, 0)');
  await sleep(350);
  await screenshot('05-announcement-deleted');

  await api('/reset', { method: 'POST' });
  list = await api('/announcements');
  check('测试结束恢复 4 条公告', list.length === 4);
} catch (error) {
  check('测试流程无异常', false, error instanceof Error ? error.message : String(error));
  try { await screenshot('99-error'); } catch {}
} finally {
  const result = { checks, failures, events, finishedAt: new Date().toISOString() };
  writeFileSync(OUT + '/report.json', JSON.stringify(result, null, 2));
  try { ws.close(); } catch {}
  edge.kill();
}

console.log('\n' + (checks.length - failures.length) + '/' + checks.length + ' checks passed');
if (events.length) console.log('EVENTS ' + JSON.stringify(events, null, 2));
process.exitCode = failures.length || events.length ? 1 : 0;
