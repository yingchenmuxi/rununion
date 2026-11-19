import { spawn } from 'node:child_process';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9231;
const BASE = 'http://127.0.0.1:8090';
const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-direct', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function targets() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/list'); if (r.ok) return await r.json(); } catch {}
    await sleep(200);
  }
  throw new Error('CDP not ready');
}
const list = await targets();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
let id = 1;
const pending = new Map();
const errors = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id); pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); return;
  }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
    errors.push(m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
  }
});
function send(method, params = {}) {
  const n = id++;
  ws.send(JSON.stringify({ id: n, method, params }));
  return new Promise((res, rej) => pending.set(n, { res, rej }));
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true });
  return r.result.value;
}
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
const routes = ['/', '/school', '/run', '/growth', '/profile'];
const report = [];
for (const route of routes) {
  errors.length = 0;
  await send('Page.navigate', { url: BASE + route });
  await sleep(6500);
  const state = await evaluate('(() => { const t = document.body.innerText; return { title: document.title, body: t.slice(0, 120), vw: window.innerWidth, sw: document.documentElement.scrollWidth }; })()');
  report.push({ route, status: state, errors: errors.slice(0, 5) });
}
console.log(JSON.stringify(report, null, 2));
try { await send('Browser.close'); } catch {}
ws.close(); edge.kill(); await sleep(300); process.exit(0);
