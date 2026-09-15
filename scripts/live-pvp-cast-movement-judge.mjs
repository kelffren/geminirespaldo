/* KELO-INDEX
 * area: QA / PVP CAST MOVEMENT
 * owner: browser integration judge only
 * keys: PVP ABILITY CAST MOVEMENT MOBILE DESKTOP PLAYWRIGHT RUNTIME PREDICTION
 * purpose: verifica en navegador real que un cast con movementScale<1 reduzca movimiento local durante su timeline sin root, error de página ni pérdida de input
 * consumes: KeloPvPWorld, KeloAbilities, KeloPvPCastMovementPrediction, KeloInput
 * do-not: NO production writes, NO gameplay tuning
 */
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const viewports=[
  {name:'mobile',viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2},
  {name:'desktop',viewport:{width:1440,height:900},isMobile:false,hasTouch:false,deviceScaleFactor:1}
];
const results=[];
for(const cfg of viewports){
  const context=await browser.newContext(cfg);
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.goto(`${base}?offline=1&cast-movement-judge=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.KeloRuntimeBootstrap?.ensure,{timeout:15000});
  await page.evaluate(async()=>{await window.KeloRuntimeBootstrap.ensure();await window.KeloAbilitiesLoader?.ensure?.();});
  await page.waitForFunction(()=>window.KeloPvPWorld&&window.KeloPvPCastMovementPrediction&&window.KeloAbilities?.hotbar,{timeout:15000});
  await page.evaluate(async()=>{await window.KeloPvPWorld.ensureCombatReady?.();window.enterPvPWorld();});
  await page.waitForFunction(()=>window.KeloPvPWorld?.state?.combatEnabled===true,{timeout:8000});
  const chosen=await page.evaluate(()=>{
    const slots=window.KeloAbilities.hotbar.slots||[];
    for(let i=0;i<slots.length;i++){const d=slots[i]?.definition,m=d?.action?.movementScale;if(d&&Number.isFinite(Number(m))&&Number(m)<.95)return{slot:i,key:d.key,scale:Number(m),duration:(Number(d.action.windup)||0)+(Number(d.action.active)||0)+(Number(d.action.recovery)||0)};}
    return null;
  });
  if(!chosen)throw new Error(`NO_SLOW_CAST_SLOT:${cfg.name}`);
  await page.evaluate(()=>{
    window.__castJudgeHook=window.KeloInput.after('cast-judge:move-right',ctx=>{if(ctx?.input){ctx.input.normX=1;ctx.input.normY=0;}},9999);
    localPlayer.x=2860;localPlayer.y=700;localPlayer.vx=0;localPlayer.vy=0;
  });
  const baselineStart=await page.evaluate(()=>localPlayer.x);await page.waitForTimeout(240);const baselineEnd=await page.evaluate(()=>localPlayer.x);const baselineDx=baselineEnd-baselineStart;
  await page.evaluate(()=>{localPlayer.x=2860;localPlayer.y=700;localPlayer.vx=0;localPlayer.vy=0;});
  const castStart=await page.evaluate(({slot})=>{const x=localPlayer.x;const ok=window.KeloPvPWorld.quickCastSlot(slot);return{x,ok,t:performance.now()};},chosen);
  await page.waitForFunction(()=>window.KELO_PVP_CAST_MOVEMENT_AUDIT?.active===true,{timeout:700,polling:'raf'});
  const phaseSample=await page.evaluate(()=>({...window.KELO_PVP_CAST_MOVEMENT_AUDIT}));
  await page.waitForTimeout(Math.max(80,Math.min(240,chosen.duration*1000*.8)));
  const castEnd=await page.evaluate(()=>({x:localPlayer.x,audit:{...window.KELO_PVP_CAST_MOVEMENT_AUDIT}}));
  const castDx=castEnd.x-castStart.x,ratio=baselineDx>0?castDx/baselineDx:0;
  const ok=castStart.ok!==false&&baselineDx>10&&ratio>0.15&&ratio<0.97&&phaseSample.active===true&&Number(phaseSample.movementScale)<.95&&errors.length===0;
  results.push({viewport:cfg.name,chosen,baselineDx,castDx,ratio,phaseSample,finalAudit:castEnd.audit,pageErrors:errors,ok});
  if(!ok)throw new Error(`LIVE_CAST_MOVEMENT_FAIL:${cfg.name}:${JSON.stringify(results.at(-1))}`);
  await context.close();
}
await browser.close();
console.log(JSON.stringify({ok:true,results},null,2));
