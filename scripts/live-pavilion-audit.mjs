import fs from 'node:fs';
import { chromium } from 'playwright';
const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedRegistry=process.env.EXPECTED_REGISTRY||'';
const expectedTitle=process.env.EXPECTED_TITLE||'';
const expectedArchitecture=process.env.EXPECTED_ARCHITECTURE_VERSION||'';
const expectedArchitectureMode=process.env.EXPECTED_ARCHITECTURE_MODE||'';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});
function architectureLayers(s){
  const layers=s.layers?.layers||[];
  return{back:layers.find(l=>l.ownership==='architecture-prefabs-v1'&&l.phase==='props_back'),front:layers.find(l=>l.ownership==='architecture-prefabs-v1'&&l.phase==='props_front')};
}
function contractOk(s){
  const okTitle=!expectedTitle||s.title===expectedTitle;
  const okArch=(!expectedArchitecture||s.architecture?.version===expectedArchitecture)&&(!expectedArchitectureMode||s.architecture?.mode===expectedArchitectureMode);
  const {back,front}=architectureLayers(s);
  const formalLayers=s.architecture?.renderMode==='generic-prefab-renderer-v1'&&s.architecture?.environmentLayerStack===true&&s.architecture?.backLayerRegistered===true&&s.architecture?.frontLayerRegistered===true&&s.architecture?.rendererWrapped===false&&s.architecture?.depthWrapped===false&&back?.timing==='pre_actor'&&back?.priority===20&&front?.timing==='post_actor'&&front?.priority===20;
  return okTitle&&okArch&&s.registry?.version===expectedRegistry&&s.architecture?.prefabCount===1&&s.architecture?.spatialOwnership==='architecture-prefabs-v1'&&formalLayers&&s.luxe?.ready&&s.luxe?.source==='generic-prefab-contract'&&s.luxe?.renderMode==='generic-prefab-renderer-v1'&&s.market?.disabled===true;
}
let loaded=false;
for(let attempt=1;attempt<=24;attempt++){
  try{await page.goto(`${base}?luxe-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});const s=await page.evaluate(()=>({title:document.title,registry:window.KELO_TILE_REGISTRY||null,architecture:window.KELO_ARCHITECTURE_RENDERER||null,luxe:window.KELO_LUXE_KIOSK||null,market:window.KELO_MARKET_PAVILION||null,layers:window.KELO_ENVIRONMENT_LAYER_AUDIT||null}));if(contractOk(s)){loaded=true;break;}}catch(e){console.log(`attempt ${attempt}: ${e.message}`)}await page.waitForTimeout(10000);
}
consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;await page.goto(`${base}?luxe-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});await page.waitForTimeout(2500);
const luxe=await page.evaluate(()=>{const c=document.getElementById('game-canvas');if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;localPlayer.x=1208;localPlayer.y=1510;camera.x=1208;camera.y=1460;camera.targetX=1208;camera.targetY=1460;render();return{dataUrl:c.toDataURL('image/png'),occluding:!!window.KELO_LUXE_KIOSK?.isOccluding?.(localPlayer),state:window.KELO_LUXE_KIOSK||null,architecture:window.KELO_ARCHITECTURE_RENDERER||null,registry:window.KELO_TILE_REGISTRY||null,market:window.KELO_MARKET_PAVILION||null,layers:window.KELO_ENVIRONMENT_LAYER_AUDIT||null};});
if(luxe?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-luxe-prefab.png',Buffer.from(luxe.dataUrl.split(',')[1],'base64'));
const report={loaded,luxe:luxe?{occluding:luxe.occluding,state:luxe.state,architecture:luxe.architecture,registryVersion:luxe.registry?.version||null,market:luxe.market,layers:luxe.layers}:null,consoleErrors,failedRequests,httpErrors};fs.writeFileSync('artifacts/pavilion-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
if(!loaded)throw new Error('Generic prefab architecture did not become ready on LIVE');if(!luxe?.dataUrl?.startsWith('data:image/png;base64,')||!luxe.occluding)throw new Error('Kelo Luxe depth capture failed');if(luxe.registry?.version!==expectedRegistry)throw new Error(`Registry mismatch ${luxe.registry?.version} !== ${expectedRegistry}`);const finalState={title:expectedTitle||'',registry:luxe.registry,architecture:luxe.architecture,luxe:luxe.state,market:luxe.market,layers:luxe.layers};if(!contractOk(finalState))throw new Error(`Unexpected generic architecture runtime state: ${JSON.stringify(finalState)}`);if(luxe.state?.prefabId!=='luxe-boutique-central'||luxe.state?.failed||luxe.state?.rendererWrapped!==false||luxe.state?.depthWrapped!==false||luxe.state?.environmentLayerStack!==true||luxe.state?.backLayer!=='props_back'||luxe.state?.frontLayer!=='props_front')throw new Error('Kelo Luxe runtime contract invalid');const {back,front}=architectureLayers({layers:luxe.layers});if(back?.boundsCount!==1||front?.boundsCount!==1)throw new Error(`Architecture spatial bounds invalid: ${JSON.stringify({back,front})}`);if(luxe.market?.disabled!==true)throw new Error('Removed market unexpectedly active');if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
