import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9253;
const BASE = 'http://127.0.0.1:8090';
const OUT = 'E:/QPTapp/mobile/shots';
const IMAGE = 'E:/QPTapp/mobile/shots/run-sync-09-home-records.png';
const CSV = 'E:/QPTapp/mobile/shots/import-test.csv';
mkdirSync(OUT, { recursive: true });

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-mobile-imports', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
const page = targets.find((target) => target.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve);
  ws.addEventListener('error', reject);
});
let nextId = 1;
const pending = new Map();
const events = [];
let chooser = null;
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const handler = pending.get(message.id);
    pending.delete(message.id);
    message.error ? handler.reject(new Error(JSON.stringify(message.error))) : handler.resolve(message.result);
    return;
  }
  if (message.method === 'Page.fileChooserOpened') chooser = message.params;
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
const clickText = (text) => evaluate('(() => { const clean = (s) => (s || "").replace(/\s+/g, ""); const nodes = [...document.querySelectorAll("button,[role=button],[role=tab],div")].reverse(); const target = nodes.find((n) => clean(n.innerText).includes(' + JSON.stringify(text.replace(/\s+/g, '')) + ') && n.getBoundingClientRect().width > 0); if (!target) return { ok: false, buttons: [...document.querySelectorAll("button,[role=button],[role=tab]")].map((b) => (b.innerText || "").trim()).filter(Boolean) }; target.click(); return { ok: true, text: (target.innerText || "").replace(/\s+/g, " ").trim() }; })()');
const setInput = (selector, value) => evaluate('(() => { const el = document.querySelector(' + JSON.stringify(selector) + '); if (!el) return { ok: false }; const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, "value")?.set || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; setter.call(el, ' + JSON.stringify(value) + '); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); return { ok: true, value: el.value }; })()');
const bodyText = () => evaluate('document.body.innerText.replace(/\s+/g, " ").trim()');
const scrollToText = (text) => evaluate('(() => { const target = [...document.querySelectorAll("div")].reverse().find((n) => (n.innerText || "").includes(' + JSON.stringify(text) + ')); if (!target) return { ok: false }; target.scrollIntoView({ block: "center" }); return { ok: true }; })()');
const pageState = () => evaluate('({ path: location.pathname, body: document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 300) })');

async function chooseFile(buttonText, filePath) {
  const click = await clickText(buttonText);
  let nodeId = 0;
  for (let i = 0; i < 40 && !nodeId; i++) {
    await sleep(100);
    const doc = await send('DOM.getDocument', { depth: -1 });
    const found = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file]' });
    nodeId = found.nodeId || 0;
  }
  if (!nodeId) return { click, input: false };
  await send('DOM.setFileInputFiles', { files: [filePath], nodeId });
  return { click, input: true };
}

await send('Page.enable');
await send('Runtime.enable');
await send('DOM.enable');
await send('Page.setInterceptFileChooserDialog', { enabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
try {
  await send('Browser.grantPermissions', { origin: BASE, permissions: ['geolocation'] });
} catch (error) {
  events.push({ kind: 'grant', text: String(error) });
}
await send('Emulation.setGeolocationOverride', { latitude: 39.9, longitude: 116.4, accuracy: 10 });
await send('Page.navigate', { url: BASE + '/' });
await sleep(1800);

const result = { initial: await pageState() };
result.loginFill = await evaluate('(() => { const link = [...document.querySelectorAll("div")].reverse().find((n) => (n.innerText || "").includes("填入演示账号")); if (!link) return { ok: false }; link.click(); return { ok: true }; })()');
await sleep(250);
result.loginClick = await clickText('进入跑团');
await sleep(1200);
result.toRun = await clickText('开跑');
await sleep(700);
result.runPage = await pageState();

// GPS channel: three points about 65 m apart, 7 s between, around 9 m/s.
result.gpsStart = await clickText('开始跑步');
await sleep(1200);
await send('Emulation.setGeolocationOverride', { latitude: 39.9008, longitude: 116.4, accuracy: 10 });
await sleep(9000);
await send('Emulation.setGeolocationOverride', { latitude: 39.9016, longitude: 116.4, accuracy: 10 });
await sleep(9000);
result.gpsTrackingText = (await bodyText()).includes('GPS 记录中');
await screenshot('three-00-gps-tracking');
result.gpsStop = await clickText('结束并保存');
await sleep(700);
const gpsBody = await bodyText();
result.gpsPending = {
  body: gpsBody.includes('本次计时'),
  gps: gpsBody.includes('GPS 已记录'),
  prefilled: await evaluate('document.querySelector(\'input[placeholder="GPS 距离，可修改"]\')?.value || null'),
};
await screenshot('three-01-gps-pending');
result.gpsSave = await clickText('保存本次');
await sleep(600);
result.gpsSaved = (await bodyText()).includes('已记录');

// Screenshot channel: choose an existing PNG, confirm numbers.
await scrollToText('截图导入');
await sleep(250);
result.shotChoose = await chooseFile('选择跑步截图', IMAGE);
await sleep(1200);
const shotBody = await bodyText();
result.shotSelected = { success: shotBody.includes('截图已选好'), preview: await evaluate('!!document.querySelector(\'img[src^="blob:"]\')') };
await screenshot('three-02-screenshot-selected');
result.shotDistance = await setInput('input[placeholder="截图里的距离 km"]', '3.2');
result.shotDuration = await setInput('input[placeholder="截图里的时长 分钟"]', '21');
result.shotNote = await setInput('input[placeholder="备注，如 Keep 5K 完成页（选填）"]', '截图确认');
result.shotSave = await clickText('确认并保存');
await sleep(600);
result.shotSaved = (await bodyText()).includes('来源记为“截图导入”');
await screenshot('three-03-screenshot-saved');

// File channel: import a CSV.
await scrollToText('文件导入');
await sleep(250);
result.fileChoose = await chooseFile('选择轨迹文件', CSV);
await sleep(1200);
const fileBody = await bodyText();
result.fileParsed = {
  loaded: fileBody.includes('已读取 6.40 km'),
  name: fileBody.includes('import-test.csv'),
};
await screenshot('three-04-file-parsed');
result.fileSave = await clickText('确认并保存');
await sleep(600);
result.fileSaved = (await bodyText()).includes('来源记为“文件导入”');
await screenshot('three-05-file-saved');

// Sync and labels.
await clickText('首页');
await sleep(700);
const homeBody = await bodyText();
result.home = {
  weekly: homeBody.includes('28.3'),
  shot: homeBody.includes('截图确认'),
  file: homeBody.includes('导入测试'),
};
await scrollToText('最近记录');
await sleep(250);
await screenshot('three-06-home-records');
result.recentText = (await bodyText()).slice(-900);
await clickText('成长');
await sleep(600);
await scrollToText('最近记录');
await sleep(250);
await screenshot('three-07-growth-records');
result.growth = (await bodyText()).includes('52.0');

result.events = events.slice(0, 30);
writeFileSync(OUT + '/three-channels-report.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
try { await send('Browser.close'); } catch {}
ws.close();
edge.kill();
await sleep(300);
process.exit(0);