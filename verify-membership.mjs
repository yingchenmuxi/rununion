import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const MOBILE_PORT = 9267;
const ADMIN_PORT = 9249;
const MOBILE_BASE = 'http://127.0.0.1:8090';
const ADMIN_BASE = 'http://127.0.0.1:5173';
const API = 'http://127.0.0.1:8090/api';
const MOBILE_OUT = 'E:/QPTapp/mobile/shots/membership';
const ADMIN_OUT = 'E:/QPTapp/admin/shots/membership';
for (const dir of [MOBILE_OUT, ADMIN_OUT]) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

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

const procs = [];
async function connect(label, port, profile, width, height, dsf, mobileMode, url) {
  const proc = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profile,
    'about:blank',
  ], { stdio: 'ignore' });
  procs.push(proc);
  let targets = null;
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/list');
      if (res.ok) { targets = await res.json(); break; }
    } catch {}
    await sleep(200);
  }
  if (!targets) throw new Error(label + ' CDP not ready');
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
      events.push({ where: label, kind: 'exception', text: details.exception?.description || details.text });
    }
    if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
      events.push({
        where: label,
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
  async function screenshot(dir, name) {
    const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    writeFileSync(dir + '/' + name + '.png', Buffer.from(shot.data, 'base64'));
  }
  async function bodyText() {
    return (await evaluate('document.body.innerText')).replace(/\s+/g, ' ').trim();
  }
  async function path() { return evaluate('location.pathname'); }
  async function waitForText(text, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if ((await bodyText()).includes(text)) return true;
      await sleep(220);
    }
    return false;
  }
  async function waitForPath(part, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const value = await path();
      if (value.includes(part)) return value;
      await sleep(220);
    }
    return await path();
  }
  function clickText(text) {
    return evaluate('(() => { const norm=(value)=>(value||"").replace(/\\s+/g," ").trim(); const want=' + JSON.stringify(text) + '; const nodes=[...document.querySelectorAll("button,[role=button],[role=tab],div")].filter((node)=>node.getBoundingClientRect().width>0); const target=nodes.reverse().find((node)=>norm(node.innerText).includes(want)); if(!target) return {ok:false,body:document.body.innerText.slice(0,400)}; target.click(); return {ok:true,text:norm(target.innerText).slice(0,100)}; })()');
  }
  function clickButton(text) {
    return evaluate('(() => { const norm=(value)=>(value||"").replace(/\\s+/g," ").trim(); const want=' + JSON.stringify(text) + '; const all=[...document.querySelectorAll("[role=button],[role=tab],button")].filter((node)=>node.getBoundingClientRect().width>0); const target=all.find((node)=>norm(node.innerText)===want)||all.find((node)=>norm(node.innerText).includes(want)); if(!target) return {ok:false,buttons:all.map((node)=>norm(node.innerText)).filter(Boolean).slice(0,30)}; target.click(); return {ok:true,text:norm(target.innerText).slice(0,100)}; })()');
  }
  function clickNav(href) {
    return evaluate('(() => { const link=document.querySelector(' + JSON.stringify('a[href="' + href + '"]') + '); if(!link) return {ok:false}; link.click(); return {ok:true}; })()');
  }
  function setPlaceholder(placeholder, value) {
    return evaluate('(() => { const want=' + JSON.stringify(placeholder) + '; const el=[...document.querySelectorAll("input,textarea")].find((node)=>(node.placeholder||"").includes(want)); if(!el) return {ok:false,placeholders:[...document.querySelectorAll("input,textarea")].map((node)=>node.placeholder).filter(Boolean)}; const proto=el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,"value").set.call(el,' + JSON.stringify(value) + '); el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true})); return {ok:true,value:el.value}; })()');
  }
  function setValue(selector, value) {
    return evaluate('(() => { const el=document.querySelector(' + JSON.stringify(selector) + '); if(!el) return {ok:false}; const proto=el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:el.tagName==="SELECT"?HTMLSelectElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,"value").set.call(el,' + JSON.stringify(value) + '); el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true})); return {ok:true,value:el.value}; })()');
  }
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dsf, mobile: mobileMode });
  await send('Page.navigate', { url });
  await sleep(1800);
  return { label, send, evaluate, screenshot, bodyText, path, waitForText, waitForPath, clickText, clickButton, clickNav, setPlaceholder, setValue, events, ws };
}

