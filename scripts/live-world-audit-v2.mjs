import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const AUDIT_REVISION='current-world-contract-v2-commerce';
const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const tileSource=fs.readFileSync(new URL('../src/environment/tile-registry.js',import.meta.url),'utf8');
const worldSource=fs.readFileSync(new URL('../src/environment/world-map.js',import.meta.url),'utf8');
const expectedRegistry=tileSource.match(/KELO_TILE_REGISTRY\s*=\s*Object\.freeze\(\{\s*version:'([^']+)'/)?.[1];
const expectedWorld=worldSource.match(/KELO_WORLD_AUDIT=\{version:'([^']+)'/)?.[1];
if(!expectedRegistry||!expectedWorld)throw new Error('Could not resolve current world contract versions from source');
const expectedGrassHash=createHash('sha256').update(fs.readFileSync(new URL('../assets/grass-variation-v1.png',import.meta.url))).digest('hex');
fs.mkdirSync('artifacts',{recursive:true});

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});
await page.route(/\/src\/environment\/.*\.js/,route=>{const u=new URL(route.request().url());u.searchParams.set('audit-bust',`${Date.now()}-${Math.random()}`);route.continue({url:u.toString()});});

let state=null;
for(let attempt=1;attempt<=8;attempt++){
  consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
  await page.goto(`${base}?world-current-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:60000});
  await page.waitForTimeout(2500);
  state=await page.evaluate(()=>({
    title:document.title,
    world:window.KELO_WORLD_AUDIT||null,
    registry:window.KELO_TILE_REGISTRY||null,
    plaza:window.KELO_PLAZA_AUDIT||null,
    tileset:window.KELO_PLAZA_TILESET||null,
    generic:window.KELO_GENERIC_PROP_AUDIT||null,
    rural:window.KELO_RURAL_GROUND_AUDIT||null,
    layers:window.KELO_ENVIRONMENT_LAYER_AUDIT||null,
    architecture:window.KELO_ARCHITECTURE_RENDERER||null,
    prefab:window.KELO_PREFAB_CONTRACT||null,
    kiosk:window.KELO_LUXE_KIOSK||null,
    market:window.KELO_MARKET_PAVILION||null,
    canvas:(()=>{const c=document.getElementById('game-canvas');return c?{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}:null})()
  }));
  const prefabs=state?.prefab?.prefabs||[];
  const west=prefabs.find(p=>p.id==='commerce-arcade-west-south');
  const east=prefabs.find(p=>p.id==='commerce-arcade-east-south');
  const ready=state?.registry?.version===expectedRegistry&&state?.world?.version===expectedWorld&&state?.world?.ready&&state?.architecture?.ready&&west&&east;
  if(ready)break;
  await page.waitForTimeout(5000);
}

if(!state)throw new Error('LIVE state unavailable');
const prefabs=state.prefab?.prefabs||[];
const west=prefabs.find(p=>p.id==='commerce-arcade-west-south');
const east=prefabs.find(p=>p.id==='commerce-arcade-east-south');
const nature=state.registry?.atlases?.plazaNature;
const natureProps=state.registry?.plazaNatureProps||[];
const architectureAssets=state.registry?.architectureAssets||{};
const architecturePrefabs=state.registry?.architecturePrefabs||{};
const grassSrc=state.registry?.atlases?.grassVariation?.src||'';
const grassResponse=await page.request.get(new URL(grassSrc,base).href);
const grassBytes=Buffer.from(await grassResponse.body());
const grassHash=createHash('sha256').update(grassBytes).digest('hex');
const westResponse=await page.request.get(new URL(architectureAssets.commerceArcadeWest?.src||'',base).href);
const eastResponse=await page.request.get(new URL(architectureAssets.commerceArcadeEast?.src||'',base).href);

async function capture(name,x,y){
  const data=await page.evaluate(({x,y})=>{
    const c=document.getElementById('game-canvas');
    if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
    localPlayer.x=x;localPlayer.y=y;camera.x=x;camera.y=y;camera.targetX=x;camera.targetY=y;render();
    return c.toDataURL('image/png');
  },{x,y});
  if(!data?.startsWith('data:image/png;base64,'))throw new Error(`Could not capture ${name}`);
  fs.writeFileSync(`artifacts/${name}.png`,Buffer.from(data.split(',')[1],'base64'));
}
await capture('live-commerce-west',2040,1824);
await capture('live-commerce-east',2668,1824);
await capture('live-commerce-center',2352,1664);
await page.screenshot({path:'artifacts/live-mobile-current.png',fullPage:false});

const report={
  auditRevision:AUDIT_REVISION,expectedRegistry,expectedWorld,state:{
    registryVersion:state.registry?.version,worldVersion:state.world?.version,worldReady:state.world?.ready,
    architectureVersion:state.architecture?.version,architectureReady:state.architecture?.ready,prefabCount:state.architecture?.prefabCount,
    contractPrefabCount:prefabs.length,natureFrameMode:nature?.frameMode,naturePropCount:natureProps.length,
    genericReady:state.generic?.ready,genericFailed:state.generic?.failed,ruralReady:state.rural?.ready,
    canvas:state.canvas,marketDisabled:state.market?.disabled,kioskReady:state.kiosk?.ready
  },
  commerce:{west,east,assetWest:architectureAssets.commerceArcadeWest,assetEast:architectureAssets.commerceArcadeEast,registryPrefabKeys:Object.keys(architecturePrefabs)},
  resources:{grassStatus:grassResponse.status(),grassHash,expectedGrassHash,westStatus:westResponse.status(),eastStatus:eastResponse.status()},
  consoleErrors,failedRequests,httpErrors
};
fs.writeFileSync('artifacts/current-world-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();

if(state.canvas?.cssWidth!==390||state.canvas?.cssHeight!==844)throw new Error(`bad mobile viewport ${JSON.stringify(state.canvas)}`);
if(state.registry?.version!==expectedRegistry)throw new Error(`Registry mismatch ${state.registry?.version} !== ${expectedRegistry}`);
if(state.world?.version!==expectedWorld||!state.world?.ready)throw new Error(`World contract not ready ${state.world?.version}`);
if(!state.plaza?.ready||!state.plaza?.groundAssetLoaded||state.plaza?.fallbackActive)throw new Error('Authored Plaza ground unavailable');
if(state.tileset?.sourceMode!=='authored-raster-ground-v1'||state.tileset?.authoredGround!==true)throw new Error('Plaza raster ground is not authoritative');
if(nature?.frameMode!=='irregular'||!nature?.src?.includes('Arboleskelo1.atlas.png')||natureProps.length<20)throw new Error('Current authored irregular nature contract unavailable');
if(!state.generic?.ready||state.generic?.failed)throw new Error('Generic Prop renderer unavailable');
if(!state.rural?.ready)throw new Error('Rural terrain contract unavailable');
if(!state.architecture?.ready||state.architecture?.prefabCount!==prefabs.length||prefabs.length!==Object.keys(architecturePrefabs).length)throw new Error('Architecture/Prefab counts disagree');
if(!architectureAssets.commerceArcadeWest?.src?.includes('commerce-arcade-west-v1.png')||!architectureAssets.commerceArcadeEast?.src?.includes('commerce-arcade-east-v1.png'))throw new Error('Commerce PNG assets not registered');
for(const [label,p,x] of [['west',west,1936],['east',east,2692]]){
  if(!p)throw new Error(`Missing Commerce ${label} prefab`);
  if(p.position?.x!==x||p.position?.y!==1736||p.size?.w!==80||p.size?.h!==216)throw new Error(`Bad Commerce ${label} mobile placement ${JSON.stringify(p)}`);
  if(p.districts?.length!==1||p.districts[0]!=='commerce'||p.priority!==24)throw new Error(`Bad Commerce ${label} district/layer metadata`);
}
if(grassResponse.status()!==200||grassHash!==expectedGrassHash||westResponse.status()!==200||eastResponse.status()!==200)throw new Error(`Authored PNG resource check failed ${JSON.stringify(report.resources)}`);
if(consoleErrors.length||failedRequests.length||httpErrors.length)throw new Error(`LIVE runtime/network errors ${JSON.stringify({consoleErrors,failedRequests,httpErrors})}`);
