/* KELO-INDEX
 * area: TEST / PVP / CAMERA
 * keys: PVP CAMERA CAST STRAFE REVERSAL RECOVERY MOBILE DESKTOP PLAYWRIGHT INPUT RAF
 * hace: reproduce cast estacionario -> recovery -> strafe contrario y mide framing residual frame a frame usando el key-state LIVE que processInput consume
 * online: N/A; valida presentación local sobre owners LIVE sin cambiar autoridad gameplay
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const URL=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const OUT=process.env.AUDIT_OUT||'artifacts/pvp-cast-strafe-camera-live';
const STRICT=process.env.CAST_STRAFE_CAMERA_STRICT==='1';
fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={url:URL,strict:STRICT,runs:[],createdAt:new Date().toISOString()};

async function ready(page){
  await page.waitForFunction(()=>window.KeloRuntimeBootstrap&&typeof window.KeloRuntimeBootstrap.ensure==='function',{timeout:30000});
  await page.evaluate(async()=>{await window.KeloRuntimeBootstrap.ensure();});
  await page.waitForFunction(()=>window.KeloPvPWorld&&window.KeloPvPCastMovementPrediction&&window.KeloAbilities&&window.KeloCamera&&window.KeloInput&&typeof window.enterPvPWorld==='function',{timeout:30000});
  await page.evaluate(()=>window.enterPvPWorld());
  await page.waitForFunction(()=>window.KeloPvPWorld?.state?.mode==='pvp'&&window.KeloPvPWorld?.state?.combatEnabled===true,{timeout:8000});
}

async function scenario(label,viewport,hasTouch){
  const context=await browser.newContext({viewport,hasTouch,isMobile:hasTouch,deviceScaleFactor:hasTouch?2:1});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(URL+'?offline=1&cast-strafe-camera-audit='+Date.now(),{waitUntil:'domcontentloaded'});
  await ready(page);
  await page.evaluate(()=>{
    localPlayer.x=2860; localPlayer.y=700; localPlayer.vx=0; localPlayer.vy=0;
    input.normX=0;input.normY=0;input.keys.a=false;input.keys.ArrowLeft=false;
    window.KeloInput.combat.setAxes({source:'cast-strafe-camera-audit',move:{x:0,y:0,magnitude:0}});
    window.KeloPvPWorld.setAimWorld({x:localPlayer.x+240,y:localPlayer.y},'cast-strafe-camera-audit',1);
    window.KeloAbilities.bus.emit('ABILITY_CAST',{abilityKey:'fireball',abilityId:1,actor:localPlayer,actorId:String(localPlayer.id||'local'),direction:{x:1,y:0},predicted:true});
  });
  await page.waitForFunction(()=>window.KeloPvPCastMovementPrediction?.phase==='active',{timeout:1500});
  await page.waitForTimeout(45);
  const peak=await page.evaluate(()=>window.KeloCamera.snapshot().combatFraming.stationaryActionOffsetScreenX);
  await page.waitForFunction(()=>window.KeloPvPCastMovementPrediction?.phase==='recovery',{timeout:1500});

  const trace=await page.evaluate(()=>new Promise(resolve=>{
    const before={t:performance.now(),offset:window.KeloCamera.snapshot().combatFraming.stationaryActionOffsetScreenX,x:localPlayer.x,y:localPlayer.y,phase:window.KeloPvPCastMovementPrediction?.phase,cameraVersion:window.KeloCamera.version};
    // Canonical processInput consumes this key state on the next simulation frame.
    input.keys.ArrowLeft=true;
    const samples=[];
    const start=performance.now();
    function step(){
      const snap=window.KeloCamera.snapshot();
      samples.push({t:performance.now(),offset:snap.combatFraming.stationaryActionOffsetScreenX,x:localPlayer.x,y:localPlayer.y,lookX:snap.lookOffsetX,intentX:snap.combatFraming.intentX,normX:input.normX,castPhase:window.KeloPvPCastMovementPrediction?.phase});
      if(performance.now()-start<260){requestAnimationFrame(step);return;}
      input.keys.ArrowLeft=false;
      resolve({before,samples});
    }
    requestAnimationFrame(step);
  }));

  // Recovery intentionally scales movement (observed ~0.78), so any clear negative
  // normX is accepted intent. Waiting for -1 would skip the exact transition under test.
  const acceptedIndex=trace.samples.findIndex(s=>s.normX < -0.1);
  const accepted=acceptedIndex>=0?trace.samples[acceptedIndex]:null;
  const post=acceptedIndex>=0?trace.samples.slice(acceptedIndex):[];
  const settle=post.find(s=>Math.abs(s.offset)<=4);
  const settleMs=accepted&&settle?settle.t-accepted.t:null;
  let maxStep=0;
  for(let i=1;i<post.length;i++)maxStep=Math.max(maxStep,Math.abs(post[i].offset-post[i-1].offset));
  const last=post.at(-1)||trace.samples.at(-1)||trace.before;
  const travel=Math.hypot(last.x-trace.before.x,last.y-trace.before.y);
  const movedLeft=last.x<trace.before.x;
  await page.screenshot({path:path.join(OUT,`${label}-cast-strafe-camera.png`),fullPage:true});
  report.runs.push({label,viewport,hasTouch,errors,peak,beforeMove:trace.before,acceptedIndex,accepted,samples:trace.samples,settleMs,maxStep,travel,movedLeft});
  await context.close();
}

await scenario('mobile-landscape',{width:844,height:390},true);
await scenario('desktop',{width:1440,height:900},false);
await browser.close();
fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));

const hardErrors=report.runs.flatMap(r=>r.errors).filter(e=>!/favicon|Failed to load resource/.test(e));
if(hardErrors.length){console.error(hardErrors.join('\n'));process.exit(1);}
for(const run of report.runs){
  if(run.peak<8)throw new Error('stationary cast framing did not reproduce: '+run.label+' peak='+run.peak);
  if(run.beforeMove.phase!=='recovery')throw new Error('strafe did not start from recovery: '+run.label);
  if(!(run.accepted?.normX < -0.1))throw new Error('LEFT input was not accepted by processInput: '+run.label);
  if(!run.movedLeft||run.travel<35)throw new Error('LEFT strafe did not resolve physically: '+run.label+' travel='+run.travel);
  if(run.maxStep>8)throw new Error('camera release snaps: '+run.label+' maxStep='+run.maxStep);
  if(STRICT&&(run.settleMs==null||run.settleMs>75))throw new Error('camera carry survives too long into opposite strafe: '+run.label+' settleMs='+run.settleMs);
}
console.log(JSON.stringify(report,null,2));
console.log('PVP_CAST_STRAFE_CAMERA_JUDGE_OK strict='+STRICT);
