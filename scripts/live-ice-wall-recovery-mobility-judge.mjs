/* KELO-INDEX
 * area: QA / PVP FEEL LIVE
 * owner: browser judge only
 * keys: ICE WALL RECOVERY MOBILITY MOBILE DESKTOP CHROMIUM
 * purpose: observe real Ice Wall recovery locomotion with identical browser trace across variants
 * do-not: NO gameplay writes
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
const URL=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const scenarios=[
  {name:'mobileLandscape',viewport:{width:844,height:390},deviceScaleFactor:2,hasTouch:true},
  {name:'desktop',viewport:{width:1440,height:900},deviceScaleFactor:1,hasTouch:false}
];
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const out=[]; let failure=null;
try{
  for(const sc of scenarios){
    const context=await browser.newContext(sc); const page=await context.newPage(); const errors=[];
    try{
      page.on('pageerror',e=>errors.push(String(e.message||e)));
      await page.goto(`${URL}?offline=1&ice-wall-recovery-judge=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:45000});
      await page.waitForFunction(()=>window.KeloRuntimeBootstrap?.ensure,{timeout:15000});
      await page.evaluate(async()=>{await window.KeloRuntimeBootstrap.ensure();await window.KeloAbilitiesLoader?.ensure?.();});
      await page.waitForFunction(()=>window.KeloPvPWorld&&window.KeloPvPCastMovementPrediction&&window.KeloAbilities?.hotbar,{timeout:15000});
      await page.evaluate(async()=>{
        await window.KeloPvPWorld.ensureCombatReady?.();
        const ice=window.KeloAbilities.registry.getByKey('ice_wall');
        if(!ice) throw new Error('ICE_WALL_DEFINITION_MISSING');
        if(typeof STATE==='undefined'||!STATE) throw new Error('STATE_MISSING');
        const stone=window.KeloAbilities.stones.createAbilityStone('ice_wall','Common',{source:'ice-wall-recovery-judge'});
        STATE.equipped[0]=stone;
        window.KeloAbilities.syncFromWorldState(true);
        window.enterPvPWorld();
      });
      await page.waitForFunction(()=>window.KeloPvPWorld?.state?.combatEnabled===true,{timeout:8000});
      const result=await page.evaluate(async()=>{
        const slots=window.KeloAbilities.hotbar.slots||[];
        const slot=slots.findIndex(s=>s?.definition?.key==='ice_wall');
        if(slot<0) throw new Error('ICE_WALL_SLOT_MISSING_AFTER_TEST_EQUIP');
        window.__iceWallMoveHook=window.KeloInput.after('ice-wall-recovery:move-left',ctx=>{if(ctx?.input){ctx.input.normX=-1;ctx.input.normY=0;}},9999);
        localPlayer.x=2860;localPlayer.y=700;localPlayer.vx=0;localPlayer.vy=0;
        const ok=window.KeloPvPWorld.quickCastSlot(slot);
        if(ok===false) throw new Error('ICE_WALL_CAST_REJECTED');
        const deadline=performance.now()+2500;
        while(performance.now()<deadline){
          const a=window.KELO_PVP_CAST_MOVEMENT_AUDIT;
          if(a?.active&&a.phase==='recovery'&&a.abilityKey==='ice_wall') break;
          await new Promise(requestAnimationFrame);
        }
        const audit=window.KELO_PVP_CAST_MOVEMENT_AUDIT;
        if(!audit?.active||audit.phase!=='recovery'||audit.abilityKey!=='ice_wall') throw new Error('ICE_WALL_RECOVERY_NOT_REACHED');
        const samples=[],x0=localPlayer.x,t0=performance.now();
        while(performance.now()-t0<120){
          await new Promise(requestAnimationFrame);
          const a=window.KELO_PVP_CAST_MOVEMENT_AUDIT||{};
          samples.push({t:performance.now()-t0,x:localPlayer.x,scale:Number(a.movementScale),phase:a.phase,active:!!a.active});
        }
        window.__iceWallMoveHook?.off?.();
        const recoverySamples=samples.filter(s=>s.active&&s.phase==='recovery'&&Number.isFinite(s.scale));
        const xLast=recoverySamples.length?recoverySamples.at(-1).x:x0;
        const duration=recoverySamples.length?recoverySamples.at(-1).t:0;
        const motion=Math.abs(xLast-x0); let maxStep=0;
        for(let i=1;i<recoverySamples.length;i++)maxStep=Math.max(maxStep,Math.abs(recoverySamples[i].x-recoverySamples[i-1].x));
        const velocity=duration>0?motion/(duration/1000):0;
        const scales=recoverySamples.map(s=>s.scale);
        const scale=scales.length?scales.reduce((a,b)=>a+b,0)/scales.length:NaN;
        return {slot,motion:+motion.toFixed(3),durationMs:+duration.toFixed(2),velocity:+velocity.toFixed(2),maxStep:+maxStep.toFixed(3),scale:+scale.toFixed(4),sampleCount:samples.length,recoverySampleCount:recoverySamples.length};
      });
      result.scenario=sc.name; result.errors=errors; result.expectedSpeed=+(185.28*result.scale).toFixed(2); result.speedError=+Math.abs(result.velocity-result.expectedSpeed).toFixed(2);
      if(errors.length) throw new Error(`${sc.name}:PAGE_ERRORS:${errors.join('|')}`);
      if(!(result.scale>=.55&&result.scale<=.81)) throw new Error(`${sc.name}:BAD_SCALE:${result.scale}`);
      if(!(result.recoverySampleCount>=3)) throw new Error(`${sc.name}:TOO_FEW_RECOVERY_SAMPLES:${result.recoverySampleCount}`);
      if(!(result.motion>6)) throw new Error(`${sc.name}:NO_MEANINGFUL_MOTION:${result.motion}`);
      if(!(result.maxStep<8)) throw new Error(`${sc.name}:DISCONTINUITY:${result.maxStep}`);
      if(!(result.speedError<30)) throw new Error(`${sc.name}:SPEED_PARITY:${result.velocity}:${result.expectedSpeed}`);
      out.push(result);
    } catch(error){
      failure={scenario:sc.name,message:String(error?.message||error),pageErrors:errors};
      throw error;
    } finally {await context.close();}
  }
} catch(error){
  failure=failure||{scenario:'unknown',message:String(error?.message||error)};
} finally {await browser.close();}
fs.mkdirSync('audit-artifacts',{recursive:true});
fs.writeFileSync('audit-artifacts/ice-wall-recovery-live.json',JSON.stringify({ok:!failure,scenarios:out,failure},null,2));
console.log(JSON.stringify({ok:!failure,scenarios:out,failure},null,2));
if(failure) throw new Error(`LIVE_ICE_WALL_RECOVERY_MOBILITY_FAIL:${failure.scenario}:${failure.message}`);
console.log('LIVE_ICE_WALL_RECOVERY_MOBILITY_JUDGE_OK');
