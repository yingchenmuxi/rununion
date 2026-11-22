import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const MOBILE_PORT = 9269;
const ADMIN_PORT = 9251;
const MOBILE_BASE = 'http://127.0.0.1:8090';
const ADMIN_BASE = 'http://127.0.0.1:5173';
const API = 'http://127.0.0.1:8090/api';
const MOBILE_OUT = 'E:/QPTapp/mobile/shots/invites';
const ADMIN_OUT = 'E:/QPTapp/admin/shots/invites';
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
  check('Mock API 返回 4 个邀请码', health.invites === 4, JSON.stringify(health));
  let invites = await api('/invites');
  check('初始 2 个可用邀请码', invites.filter((item) => item.status === 'active').length === 2, String(invites.length));

  admin = await connect('admin', ADMIN_PORT, 'E:/QPTapp/.edge-cdp-admin-invites', 1440, 1000, 1, false, ADMIN_BASE + '/login');
  await admin.waitForText('填入演示账号');
  await admin.evaluate('document.querySelectorAll(".demo-account button")[0]?.click()');
  await sleep(300);
  await admin.evaluate('document.querySelector(".login-submit")?.click()');
  await admin.waitForPath('/overview', 10000);
  check('社团后台登录成功', !(await admin.path()).includes('/login'));
  await sleep(3400);
  check('打开邀请码页', (await admin.clickNav('/invites')).ok);
  check('邀请码页加载', await admin.waitForText('全部邀请码'));
  await sleep(700);
  let body = await admin.bodyText();
  check('邀请码页显示 4 条记录', body.includes('4 个'), body.slice(0, 180));
  check('邀请码页显示可用 2 个', body.includes('可用邀请码') && body.includes('2'), body.slice(0, 180));
  await admin.screenshot(ADMIN_OUT, '01-invite-list');

  check('点击生成邀请码', (await admin.clickButton('生成邀请码')).ok);
  check('生成弹窗打开', await admin.waitForText('分享前请确认'));
  check('填写用途备注', (await admin.setPlaceholder('给这个邀请码一个容易辨认的名字', '联调邀请码')).ok);
  const formValues = await admin.evaluate('(() => { const inputs=[...document.querySelectorAll("input[type=number]")].filter((el)=>el.getBoundingClientRect().width>0); const set=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(el,v); el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true}));}; set(inputs[0],"2"); set(inputs[1],"7"); return inputs.map((el)=>el.value); })()');
  check('填写使用次数和有效期', JSON.stringify(formValues) === JSON.stringify(['2', '7']), JSON.stringify(formValues));
  check('提交生成邀请码', (await admin.clickButton('生成')).ok);
  check('生成成功 toast', await admin.waitForText('新的邀请码已生成。'));

  invites = await api('/invites');
  const created = invites.find((item) => item.note === '联调邀请码');
  check('共享 API 生成新邀请码', Boolean(created) && created.status === 'active' && created.maxUses === 2, JSON.stringify(created || {}));
  const code = created?.code || '';
  check('邀请码格式可识别', /^QINGRUN-\d{4}$/.test(code), code);
  await sleep(500);
  body = await admin.bodyText();
  check('后台列表出现新邀请码', body.includes(code), body.slice(0, 220));
  await admin.screenshot(ADMIN_OUT, '02-invite-created');

  mobile = await connect('mobile', MOBILE_PORT, 'E:/QPTapp/.edge-cdp-mobile-invites', 390, 844, 2, true, MOBILE_BASE + '/');
  check('手机端登录页可用', await mobile.waitForText('先入团'));
  check('切换到我有邀请码', (await mobile.clickText('我有邀请码')).ok);
  check('邀请码步骤打开', await mobile.waitForText('找到你的跑团'));
  check('填入后台生成的邀请码', (await mobile.setPlaceholder('例如 KANGFU-2026', code)).ok);
  await mobile.screenshot(MOBILE_OUT, '01-generated-code');
  check('验证后台生成的邀请码', (await mobile.clickButton('验证邀请码')).ok);
  check('生成码验证通过并进入资料', await mobile.waitForText('接下来填写入团资料'));

  check('填写昵称', (await mobile.setPlaceholder('社团里怎么称呼你', '邀请测试')).ok);
  check('选择年级', (await mobile.clickText('高二')).ok);
  check('填写用户名', (await mobile.setPlaceholder('3–20 位小写字母', 'invitetest')).ok);
  await mobile.screenshot(MOBILE_OUT, '02-join-with-generated-code');
  check('提交入团申请', (await mobile.clickButton('提交入团申请')).ok);
  check('进入待审批页', await mobile.waitForText('申请已提交'));
  await mobile.screenshot(MOBILE_OUT, '03-pending-after-generated-code');

  invites = await api('/invites');
  const used = invites.find((item) => item.code === code);
  check('邀请码使用次数加一', used?.usedCount === 1 && used?.remaining === 1, JSON.stringify(used || {}));
  const members = await api('/members');
  const applicant = members.find((member) => member.username === 'invitetest');
  check('共享 API 收到新申请', applicant?.status === 'pending', JSON.stringify(applicant || {}));
  check('申请备注记录生成码', String(applicant?.note || '').includes(code), String(applicant?.note || ''));
  check('新成员共 13 人', members.length === 13, String(members.length));

  await admin.clickNav('/overview');
  await sleep(600);
  await admin.clickNav('/invites');
  check('后台重新打开邀请码页', await admin.waitForText('全部邀请码'));
  await sleep(700);
  check('后台刷新邀请码使用 1 / 2', await admin.waitForText('1 / 2', 9000));
  body = await admin.bodyText();
  check('后台显示邀请码使用 1 / 2', body.includes('1 / 2'), body.slice(0, 260));
  await admin.screenshot(ADMIN_OUT, '03-invite-used');

  const disable = await admin.evaluate('(() => { const row=[...document.querySelectorAll("tr")].find((tr)=>tr.innerText.includes(' + JSON.stringify(code) + ')); if(!row) return {ok:false}; const btn=[...row.querySelectorAll("button")].find((b)=>(b.innerText||"").trim()==="停用"); if(!btn) return {ok:false,buttons:[...row.querySelectorAll("button")].map((b)=>b.innerText)}; btn.click(); return {ok:true}; })()');
  check('点击停用生成码', disable.ok, JSON.stringify(disable));
  check('停用确认弹窗打开', await admin.waitForText('停用后，这个邀请码不能再被使用'));
  await admin.screenshot(ADMIN_OUT, '04-disable-dialog');
  check('确认停用邀请码', (await admin.clickButton('停用邀请码')).ok);
  check('停用 toast 出现', await admin.waitForText('已停用。'));
  await sleep(600);
  invites = await api('/invites');
  const disabled = invites.find((item) => item.code === code);
  check('API 邀请码变为停用', disabled?.status === 'disabled', JSON.stringify(disabled || {}));
  await admin.screenshot(ADMIN_OUT, '05-invite-disabled');

  await mobile.clickButton('返回登录');
  check('手机端回到登录页', await mobile.waitForText('先入团'));
  await mobile.clickText('我有邀请码');
  await mobile.waitForText('找到你的跑团');
  await mobile.setPlaceholder('例如 KANGFU-2026', code);
  check('再次验证已停用邀请码', (await mobile.clickButton('验证邀请码')).ok);
  check('手机端提示邀请码已停用', await mobile.waitForText('这个邀请码已停用'));
  await mobile.screenshot(MOBILE_OUT, '04-disabled-code-error');

  await api('/reset', { method: 'POST' });
  const restoredInvites = await api('/invites');
  const restoredMembers = await api('/members');
  check('测试结束恢复 4 个邀请码', restoredInvites.length === 4, String(restoredInvites.length));
  check('测试结束恢复 12 名成员', restoredMembers.length === 12, String(restoredMembers.length));
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
