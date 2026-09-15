/* KELO-INDEX
 * area: QA / PVP CAMERA
 * owner: live-pvp-live-action-camera-judge
 * keys: PVP CAMERA CRITICAL HEALTH HEAL HYSTERESIS MOBILE DESKTOP PERFORMANCE
 * purpose: reproduce composición PvP y FX de vida crítica en navegador real y emitir veredicto independiente
 * online: presentation-only test; manipula HP local únicamente para probar la capa visual
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const OUT=process.env.PVP_CAMERA_OUT||'artifacts/pvp-live-action-camera';
const STRICT=process.env.PVP_CAMERA_STRICT==='1';
fs.mkdirSync(OUT,{recursive:true});

function pct(values,p){if(!values.length)return Infinity;const s=values.slice().sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.max(0,Math.ceil(s.length*p)-1))];}
async function runViewport(browser,name,viewport,isMobile=false){
  const context=await browser.newContext({viewport,deviceScaleFactor:isMobile?2:1,isMobile,hasTouch:isMobile});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e.message||e)));
  const sep=BASE.includes('?')?'&':'?';
  await page.goto(`${BASE}${sep}offline=1&pvp-live-action-camera=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>!!window.KeloRuntimeBootstrap?.ensure,null,{timeout:20000});
  await page.evaluate(async()=>{await window.KeloRuntimeBootstrap.ensure();window.enterPvPWorld();});
  await page.waitForFunction(()=>window.KeloPvPWorld?.state?.combatEnabled===true&&window.KeloPvPVisualCompetitivePass&&window.KeloCamera?.snapshot,null,{timeout:15000});
  await page.evaluate(()=>{const p=localPlayer,d=simulatedPlayers[0];p.x=2860;p.y=700;p.vx=0;p.vy=0;p.maxHp=100;p.hp=100;d.x=3140;d.y=700;d.targetX=d.x;d.targetY=d.y;d.maxHp=500;d.hp=500;window.KeloPvPWorld.setAimWorld({x:d.x,y:d.y},'camera-judge',1);});
  await page.waitForTimeout(450);
  await page.screenshot({path:`${OUT}/${name}-normal.png`,scale:'device'});
  const engaged=await page.evaluate(()=>({camera:window.KeloCamera.snapshot().pvpDirector,visual:window.KeloPvPVisualCompetitivePass.snapshot(),zoom:window.KeloCamera.getEffectiveZoom(),playerScreen:window.KeloCamera.worldToScreen(localPlayer.x,localPlayer.y),enemyScreen:window.KeloCamera.worldToScreen(simulatedPlayers[0].x,simulatedPlayers[0].y)}));
  await page.evaluate(()=>{localPlayer.hp=15;});
  await page.waitForTimeout(320);
  await page.screenshot({path:`${OUT}/${name}-critical15.png`,scale:'device'});
  const critical15=await page.evaluate(()=>({camera:window.KeloCamera.snapshot().pvpDirector,visual:window.KeloPvPVisualCompetitivePass.snapshot(),overlay:(()=>{const e=document.getElementById('kelo-pvp-critical-fx');return{opacity:getComputedStyle(e).opacity,transform:getComputedStyle(e).transform,pointer:getComputedStyle(e).pointerEvents,dataset:e.dataset.critical};})()}));
  await page.evaluate(()=>{localPlayer.hp=5;});
  const frames=[];let last=await page.evaluate(()=>performance.now());
  for(let i=0;i<42;i++){await page.waitForTimeout(16);const r=await page.evaluate(()=>({t:performance.now(),x:camera.x,y:camera.y,intensity:window.KeloPvPVisualCompetitivePass.snapshot().critical.intensity}));frames.push(r);}
  const dts=[];for(let i=1;i<frames.length;i++)dts.push(frames[i].t-frames[i-1].t);
  await page.screenshot({path:`${OUT}/${name}-critical05.png`,scale:'device'});
  const low=await page.evaluate(()=>({camera:window.KeloCamera.snapshot().pvpDirector,visual:window.KeloPvPVisualCompetitivePass.snapshot()}));
  const beforeHeal=low.visual.critical.intensity;
  await page.evaluate(()=>{localPlayer.hp=40;});
  await page.waitForTimeout(110);
  const heal110=await page.evaluate(()=>window.KeloPvPVisualCompetitivePass.snapshot().critical.intensity);
  await page.screenshot({path:`${OUT}/${name}-heal110.png`,scale:'device'});
  await page.waitForTimeout(650);
  const healed=await page.evaluate(()=>({critical:window.KeloPvPVisualCompetitivePass.snapshot().critical,camera:window.KeloCamera.snapshot().pvpDirector}));
  await page.screenshot({path:`${OUT}/${name}-healed.png`,scale:'device'});
  const cfg=critical15.visual.critical.config,camCfg=engaged.camera.config;
  const checks={
    directorEngaged:engaged.camera.state==='ENGAGED',
    enemyVisible:engaged.enemyScreen.x>24&&engaged.enemyScreen.x<viewport.width-24&&engaged.enemyScreen.y>24&&engaged.enemyScreen.y<viewport.height-24,
    playerVisible:engaged.playerScreen.x>24&&engaged.playerScreen.x<viewport.width-24,
    criticalState:critical15.camera.state==='CRITICAL'&&critical15.visual.critical.latched===true,
    peripheralOnly:critical15.overlay.pointer==='none',
    healProgressive:heal110>0.03&&heal110<beforeHeal&&healed.critical.intensity<heal110,
    hysteresis:cfg.enterHp<cfg.exitHp,
    cameraBounded:Math.abs(critical15.camera.zoomFactor-1)<=0.071&&Math.hypot(critical15.camera.offsetScreenX,critical15.camera.offsetScreenY)<=92,
    fxBounded:cfg.edgeShakePx<=2.0&&cfg.maxVignette<=0.66,
    performance:pct(dts,.95)<=20.5&&pct(dts,.99)<=26&&dts.filter(x=>x>33).length===0,
    noErrors:errors.length===0
  };
  const score=Object.values(checks).filter(Boolean).length/Object.keys(checks).length*10;
  await context.close();
  return{name,viewport,engaged,critical15,low,heal:{beforeHeal,heal110,healed},performance:{samples:dts.length,p95:pct(dts,.95),p99:pct(dts,.99),long33:dts.filter(x=>x>33).length},checks,score,errors,config:{critical:cfg,camera:camCfg}};
}

const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
let report;
try{
  const mobile=await runViewport(browser,'mobile-landscape',{width:844,height:390},true);
  const desktop=await runViewport(browser,'desktop',{width:1440,height:900},false);
  const all=[mobile,desktop],score=all.reduce((s,x)=>s+x.score,0)/all.length;
  const hard=all.flatMap(x=>Object.entries(x.checks).filter(([,v])=>!v).map(([k])=>`${x.name}:${k}`));
  const verdict=hard.length?'PIERDE':score>=9?'GANA':'EMPATA';
  report={verdict,score:Number(score.toFixed(2)),hard,mobile,desktop};
  fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2));
  console.log('PVP_LIVE_ACTION_CAMERA_JUDGE');console.log(JSON.stringify(report,null,2));
  if(STRICT&&verdict!=='GANA')process.exitCode=1;
}finally{await browser.close();}
