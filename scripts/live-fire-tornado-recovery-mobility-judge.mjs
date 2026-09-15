/* KELO-INDEX
 * area: QA / PVP CAST RECOVERY MOBILITY
 * owner: browser integration judge only
 * keys: FIRE TORNADO RECOVERY MOVEMENT MOBILE DESKTOP PLAYWRIGHT WINNER CONTINUITY
 * purpose: reproduce movimiento LEFT durante recovery de Fire Tornado y medir control físico/continuidad del winner
 * consumes: KeloPvPWorld, KeloAbilities, KeloPvPCastMovementPrediction, KeloInput
 * online: verifica predicción local con la misma semántica de fase consumible por server
 * do-not: NO production writes, NO gameplay tuning
 */
import fs from 'node:fs';
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
  await page.goto(`${base}?offline=1&fire-tornado-recovery=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.KeloRuntimeBootstrap?.ensure,{timeout:15000});
  await page.evaluate(async()=>{await window.KeloRuntimeBootstrap.ensure();await window.KeloAbilitiesLoader?.ensure?.();await window.KeloPvPWorld?.ensureCombatReady?.();window.enterPvPWorld();});
  await page.waitForFunction(()=>window.KeloPvPWorld?.state?.combatEnabled===true&&window.KeloAbilities?.engine?.castSource,{timeout:10000});
  await page.evaluate(()=>{
    window.__ftRecoveryHook=window.KeloInput.after('ft-recovery-judge:left',ctx=>{if(ctx?.input){ctx.input.normX=-1;ctx.input.normY=0;}},9999);
    localPlayer.x=2860;localPlayer.y=700;localPlayer.vx=0;localPlayer.vy=0;localPlayer.mana=100;
  });
  const cast=await page.evaluate(()=>{
    const def=window.KeloAbilities.registry.getByKey('fire_tornado');
    return {result:window.KeloAbilities.engine.castSource({sourceType:'qa',sourceId:'qa-fire-tornado',definition:def,request:{position:{x:localPlayer.x+100,y:localPlayer.y}}}),x:localPlayer.x,t:performance.now()};
  });
  await page.waitForFunction(()=>{
    const a=window.KELO_PVP_CAST_MOVEMENT_AUDIT;
    return a?.active===true&&a?.phase==='recovery';
  },{timeout:1200,polling:'raf'});
  const sample=await page.evaluate(async()=>{
    const audit0={...window.KELO_PVP_CAST_MOVEMENT_AUDIT},x0=localPlayer.x,t0=performance.now(),frames=[localPlayer.x];
    await new Promise(resolve=>{
      const end=t0+100;
      function step(){frames.push(localPlayer.x);if(performance.now()>=end)resolve();else requestAnimationFrame(step);}requestAnimationFrame(step);
    });
    const t1=performance.now(),x1=localPlayer.x;let maxStep=0;
    for(let i=1;i<frames.length;i++)maxStep=Math.max(maxStep,Math.abs(frames[i]-frames[i-1]));
    return {audit0,x0,x1,t0,t1,frames:frames.length,maxStep,vx:localPlayer.vx};
  });
  const elapsed=sample.t1-sample.t0,dx=sample.x0-sample.x1,velocity=elapsed>0?dx/(elapsed/1000):0;
  const scale=Number(sample.audit0.movementScale);
  const ok=cast.result?.valid!==false&&scale>.775&&scale<.785&&dx>12.5&&dx<18.5&&velocity>125&&velocity<160&&sample.maxStep<4&&errors.length===0;
  const row={viewport:cfg.name,scale:+scale.toFixed(3),elapsedMs:+elapsed.toFixed(2),leftDistancePx:+dx.toFixed(3),observedVelocity:+velocity.toFixed(2),maxFrameStepPx:+sample.maxStep.toFixed(3),sampledFrames:sample.frames,pageErrors:errors,ok};
  results.push(row);
  if(!ok)throw new Error(`FIRE_TORNADO_RECOVERY_WINNER_FAIL:${cfg.name}:${JSON.stringify(row)}`);
  await context.close();
}
await browser.close();
fs.mkdirSync('audit-artifacts',{recursive:true});
fs.writeFileSync('audit-artifacts/fire-tornado-recovery-winner.json',JSON.stringify({ok:true,results},null,2));
console.log(JSON.stringify({ok:true,results},null,2));
