import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9226;
const BASE = 'http://127.0.0.1:8090';
const OUTDIR = 'E:/QPTapp/mobile/shots';
const W = 390;
const H = 844;
const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'school', path: '/school' },
  { name: 'run', path: '/run' },
  { name: 'growth', path: '/growth' },
  { name: 'profile', path: '/profile' },
];
mkdirSync(OUTDIR, { recursive: true });

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-pages', 'about:blank',
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
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true });

const results = [];
for (const route of ROUTES) {
  events.length = 0;
  await send('Page.navigate', { url: BASE + route.path });
  await sleep(route.name === 'home' ? 9000 : 4000);
  const metrics = await send('Runtime.evaluate', {
    expression: `(() => {
      const vw = window.innerWidth;
      return {
        vw,
        sw: document.documentElement.scrollWidth,
        text: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 400),
        overflow: [...document.querySelectorAll('body *')].map((el) => {
          const r = el.getBoundingClientRect();
          return { tag: el.tagName.toLowerCase(), w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right) };
        }).filter((r) => r.right > vw + 8 || r.left < -8).length,
      };
    })()`,
    returnByValue: true,
  });
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  const out = OUTDIR + '/' + route.name + '.png';
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  results.push({ name: route.name, path: route.path, out, metrics: metrics.result.value, events: events.slice(0, 5) });
}
console.log(JSON.stringify(results, null, 2));
try { await send('Browser.close'); } catch {}
ws.close(); edge.kill(); await sleep(300); process.exit(0);
