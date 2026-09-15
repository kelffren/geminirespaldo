/* KELO-INDEX
 * area: TEST / PVP / APPEARANCE
 * keys: PVP CAST AIM FACING MOVE DIAGONAL MOBILE DESKTOP PLAYWRIGHT INPUT HOOK
 * hace: mide en Chromium si el sprite conserva aim durante windup/active de una ability mientras el jugador se mueve en diagonal real por KeloInput
 * online: N/A; valida presentación local separada de autoridad y usa la timeline predicha compartida
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const URL=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const OUT=process.env.AUDIT_OUT||'artifacts/pvp-cast-facing-live';
const STRICT=process.env.CAST_FACING_STRICT==='1';
fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={url:URL,strict:STRICT,runs:[],createdAt:new Date().toISOString()};

async function ready(page){
  await page.waitForFunction(()=>window.KeloRuntimeBootstrap&&typeof window.KeloRuntimeBootstrap.ensure==='function',{timeout:30000});
  await page.evaluate(async()=>{await window.KeloRuntimeBootstrap.ensure();});
  await page.waitForFunction(()=>window.KeloPvPWorld&&window.KeloPvPCastMovementPrediction&&window.KeloAbilities&&window.KeloInput&&window.KELO_CHARACTER_APPEARANCE_AUDIT&&typeof window.enterPvPWorld==='function',{timeout:30000});
  await page.evaluate(()=>window.enterPvPWorld());
  await page.waitForFunction(()=>window.KeloPvPWorld&&window.KeloPvPWorld.state.mode==='pvp'&&window.KeloPvPWorld.state.combatEnabled===true,{timeout:8000});
}

async function holdDiagonal(page){
  await page.evaluate(()=>{
    if(window.__castFacingMoveHook&&window.KeloInput)window.KeloInput.unregister(window.__castFacingMoveHook);
    const n=Math.SQRT1_2;
    window.__castFacingMoveHook=window.KeloInput.after('cast-facing-judge:diag',ctx=>{
      if(ctx?.input){ctx.input.normX=n;ctx.input.normY=n;}
      window.KeloInput.combat.setAxes({source:'cast-facing-judge',move:{x:n,y:n,magnitude:1}});
    },9999);
  });
}

async function clearMove(page){
  await page.evaluate(()=>{
    if(window.__castFacingMoveHook&&window.KeloInput)window.KeloInput.unregister(window.__castFacingMoveHook);
    window.__castFacingMoveHook=null;
    if(typeof input!=='undefined'&&input){input.normX=0;input.normY=0;}
    window.KeloInput?.combat?.setAxes({source:'cast-facing-judge',move:{x:0,y:0,magnitude:0}});
  });
}

async function sample(page,label){
  return page.evaluate((label)=>({
    label,
    predictor:{active:!!window.KeloPvPCastMovementPrediction?.active,phase:window.KeloPvPCastMovementPrediction?.phase||null},
    actorFace:localPlayer._face||null,
    movementFace:window.KELO_MOVEMENT_AUDIT?.movementFace||localPlayer._visualMotion?.face||null,
    renderFace:window.KELO_CHARACTER_APPEARANCE_AUDIT?.lastDraw?.face||null,
    faceSource:window.KELO_CHARACTER_APPEARANCE_AUDIT?.lastDraw?.faceSource||null,
    pos:{x:localPlayer.x,y:localPlayer.y},
    visualOn:!!localPlayer._visualMotion?.on,
    movementInput:{x:typeof input!=='undefined'?Number(input.normX)||0:0,y:typeof input!=='undefined'?Number(input.normY)||0:0}
  }),label);
}

async function scenario(label,viewport,hasTouch){
  const context=await browser.newContext({viewport,hasTouch,isMobile:hasTouch,deviceScaleFactor:hasTouch?2:1});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(URL+'?offline=1&cast-facing-audit='+Date.now(),{waitUntil:'domcontentloaded'});
  await ready(page);
  await page.evaluate(()=>{
    localPlayer.x=2860;localPlayer.y=700;localPlayer.vx=0;localPlayer.vy=0;
    window.KeloPvPWorld.setAimWorld({x:2860,y:500},'cast-facing-audit',1);
  });
  await holdDiagonal(page);
  await page.waitForTimeout(140);
  const before=await sample(page,'before-cast');
  await page.evaluate(()=>{
    window.KeloPvPWorld.setAimWorld({x:localPlayer.x,y:localPlayer.y-200},'cast-facing-audit',1);
    window.KeloAbilities.bus.emit('ABILITY_CAST',{abilityKey:'fireball',abilityId:1,actor:localPlayer,actorId:String(localPlayer.id||'local'),direction:{x:0,y:-1},predicted:true});
  });
  await page.waitForTimeout(25);
  const windup=await sample(page,'windup');
  await page.waitForTimeout(65);
  const active=await sample(page,'active-or-boundary');
  await page.waitForTimeout(75);
  const recovery=await sample(page,'recovery');
  await clearMove(page);
  await page.screenshot({path:path.join(OUT,`${label}-cast-facing.png`),fullPage:true});
  const travel=Math.hypot(recovery.pos.x-before.pos.x,recovery.pos.y-before.pos.y);
  report.runs.push({label,viewport,hasTouch,errors,before,windup,active,recovery,travel});
  await context.close();
}

await scenario('mobile',{width:390,height:844},true);
await scenario('desktop',{width:1440,height:900},false);
await browser.close();
fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));

const hardErrors=report.runs.flatMap(r=>r.errors).filter(e=>!/favicon|Failed to load resource/.test(e));
if(hardErrors.length){console.error(hardErrors.join('\n'));process.exit(1);}
for(const run of report.runs){
  if(run.travel<8||!run.before.visualOn)throw new Error('diagonal movement reproduction invalid: '+run.label+' '+JSON.stringify({travel:run.travel,before:run.before}));
  if(!run.windup.predictor.active)throw new Error('cast predictor never became active: '+run.label);
  if(STRICT){
    if(run.windup.predictor.phase!=='windup')throw new Error('expected windup phase: '+run.label+' '+JSON.stringify(run.windup));
    if(run.windup.faceSource!=='combat-aim'||run.windup.renderFace!=='up')throw new Error('windup lost combat aim: '+run.label+' '+JSON.stringify(run.windup));
    if(run.active.predictor.active&&run.active.predictor.phase==='active'&&(run.active.faceSource!=='combat-aim'||run.active.renderFace!=='up'))throw new Error('active lost combat aim: '+run.label+' '+JSON.stringify(run.active));
    if(run.recovery.predictor.active&&run.recovery.predictor.phase==='recovery'&&run.recovery.faceSource!=='movement')throw new Error('recovery should return locomotion facing: '+run.label+' '+JSON.stringify(run.recovery));
  }
}
console.log(JSON.stringify(report,null,2));
console.log('PVP_CAST_FACING_JUDGE_OK strict='+STRICT);
