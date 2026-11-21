import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9271;
const BASE = 'http://127.0.0.1:8090';
const API = BASE + '/api';
const PROFILE = 'E:/QPTapp/.edge-cdp-auth';
const OUT = 'E:/QPTapp/mobile/shots';

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const checks = [];
const failures = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass: Boolean(pass), detail });
  if (!pass) failures.push(name);
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' | ' + detail : ''));
}
async function resetDemo() {
  const res = await fetch(API + '/reset', { method: 'POST' });
  if (!res.ok) throw new Error('reset failed: ' + res.status);
}

const proc = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + PROFILE,
  'about:blank',
], { stdio: 'ignore' });

let ws;
try {
  let targets = null;
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      if (res.ok) { targets = await res.json(); break; }
    } catch {}
    await sleep(200);
  }
  if (!targets) throw new Error('CDP not ready');
  const page = targets.find((target) => target.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
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
  async function bodyText() {
    return (await evaluate('document.body.innerText')).replace(/\s+/g, ' ').trim();
  }
  async function waitForText(text, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if ((await bodyText()).includes(text)) return true;
      await sleep(220);
    }
    return false;
  }
  function clickText(text) {
    return evaluate('(() => { const norm=(value)=>(value||"").replace(/\\s+/g," ").trim(); const want=' + JSON.stringify(text) + '; const nodes=[...document.querySelectorAll("button,[role=button],[role=tab],div")].filter((node)=>node.getBoundingClientRect().width>0); const target=nodes.reverse().find((node)=>norm(node.innerText).includes(want)); if(!target) return {ok:false,body:document.body.innerText.slice(0,400)}; target.click(); return {ok:true}; })()');
  }
  function clickButton(text) {
    return evaluate('(() => { const norm=(value)=>(value||"").replace(/\\s+/g," ").trim(); const want=' + JSON.stringify(text) + '; const all=[...document.querySelectorAll("[role=button],[role=tab],button")].filter((node)=>node.getBoundingClientRect().width>0); const target=all.find((node)=>norm(node.innerText)===want)||all.find((node)=>norm(node.innerText).includes(want)); if(!target) return {ok:false,buttons:all.map((node)=>norm(node.innerText)).filter(Boolean).slice(0,30)}; target.click(); return {ok:true}; })()');
  }
  function setPlaceholder(placeholder, value) {
    return evaluate('(() => { const want=' + JSON.stringify(placeholder) + '; const el=[...document.querySelectorAll("input,textarea")].find((node)=>(node.placeholder||"").includes(want)); if(!el) return {ok:false}; const proto=el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,"value").set.call(el,' + JSON.stringify(value) + '); el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true})); return {ok:true}; })()');
  }
  async function clickAndClick(first, second) {
    await clickText(first);
    await sleep(300);
    await clickButton(second);
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: BASE });
  await sleep(1800);

  await resetDemo();
  await send('Page.reload');
  await sleep(1600);

  check('登录页出现', await waitForText('先入团，再一起跑。'));
  check('登录页保留密码输入', (await evaluate('document.querySelectorAll("input[type=password]").length')) === 1);
  await screenshot('auth-login');

  await clickText('填入演示账号');
  await sleep(350);
  await clickButton('进入跑团');
  check('演示账号可登录', await waitForText('你好，林小满'));
  await screenshot('auth-home');

  await clickButton('我的');
  check('我的页可打开', await waitForText('一个普通跑者的成长档案。'));
  await clickText('退出登录');
  check('退出登录回登录页', await waitForText('先入团，再一起跑。'));

  await clickText('我有邀请码');
  check('邀请码页出现', await waitForText('找到你的跑团'));
  await setPlaceholder('例如 KANGFU-2026', 'WRONG-0000');
  await clickButton('验证邀请码');
  check('错误邀请码被拦截', await waitForText('邀请码不对'));

  await setPlaceholder('例如 KANGFU-2026', 'KANGFU-2026');
  await clickButton('验证邀请码');
  check('正确邀请码进入资料页', await waitForText('接下来填写入团资料。'));
  check('入团表单不再要求密码', (await evaluate('document.querySelectorAll("input[type=password]").length')) === 0);

  await setPlaceholder('社团里怎么称呼你', '周小满');
  await clickButton('高二');
  await setPlaceholder('3–20 位小写字母、数字或下划线', 'zhouxiaoman');
  await clickButton('提交入团申请');
  check('提交后进入待审批', await waitForText('申请已提交'));
  check('待审批页有手动刷新', await waitForText('手动刷新审批状态'));
  await screenshot('auth-pending');

  const members = await fetch(API + '/members').then((res) => res.json());
  const applicant = members.find((member) => member.name === '周小满');
  check('共享名册出现待审批申请', applicant?.status === 'pending', applicant ? '@' + applicant.username : 'missing');

  check('无 console 错误', events.length === 0, JSON.stringify(events.slice(0, 3)));
  console.log('');
  console.log(checks.filter((item) => item.pass).length + '/' + checks.length + ' checks passed');
  if (failures.length) {
    console.log('FAILED: ' + failures.join(', '));
    process.exitCode = 1;
  }
} finally {
  await resetDemo().catch(() => {});
  if (ws) ws.close();
  proc.kill();
}
