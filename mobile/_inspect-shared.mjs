import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9256;
const BASE = 'http://127.0.0.1:8090';
const OUT = 'E:/QPTapp/mobile/shots/shared-smoke';
mkdirSync(OUT, { recursive: true });
const edge = spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=' + PORT,'--user-data-dir=E:/QPTapp/.edge-cdp-mobile-shared','about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function targets() { for (let i=0;i<60;i++){ try { const r=await fetch('http://127.0.0.1:'+PORT+'/json/list'); if(r.ok) return r.json(); } catch {} await sleep(200);} throw new Error('no cdp'); }
const pages = await targets();
const page = pages.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
let id = 1; const pending = new Map(); const events = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); return; }
  if (m.method === 'Runtime.exceptionThrown') events.push({ kind: 'exception', text: m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text });
  if (m.method === 'Runtime.consoleAPICalled' && ['error','warning'].includes(m.params.type)) events.push({ kind: 'console:'+m.params.type, text: m.params.args.map((a)=>a.value??a.description??a.type).join(' ') });
});
const send = (method, params={}) => { const n=id++; ws.send(JSON.stringify({id:n,method,params})); return new Promise((res,rej)=>pending.set(n,{resolve:res,reject:rej})); };
async function evaluate(expression) { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails) throw new Error(r.exceptionDetails.text+' '+(r.exceptionDetails.exception?.description||'')); return r.result.value; }
async function shot(name) { const s=await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false}); writeFileSync(OUT+'/'+name+'.png',Buffer.from(s.data,'base64')); }
const clickText = (text) => evaluate('(() => { const nodes=[...document.querySelectorAll("button,[role=button],[role=tab],div")].reverse(); const t=nodes.find((n)=>(n.innerText||"").includes('+JSON.stringify(text)+')&&n.getBoundingClientRect().width>0); if(!t) return {ok:false, body:document.body.innerText.slice(0,300)}; t.click(); return {ok:true,text:(t.innerText||"").replace(/\\s+/g," ").trim().slice(0,80)}; })()');
const clickButton = (text) => evaluate('(() => { const norm=(s)=>(s||"").replace(/\\s+/g," ").trim(); const want=' + JSON.stringify(text) + '; const all=[...document.querySelectorAll("[role=button]")].filter((n)=>n.getBoundingClientRect().width>0); const t=all.find((n)=>norm(n.innerText)===want)||all.find((n)=>norm(n.innerText).includes(want)); if(!t) return {ok:false,buttons:all.map(b=>norm(b.innerText)).filter(Boolean).slice(0,14)}; t.click(); return {ok:true,text:norm(t.innerText)}; })()');
const body = async () => (await evaluate('document.body.innerText')).replace(/\s+/g,' ').trim();
async function waitFor(text, timeout=7000) { const s=Date.now(); while(Date.now()-s<timeout){ if((await body()).includes(text)) return true; await sleep(200);} return false; }
async function waitPath(part, timeout=7000) { const s=Date.now(); while(Date.now()-s<timeout){ const p=await evaluate('location.pathname'); if(p.includes(part)) return p; await sleep(200);} return await evaluate('location.pathname'); }
const result = {};
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await send('Page.navigate',{url:BASE+'/'}); await sleep(2200);
result.login = await clickText('填入演示账号'); await sleep(300);
result.enter = await clickText('进入跑团'); await sleep(1500);
result.home = { ready: await waitFor('本周活动'), text: (await body()).slice(0,700) };
await shot('01-home');
result.all = await clickText('全部活动'); await sleep(1000);
result.activitiesPath = await waitPath('/activities');
result.list = { ready: await waitFor('共享演示数据'), text: (await body()).slice(0,1200) };
await shot('02-list');
result.open = await clickButton('校园环湖 5K'); await sleep(1100);
result.detailPath = await waitPath('/activity/act-001');
result.detail = { text: (await body()).slice(0,1400) };
await shot('03-detail-top');
await evaluate('window.scrollTo(0, document.body.scrollHeight)'); await sleep(400);
await shot('04-detail-bottom');
result.profileTab = await clickText('我的'); await sleep(900);
result.profile = { path: await evaluate('location.pathname'), text: (await body()).slice(0,1600) };
await shot('05-profile');
result.mine = await clickText('我的活动'); await sleep(1000);
result.minePath = await waitPath('/my-activities');
result.mineText = (await body()).slice(0,1600);
await shot('06-my-activities');
result.events = events;
writeFileSync(OUT+'/smoke.json', JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
ws.close(); edge.kill();
