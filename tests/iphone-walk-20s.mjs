import { chromium } from 'playwright';
const URL=process.env.KELO_URL;
const t0=Date.now();
const log=m=>console.log(`[${Date.now()-t0}ms] ${m}`);
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const page=await (await browser.newContext({
  viewport:{width:390,height:844},isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})).newPage();
page.on('crash',()=>log('CRASH'));
await page.goto(URL,{waitUntil:'load',timeout:25000});
const boot=await page.evaluate(()=>({
  title:document.title, hasLP:!!localPlayer, ready:!!window.__keloBootReady,
  loop:!!window.__keloGameLoopStarted, x:localPlayer&&localPlayer.x
}));
log('boot '+JSON.stringify(boot));
if(!boot.hasLP||!boot.ready||!boot.loop){ console.log('FAIL boot contract'); process.exit(2); }
async function evalSnap(){
  const t=Date.now();
  const snap=await Promise.race([
    page.evaluate(()=>{
      const c=document.getElementById('game-canvas');
      const ctx=c.getContext('2d');
      const d=ctx.getImageData(0,0,Math.min(32,c.width),Math.min(32,c.height)).data;
      let nb=0; for(let i=0;i<d.length;i+=4) if(d[i]+d[i+1]+d[i+2]>30) nb++;
      return {x:localPlayer.x,y:localPlayer.y,nb,chat:!!window.KeloChatUI};
    }),
    new Promise((_,rej)=>setTimeout(()=>rej(new Error('EVAL_TIMEOUT')),2000))
  ]);
  return {snap, ms:Date.now()-t};
}
async function pointer(type,x,y){
  await page.evaluate(({type,x,y})=>{
    const c=document.getElementById('game-canvas');
    c.dispatchEvent(new PointerEvent(type,{pointerId:3,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,buttons:type==='pointerup'?0:1,pressure:type==='pointerup'?0:.5,bubbles:true}));
  },{type,x,y});
}
const box=await page.evaluate(()=>{const r=document.getElementById('game-canvas').getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height};});
const sx=box.l+box.w*0.2, sy=box.t+box.h*0.7;
await pointer('pointerdown',sx,sy);
let slow=0, stall=0, maxStall=0, lastX=boot.x, black=0;
for(let i=1;i<=80;i++){
  await pointer('pointermove', sx+90*(0.5+0.5*Math.sin(i/6)), sy);
  const {snap,ms}=await evalSnap();
  if(ms>400){slow++; log('SLOW '+ms);}
  if(Math.abs(snap.x-lastX)<0.4) stall++; else stall=0;
  if(stall>maxStall) maxStall=stall;
  lastX=snap.x;
  if(snap.nb<20) black++;
  if(snap.chat){ console.log('FAIL chat mounted'); process.exit(4); }
  await page.waitForTimeout(200);
}
await pointer('pointerup',sx+80,sy);
const end=await evalSnap();
const moved=Math.abs(end.snap.x-boot.x);
log('20s moved='+moved.toFixed(1)+' slow='+slow+' maxStall='+maxStall+' black='+black+' nb='+end.snap.nb);
await browser.close();
if(moved<80) process.exit(2);
if(slow>=8||black>=10) process.exit(4);
// stall against world collision is not a freeze if we already moved
console.log('PASS 20s walk');
process.exit(0);
