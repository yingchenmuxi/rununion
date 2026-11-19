import { spawn } from 'node:child_process';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9224;
const URL = process.argv[2] || 'http://127.0.0.1:8090/';
const userDataDir = 'E:/QPTapp/.edge-cdp-inspect';

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + userDataDir, 'about:blank',
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
await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: URL });
await sleep(9000);
const expr = `(() => {
  const vw = window.innerWidth;
  const all = [...document.querySelectorAll('body *')];
  const rows = all.map((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      cls: (el.className && el.className.toString ? el.className.toString() : '').slice(0, 90),
      w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right),
      disp: cs.display, flexDir: cs.flexDirection, align: cs.alignItems,
      widthCss: cs.width, maxWidth: cs.maxWidth,
      style: (el.getAttribute('style') || '').slice(0, 220),
    };
  });
  const root = document.getElementById('root');
  const body = document.body;
  return {
    vw,
    dpr: window.devicePixelRatio,
    body: { w: Math.round(body.getBoundingClientRect().width), disp: getComputedStyle(body).display },
    root: root ? { w: Math.round(root.getBoundingClientRect().width), disp: getComputedStyle(root).display, flexDir: getComputedStyle(root).flexDirection, style: root.getAttribute('style') } : null,
    rootChildren: root ? [...root.children].map((el) => ({ tag: el.tagName.toLowerCase(), w: Math.round(el.getBoundingClientRect().width), disp: getComputedStyle(el).display, flexDir: getComputedStyle(el).flexDirection, style: (el.getAttribute('style') || '').slice(0, 200) })) : [],
    wider: rows.filter((r) => r.w > vw - 1).slice(0, 25),
    top: rows.slice(0, 15),
  };
})()`;
const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
console.log(JSON.stringify(res.result.value, null, 2));
try { await send('Browser.close'); } catch {}
ws.close(); edge.kill(); await sleep(300); process.exit(0);
