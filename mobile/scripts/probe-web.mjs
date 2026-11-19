import { spawn } from 'node:child_process';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9223;
const URL = process.argv[2] || 'http://127.0.0.1:8090/';
const userDataDir = 'E:/QPTapp/.edge-cdp';

const edge = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + userDataDir,
  'about:blank',
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
if (!page) throw new Error('no page target');

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
    events.push({
      kind: 'exception',
      text: d.exception?.description || d.text,
      url: d.url,
      line: d.lineNumber,
      column: d.columnNumber,
      stack: d.stackTrace?.callFrames?.map((f) => f.functionName + ' @ ' + f.url + ':' + (f.lineNumber + 1) + ':' + (f.columnNumber + 1)),
    });
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    events.push({
      kind: 'console:' + msg.params.type,
      text: msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '),
    });
  }
  if (msg.method === 'Log.entryAdded') {
    events.push({ kind: 'log:' + msg.params.entry.level, text: msg.params.entry.text, url: msg.params.entry.url });
  }
});

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Page.navigate', { url: URL });
await sleep(9000);

console.log(JSON.stringify({ url: URL, events }, null, 2));
try { await send('Browser.close'); } catch {}
ws.close();
edge.kill();
await sleep(300);
process.exit(0);
