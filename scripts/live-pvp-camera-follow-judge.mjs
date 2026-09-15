/* KELO-INDEX
 * area: QA / CAMERA / PVP
 * owner: Camera Foundation CI
 * keys: CAMERA PVP DEADZONE FOLLOW LOOKAHEAD LANDSCAPE DESKTOP PLAYWRIGHT AIM COMPOSITION ACTION STATIONARY
 * purpose: mide en Chromium dead-zone PvP, composición de aim durante strafe y framing hacia objetivo al atacar quieto
 * online: N/A; solo QA de presentación local
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const url=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox']});

async function boot(name,viewport,opts,fn){
  const context=await browser.newContext({viewport,deviceScaleFactor:opts.dpr||1,hasTouch:!!opts.touch,isMobile:!!opts.mobile});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e?.message||e)));
  await page.goto(url+'?pvpCameraFollowAudit=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KeloCamera&&window.KeloPvPWorld&&window.KeloInput&&typeof localPlayer!=='undefined'&&typeof camera!=='undefined'&&typeof input!=='undefined',{timeout:20000});
  await page.waitForTimeout(300);
  const result=await page.evaluate(fn);result.errors=errors;
  await page.screenshot({path:`artifacts/pvp-camera-follow-${name}.png`,fullPage:true});await context.close();return result;
}
const enter=async()=>{await KeloPvPWorld.ensureCombatReady();KeloPvPWorld.enter();let deadline=performance.now()+5000;while(KeloPvPWorld.state.mode!=='pvp'&&performance.now()<deadline)await new Promise(r=>setTimeout(r,25));if(KeloPvPWorld.state.mode!=='pvp')throw new Error('PVP_ENTER_TIMEOUT');};
const deadzoneFn=async()=>{
  await KeloPvPWorld.ensureCombatReady();KeloPvPWorld.enter();let deadline=performance.now()+5000;while(KeloPvPWorld.state.mode!=='pvp'&&performance.now()<deadline)await new Promise(r=>setTimeout(r,25));if(KeloPvPWorld.state.mode!=='pvp')throw new Error('PVP_ENTER_TIMEOUT');
  localPlayer.x=2900;localPlayer.y=720;localPlayer.vx=0;localPlayer.vy=0;input.normX=0;input.normY=0;input.keys.d=false;KeloCamera.setTarget(localPlayer.x,localPlayer.y,{snap:true,source:'pvp-camera-follow-audit'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const start={t:performance.now(),playerX:localPlayer.x,cameraX:camera.x,targetX:camera.targetX,zoom:KeloCamera.getEffectiveZoom(),follow:KeloCamera.getFollowTuning(),legacyDeadRatio:Number(CONFIG.deadXRatio),screenSpaceDeadZone:KeloCamera.snapshot().version.includes('screen-deadzone')};input.keys.d=true;const samples=[];let onset=null;const until=start.t+1800;
  while(performance.now()<until){await new Promise(r=>requestAnimationFrame(r));const t=performance.now()-start.t;const sample={t,playerX:localPlayer.x,cameraX:camera.x,targetX:camera.targetX,lookOffsetX:camera.lookOffsetX,screenOffsetX:(localPlayer.x-camera.x)*KeloCamera.getEffectiveZoom()};samples.push(sample);if(!onset&&Math.abs(camera.targetX-start.targetX)>.5)onset=sample;if(onset&&t>onset.t+220)break;}
  input.keys.d=false;input.normX=0;const semanticPx=innerWidth*start.follow.deadXRatio;const legacyPx=innerWidth*start.legacyDeadRatio*start.zoom;return{viewport:{w:innerWidth,h:innerHeight},start,onset,semanticPx,legacyPx,samples:samples.slice(-12)};
};
const aimFn=async()=>{
  await KeloPvPWorld.ensureCombatReady();KeloPvPWorld.enter();let deadline=performance.now()+5000;while(KeloPvPWorld.state.mode!=='pvp'&&performance.now()<deadline)await new Promise(r=>setTimeout(r,25));if(KeloPvPWorld.state.mode!=='pvp')throw new Error('PVP_ENTER_TIMEOUT');
  localPlayer.x=2900;localPlayer.y=720;localPlayer.vx=0;localPlayer.vy=0;input.normX=0;input.normY=0;input.keys.d=false;KeloCamera.setTarget(localPlayer.x,localPlayer.y,{snap:true,source:'pvp-camera-aim-audit'});
  KeloInput.combat.setAxes({aim:{x:0,y:-1,magnitude:1,source:'audit'},source:'audit'});input.keys.d=true;
  const startPlayer={x:localPlayer.x,y:localPlayer.y};const up=[];for(let i=0;i<36;i++){await new Promise(r=>requestAnimationFrame(r));up.push({x:Number(camera.lookOffsetX)||0,y:Number(camera.lookOffsetY)||0,px:localPlayer.x,py:localPlayer.y,framing:KeloCamera.snapshot().combatFraming});}
  const beforeFlip={x:Number(camera.lookOffsetX)||0,y:Number(camera.lookOffsetY)||0};KeloInput.combat.setAxes({aim:{x:0,y:1,magnitude:1,source:'audit'},source:'audit'});const down=[];let maxStep=0,prev=beforeFlip.y;for(let i=0;i<24;i++){await new Promise(r=>requestAnimationFrame(r));const y=Number(camera.lookOffsetY)||0;maxStep=Math.max(maxStep,Math.abs(y-prev));prev=y;down.push({x:Number(camera.lookOffsetX)||0,y,framing:KeloCamera.snapshot().combatFraming});}
  input.keys.d=false;input.normX=0;const endPlayer={x:localPlayer.x,y:localPlayer.y};return{viewport:{w:innerWidth,h:innerHeight},version:KeloCamera.snapshot().version,weight:KeloCamera.snapshot().combatFraming?.aimPerpWeight,beforeFlip,afterFlip:down.at(-1),maxStep,playerDeltaY:endPlayer.y-startPlayer.y,upTail:up.slice(-6),downTail:down.slice(-6)};
};
const stationaryActionFn=async()=>{
  await KeloPvPWorld.ensureCombatReady();KeloPvPWorld.enter();let deadline=performance.now()+5000;while(KeloPvPWorld.state.mode!=='pvp'&&performance.now()<deadline)await new Promise(r=>setTimeout(r,25));if(KeloPvPWorld.state.mode!=='pvp')throw new Error('PVP_ENTER_TIMEOUT');
  localPlayer.x=2100;localPlayer.y=800;localPlayer.vx=0;localPlayer.vy=0;input.normX=0;input.normY=0;input.keys.a=false;input.keys.d=false;input.keys.w=false;input.keys.s=false;KeloCamera.setTarget(localPlayer.x,localPlayer.y,{snap:true,source:'pvp-camera-stationary-action-audit'});
  KeloInput.combat.setAxes({aim:{x:1,y:0,magnitude:1,source:'audit'},move:{x:0,y:0,magnitude:0,source:'audit'},source:'audit'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const before={cameraX:camera.x,playerX:localPlayer.x,framing:KeloCamera.snapshot().combatFraming};
  const started=KeloPvPWorld.startBasicAttack('camera-audit');const samples=[];let peakLead=0,maxStep=0,prevLead=0,committedFrames=0,recoveryFrames=0;const t0=performance.now();
  while(performance.now()-t0<520){await new Promise(r=>requestAnimationFrame(r));const snap=KeloCamera.snapshot(),framing=snap.combatFraming||{},lead=Number(framing.stationaryActionOffsetScreenX)||0,phase=KeloPvPWorld.state.basicAttack?.phase||null;peakLead=Math.max(peakLead,Math.abs(lead));maxStep=Math.max(maxStep,Math.abs(lead-prevLead));prevLead=lead;if((phase==='windup'||phase==='active')&&framing.stationaryActionActive)committedFrames++;if(phase==='recovery'&&!framing.stationaryActionActive)recoveryFrames++;samples.push({t:performance.now()-t0,cameraX:camera.x,playerX:localPlayer.x,lead,phase,framing});}
  const after=KeloCamera.snapshot().combatFraming;return{viewport:{w:innerWidth,h:innerHeight},started,before,peakLeadPx:peakLead,maxStepPx:maxStep,committedFrames,recoveryFrames,playerDelta:Math.hypot(localPlayer.x-before.playerX,localPlayer.y-800),after,samples,version:KeloCamera.snapshot().version};
};
const landscape=await boot('mobile-landscape',{width:844,height:390},{dpr:2,touch:true,mobile:true},deadzoneFn);
const desktop=await boot('desktop',{width:1440,height:900},{dpr:1},deadzoneFn);
const aimLandscape=await boot('aim-mobile-landscape',{width:844,height:390},{dpr:2,touch:true,mobile:true},aimFn);
const aimDesktop=await boot('aim-desktop',{width:1440,height:900},{dpr:1},aimFn);
const actionLandscape=await boot('action-mobile-landscape',{width:844,height:390},{dpr:2,touch:true,mobile:true},stationaryActionFn);
const actionDesktop=await boot('action-desktop',{width:1440,height:900},{dpr:1},stationaryActionFn);
function deadzoneOk(s){return s.errors.length===0&&!!s.onset&&s.start.screenSpaceDeadZone===true&&Math.abs(s.legacyPx-s.semanticPx)<=0.25;}
function aimOk(s){return s.errors.length===0&&s.version.includes('pvp-aim-composition')&&Number(s.weight)>0&&s.beforeFlip.y<-5&&s.afterFlip.y>5&&s.maxStep<19&&Math.abs(s.playerDeltaY)<0.5;}
function actionOk(s){return s.errors.length===0&&s.started===true&&s.version.includes('stationary-action-framing')&&s.before.framing.stationaryActionActive===false&&s.peakLeadPx>=18&&s.peakLeadPx<=28.5&&s.maxStepPx<8&&s.committedFrames>0&&s.recoveryFrames>0&&s.playerDelta<0.5;}
const report={ok:deadzoneOk(landscape)&&deadzoneOk(desktop)&&aimOk(aimLandscape)&&aimOk(aimDesktop)&&actionOk(actionLandscape)&&actionOk(actionDesktop),landscape,desktop,aimLandscape,aimDesktop,stationaryAction:{mobile:actionLandscape,desktop:actionDesktop}};
fs.writeFileSync('artifacts/pvp-camera-follow-report.json',JSON.stringify(report,null,2));console.log('PVP_CAMERA_FOLLOW_REPORT '+JSON.stringify(report));await browser.close();if(!report.ok)process.exit(1);