const result = { checks };
let mobile;
let admin;
try {
  await api('/reset', { method: 'POST' });
  const health = await api('/health');
  check('共享 Mock 种子 12 名成员', health.members === 12 && health.activities === 4, JSON.stringify(health));
  let members = await api('/members');
  check('初始 3 条待审批申请', members.filter((member) => member.status === 'pending').length === 3, String(members.length));

  mobile = await connect('mobile', MOBILE_PORT, 'E:/QPTapp/.edge-cdp-mobile-membership', 390, 844, 2, true, MOBILE_BASE + '/');
  check('手机端登录页可用', await mobile.waitForText('先入团'));

  check('切换到我有邀请码', (await mobile.clickText('我有邀请码')).ok);
  check('邀请码步骤打开', await mobile.waitForText('找到你的跑团'));
  check('填入邀请码', (await mobile.setPlaceholder('例如 KANGFU-2026', 'KANGFU-2026')).ok);
  await mobile.screenshot(MOBILE_OUT, '01-invite-code');
  check('验证邀请码', (await mobile.clickButton('验证邀请码')).ok);
  check('进入入团资料步骤', await mobile.waitForText('接下来填写入团资料'));
  check('填写昵称', (await mobile.setPlaceholder('社团里怎么称呼你', '周小满')).ok);
  check('选择年级', (await mobile.clickText('高一')).ok);
  check('填写用户名', (await mobile.setPlaceholder('3–20 位小写字母', 'zhouxiaoman')).ok);
  let body = await mobile.bodyText();
  const passwordInputs = await mobile.evaluate('document.querySelectorAll("input[type=password]").length');
  check('入团表单不再要求密码', passwordInputs === 0, String(passwordInputs));
  check('提示由社长审批', body.includes('提交后由社长在后台审批'));
  await mobile.screenshot(MOBILE_OUT, '02-join-form');

  check('提交入团申请', (await mobile.clickButton('提交入团申请')).ok);
  check('进入待审批页', await mobile.waitForText('申请已提交'));
  body = await mobile.bodyText();
  check('待审批页不能自己通过', !body.includes('演示：立即通过') && body.includes('待社长审批'), body.slice(0, 160));
  check('待审批页显示自动刷新', body.includes('每 2.5 秒一次'));
  await mobile.screenshot(MOBILE_OUT, '03-pending');

  members = await api('/members');
  const applicant = members.find((member) => member.username === 'zhouxiaoman');
  check('共享 API 收到申请', Boolean(applicant) && applicant.status === 'pending', JSON.stringify(applicant || {}));
  check('成员数增至 13', members.length === 13, String(members.length));

  admin = await connect('admin', ADMIN_PORT, 'E:/QPTapp/.edge-cdp-admin-membership', 1440, 1000, 1, false, ADMIN_BASE + '/login');
  await admin.waitForText('填入演示账号');
  await admin.evaluate('document.querySelectorAll(".demo-account button")[0]?.click()');
  await sleep(300);
  await admin.evaluate('document.querySelector(".login-submit")?.click()');
  check('社团后台登录成功', await admin.waitForPath('/overview', 10000) === '/overview' || !(await admin.path()).includes('/login'));
  await sleep(3400);

  check('打开成员页', (await admin.clickNav('/members')).ok);
  check('成员页加载', await admin.waitForText('审批新成员'));
  check('搜索新申请', (await admin.setValue('input[aria-label="搜索成员"]', '周小满')).ok);
  await sleep(500);
  body = await admin.bodyText();
  check('后台看到待审批的新成员', body.includes('周小满') && body.includes('未填写') && body.includes('待审批'), body.slice(0, 220));
  await admin.screenshot(ADMIN_OUT, '01-member-pending');

  const approve = await admin.evaluate('(() => { const row=[...document.querySelectorAll("tr")].find((tr)=>tr.innerText.includes("周小满")); if(!row) return {ok:false}; const btn=[...row.querySelectorAll("button")].find((b)=>(b.innerText||"").trim()==="通过"); if(!btn) return {ok:false,buttons:[...row.querySelectorAll("button")].map((b)=>b.innerText)}; btn.click(); return {ok:true}; })()');
  check('后台通过新成员', approve.ok);
  check('通过 toast 出现', await admin.waitForText('已通过审批'));
  await sleep(700);
  members = await api('/members');
  const approved = members.find((member) => member.username === 'zhouxiaoman');
  check('API 申请变为在团', approved?.status === 'active' && approved?.reviewNote.includes('通过'), JSON.stringify({ status: approved?.status, note: approved?.reviewNote }));
  await admin.screenshot(ADMIN_OUT, '02-member-approved');

  check('手机端自动出现通过页', await mobile.waitForText('欢迎加入跑团', 12000));
  body = await mobile.bodyText();
  check('通过页显示申请人昵称和年级', body.includes('周小满') && body.includes('高一'), body.slice(0, 180));
  await mobile.screenshot(MOBILE_OUT, '04-approved');
  check('点击进入跑团', (await mobile.clickButton('进入跑团')).ok);
  check('进入首页并保留昵称', await mobile.waitForText('你好，周小满', 10000));
  check('首页加载', await mobile.waitForText('本周活动'));
  await mobile.screenshot(MOBILE_OUT, '05-home-after-approval');

  check('打开我的页', (await mobile.clickText('我的')).ok);
  check('我的页加载', await mobile.waitForText('演示数据'));
  check('退出登录', (await mobile.clickButton('退出登录')).ok);
  check('回到登录页', await mobile.waitForText('先入团'));

  check('再次切换邀请码', (await mobile.clickText('我有邀请码')).ok);
  await mobile.waitForText('找到你的跑团');
  await mobile.setPlaceholder('例如 KANGFU-2026', 'KANGFU-2026');
  await mobile.clickButton('验证邀请码');
  await mobile.waitForText('接下来填写入团资料');
  await mobile.setPlaceholder('社团里怎么称呼你', '陈小满');
  await mobile.clickText('初三');
  await mobile.setPlaceholder('3–20 位小写字母', 'chenxiaoman');
  check('提交第二条申请', (await mobile.clickButton('提交入团申请')).ok);
  check('第二条申请进入待审批', await mobile.waitForText('申请已提交'));
  await mobile.screenshot(MOBILE_OUT, '06-second-pending');

  await admin.setValue('input[aria-label="搜索成员"]', '陈小满');
  check('后台自动刷新看到第二条申请', await admin.waitForText('陈小满', 9000));
  body = await admin.bodyText();
  check('后台看到第二条申请', body.includes('陈小满') && body.includes('待审批'), body.slice(0, 200));
  const reject = await admin.evaluate('(() => { const row=[...document.querySelectorAll("tr")].find((tr)=>tr.innerText.includes("陈小满")); if(!row) return {ok:false}; const btn=[...row.querySelectorAll("button")].find((b)=>(b.innerText||"").trim()==="拒绝"); if(!btn) return {ok:false}; btn.click(); return {ok:true}; })()');
  check('打开拒绝弹窗', reject.ok && await admin.waitForText('拒绝这条申请'));
  check('填写拒绝原因', (await admin.setValue('#member-reject-reason', '请补充班级和监护人联系方式。')).ok);
  await admin.screenshot(ADMIN_OUT, '03-reject-dialog');
  check('确认拒绝', (await admin.clickButton('拒绝申请')).ok);
  check('拒绝 toast 出现', await admin.waitForText('拒绝原因会显示在成员端'));
  await sleep(700);
  members = await api('/members');
  const rejected = members.find((member) => member.username === 'chenxiaoman');
  check('API 申请变为已拒绝并保留原因', rejected?.status === 'rejected' && rejected?.reviewNote === '请补充班级和监护人联系方式。', JSON.stringify({ status: rejected?.status, note: rejected?.reviewNote }));

  check('手机端自动出现拒绝页', await mobile.waitForText('这次先补充资料', 12000));
  body = await mobile.bodyText();
  check('拒绝页显示社长留言', body.includes('请补充班级和监护人联系方式。'), body.slice(0, 220));
  await mobile.screenshot(MOBILE_OUT, '07-rejected');

  check('点击修改资料重新申请', (await mobile.clickButton('修改资料并重新申请')).ok);
  check('重新回到入团资料', await mobile.waitForText('接下来填写入团资料'));
  const prefills = await mobile.evaluate('(() => [...document.querySelectorAll("input")].map((el)=>({placeholder:el.placeholder,value:el.value})))()');
  check('重新申请预填昵称和用户名', prefills.some((item) => item.value === '陈小满') && prefills.some((item) => item.value === 'chenxiaoman'), JSON.stringify(prefills));
  await mobile.screenshot(MOBILE_OUT, '08-reapply-form');

  check('重新提交申请', (await mobile.clickButton('提交入团申请')).ok);
  check('重新提交进入待审批', await mobile.waitForText('申请已提交'));
  await mobile.screenshot(MOBILE_OUT, '09-pending-again');
  members = await api('/members');
  const reapplied = members.find((member) => member.username === 'chenxiaoman');
  check('重提复用原申请记录', reapplied?.status === 'pending' && reapplied?.id === rejected?.id, JSON.stringify({ id: reapplied?.id, status: reapplied?.status }));
  check('重提不增加成员数', members.length === 14, String(members.length));

  await admin.setValue('input[aria-label="搜索成员"]', '陈小满');
  await sleep(600);
  check('后台重新看到待审批数回升', await admin.waitForText('待审批 4', 9000));
  body = await admin.bodyText();
  check('后台重新看到待审批', body.includes('陈小满') && body.includes('待审批'), body.slice(0, 200));
  await admin.screenshot(ADMIN_OUT, '04-reapplied');

  await api('/reset', { method: 'POST' });
  const restored = await api('/members');
  check('测试结束恢复 12 名成员', restored.length === 12, String(restored.length));
} catch (error) {
  check('测试流程无异常', false, error instanceof Error ? error.message : String(error));
  try { if (mobile) await mobile.screenshot(MOBILE_OUT, '99-error'); } catch {}
  try { if (admin) await admin.screenshot(ADMIN_OUT, '99-error'); } catch {}
} finally {
  result.failures = failures;
  result.events = [...(mobile?.events ?? []), ...(admin?.events ?? [])];
  result.finishedAt = new Date().toISOString();
  writeFileSync(MOBILE_OUT + '/report.json', JSON.stringify(result, null, 2));
  try { mobile?.ws.close(); } catch {}
  try { admin?.ws.close(); } catch {}
  for (const proc of procs) { try { proc.kill(); } catch {} }
}

console.log('\n' + (checks.length - failures.length) + '/' + checks.length + ' checks passed');
if (result.events.length) console.log('EVENTS ' + JSON.stringify(result.events, null, 2));
process.exitCode = failures.length || result.events.length ? 1 : 0;
