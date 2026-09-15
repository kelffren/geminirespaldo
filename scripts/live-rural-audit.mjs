import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedGeneric=(()=>{
  const propSource=fs.readFileSync(new URL('../src/environment/prop-contract.js',import.meta.url),'utf8');
  const genericSource=fs.readFileSync(new URL('../src/environment/generic-props.js',import.meta.url),'utf8');
  const contractVersion=propSource.match(/KELO_PROP_CONTRACT=Object\.freeze\(\{version:'([^']+)'/)?.[1];
  const contractMode=propSource.match(/KELO_PROP_CONTRACT=Object\.freeze\(\{version:'[^']+',mode:'([^']+)'/)?.[1];
  const rendererMode=genericSource.match(/rendererMode:'([^']+)'/)?.[1];
  if(!contractVersion||!contractMode||!rendererMode)throw new Error('Could not resolve rural generic prop expectations from source');
  return{contractVersion,contractMode,rendererMode};
})();
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
await page.route(/\/src\/environment\/(environment-layer-stack|prop-contract|generic-props|rural-ground)\.js/,route=>{const u=new URL(route.request().url());u.searchParams.set('rural-depth-bust',`${Date.now()}-${Math.random()}`);route.continue({url:u.toString()});});
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

await page.goto(`${base}?rural-edge-audit=${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForFunction(()=>window.KELO_RURAL_LANDMARK_AUDIT?.ready===true&&window.KELO_RURAL_GROUND_AUDIT?.ready===true&&window.KELO_WORLD_AUDIT?.ready===true&&window.KELO_GENERIC_PROP_AUDIT?.ready===true,null,{timeout:45000});
await page.waitForTimeout(800);
const rural=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');
  if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function'||typeof STATE==='undefined'||!STATE.farm)return null;
  const farm=STATE.farm, g=c.getContext('2d');
  const focusX=farm.x+farm.w/2, focusY=farm.y+farm.h/2;
  localPlayer.x=focusX;localPlayer.y=focusY;
  camera.x=focusX;camera.y=focusY;camera.targetX=focusX;camera.targetY=focusY;
  const activeFarmRenderer=window.renderFarm;
  let hookCalls=0;
  window.renderFarm=function(f){hookCalls++;return activeFarmRenderer(f);};
  render();
  window.renderFarm=activeFarmRenderer;
  function countMaterial(){
    const px=g.getImageData(0,0,c.width,c.height).data;let count=0;
    for(let i=0;i<px.length;i+=4){const r=px[i],gg=px[i+1],b=px[i+2],a=px[i+3];if(a>200&&r>=45&&r<=190&&gg>=20&&gg<=140&&b<=100)count++;}
    return count;
  }
  const ruralMaterialPixels=countMaterial();
  const dataUrl=c.toDataURL('image/png');
  const layerAudit=window.KELO_ENVIRONMENT_LAYER_AUDIT||null;
  const ruralBack=layerAudit?.layers?.find?.(l=>l.id==='rural-boundary-back')||null;
  return{
    dataUrl,
    landmark:window.KELO_RURAL_LANDMARK_AUDIT||null,
    ground:window.KELO_RURAL_GROUND_AUDIT||null,
    genericProps:window.KELO_GENERIC_PROP_AUDIT||null,
    propContract:window.KELO_PROP_CONTRACT?{version:window.KELO_PROP_CONTRACT.version,mode:window.KELO_PROP_CONTRACT.mode,assetCount:Object.keys(window.KELO_PROP_CONTRACT.assets||{}).length,layerGroupCount:Object.keys(window.KELO_PROP_CONTRACT.layerGroups||{}).length,sourceCount:Object.keys(window.KELO_PROP_CONTRACT.sources||{}).length}:null,
    layers:layerAudit,ruralBack,
    world:window.KELO_WORLD_AUDIT||null,
    farm:{x:farm.x,y:farm.y,w:farm.w,h:farm.h,cropCount:Array.isArray(farm.crops)?farm.crops.length:0,focusX,focusY},
    ruralMaterialPixels,hookCalls,
    finalRenderUsesWindowFarm:String(render).includes('window.renderFarm'),
    activeFarmRendererPreview:String(activeFarmRenderer).slice(0,260),
    canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}
  };
});
if(rural?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-rural-edge.png',Buffer.from(rural.dataUrl.split(',')[1],'base64'));
const report={expectedGeneric,rural:rural?{landmark:rural.landmark,ground:rural.ground,genericProps:rural.genericProps,propContract:rural.propContract,layers:rural.layers,ruralBack:rural.ruralBack,world:rural.world,farm:rural.farm,ruralMaterialPixels:rural.ruralMaterialPixels,hookCalls:rural.hookCalls,finalRenderUsesWindowFarm:rural.finalRenderUsesWindowFarm,activeFarmRendererPreview:rural.activeFarmRendererPreview,canvas:rural.canvas}:null,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/rural-edge-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
if(!rural?.dataUrl?.startsWith('data:image/png;base64,'))throw new Error('Rural screenshot evidence missing');
if(!rural.landmark?.ready||!rural.landmark?.assetLoaded||rural.landmark?.failed)throw new Error(`Rural edge layer failed: ${JSON.stringify(rural.landmark)}`);
if(rural.landmark?.mode!=='authored-low-profile-edge-clusters-v1'||rural.landmark?.clusterTileCount!==17||rural.landmark?.centerClear!==true||rural.landmark?.northRoadClear!==true)throw new Error(`Rural edge contract invalid: ${JSON.stringify(rural.landmark)}`);
if(!rural.ground?.ready||rural.ground?.fallbackActive)throw new Error('Rural ground fallback active');
if(rural.ground?.boundaryMode!=='environment-layer-stack-props-back-v1'||rural.ground?.genericPropContract!==true||rural.ground?.propContractVersion!==expectedGeneric.contractVersion||rural.ground?.boundarySource!=='ruralFarmBoundary'||rural.ground?.immediateBoundaryDraw!==false)throw new Error(`Rural boundary is not formal-stack driven: ${JSON.stringify(rural.ground)}`);
if(!rural.genericProps?.ready||rural.genericProps?.failed||rural.genericProps?.rendererMode!==expectedGeneric.rendererMode||rural.genericProps?.assetCount<2||rural.genericProps?.layerGroupCount<2||rural.genericProps?.immediateLayerGroupCount!==0||rural.genericProps?.immediateDrawCalls!==0||rural.genericProps?.dynamicSourceCount<1||rural.genericProps?.dynamicPropCount<8)throw new Error(`Generic prop renderer did not resolve rural props through data: ${JSON.stringify(rural.genericProps)}`);
if(rural.propContract?.version!==expectedGeneric.contractVersion||rural.propContract?.mode!==expectedGeneric.contractMode||rural.propContract?.assetCount<2||rural.propContract?.layerGroupCount<2||rural.propContract?.sourceCount<1)throw new Error(`Prop contract runtime state invalid: ${JSON.stringify(rural.propContract)}`);
if(rural.layers?.version!=='environment-layer-stack-v2.3'||rural.layers?.mode!=='formal-base-back-actor-front-order-v1'||rural.layers?.preActorLayerCount<1)throw new Error(`Formal depth stack missing: ${JSON.stringify(rural.layers)}`);
if(rural.ruralBack?.phase!=='props_back'||rural.ruralBack?.timing!=='pre_actor'||rural.ruralBack?.priority!==8||rural.ruralBack?.ownership!=='rural-farm-boundary-props-v1'||rural.ruralBack?.boundsCount<8)throw new Error(`Rural props_back layer invalid: ${JSON.stringify(rural.ruralBack)}`);
if(!rural.farm||rural.farm.cropCount<4)throw new Error(`Farm state missing from visual evidence: ${JSON.stringify(rural.farm)}`);
if(rural.ruralMaterialPixels<15000)throw new Error(`Farm/edge not visible: normal=${rural.ruralMaterialPixels}, hookCalls=${rural.hookCalls}, finalUsesWindow=${rural.finalRenderUsesWindowFarm}`);
if(rural.canvas?.cssWidth!==390||rural.canvas?.cssHeight!==844||rural.canvas?.width!==780||rural.canvas?.height!==1688)throw new Error(`Mobile canvas mismatch: ${JSON.stringify(rural.canvas)}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
