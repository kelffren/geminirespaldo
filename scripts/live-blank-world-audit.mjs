import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

function coreReady(s){
  return !!(s?.reset&&s?.rendererReset&&s?.layerAudit?.decorationReset===true&&s?.propAudit?.decorationReset===true&&s?.prefabAudit?.decorationReset===true);
}

let state=null;
for(let attempt=1;attempt<=18;attempt++){
  await page.goto(`${base}?blank-world-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
  await page.waitForTimeout(900);
  state=await page.evaluate(()=>({
    reset:window.KELO_WORLD_DECORATION_RESET===true,
    rendererReset:window.KELO_WORLD_RENDERER?.decorationReset===true,
    layerAudit:window.KELO_ENVIRONMENT_LAYER_AUDIT||null,
    propAudit:window.KELO_GENERIC_PROP_AUDIT||null,
    prefabAudit:window.KELO_PREFAB_AUDIT||null,
    legacyWorld:window.KELO_LEGACY_WORLD_DRAW_AUDIT||null,
    plaza:window.KELO_PLAZA_AUDIT||null,
    houses:window.KELO_LEGACY_HOUSE_RENDERER?{decorationReset:window.KELO_LEGACY_HOUSE_RENDERER.decorationReset,visibleTitles:window.KELO_LEGACY_HOUSE_RENDERER.visibleTitles,suppressedTitles:window.KELO_LEGACY_HOUSE_RENDERER.suppressedTitles}:null,
    legacyPlaza:window.KELO_LEGACY_PLAZA_AUDIT||null,
    socialWorld:window.KELO_SOCIAL_WORLD_AUDIT||null,
    dummy:window.KELO_TRAINING_DUMMY_AUDIT||null,
    npc:window.KELO_PLAZA_NPC_AUDIT||null,
    minimap:window.KELO_MINIMAP_AUDIT?{decorationReset:window.KELO_MINIMAP_AUDIT.decorationReset,suppressedDuringReset:window.KELO_MINIMAP_AUDIT.suppressedDuringReset}:null
  }));
  if(coreReady(state))break;
  await page.waitForTimeout(8000);
}

const hotspots=[
  {id:'plaza',x:1440,y:1510},
  {id:'farm',x:840,y:1660},
  {id:'houses',x:1680,y:1590}
];
const captures=[];
for(const target of hotspots){
  const shot=await page.evaluate((target)=>{
    const c=document.getElementById('game-canvas');
    if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
    if(typeof input!=='undefined'){input.touchActive=false;input.normX=0;input.normY=0;}
    if(typeof particles!=='undefined'&&Array.isArray(particles))particles.length=0;
    if(window.skillShots&&Array.isArray(window.skillShots))window.skillShots.length=0;
    if(typeof arenaPvP!=='undefined'&&Array.isArray(arenaPvP.projectiles))arenaPvP.projectiles.length=0;
    localPlayer.x=3200;localPlayer.y=2800;localPlayer.vx=0;localPlayer.vy=0;
    camera.x=target.x;camera.y=target.y;camera.targetX=target.x;camera.targetY=target.y;camera.lookOffsetX=0;camera.lookOffsetY=0;
    render();
    const g=c.getContext('2d');
    let white=0,total=0;
    const stride=40;
    for(let y=20;y<c.height-20;y+=stride){
      for(let x=20;x<c.width-20;x+=stride){
        const p=g.getImageData(x,y,1,1).data;
        total++;
        if(p[0]>=248&&p[1]>=248&&p[2]>=248&&p[3]>=250)white++;
      }
    }
    const center=Array.from(g.getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data);
    return {
      id:target.id,
      dataUrl:c.toDataURL('image/png'),
      canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight},
      white,total,whiteRatio:total?white/total:0,center,
      audits:{
        reset:window.KELO_WORLD_DECORATION_RESET===true,
        rendererReset:window.KELO_WORLD_RENDERER?.decorationReset===true,
        layerAudit:window.KELO_ENVIRONMENT_LAYER_AUDIT||null,
        propAudit:window.KELO_GENERIC_PROP_AUDIT||null,
        prefabAudit:window.KELO_PREFAB_AUDIT||null,
        legacyWorld:window.KELO_LEGACY_WORLD_DRAW_AUDIT||null,
        plaza:window.KELO_PLAZA_AUDIT||null,
        houses:window.KELO_LEGACY_HOUSE_RENDERER?{decorationReset:window.KELO_LEGACY_HOUSE_RENDERER.decorationReset,visibleTitles:window.KELO_LEGACY_HOUSE_RENDERER.visibleTitles,suppressedTitles:window.KELO_LEGACY_HOUSE_RENDERER.suppressedTitles}:null,
        legacyPlaza:window.KELO_LEGACY_PLAZA_AUDIT||null,
        socialWorld:window.KELO_SOCIAL_WORLD_AUDIT||null,
        dummy:window.KELO_TRAINING_DUMMY_AUDIT||null,
        npc:window.KELO_PLAZA_NPC_AUDIT||null,
        minimap:window.KELO_MINIMAP_AUDIT?{decorationReset:window.KELO_MINIMAP_AUDIT.decorationReset,suppressedDuringReset:window.KELO_MINIMAP_AUDIT.suppressedDuringReset}:null
      }
    };
  },target);
  if(shot?.dataUrl?.startsWith('data:image/png;base64,')){
    fs.writeFileSync(`artifacts/live-blank-world-${target.id}-390x844.png`,Buffer.from(shot.dataUrl.split(',')[1],'base64'));
  }
  if(shot)delete shot.dataUrl;
  captures.push(shot);
}

const report={state,captures,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/blank-world-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();

if(!coreReady(state))throw new Error(`Blank-world reset flags missing: ${JSON.stringify(state)}`);
if(state.layerAudit?.mode!=='blank-world-decoration-reset-v1'||state.layerAudit?.decorationReset!==true)throw new Error(`Layer reset audit invalid: ${JSON.stringify(state.layerAudit)}`);
if(state.propAudit?.decorationReset!==true||state.propAudit?.registeredColliderCount!==0)throw new Error(`Decorative prop colliders still active: ${JSON.stringify(state.propAudit)}`);
if(state.prefabAudit?.decorationReset!==true||state.prefabAudit?.registeredColliderCount!==0)throw new Error(`Decorative prefab colliders still active: ${JSON.stringify(state.prefabAudit)}`);

for(const shot of captures){
  if(!shot)throw new Error('Blank-world hotspot screenshot missing');
  if(shot.canvas?.cssWidth!==390||shot.canvas?.cssHeight!==844||shot.canvas?.width!==780||shot.canvas?.height!==1688)throw new Error(`Mobile canvas mismatch at ${shot.id}: ${JSON.stringify(shot.canvas)}`);
  if(shot.whiteRatio<0.985)throw new Error(`Legacy world visuals remain at ${shot.id}: whiteRatio=${shot.whiteRatio}`);
}

const a=captures[0]?.audits||state;
if(a.legacyWorld?.decorationReset!==true||!a.legacyWorld?.farmSuppressed||!a.legacyWorld?.plotSuppressed||!a.legacyWorld?.arenaFrameSuppressed||!a.legacyWorld?.simulatedPlayersSuppressed||!a.legacyWorld?.baseObstaclesSuppressed)throw new Error(`Legacy core world draw suppression invalid: ${JSON.stringify(a.legacyWorld)}`);
if(a.plaza?.decorationResetSuppressed!==true)throw new Error(`Authored Plaza ground still allowed during reset: ${JSON.stringify(a.plaza)}`);
if(a.houses?.decorationReset!==true||a.houses?.visibleTitles?.length!==0)throw new Error(`Legacy facades still visible: ${JSON.stringify(a.houses)}`);
if(a.legacyPlaza?.decorationReset!==true||a.legacyPlaza?.drawCount!==0)throw new Error(`Legacy Plaza lamps/fountain still drawing: ${JSON.stringify(a.legacyPlaza)}`);
if(a.socialWorld?.decorationReset!==true||a.socialWorld?.legacyFountainDrawCount!==0)throw new Error(`Legacy social fountain still drawing: ${JSON.stringify(a.socialWorld)}`);
if(a.dummy?.decorationResetSuppressed!==true||a.dummy?.drawCount!==0)throw new Error(`Training dummy still drawing: ${JSON.stringify(a.dummy)}`);
if(a.npc?.decorationResetSuppressed!==true||a.npc?.drawCount!==0)throw new Error(`Plaza NPCs still drawing: ${JSON.stringify(a.npc)}`);
if(a.minimap?.decorationReset!==true||a.minimap?.suppressedDuringReset!==true)throw new Error(`Legacy canvas minimap not reset-guarded: ${JSON.stringify(a.minimap)}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
console.log('BLANK_WORLD_LIVE_OK');