import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9254;
const BASE = 'http://127.0.0.1:8090';
const OUT = 'E:/QPTapp/mobile/shots';
mkdirSync(OUT, { recursive: true });

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-mobile-knowledge', 'about:blank',
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
const clickText = (text) => evaluate('(() => { const clean = (s) => (s || "").replace(/\\s+/g, ""); const nodes = [...document.querySelectorAll("button,[role=button],[role=tab],div")].reverse(); const target = nodes.find((n) => clean(n.innerText).includes(' + JSON.stringify(text.replace(/\s+/g, '')) + ') && n.getBoundingClientRect().width > 0); if (!target) return { ok: false }; target.click(); return { ok: true, text: (target.innerText || "").replace(/\\s+/g, " ").trim() }; })()');
const clickTestId = (id) => evaluate('(() => { const el = document.querySelector(\'[data-testid="' + id + '"]\'); if (!el) return { ok: false, testids: [...document.querySelectorAll("[data-testid]")].map((n) => n.getAttribute("data-testid")) }; el.click(); return { ok: true }; })()');
const setInputTestId = (id, value) => evaluate('(() => { const el = document.querySelector(\'[data-testid="' + id + '"]\'); if (!el) return { ok: false }; const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, "value")?.set || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; setter.call(el, ' + JSON.stringify(value) + '); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); return { ok: true, value: el.value }; })()');
const bodyText = () => evaluate('document.body.innerText.replace(/\\s+/g, " ").trim()');
const scrollToText = (text) => evaluate('(() => { const target = [...document.querySelectorAll("div")].reverse().find((n) => (n.innerText || "").includes(' + JSON.stringify(text) + ')); if (!target) return { ok: false }; target.scrollIntoView({ block: "center" }); return { ok: true }; })()');
const pageState = () => evaluate('({ path: location.pathname, body: document.body.innerText.replace(/\\s+/g, " ").trim().slice(0, 260) })');

async function waitForText(text, timeout = 5000) {
  for (let i = 0; i < timeout / 200; i++) {
    if ((await bodyText()).includes(text)) return true;
    await sleep(200);
  }
  return false;
}
async function waitForPath(path, timeout = 5000) {
  for (let i = 0; i < timeout / 200; i++) {
    if ((await evaluate('location.pathname')) === path) return true;
    await sleep(200);
  }
  return false;
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: BASE + '/' });
await sleep(1800);

const result = {};
result.loginFill = await evaluate('(() => { const link = [...document.querySelectorAll("div")].reverse().find((n) => (n.innerText || "").includes("填入演示账号")); if (!link) return { ok: false }; link.click(); return { ok: true }; })()');
await sleep(250);
result.loginClick = await clickText('进入跑团');
await sleep(1400);
result.homeHasKnowledge = (await bodyText()).includes('第一次跑 5 公里，怎么不岔气？');
await screenshot('knowledge-00-home-entry');

result.openList = await clickText('去逛逛');
result.listPath = await waitForPath('/knowledge');
result.listReady = await waitForText('跑步知识库');
await sleep(350);
result.listBody = await bodyText();
result.list = {
  title: result.listBody.includes('跑步知识库'),
  total: result.listBody.includes('主题文章 · 9 篇'),
  categories: result.listBody.includes('防伤') && result.listBody.includes('恢复'),
  featured: result.listBody.includes('本周精选') && result.listBody.includes('开始阅读'),
};
await screenshot('knowledge-01-list');

result.searchSet = await setInputTestId('knowledge-search', '岔气');
await waitForText('主题文章 · 1 篇');
await sleep(350);
const searchBody = await bodyText();
result.search = {
  oneResult: searchBody.includes('主题文章 · 1 篇'),
  article: searchBody.includes('第一次跑 5 公里，怎么不岔气？'),
  noOther: !searchBody.includes('跑前 6 分钟热身，比静态拉伸更重要'),
};
await screenshot('knowledge-02-search');

