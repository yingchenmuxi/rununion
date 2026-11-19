import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9245;
const BASE = 'http://127.0.0.1:5173';
const OUT = 'E:/QPTapp/admin/shots/platform';
mkdirSync(OUT, { recursive: true });
const edge = spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=' + PORT,'--user-data-dir=E:/QPTapp/.edge-cdp-platform-responsive','about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function targets() { for (let i=0;i<60;i++){ try { const r=await fetch('http://127.0.0.1:'+PORT+'/json/list'); if(r.ok) return await r.json(); } catch {} await sleep(200);} throw new Error('CDP not ready'); }
const page = (await targets()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
let id = 1; const pending = new Map(); const events = [];
ws.addEventListener('message', (event) => { const m=JSON.parse(event.data); if(m.id&&pending.has(m.id)){const h=pending.get(m.id);pending.delete(m.id);m.error?h.reject(new Error(JSON.stringify(m.error))):h.resolve(m.result);return;} if(m.method==='Runtime.exceptionThrown'){events.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);} if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error'){events.push(m.params.args.map((a)=>a.value??a.description).join(' '));} });
const send=(method,params={})=>{const n=id++;ws.send(JSON.stringify({id:n,method,params}));return new Promise((resolve,reject)=>pending.set(n,{resolve,reject}));};
const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
const shot=async(name)=>{const r=await send('Page.captureScreenshot',{format:'png',fromSurface:true});writeFileSync(OUT+'/'+name+'.png',Buffer.from(r.data,'base64'));};
const go=async(path)=>{await send('Page.navigate',{url:BASE+path});for(let i=0;i<40;i++){await sleep(150);if(await evaluate('document.body.innerText.trim().length>80&&!!document.querySelector(\'h1\')'))break;}await sleep(600);};
const info=`(() => { const t=document.querySelector('.table-wrap'); const p=document.querySelector('.table-pager'); const r=p?.getBoundingClientRect(); return { h1:(document.querySelector('h1')?.innerText||'').trim(), doc:document.documentElement.scrollWidth, inner:innerWidth, tableClient:t?.clientWidth||0, tableScroll:t?.scrollWidth||0, pager:p?{left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width)}:null }; })()`;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
await go('/login'); await evaluate('localStorage.clear()'); await send('Page.reload'); await sleep(1600);
await evaluate('document.querySelectorAll(".demo-account button")[1]?.click()'); await sleep(300); await evaluate('document.querySelector(".login-submit")?.click()'); await sleep(1900); await go('/platform');
const results=[];
for (const width of [1280,1024]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
  for (const [name,path] of [['users','/platform/users'],['records','/platform/records'],['system','/platform/system']]) {
    await go(path); await sleep(400);
    results.push({ width, name, ...(await evaluate(info)) });
    if ((width===1280&&name==='users')||(width===1024&&name==='system')) await shot('22-responsive-'+width+'-'+name);
  }
}
writeFileSync(OUT+'/responsive-report.json',JSON.stringify({results,events},null,2));
console.log(JSON.stringify({results,events},null,2));
try{await send('Browser.close');}catch{} ws.close(); edge.kill(); await sleep(300); process.exit(0);
