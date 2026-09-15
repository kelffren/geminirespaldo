import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedTitle=process.env.EXPECTED_TITLE||'Kelo World — V6.24';
const expectedWorldVersion=process.env.EXPECTED_WORLD_VERSION||'world-v1.23';
const expectedDistrictProfileVersion=process.env.EXPECTED_DISTRICT_PROFILE_VERSION||'1.2.0';
const expectedRegistryVersion='1.11.1';
const expectedCompositionMode=process.env.EXPECTED_GARDENS_COMPOSITION_MODE||'registry-authored-garden-compositions-v20';
const expectedJoinMode=process.env.EXPECTED_GARDENS_JOIN_MODE||'authored-garden-endcaps-mid-variants-v5';
const expectedGardensMode='authored-organic-garden-overlay-atlas-v2';
const expectedJunctionMode='formal-props-back-t-junction-layer-v1';
fs.mkdirSync('artifacts',{recursive:true});

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
await page.route(/\/src\/environment\/(terrain-contract|world-map|gardens-compositions|gardens-junction-overlay)\.js/,route=>{const u=new URL(route.request().url());u.searchParams.set('audit-bust',`${Date.now()}-${Math.random()}`);route.continue({url:u.toString()});});
await page.route(/\/assets\/gardens-t-junctions-v1\.svg/,route=>{const u=new URL(route.request().url());u.searchParams.set('audit-bust',`${Date.now()}-${Math.random()}`);route.continue({url:u.toString()});});
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

function valid(s){
  const joins=s.joins,comp=s.composition,world=s.world,junction=s.junction,district=s.district;
  const atlasShape=joins&&joins.width===joins.columns*joins.tileWidth&&joins.height===joins.tileHeight&&joins.columns===9;
  return s.title===expectedTitle&&s.registry?.version===expectedRegistryVersion&&atlasShape&&joins.mode===expectedJoinMode&&
    district?.version===expectedDistrictProfileVersion&&district.mode==='data-driven-district-visual-profiles-v3'&&district.profiles?.gardens?.tileOverlayProvider==='garden-compositions-v1'&&
    comp?.ready&&comp.mode===expectedCompositionMode&&comp.joinMode===expectedJoinMode&&comp.auditRevision==='registry-owned-t-atlas-v1'&&comp.tJunctionAtlas==='gardens-t-junctions-v1'&&comp.tJunctionRegistryOwned===true&&comp.tJunctionOrientationCount===4&&comp.compositionCount===11&&comp.fixedPlacementCount===7&&comp.declaredCellCount===41&&comp.navigationConflictFixCount===16&&comp.tJunctionCount===2&&comp.legacyVirtualTJunctions===false&&comp.southeastTJunctionAnchor?.[0]===22&&comp.southeastTJunctionAnchor?.[1]===17&&comp.southwestTJunctionAnchor?.[0]===5&&comp.southwestTJunctionAnchor?.[1]===17&&
    junction?.ready&&junction.assetLoaded&&junction.version==='gardens-junction-layer-v4'&&junction.mode===expectedJunctionMode&&junction.atlasId==='gardens-t-junctions-v1'&&junction.registryOwned===true&&junction.orientationCount===4&&junction.placementCount===2&&junction.legacyVirtualOwnership===false&&junction.layerId==='gardens-t-junctions'&&junction.layerPhase==='props_back'&&
    world?.ready&&world.version===expectedWorldVersion&&world.districtVisualProfileVersion===expectedDistrictProfileVersion&&world.districtSourceMode==='terrain-contract-district-profiles-v2'&&world.districtOverlayMode==='profile-selected-provider-v1'&&world.gardensMode===expectedGardensMode&&world.gardensJoinMode===expectedJoinMode&&world.gardensCompositionMode===expectedCompositionMode&&world.gardensCompositionCount===11&&world.gardensFixedPlacementCount===7&&world.legacyTJunctionSpecialCase===false&&world.gardensLandmarkClearance==='east-fountain-footprint-v1';
}

async function state(){return page.evaluate(()=>({title:document.title,registry:window.KELO_TILE_REGISTRY||null,joins:window.KELO_GARDENS_JOINS||null,composition:window.KELO_GARDENS_COMPOSITION_AUDIT||null,junction:window.KELO_GARDENS_JUNCTION_AUDIT||null,world:window.KELO_WORLD_AUDIT||null,district:window.KELO_DISTRICT_VISUAL_PROFILES||null}));}
async function loadCurrent(url){
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KELO_WORLD_AUDIT?.ready&&window.KELO_GARDENS_COMPOSITION_AUDIT?.ready&&window.KELO_GARDENS_JUNCTION_AUDIT?.ready&&window.KELO_DISTRICT_VISUAL_PROFILES?.version,{timeout:20000});
}
let loaded=false,lastState=null;
for(let attempt=1;attempt<=6;attempt++){
  try{
    await loadCurrent(`${base}?gardens-audit=${Date.now()}-${attempt}`);
    lastState=await state();
    if(valid(lastState)){loaded=true;break;}
    console.log(`contract mismatch attempt ${attempt}: ${JSON.stringify(lastState)}`);
  }catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(5000);
}
if(!loaded){fs.writeFileSync('artifacts/gardens-report.json',JSON.stringify({loaded,lastState,consoleErrors,failedRequests,httpErrors,expected:{expectedTitle,expectedWorldVersion,expectedDistrictProfileVersion,expectedCompositionMode,expectedJoinMode}},null,2));await browser.close();throw new Error(`LIVE never reached current Gardens contract: ${JSON.stringify(lastState)}`);}

consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await loadCurrent(`${base}?gardens-audit=final-${Date.now()}`);
await page.waitForTimeout(1600);
const shot=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');
  if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=1260;localPlayer.y=2680;camera.x=1260;camera.y=2680;camera.targetX=1260;camera.targetY=2680;render();
  return{dataUrl:c.toDataURL('image/png'),canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight},registry:window.KELO_TILE_REGISTRY||null,joins:window.KELO_GARDENS_JOINS||null,composition:window.KELO_GARDENS_COMPOSITION_AUDIT||null,junction:window.KELO_GARDENS_JUNCTION_AUDIT||null,world:window.KELO_WORLD_AUDIT||null,district:window.KELO_DISTRICT_VISUAL_PROFILES||null,landmark:window.KELO_GARDEN_LANDMARK_AUDIT||null};
});
if(shot?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-gardens-marble.png',Buffer.from(shot.dataUrl.split(',')[1],'base64'));
const finalState={title:await page.title(),registry:shot?.registry,joins:shot?.joins,composition:shot?.composition,junction:shot?.junction,world:shot?.world,district:shot?.district};
const report={loaded,finalState,canvas:shot?.canvas,landmark:shot?.landmark,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/gardens-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
if(!shot?.dataUrl?.startsWith('data:image/png;base64,'))throw new Error('Gardens screenshot missing');
if(!valid(finalState))throw new Error(`Final Gardens contract invalid: ${JSON.stringify(finalState)}`);
if(shot.canvas?.cssWidth!==390||shot.canvas?.cssHeight!==844||shot.canvas?.width!==780||shot.canvas?.height!==1688)throw new Error(`Mobile canvas mismatch: ${JSON.stringify(shot.canvas)}`);
if(!shot.landmark?.ready||shot.landmark?.failed)throw new Error(`Gardens landmark invalid: ${JSON.stringify(shot.landmark)}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);