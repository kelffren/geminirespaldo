import { chromium } from 'playwright';
const URL=process.env.KELO_URL;
const t0=Date.now();
const log=m=>console.log(`[${Date.now()-t0}ms] ${m}`);
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const page=await (await browser.newContext({
  viewport:{width:390,height:844},isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})).newPage();
const chatGets=[];
page.on('request', req=>{
  const u=req.url();
  if(/kelo-chat|chat-drawer|chat-integration/i.test(u)) chatGets.push(u);
});
await page.goto(URL,{waitUntil:'load',timeout:25000});
const boot=await page.evaluate(()=>({title:document.title,hasLP:!!localPlayer,x:localPlayer&&localPlayer.x}));
log('boot '+JSON.stringify(boot));
if(!boot.hasLP) process.exit(2);

await page.evaluate(()=>{
  const b=document.getElementById('lx-side-menu');
  if(b) b.click();
});
await page.waitForTimeout(300);
await page.evaluate(()=>{
  const chat=document.querySelector('[data-tool="chat"]');
  if(chat) chat.click();
});
await page.waitForTimeout(800);
const after=await Promise.race([
  page.evaluate(()=>({
    chatOpen: document.getElementById('lx-chat-drawer')?.classList.contains('open'),
    premium: !!document.querySelector('#lx-chat-drawer.kc-premium'),
    keloChat: !!window.KeloChatUI,
    scripts: Array.from(document.scripts).map(s=>s.src||'').filter(s=>/chat/i.test(s)),
    x: localPlayer.x,
    loaderText: (document.getElementById('kelo-ml-text')||{}).textContent||'',
    loaderHidden: !document.getElementById('kelo-module-loader') || document.getElementById('kelo-module-loader').hidden
  })),
  new Promise((_,rej)=>setTimeout(()=>rej(new Error('EVAL_TIMEOUT')),2000))
]).catch(e=>{ log('FREEZE '+e.message); return null; });
if(!after){ await browser.close(); process.exit(3); }
log('afterChat '+JSON.stringify({...after, chatGets}));
if(chatGets.length || after.scripts.length || after.keloChat || after.premium){
  console.log('FAIL chat downloaded');
  await browser.close(); process.exit(4);
}
const t=Date.now();
const snap=await Promise.race([
  page.evaluate(()=>({x:localPlayer.x})),
  new Promise((_,rej)=>setTimeout(()=>rej(new Error('EVAL_TIMEOUT')),2000))
]);
log('evalMs '+(Date.now()-t)+' x='+snap.x);
await browser.close();
console.log('PASS chat tap did not download kelo-chat');
process.exit(0);