result.clear = await clickText('清空');
await waitForText('主题文章 · 9 篇');
await sleep(300);

result.emptySet = await setInputTestId('knowledge-search', '不存在的关键词');
await waitForText('没有找到相关文章');
await sleep(300);
const emptyBody = await bodyText();
result.empty = {
  title: emptyBody.includes('没有找到相关文章'),
  reset: emptyBody.includes('清空搜索和筛选'),
};
await screenshot('knowledge-02b-empty');
result.emptyReset = await clickText('清空搜索和筛选');
await waitForText('主题文章 · 9 篇');
await sleep(300);

result.category = await clickTestId('category-防伤');
await waitForText('膝盖外侧疼，先别硬撑');
await sleep(300);
const categoryBody = await bodyText();
result.categoryResult = {
  oneResult: categoryBody.includes('主题文章 · 1 篇'),
  knee: categoryBody.includes('膝盖外侧疼，先别硬撑'),
  notBreathing: !categoryBody.includes('第一次跑 5 公里，怎么不岔气？'),
};
await screenshot('knowledge-03-category');

result.allCategory = await clickTestId('category-全部');
await sleep(400);
result.savedMode = await clickTestId('knowledge-mode-saved');
await waitForText('我的收藏 · 3 篇');
await sleep(300);
const savedBody = await bodyText();
result.saved = {
  count: savedBody.includes('我的收藏 · 3 篇'),
  breathing: savedBody.includes('第一次跑 5 公里，怎么不岔气？'),
  easy: savedBody.includes('怎么判断今天跑得够慢？'),
  knee: savedBody.includes('膝盖外侧疼，先别硬撑'),
  noFeatured: !savedBody.includes('本周精选'),
};
await screenshot('knowledge-04-saved');

result.openKnee = await clickTestId('knowledge-open-knee');
result.detailPath = await waitForPath('/knowledge/knee');
result.detailReady = await waitForText('今天就能做');
await sleep(350);
const detailBody = await bodyText();
result.detail = {
  title: detailBody.includes('膝盖外侧疼，先别硬撑'),
  checklist: detailBody.includes('今天就能做'),
  warning: detailBody.includes('注意'),
  savedLabel: detailBody.includes('已收藏（点击取消）'),
  related: detailBody.includes('接着读') && detailBody.includes('休息日也是训练'),
};
await screenshot('knowledge-05-detail');

result.unsave = await clickText('已收藏（点击取消）');
await sleep(350);
result.unsaved = (await bodyText()).includes('收藏这篇');
result.resave = await clickText('收藏这篇');
await sleep(350);
result.resaved = (await bodyText()).includes('已收藏（点击取消）');

await scrollToText('接着读');
await sleep(250);
result.relatedClick = await clickText('休息日也是训练');
result.relatedPath = await waitForPath('/knowledge/rest');
await waitForText('每周至少 1 到 2 天不跑');
await sleep(350);
const relatedBody = await bodyText();
result.relatedDetail = relatedBody.includes('休息日也是训练') && relatedBody.includes('每周至少 1 到 2 天不跑');
await screenshot('knowledge-06-related');

await scrollToText('返回知识库');
await sleep(200);
result.back = await clickText('返回知识库');
result.backPath = await waitForPath('/knowledge');
await waitForText('跑步知识库');
await sleep(350);
result.profileTab = await clickText('我的');
await sleep(800);
await scrollToText('我的服务');
await sleep(250);
const profileBody = await bodyText();
result.profile = {
  path: await evaluate('location.pathname'),
  savedCount: profileBody.includes('收藏了 3 篇训练与康复笔记'),
};
await screenshot('knowledge-07-profile');

result.events = events.slice(0, 30);
writeFileSync(OUT + '/knowledge-report.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
try { await send('Browser.close'); } catch {}
ws.close();
edge.kill();
await sleep(300);
process.exit(0);
