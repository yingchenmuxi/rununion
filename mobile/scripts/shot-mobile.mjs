import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9225;
const URL = process.argv[2] || 'http://127.0.0.1:8090/';
const OUT = process.argv[3] || 'E:/QPTapp/mobile/home-mobile.png';
const W = Number(process.argv[4] || 390);
const H = Number(process.argv[5] || 844);

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-shot', 'about:blank',
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
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
});
function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: W, height: H, deviceScaleFactor: 1, mobile: true,
});
await send('Page.navigate', { url: URL });
await sleep(9000);
const metrics = await send('Runtime.evaluate', {
  expression: `(() => {
    const vw = window.innerWidth;
    const sw = document.documentElement.scrollWidth;
    const bw = document.body.scrollWidth;
    const over = [...document.querySelectorAll('body *')].map((el) => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 50), w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right) };
    }).filter((r) => r.w > vw + 1 || r.right > vw + 1 || r.left < -1).slice(0, 12);
    return { vw, sw, bw, over };
  })()`,
  returnByValue: true,
});
const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
console.log(JSON.stringify({ url: URL, out: OUT, metrics: metrics.result.value }, null, 2));
try { await send('Browser.close'); } catch {}
ws.close(); edge.kill(); await sleep(300); process.exit(0);
