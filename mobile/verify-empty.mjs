import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9274;
const BASE = 'http://127.0.0.1/';
const OUT = 'E:/QPTapp/mobile/shots/empty-probe';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=E:/QPTapp/.edge-cdp-mobile-empty', 'about:blank',
], { stdio: 'ignore' });
async function targets() {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/list'); if (r.ok) return await r.json(); } catch {}
    await sleep(200);
  }
  throw new Error('CDP not ready');
}
const page = (await targets()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
let id = 1; const pending = new Map(); const errors = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const h = pending.get(m.id); pending.delete(m.id); m.error ? h.reject(new Error(JSON.stringify(m.error))) : h.resolve(m.result); return; }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
});
function send(method, params = {}) { const n = id++; ws.send(JSON.stringify({ id: n, method, params })); return new Promise((res, rej) => pending.set(n, { resolve: res, reject: rej })); }
async function ev(expression) { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
async function text() { return (await ev('document.body.innerText')).replace(/\s+/g, ' ').trim(); }
async function shot(name) { const s = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }); writeFileSync(OUT + '/' + name + '.png', Buffer.from(s.data, 'base64')); }
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: BASE }); await sleep(2500);
const loginText = await text();
await shot('01-login');
await ev(`(() => { const inputs=[...document.querySelectorAll('input')]; const set=(el,v)=>{const s=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value')?.set||Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}; set(inputs[0],'demo'); set(inputs[1],'qingrun123'); const b=[...document.querySelectorAll('div,button')].find(el=>el.innerText==='进入跑团'); b?.click(); return inputs.length; })()`);
await sleep(3500);
const homeText = await text();
await shot('02-home');
await ev(`(() => { const t=[...document.querySelectorAll('div,button,a')].find(el=>el.innerText==='成长'); t?.click(); return !!t; })()`);
await sleep(2500);
const growthText = await text();
await shot('03-growth');
await ev(`(() => { const t=[...document.querySelectorAll('div,button,a')].find(el=>el.innerText==='跑团'); t?.click(); return !!t; })()`);
await sleep(2500);
const clubText = await text();
await shot('04-club');
await ev(`(() => { const t=[...document.querySelectorAll('div,button,a')].find(el=>el.innerText==='我的'); t?.click(); return !!t; })()`);
await sleep(2500);
const profileText = await text();
await shot('05-profile');
console.log('LOGIN::' + loginText.slice(0, 500));
console.log('HOME::' + homeText.slice(0, 1400));
console.log('GROWTH::' + growthText.slice(0, 1800));
console.log('CLUB::' + clubText.slice(0, 1400));
console.log('PROFILE::' + profileText.slice(0, 1400));
console.log('ERRORS::' + JSON.stringify(errors.slice(0, 5)));
try { await send('Browser.close'); } catch {}
browser.kill();
