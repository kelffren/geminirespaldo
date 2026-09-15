import fs from 'node:fs';
import { chromium } from 'playwright';
const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedTitle=process.env.EXPECTED_TITLE||'Kelo World — V6.24';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

const probe=()=>page.evaluate(()=>({
  title:document.title,contract:window.KELO_PREFAB_CONTRACT||null,audit:window.KELO_PREFAB_AUDIT||null,
  renderer:window.KELO_PREFAB_RENDERER?{version:window.KELO_PREFAB_RENDERER.version,mode:window.KELO_PREFAB_RENDERER.mode,ready:window.KELO_PREFAB_RENDERER.ready,failed:window.KELO_PREFAB_RENDERER.failed}:null,
  architecture:window.KELO_ARCHITECTURE_RENDERER?{version:window.KELO_ARCHITECTURE_RENDERER.version,mode:window.KELO_ARCHITECTURE_RENDERER.mode,ready:window.KELO_ARCHITECTURE_RENDERER.ready,backLayerRegistered:window.KELO_ARCHITECTURE_RENDERER.backLayerRegistered,frontLayerRegistered:window.KELO_ARCHITECTURE_RENDERER.frontLayerRegistered}:null,
  plaza:window.KELO_PLAZA_AUDIT?{worldLayerWrapped:window.KELO_PLAZA_AUDIT.worldLayerWrapped,preActorContractPreserved:window.KELO_PLAZA_AUDIT.preActorContractPreserved,postActorContractPreserved:window.KELO_PLAZA_AUDIT.postActorContractPreserved}:null,
  luxe:window.KELO_LUXE_KIOSK?{version:window.KELO_LUXE_KIOSK.version,source:window.KELO_LUXE_KIOSK.source,ready:window.KELO_LUXE_KIOSK.ready,failed:window.KELO_LUXE_KIOSK.failed,prefabId:window.KELO_LUXE_KIOSK.prefabId,occluding:typeof localPlayer!=='undefined'?!!window.KELO_LUXE_KIOSK.isOccluding?.(localPlayer):false}:null,
  layers:(window.KELO_ENVIRONMENT_LAYERS?.layers||[]).filter(x=>String(x.id).includes('architecture-prefabs')).map(x=>({id:x.id,phase:x.phase,priority:x.priority,ownership:x.ownership,ready:typeof x.ready==='function'?x.ready():true})),
  liveColliders:typeof obstacles!=='undefined'&&Array.isArray(obstacles)?obstacles.filter(o=>o?._genericPrefabCollision===true).map(o=>({id:o.id,x:o.x,y:o.y,w:o.w,h:o.h})):[],
  canvas:(()=>{const c=document.getElementById('game-canvas');return c?{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}:null})()
}));
function valid(s){return s.title===expectedTitle&&s.contract?.version==='1.1.0'&&s.contract?.mode==='data-driven-building-prefabs-v2'&&s.contract?.capabilities?.renderParts===true&&s.contract?.capabilities?.splitAssets===true&&s.contract?.capabilities?.frameSelection===true&&s.contract?.prefabs?.length===1&&s.contract?.prefabs?.[0]?.renderPlan?.back?.length===1&&String(s.audit?.version||'').startsWith('generic-prefabs-v1.2')&&s.audit?.rendererMode==='data-driven-prefabs-v2'&&s.audit?.renderPartCount===1&&s.audit?.ready===true&&s.audit?.failed===false&&s.audit?.registeredColliderCount===1&&s.renderer?.mode==='data-driven-prefabs-v2'&&s.renderer?.ready===true&&s.renderer?.failed===false&&s.architecture?.mode==='generic-prefab-contract-v1'&&s.architecture?.ready===true&&s.architecture?.backLayerRegistered===true&&s.architecture?.frontLayerRegistered===true&&s.plaza?.worldLayerWrapped===true&&s.plaza?.preActorContractPreserved===true&&s.plaza?.postActorContractPreserved===true&&s.luxe?.source==='generic-prefab-contract'&&s.luxe?.ready===true&&s.luxe?.failed===false&&s.layers?.some(x=>x.id==='architecture-prefabs-back'&&x.phase==='props_back'&&x.ready)&&s.layers?.some(x=>x.id==='architecture-prefabs-front'&&x.phase==='props_front'&&x.ready)&&s.liveColliders?.length===1;}
let state=null;
for(let attempt=1;attempt<=30;attempt++){
  consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
  try{await page.goto(`${base}?prefab-live=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});await page.waitForTimeout(1600);state=await probe();if(valid(state)&&!consoleErrors.length&&!failedRequests.length&&!httpErrors.length)break;}catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(8000);
}
if(!state||!valid(state))throw new Error(`LIVE generic prefab contract unavailable: ${JSON.stringify(state)}`);
if(consoleErrors.length||failedRequests.length||httpErrors.length)throw new Error(`LIVE browser errors: ${JSON.stringify({consoleErrors,failedRequests,httpErrors})}`);
await page.evaluate(()=>{if(typeof localPlayer!=='undefined'&&localPlayer){localPlayer.x=1208;localPlayer.y=1510;}if(typeof camera!=='undefined'&&camera){camera.x=1208;camera.y=1460;camera.targetX=1208;camera.targetY=1460;}if(typeof render==='function')render();});
await page.waitForTimeout(500);
await page.screenshot({path:'artifacts/live-prefab-mobile.png',fullPage:true});
state=await probe();
fs.writeFileSync('artifacts/prefab-live-report.json',JSON.stringify({state,consoleErrors,failedRequests,httpErrors},null,2));
console.log(JSON.stringify({state,consoleErrors,failedRequests,httpErrors},null,2));
await browser.close();
if(state.canvas?.cssWidth!==390||state.canvas?.cssHeight!==844||state.canvas?.width!==780||state.canvas?.height!==1688)throw new Error(`Unexpected mobile canvas: ${JSON.stringify(state.canvas)}`);
if(state.audit?.backDrawCount<1)throw new Error(`Generic prefab back layer did not draw: ${JSON.stringify(state.audit)}`);
if(state.audit?.frontOcclusionDrawCount<1||state.luxe?.occluding!==true)throw new Error(`Generic prefab front occlusion did not execute: ${JSON.stringify({audit:state.audit,luxe:state.luxe})}`);
if(state.liveColliders?.length!==1)throw new Error(`Generic prefab collider not live: ${JSON.stringify(state.liveColliders)}`);
if(consoleErrors.length||failedRequests.length||httpErrors.length)throw new Error(`LIVE browser errors after capture: ${JSON.stringify({consoleErrors,failedRequests,httpErrors})}`);