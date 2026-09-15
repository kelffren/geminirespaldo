import { chromium } from 'playwright';
const URL = process.env.KELO_URL || 'http://127.0.0.1:8096/?guest=1&v=665-walk';
const t0=Date.now();
const log=m=>console.log(`[${Date.now()-t0}ms] ${m}`);
const browser=await chromium.launch({headless:true, args:['--disable-dev-shm-usage']});
const page=await (await browser.newContext({
  viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})).newPage();
page.on('crash',()=>log('CRASH'));
page.on('pageerror',e=>log('ERR '+String(e.message||e).slice(0,160)));
await page.goto(URL,{waitUntil:'load',timeout:25000});
const boot=await page.evaluate(()=>({
  title:document.title,
  hasLP:!!(typeof localPlayer!=='undefined'&&localPlayer),
  x:localPlayer?localPlayer.x:null,
  y:localPlayer?localPlayer.y:null,
  loader:!!window.KELO_MODULE_LOADER
}));
log('boot '+JSON.stringify(boot));
if(!boot.hasLP){ await browser.close(); process.exit(2); }

async function evalSnap(){
  const t=Date.now();
  const snap=await Promise.race([
    page.evaluate(()=>({x:localPlayer.x,y:localPlayer.y,t:performance.now()})),
    new Promise((_,rej)=>setTimeout(()=>rej(new Error('EVAL_TIMEOUT')),2000))
  ]);
  return {snap, ms:Date.now()-t};
}

async function pointer(type, x, y, extra={}){
  await page.evaluate(({type,x,y,extra})=>{
    const c=document.getElementById('game-canvas');
    if(!c) throw new Error('NO_CANVAS');
    c.dispatchEvent(new PointerEvent(type,{
      pointerId:9, pointerType:'touch', isPrimary:true,
      clientX:x, clientY:y, buttons: type==='pointerup'?0:1,
      pressure: type==='pointerup'?0:.5, bubbles:true, ...extra
    }));
  },{type,x,y,extra});
}

const box=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');
  const r=c.getBoundingClientRect();
  return {w:r.width,h:r.height,left:r.left,top:r.top};
});
const sx=box.left+box.w*0.20, sy=box.top+box.h*0.70;

await pointer('pointerdown', sx, sy);
const samples=[];
let stall=0, maxStall=0, slow=0;
try{
  for(let i=1;i<=40;i++){
    const px=sx + 90*(0.5+0.5*Math.sin(i/5));
    await pointer('pointermove', px, sy);
    const {snap, ms}=await evalSnap();
    samples.push({x:snap.x, ms});
    if(ms>400){ slow++; log('SLOW eval '+ms+'ms x='+snap.x.toFixed(1)); }
    if(samples.length>=2){
      const dx=Math.abs(snap.x-samples[samples.length-2].x);
      if(dx<0.4) stall++; else stall=0;
      if(stall>maxStall) maxStall=stall;
    }
    await page.waitForTimeout(200);
  }
}catch(e){
  log('FREEZE '+e.message);
  await browser.close();
  process.exit(3);
}
await pointer('pointerup', sx+80, sy);
const moved=Math.abs(samples.at(-1).x - samples[0].x);
log('movedX='+moved.toFixed(1)+' maxStall='+maxStall+' slow='+slow+' waiting 10s');
await page.waitForTimeout(10000);
const mid=await evalSnap();
log('afterWait evalMs='+mid.ms+' x='+mid.snap.x.toFixed(1));
const chat=await page.evaluate(()=>({
  premium:!!document.querySelector('#lx-chat-drawer.kc-premium, #lx-chat-tab.kc-chat-tab'),
  loader:!!document.getElementById('kelo-chat-drawer-loader'),
  keloChat:!!window.KeloChatUI
}));
log('chat '+JSON.stringify(chat));
if(chat.premium||chat.loader||chat.keloChat){ console.log('FAIL chat auto-mounted'); process.exit(4); }

if(mid.ms>400){ console.log('FAIL hitch after wait'); process.exit(4); }
await pointer('pointerdown', sx, sy);
const later=[];
for(let i=1;i<=20;i++){
  const px=sx + 90*(0.5+0.5*Math.sin(i/5));
  await pointer('pointermove', px, sy);
  const {snap, ms}=await evalSnap();
  later.push({x:snap.x, ms});
  if(ms>400){ log('SLOW2 '+ms); slow++; }
  await page.waitForTimeout(200);
}
await pointer('pointerup', sx+80, sy);
const moved2=Math.abs(later.at(-1).x - later[0].x);
log('moved2='+moved2.toFixed(1)+' slowTotal='+slow);
await page.screenshot({path:'/workspace/screenshots/v666-walk-later.png', timeout:5000}).catch(()=>{});
await browser.close();
if(moved<40){ console.log('FAIL little movement'); process.exit(2); }
if(moved2<20){ console.log('FAIL freeze after wait'); process.exit(4); }
if(maxStall>=10 || slow>=6){ console.log('FAIL freeze'); process.exit(4); }
console.log('PASS 8s + 10s wait + 4s walk');
process.exit(0);
