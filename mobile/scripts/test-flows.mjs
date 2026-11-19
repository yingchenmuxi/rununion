import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9229;
const BASE = 'http://127.0.0.1:8090';
const OUT = 'E:/QPTapp/mobile/shots';

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-flows', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve);
  ws.addEventListener('error', reject);
});
let nextId = 1;
const pending = new Map();
const events = [];
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    events.push({ kind: 'exception', text: d.exception?.description || d.text });
  }
  if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
    events.push({ kind: 'console:' + msg.params.type, text: msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ') });
  }
});
function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evalValue(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true });
  return r.result.value;
}
async function clickTab(index) {
  return evalValue('(() => { const tabs = [...document.querySelectorAll(\'[role="tab"]\')]; if (!tabs[' + index + ']) return { ok: false, count: tabs.length }; tabs[' + index + '].click(); return { ok: true }; })()');
}
async function clickText(text, index) {
  return evalValue('(() => { const wanted = ' + JSON.stringify(text) + '; const all = [...document.querySelectorAll("div")].filter((el) => (el.textContent || "").trim() === wanted); const visible = all.filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }); const el = visible[' + String(index || 0) + ']; if (!el) return { ok: false, matches: all.length }; el.click(); return { ok: true, tag: el.tagName, matches: all.length }; })()');
}
async function shot(name) {
  const s = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  writeFileSync(OUT + '/' + name + '.png', Buffer.from(s.data, 'base64'));
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: BASE + '/' });
await sleep(9000);

const report = {};
report.runTab = await clickTab(2);
await sleep(1600);
report.startClick = await clickText('开始跑步');
await sleep(2300);
report.runningText = await evalValue('(() => { const t = document.body.innerText; return { running: t.includes("正在记录"), finishButton: t.includes("结束并保存"), timer: (t.match(/00:0\\d/) || [])[0] || null }; })()');
await shot('run-running');
report.stopClick = await clickText('结束并保存');
await sleep(700);
report.savedText = await evalValue('(() => { const t = document.body.innerText; return { saved: t.includes("本次记录"), zero: t.includes("0.0 km"), demo: t.includes("已保存（演示）") }; })()');
await shot('run-saved');

report.profileTab = await clickTab(4);
await sleep(1600);
report.switchClick = await evalValue('(() => { const el = document.querySelector(\'[role="switch"]\'); if (!el) return { ok: false }; el.click(); return { ok: true }; })()');
await sleep(500);
report.switchText = await evalValue('(() => { const t = document.body.innerText; return { toast: t.includes("已开启同城可见"), body: t.slice(0, 80) }; })()');
await shot('profile-toggle');

report.schoolTab = await clickTab(1);
await sleep(1600);
report.joinClick = await clickText('报名');
await sleep(500);
report.joinText = await evalValue('(() => document.body.innerText.includes("已报名"))()');
await shot('school-joined');
report.events = events.slice(0, 10);
console.log(JSON.stringify(report, null, 2));
try { await send('Browser.close'); } catch {}
ws.close(); edge.kill(); await sleep(300); process.exit(0);
