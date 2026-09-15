import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedWorld=process.env.EXPECTED_WORLD||'world-v1.4';
const expectedRegistry=process.env.EXPECTED_REGISTRY||'';
const expectedTitle=process.env.EXPECTED_TITLE||'';
const expectedPlaza=process.env.EXPECTED_PLAZA||'';
const expectedArchitectureVersion=process.env.EXPECTED_ARCHITECTURE_VERSION||'';
const expectedArchitectureMode=process.env.EXPECTED_ARCHITECTURE_MODE||'';
const expectedGeneric=(()=>{
  const propSource=fs.readFileSync(new URL('../src/environment/prop-contract.js',import.meta.url),'utf8');
  const genericSource=fs.readFileSync(new URL('../src/environment/generic-props.js',import.meta.url),'utf8');
  const contractVersion=propSource.match(/KELO_PROP_CONTRACT=Object\.freeze\(\{version:'([^']+)'/)?.[1];
  const rendererVersion=genericSource.match(/KELO_GENERIC_PROP_AUDIT=\{version:'([^']+)'/)?.[1];
  const rendererMode=genericSource.match(/rendererMode:'([^']+)'/)?.[1];
  if(!contractVersion||!rendererVersion||!rendererMode)throw new Error('Could not resolve generic prop LIVE contract from source');
  return{contractVersion,rendererVersion,rendererMode};
})();
const expectedMarbleScope=process.env.EXPECTED_MARBLE_SCOPE||(()=>{
  const source=fs.readFileSync(new URL('../src/environment/tile-registry.js',import.meta.url),'utf8');
  const match=source.match(/marbleVariation:Object\.freeze\(\{[^}]*scope:'([^']+)'/);
  if(!match)throw new Error('Could not resolve marble variation scope from TileRegistry');
  return match[1];
})();
const expectedGrassHash=createHash('sha256').update(fs.readFileSync(new URL('../assets/grass-variation-v1.png',import.meta.url))).digest('hex');
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
await page.route(/\/src\/environment\/(tile-registry|world-map|environment-layer-stack|prop-contract|generic-props|rural-ground)\.js/,route=>{const u=new URL(route.request().url());u.searchParams.set('audit-bust',`${Date.now()}-${Math.random()}`);route.continue({url:u.toString()});});
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});
function validDepth(d){
  const frontLayer=d.layers?.layers?.find?.(l=>l.id==='plaza-nature-front');
  const ruralBack=d.layers?.layers?.find?.(l=>l.id==='rural-boundary-back');
  return d.layers?.version==='environment-layer-stack-v2.3'&&d.layers?.mode==='formal-base-back-actor-front-order-v1'&&d.layers?.spatialPolicy==='same-phase-aabb-priority-resolution-v1'&&d.layers?.spatialTieCount===0&&d.layers?.preActorLayerCount>=1&&d.layers?.postActorLayerCount>=1&&frontLayer?.phase==='props_front'&&frontLayer?.timing==='post_actor'&&frontLayer?.priority===10&&ruralBack?.phase==='props_back'&&ruralBack?.timing==='pre_actor'&&ruralBack?.priority===8;
}
let loaded=false;
for(let attempt=1;attempt<=24;attempt++){
  try{
    await page.goto(`${base}?world-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
    const d=await page.evaluate(()=>({title:document.title,world:window.KELO_WORLD_AUDIT||null,plaza:window.KELO_PLAZA_AUDIT||null,tileset:window.KELO_PLAZA_TILESET||null,registry:window.KELO_TILE_REGISTRY||null,architecture:window.KELO_ARCHITECTURE_RENDERER||null,kiosk:window.KELO_LUXE_KIOSK||null,market:window.KELO_MARKET_PAVILION||null,nature:window.KELO_PLAZA_NATURE_AUDIT||null,layers:window.KELO_ENVIRONMENT_LAYER_AUDIT||null,generic:window.KELO_GENERIC_PROP_AUDIT||null,rural:window.KELO_RURAL_GROUND_AUDIT||null}));
    const okTitle=!expectedTitle||d.title===expectedTitle;
    const okPlaza=(!expectedPlaza||d.plaza?.version===expectedPlaza)&&d.plaza?.ready&&d.plaza?.groundAssetLoaded&&d.plaza?.fallbackActive===false&&d.plaza?.worldLayerWrapped===true&&d.plaza?.renderingMode==='authored-plaza-ground-v1'&&d.tileset?.sourceMode==='authored-raster-ground-v1'&&d.tileset?.authoredGround===true;
    const okArch=(!expectedArchitectureVersion||d.architecture?.version===expectedArchitectureVersion)&&(!expectedArchitectureMode||d.architecture?.mode===expectedArchitectureMode);
    const okNature=d.nature?.ready&&d.nature?.assetLoaded&&!d.nature?.failed&&d.nature?.version==='plaza-nature-v3.1'&&d.nature?.propCount===4&&d.nature?.depthMode==='formal-back-front-layer-stack-v1'&&d.nature?.rendererWrapper===false&&d.nature?.layerPriority===10&&d.nature?.precedencePolicy==='nature-before-architecture-on-overlap-v1'&&validDepth(d);
    const okRural=d.generic?.ready&&!d.generic?.failed&&d.generic?.contractVersion===expectedGeneric.contractVersion&&d.generic?.rendererMode===expectedGeneric.rendererMode&&d.generic?.immediateLayerGroupCount===0&&d.generic?.dynamicSourceCount>=1&&d.rural?.ready&&d.rural?.boundaryMode==='environment-layer-stack-props-back-v1'&&d.rural?.immediateBoundaryDraw===false;
    const okCommerce=d.world?.commerceMarbleVariation===true&&d.world?.marbleVariationScope===expectedMarbleScope&&d.registry?.styles?.districtGround?.profiles?.commerce?.marbleVariation===true&&d.registry?.styles?.marbleVariation?.scope===expectedMarbleScope;
    if(okTitle&&okPlaza&&okArch&&okNature&&okRural&&okCommerce&&d.world?.ready&&d.world?.version===expectedWorld&&d.world?.grassVariationAssetLoaded&&d.world?.grassVariationMode==='authored-eight-variant-atlas-v1'&&d.world?.grassVariationCount===8&&d.registry?.version===expectedRegistry&&d.registry?.atlases?.grassVariation?.src?.includes('grass-variation-v1.png')&&d.registry?.atlases?.plazaGround?.src?.includes('plaza-ground-v1.png')&&d.registry?.atlases?.plazaNature?.src?.includes('plaza-nature-v1.svg')&&d.architecture?.prefabCount===1&&d.kiosk?.ready&&d.market?.disabled===true){loaded=true;break;}
  }catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}
consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?world-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(2500);
const state=await page.evaluate(()=>({title:document.title,world:window.KELO_WORLD_AUDIT||null,plaza:window.KELO_PLAZA_AUDIT||null,tileset:window.KELO_PLAZA_TILESET||null,registryVersion:window.KELO_TILE_REGISTRY?.version||null,architectureRenderer:window.KELO_ARCHITECTURE_RENDERER||null,kiosk:window.KELO_LUXE_KIOSK||null,market:window.KELO_MARKET_PAVILION||null,nature:window.KELO_PLAZA_NATURE_AUDIT||null,layers:window.KELO_ENVIRONMENT_LAYER_AUDIT||null,generic:window.KELO_GENERIC_PROP_AUDIT||null,rural:window.KELO_RURAL_GROUND_AUDIT||null,canvas:(()=>{const c=document.getElementById('game-canvas');return c?{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}:null})()}));
await page.screenshot({path:'artifacts/live-mobile.png',fullPage:false});
const plaza=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=1440;localPlayer.y=1520;camera.x=1440;camera.y=1520;camera.targetX=1440;camera.targetY=1520;render();
  const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let ivory=0,gold=0,teal=0;
  for(let i=0;i<px.length;i+=4){const r=px[i],g=px[i+1],b=px[i+2],a=px[i+3];if(a<200)continue;if(r>205&&g>190&&b>155)ivory++;if(r>150&&g>95&&g<205&&b<110)gold++;if(r<90&&g>80&&g<190&&b>75&&b<200)teal++;}
  return{dataUrl:c.toDataURL('image/png'),ivory,gold,teal};
});
if(plaza?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-plaza.png',Buffer.from(plaza.dataUrl.split(',')[1],'base64'));
const grass=await page.evaluate(async()=>{
  const c=document.getElementById('game-canvas');if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=760;localPlayer.y=760;camera.x=760;camera.y=760;camera.targetX=760;camera.targetY=760;render();
  const src=window.KELO_TILE_REGISTRY?.atlases?.grassVariation?.src||null;
  let assetHash=null,assetByteLength=0;
  if(src){
    const response=await fetch(src,{cache:'no-store'});
    const bytes=await response.arrayBuffer();assetByteLength=bytes.byteLength;
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    assetHash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
  }
  const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let opaquePixels=0;const colors=new Set();
  for(let i=0;i<px.length;i+=4){const a=px[i+3];if(a<200)continue;opaquePixels++;if(colors.size<4096)colors.add(`${px[i]},${px[i+1]},${px[i+2]}`);}
  return{dataUrl:c.toDataURL('image/png'),atlasSrc:src,assetHash,assetByteLength,opaquePixels,uniqueOpaqueColors:colors.size};
});
if(grass?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-grass.png',Buffer.from(grass.dataUrl.split(',')[1],'base64'));
const commerce=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=2144;localPlayer.y=1568;camera.x=2144;camera.y=1568;camera.targetX=2144;camera.targetY=1568;render();
  return{dataUrl:c.toDataURL('image/png'),world:window.KELO_WORLD_AUDIT||null,profile:window.KELO_TILE_REGISTRY?.styles?.districtGround?.profiles?.commerce||null,scope:window.KELO_TILE_REGISTRY?.styles?.marbleVariation?.scope||null,canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}};
});
if(commerce?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-commerce-marble.png',Buffer.from(commerce.dataUrl.split(',')[1],'base64'));
const plazaTree=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=1168;localPlayer.y=1406;camera.x=1168;camera.y=1388;camera.targetX=1168;camera.targetY=1388;render();
  return{dataUrl:c.toDataURL('image/png'),nature:window.KELO_PLAZA_NATURE_AUDIT||null,layers:window.KELO_ENVIRONMENT_LAYER_AUDIT||null,registryNature:window.KELO_TILE_REGISTRY?.plazaNatureProps||null};
});
if(plazaTree?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-plaza-tree.png',Buffer.from(plazaTree.dataUrl.split(',')[1],'base64'));
const rural=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  const f=typeof STATE!=='undefined'?STATE.farm:null;if(!f)return null;
  localPlayer.x=f.x+f.w/2;localPlayer.y=f.y-20;camera.x=f.x+f.w/2;camera.y=f.y+f.h/2;camera.targetX=camera.x;camera.targetY=camera.y;render();
  return{dataUrl:c.toDataURL('image/png'),rural:window.KELO_RURAL_GROUND_AUDIT||null,generic:window.KELO_GENERIC_PROP_AUDIT||null,layers:window.KELO_ENVIRONMENT_LAYER_AUDIT||null,canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}};
});
if(rural?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-rural-depth.png',Buffer.from(rural.dataUrl.split(',')[1],'base64'));
const report={loaded,expectedMarbleScope,expectedGrassHash,state,plaza:plaza?{ivory:plaza.ivory,gold:plaza.gold,teal:plaza.teal}:null,grass:grass?{atlasSrc:grass.atlasSrc,assetHash:grass.assetHash,assetByteLength:grass.assetByteLength,opaquePixels:grass.opaquePixels,uniqueOpaqueColors:grass.uniqueOpaqueColors}:null,commerce:commerce?{world:commerce.world,profile:commerce.profile,scope:commerce.scope,canvas:commerce.canvas}:null,plazaTree:plazaTree?{nature:plazaTree.nature,layers:plazaTree.layers,propCount:plazaTree.registryNature?.length||0}:null,rural:rural?{rural:rural.rural,generic:rural.generic,layers:rural.layers,canvas:rural.canvas}:null,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
await browser.close();
if(!loaded)throw new Error(`LIVE never reached current visual contract (marbleScope=${expectedMarbleScope})`);
if(expectedTitle&&state.title!==expectedTitle)throw new Error(`Title mismatch ${state.title} !== ${expectedTitle}`);
if(expectedPlaza&&state.plaza?.version!==expectedPlaza)throw new Error(`Plaza mismatch ${state.plaza?.version} !== ${expectedPlaza}`);
if(!state.plaza?.ready||!state.plaza?.assetLoaded||!state.plaza?.groundAssetLoaded||state.plaza?.fallbackActive||!state.plaza?.worldLayerWrapped||state.plaza?.renderingMode!=='authored-plaza-ground-v1')throw new Error('Authored plaza ground did not become the active world layer');
if(state.plaza?.groundWidth!==800||state.plaza?.groundHeight!==560||state.tileset?.sourceMode!=='authored-raster-ground-v1'||state.tileset?.authoredGround!==true||!state.tileset?.assetPath?.includes('plaza-ground-v1.png'))throw new Error('Authored plaza ground contract invalid');
if(!plaza?.dataUrl?.startsWith('data:image/png;base64,')||plaza.ivory<10000||plaza.gold<100||plaza.teal<10)throw new Error(`Authored plaza materials not visible: ${JSON.stringify(plaza)}`);
if(state.world?.version!==expectedWorld||state.world?.plazaRoadAlignment!=='authored-plaza-ground-v1'||!state.world?.grassVariationAssetLoaded||state.world?.grassVariationCount!==8)throw new Error('World/plaza road alignment contract invalid');
if(state.world?.commerceMarbleVariation!==true||state.world?.marbleVariationScope!==expectedMarbleScope)throw new Error(`Commerce marble contract invalid: ${JSON.stringify(state.world)}`);
if(state.registryVersion!==expectedRegistry)throw new Error(`Registry mismatch ${state.registryVersion} !== ${expectedRegistry}`);
if(state.architectureRenderer?.prefabCount!==1||state.architectureRenderer?.version!==expectedArchitectureVersion||state.architectureRenderer?.mode!==expectedArchitectureMode)throw new Error(`Architecture contract invalid: ${JSON.stringify(state.architectureRenderer)}`);
if(!state.kiosk?.ready||state.kiosk?.failed||state.market?.disabled!==true)throw new Error('Luxe architecture state invalid');
if(!state.nature?.ready||!state.nature?.assetLoaded||state.nature?.failed||state.nature?.propCount!==4||state.nature?.version!=='plaza-nature-v3.1'||state.nature?.depthMode!=='formal-back-front-layer-stack-v1'||state.nature?.rendererWrapper!==false||state.nature?.layerPriority!==10||state.nature?.precedencePolicy!=='nature-before-architecture-on-overlap-v1')throw new Error(`Plaza nature contract invalid: ${JSON.stringify(state.nature)}`);
if(!validDepth(state))throw new Error(`Formal base/back/actor/front layer contract invalid: ${JSON.stringify(state.layers)}`);
if(!state.generic?.ready||state.generic?.failed||state.generic?.contractVersion!==expectedGeneric.contractVersion||state.generic?.rendererMode!==expectedGeneric.rendererMode||state.generic?.immediateLayerGroupCount!==0||state.generic?.dynamicSourceCount<1)throw new Error(`Generic dynamic prop contract invalid: ${JSON.stringify(state.generic)}`);
if(!state.rural?.ready||state.rural?.boundaryMode!=='environment-layer-stack-props-back-v1'||state.rural?.immediateBoundaryDraw!==false)throw new Error(`Rural formal props_back contract invalid: ${JSON.stringify(state.rural)}`);
if(!plazaTree?.dataUrl?.startsWith('data:image/png;base64,')||plazaTree.registryNature?.length!==4)throw new Error('Plaza nature screenshot evidence missing');
if(!rural?.dataUrl?.startsWith('data:image/png;base64,')||rural.canvas?.cssWidth!==390||rural.canvas?.cssHeight!==844||rural.canvas?.width!==780||rural.canvas?.height!==1688)throw new Error(`Rural depth screenshot evidence missing: ${JSON.stringify(rural?.canvas)}`);
if(!grass?.dataUrl?.startsWith('data:image/png;base64,')||grass.assetHash!==expectedGrassHash||grass.assetByteLength<100||grass.opaquePixels<100000||grass.uniqueOpaqueColors<4)throw new Error(`Authored grass substitution contract invalid: ${JSON.stringify({expectedGrassHash,grass})}`);
if(!commerce?.dataUrl?.startsWith('data:image/png;base64,')||commerce.world?.activeDistrictLabel!=='commerce'||commerce.profile?.marbleVariation!==true||commerce.scope!==expectedMarbleScope)throw new Error(`Commerce marble screenshot/contract evidence missing: ${JSON.stringify(commerce)}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);