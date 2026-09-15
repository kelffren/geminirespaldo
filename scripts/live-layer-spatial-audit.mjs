import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
await page.route(/\/src\/environment\/(environment-layer-stack|plaza-nature|luxe-kiosk-atlas|plaza-depth|gardens-junction-overlay|prop-contract|generic-props)\.js/,route=>{const u=new URL(route.request().url());u.searchParams.set('spatial-audit-bust',`${Date.now()}-${Math.random()}`);route.continue({url:u.toString()});});
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

function valid(audit){
  if(!audit||audit.version!=='environment-layer-stack-v2.3'||audit.mode!=='formal-base-back-actor-front-order-v1'||audit.orderingPolicy!=='phase-priority-id-v1'||audit.spatialPolicy!=='same-phase-aabb-priority-resolution-v1')return false;
  if(audit.preActorLayerCount<1||audit.postActorLayerCount<1||audit.spatialTieCount!==0)return false;
  const target=(audit.spatialOverlaps||[]).filter(overlap=>{
    const owners=new Set([overlap.aOwnership,overlap.bOwnership]);
    return (overlap.phase==='props_back'||overlap.phase==='props_front')&&owners.has('architecture-prefabs-v1')&&owners.has('plaza-nature-props-v1');
  });
  if(target.length!==2)return false;
  for(const overlap of target){
    if(overlap.overlapCount!==1||overlap.ambiguous!==false||overlap.resolvedBy!=='priority')return false;
    const natureFirst=overlap.aOwnership==='plaza-nature-props-v1';
    const naturePriority=natureFirst?overlap.aPriority:overlap.bPriority;
    const architecturePriority=natureFirst?overlap.bPriority:overlap.aPriority;
    if(naturePriority!==10||architecturePriority!==20)return false;
    if(!overlap.overlaps?.some(o=>(o.a==='luxe-boutique-central'&&o.b==='plaza-tree-nw')||(o.a==='plaza-tree-nw'&&o.b==='luxe-boutique-central')))return false;
  }
  const layers=audit.layers||[];
  const nature=layers.filter(l=>l.ownership==='plaza-nature-props-v1');
  const architecture=layers.filter(l=>l.ownership==='architecture-prefabs-v1');
  const ruralBack=layers.find(l=>l.id==='rural-boundary-back');
  const fountainBack=layers.find(l=>l.id==='plaza-fountain-back');
  const fountainFront=layers.find(l=>l.id==='plaza-fountain-front');
  const gardensJunctions=layers.find(l=>l.id==='gardens-t-junctions');
  return nature.length===2&&architecture.length===2&&nature.every(l=>l.boundsCount===4&&l.priority===10)&&architecture.every(l=>l.boundsCount===1&&l.priority===20)&&ruralBack?.ownership==='rural-farm-boundary-props-v1'&&ruralBack.phase==='props_back'&&ruralBack.timing==='pre_actor'&&ruralBack.priority===8&&fountainBack?.ownership==='plaza-fountain-v1'&&fountainBack.boundsCount===1&&fountainFront?.ownership==='plaza-fountain-v1'&&fountainFront.boundsCount===1&&gardensJunctions?.ownership==='gardens-t-junctions-v1'&&gardensJunctions.boundsCount>0;
}

let audit=null;
for(let attempt=1;attempt<=24;attempt++){
  await page.goto(`${base}?layer-spatial-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
  await page.waitForTimeout(1000);
  audit=await page.evaluate(()=>window.KELO_ENVIRONMENT_LAYER_AUDIT||null);
  if(valid(audit))break;
  await page.waitForTimeout(10000);
}
if(!valid(audit)){
  fs.writeFileSync('artifacts/layer-spatial-report.json',JSON.stringify({audit,consoleErrors,failedRequests,httpErrors},null,2));
  await browser.close();
  throw new Error(`LIVE spatial layer contract not reached: ${JSON.stringify(audit)}`);
}

consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?layer-spatial-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(1400);
const shot=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');
  if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=1208;localPlayer.y=1452;camera.x=1208;camera.y=1428;camera.targetX=1208;camera.targetY=1428;render();
  return {dataUrl:c.toDataURL('image/png'),canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight},audit:window.KELO_ENVIRONMENT_LAYER_AUDIT||null,nature:window.KELO_PLAZA_NATURE_AUDIT||null,architecture:window.KELO_ARCHITECTURE_RENDERER||null,fountain:window.KELO_PLAZA_FOUNTAIN_AUDIT||null,gardensJunctions:window.KELO_GARDENS_JUNCTION_AUDIT||null};
});
if(shot?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-layer-spatial-overlap.png',Buffer.from(shot.dataUrl.split(',')[1],'base64'));
const report={canvas:shot?.canvas,audit:shot?.audit,nature:shot?.nature,architecture:shot?.architecture,fountain:shot?.fountain,gardensJunctions:shot?.gardensJunctions,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/layer-spatial-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
if(!shot?.dataUrl?.startsWith('data:image/png;base64,'))throw new Error('Spatial overlap screenshot missing');
if(!valid(shot.audit))throw new Error(`Final spatial contract invalid: ${JSON.stringify(shot.audit)}`);
if(shot.canvas?.cssWidth!==390||shot.canvas?.cssHeight!==844||shot.canvas?.width!==780||shot.canvas?.height!==1688)throw new Error(`Mobile canvas mismatch: ${JSON.stringify(shot.canvas)}`);
if(!shot.nature?.ready||shot.nature?.failed||shot.nature?.spatialOwnership!=='plaza-nature-props-v1'||shot.nature?.layerPriority!==10||shot.nature?.precedencePolicy!=='nature-before-architecture-on-overlap-v1')throw new Error(`Nature spatial ownership invalid: ${JSON.stringify(shot.nature)}`);
if(!shot.architecture?.ready||shot.architecture?.spatialOwnership!=='architecture-prefabs-v1')throw new Error(`Architecture spatial ownership invalid: ${JSON.stringify(shot.architecture)}`);
if(!shot.fountain?.ready||shot.fountain?.spatialOwnership!=='plaza-fountain-v1'||shot.fountain?.backBoundsCount!==1||shot.fountain?.frontBoundsCount!==1)throw new Error(`Fountain spatial ownership invalid: ${JSON.stringify(shot.fountain)}`);
if(!shot.gardensJunctions?.ready||shot.gardensJunctions?.spatialOwnership!=='gardens-t-junctions-v1'||shot.gardensJunctions?.spatialBoundsCount!==shot.gardensJunctions?.placementCount)throw new Error(`Gardens junction spatial ownership invalid: ${JSON.stringify(shot.gardensJunctions)}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
