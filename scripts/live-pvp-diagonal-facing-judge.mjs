/* KELO-INDEX
 * area: QA / PVP MOVEMENT FEEL
 * owner: live-pvp-diagonal-facing-judge
 * keys: PVP MOVEMENT DIAGONAL FACING HYSTERESIS MOBILE DESKTOP CHROMIUM JITTER
 * purpose: mide en navegador real flips visuales de locomocion cerca de 45 grados y confirma respuesta a un giro deliberado
 * online: N/A; solo QA de presentacion cliente, no muta autoridad gameplay
 * do-not: NO gameplay, NO tuning, NO segundo movement owner
 */
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const cases=[
  {name:'mobile',viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true},
  {name:'desktop',viewport:{width:1440,height:900},deviceScaleFactor:1,isMobile:false,hasTouch:false}
];
const results=[];
function flips(rows){let n=0;for(let i=1;i<rows.length;i++)if(rows[i]!==rows[i-1])n++;return n;}
try{
  for(const cfg of cases){
    const context=await browser.newContext(cfg);
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
    await page.goto(base+(base.includes('?')?'&':'?')+'offline=1&diag-facing='+Date.now(),{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(()=>!!(window.KeloMovement&&window.KeloInput&&window.KeloRuntimeBootstrap),null,{timeout:15000});
    await page.evaluate(async()=>window.KeloRuntimeBootstrap.ensure());
    await page.waitForFunction(()=>typeof localPlayer!=='undefined'&&!!localPlayer,null,{timeout:15000});
    await page.evaluate(()=>{
      window.__diagFacingVector={x:1,y:1.13};
      window.__diagFacingHook=window.KeloInput.after('qa:diag-facing',ctx=>{
        const v=window.__diagFacingVector;if(!v||!ctx?.input)return;
        const l=Math.hypot(v.x,v.y)||1;ctx.input.normX=v.x/l;ctx.input.normY=v.y/l;
      },9999);
    });
    const jitter=[];
    for(let i=0;i<16;i++){
      await page.evaluate(v=>{window.__diagFacingVector=v;},i%2===0?{x:1,y:1.13}:{x:1,y:1.17});
      await page.waitForTimeout(42);
      jitter.push(await page.evaluate(()=>localPlayer._visualMotion?.face||null));
    }
    const deliberate=[];
    for(const ratio of [1.12,1.16,1.20,1.24,1.30]){
      await page.evaluate(r=>{window.__diagFacingVector={x:1,y:r};},ratio);
      await page.waitForTimeout(42);
      deliberate.push({ratio,face:await page.evaluate(()=>localPlayer._visualMotion?.face||null)});
    }
    const jitterFlips=flips(jitter);
    const firstDown=deliberate.find(r=>r.face==='down')?.ratio??null;
    const travel=await page.evaluate(()=>({speed:Math.hypot(localPlayer.vx||0,localPlayer.vy||0),audit:window.KELO_MOVEMENT_AUDIT||null}));
    const row={viewport:cfg.name,jitter,jitterFlips,deliberate,firstDown,travel,pageErrors:errors};
    row.ok=errors.length===0&&jitterFlips<=1&&firstDown!=null&&firstDown<=1.24&&travel.speed>20;
    results.push(row);
    await page.evaluate(()=>{if(window.__diagFacingHook)window.KeloInput.unregister(window.__diagFacingHook);window.__diagFacingHook=null;});
    await context.close();
  }
}finally{await browser.close();}
console.log(JSON.stringify({ok:results.every(r=>r.ok),results},null,2));
if(results.some(r=>!r.ok))throw new Error('PVP_DIAGONAL_FACING_FEEL_FAILED');