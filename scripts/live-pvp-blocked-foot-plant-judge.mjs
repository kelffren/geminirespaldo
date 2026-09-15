/* KELO-INDEX
 * area: QA / PVP MOVEMENT FEEL
 * owner: live-pvp-blocked-foot-plant-judge
 * keys: PVP MOVEMENT COLLISION BLOCKED FOOT PLANT MOBILE DESKTOP CHROMIUM
 * purpose: compara baseline y candidato cuando hay input sostenido pero el desplazamiento resuelto queda bloqueado
 * online: N/A; harness de presentacion cliente, no muta autoridad ni gameplay persistente
 * do-not: NO gameplay, NO tuning, NO segundo movement owner
 */
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const viewports=[
  {name:'mobile',viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true},
  {name:'desktop',viewport:{width:1440,height:900},deviceScaleFactor:1,isMobile:false,hasTouch:false}
];
const modes=[
  {name:'baseline',query:'blockedPlantV2=0',expectSettled:false},
  {name:'candidate',query:'blockedPlantV2=1',expectSettled:true}
];
const results=[];
try{
  for(const cfg of viewports){
    for(const mode of modes){
      const context=await browser.newContext(cfg);
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
      await page.goto(base+(base.includes('?')?'&':'?')+mode.query+'&offline=1&blocked-plant='+Date.now(),{waitUntil:'domcontentloaded',timeout:45000});
      await page.waitForFunction(()=>!!(window.KeloMovement&&window.KeloInput&&window.KeloRuntimeBootstrap),null,{timeout:15000});
      await page.evaluate(async()=>window.KeloRuntimeBootstrap.ensure());
      await page.waitForFunction(()=>typeof localPlayer!=='undefined'&&!!localPlayer,null,{timeout:15000});
      await page.evaluate(()=>{
        window.__blockedPlantInput=window.KeloInput.after('qa:blocked-plant-input',ctx=>{
          if(!ctx?.input)return;ctx.input.normX=1;ctx.input.normY=0;
        },9999);
      });
      await page.waitForTimeout(180);
      const before=await page.evaluate(()=>({x:localPlayer.x,y:localPlayer.y,frame:localPlayer._visualMotion?.frame??null,on:!!localPlayer._visualMotion?.on}));
      await page.evaluate(()=>{
        window.__blockedPlantAnchor={x:localPlayer.x,y:localPlayer.y};window.__blockedPlantActive=true;
        window.__blockedPlantFreeze=window.KeloMovement.after('qa:blocked-plant-freeze',()=>{
          if(!window.__blockedPlantActive)return;
          localPlayer.x=window.__blockedPlantAnchor.x;localPlayer.y=window.__blockedPlantAnchor.y;
        },15);
      });
      const samples=[];
      const until=Date.now()+170;
      while(Date.now()<until){
        samples.push(await page.evaluate(()=>({
          t:performance.now(),x:localPlayer.x,y:localPlayer.y,frame:localPlayer._visualMotion?.frame??null,
          on:!!localPlayer._visualMotion?.on,audit:window.KELO_MOVEMENT_AUDIT||null
        })));
        await page.waitForTimeout(8);
      }
      const blockedEnd=samples.at(-1);
      await page.evaluate(()=>{window.__blockedPlantActive=false;});
      const releaseStart=await page.evaluate(()=>localPlayer.x);
      await page.waitForTimeout(70);
      const after=await page.evaluate(()=>({x:localPlayer.x,y:localPlayer.y,frame:localPlayer._visualMotion?.frame??null,on:!!localPlayer._visualMotion?.on,audit:window.KELO_MOVEMENT_AUDIT||null}));
      const movedAfterUnblock=Math.abs(after.x-releaseStart);
      const row={viewport:cfg.name,mode:mode.name,before,blockedEnd,movedAfterUnblock,after,pageErrors:errors};
      row.ok=errors.length===0&&movedAfterUnblock>3&&(
        mode.expectSettled
          ? blockedEnd.on===false&&blockedEnd.frame===2&&blockedEnd.audit?.blockedSettled===true
          : blockedEnd.on===true
      );
      results.push(row);
      await context.close();
    }
  }
}finally{await browser.close();}
const baseline=results.filter(r=>r.mode==='baseline');
const candidate=results.filter(r=>r.mode==='candidate');
const improved=baseline.every(r=>r.blockedEnd.on===true)&&candidate.every(r=>r.blockedEnd.on===false&&r.blockedEnd.frame===2&&r.movedAfterUnblock>3);
console.log(JSON.stringify({ok:results.every(r=>r.ok)&&improved,improved,results},null,2));
if(results.some(r=>!r.ok)||!improved)throw new Error('PVP_BLOCKED_FOOT_PLANT_FEEL_FAILED');