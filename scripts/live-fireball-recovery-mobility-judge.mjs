/* KELO-INDEX
 * area: QA / PVP CAST RECOVERY MOBILITY
 * owner: browser integration judge only
 * keys: FIREBALL RECOVERY REVERSAL MOVEMENT MOBILE DESKTOP PLAYWRIGHT
 * purpose: reproduce un LEFT sostenido durante recovery de Fireball y medir la movilidad física real con la policy phase-aware
 * consumes: KeloPvPWorld, KeloAbilities, KeloPvPCastMovementPrediction, KeloInput
 * do-not: NO production writes, NO gameplay tuning
 */
import { chromium } from 'playwright';
const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const viewports=[
  {name:'mobile-landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:2},
  {name:'desktop',viewport:{width:1440,height:900},isMobile:false,hasTouch:false,deviceScaleFactor:1}
];
const results=[];
for(const cfg of viewports){
  const context=await browser.newContext(cfg),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.goto(`${base}?offline=1&fireball-recovery-mobility=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.KeloRuntimeBootstrap?.ensure,{timeout:15000});
  await page.evaluate(async()=>{await window.KeloRuntimeBootstrap.ensure();await window.KeloAbilitiesLoader?.ensure?.();});
  await page.waitForFunction(()=>window.KeloPvPWorld&&window.KeloAbilities?.hotbar&&window.KeloInput?.after,{timeout:15000});
  await page.evaluate(async()=>{await window.KeloPvPWorld.ensureCombatReady?.();window.enterPvPWorld();});
  await page.waitForFunction(()=>window.KeloPvPWorld?.state?.combatEnabled===true,{timeout:8000});
  const slot=await page.evaluate(()=>{const a=window.KeloAbilities.hotbar.slots||[];return a.findIndex(x=>x?.definition?.key==='fireball');});
  if(slot<0)throw new Error(`FIREBALL_SLOT_MISSING:${cfg.name}`);
  await page.evaluate(()=>{
    window.__fbRecoveryHook=window.KeloInput.after('fb-recovery-judge:left',ctx=>{if(ctx?.input){ctx.input.normX=-1;ctx.input.normY=0;}},9999);
    localPlayer.x=2860;localPlayer.y=700;localPlayer.vx=0;localPlayer.vy=0;
  });
  const cast=await page.evaluate(slot=>({ok:window.KeloPvPWorld.quickCastSlot(slot),x:localPlayer.x,t:performance.now()}),slot);
  await page.waitForFunction(()=>{
    const a=window.KELO_PVP_CAST_MOVEMENT_AUDIT;
    return a?.active===true&&Number(a.movementScale)>=.895;
  },{timeout:900,polling:'raf'});
  const start=await page.evaluate(()=>({x:localPlayer.x,t:performance.now(),audit:{...window.KELO_PVP_CAST_MOVEMENT_AUDIT},vx:localPlayer.vx}));
  await page.waitForTimeout(100);
  const end=await page.evaluate(()=>({x:localPlayer.x,t:performance.now(),audit:{...window.KELO_PVP_CAST_MOVEMENT_AUDIT},vx:localPlayer.vx}));
  const elapsed=end.t-start.t,dx=start.x-end.x,velocity=elapsed>0?dx/(elapsed/1000):0;
  const ok=cast.ok!==false&&Number(start.audit.movementScale)>=.895&&Number(start.audit.movementScale)<=.905&&dx>15&&dx<20&&velocity>150&&errors.length===0;
  const row={viewport:cfg.name,cast,start,end,elapsedMs:+elapsed.toFixed(2),leftDistancePx:+dx.toFixed(3),observedVelocity:+velocity.toFixed(2),pageErrors:errors,ok};
  results.push(row);
  if(!ok)throw new Error(`FIREBALL_RECOVERY_MOBILITY_FAIL:${cfg.name}:${JSON.stringify(row)}`);
  await context.close();
}
await browser.close();
console.log(JSON.stringify({ok:true,results},null,2));
