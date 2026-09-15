import fs from 'node:fs';
import { chromium } from 'playwright';
const url=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const executablePath=process.env.CHROME_BIN||undefined;
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}: {})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],pageErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>pageErrors.push(String(e.stack||e.message||e)));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'unknown'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()})});
let evidence=null,lastErr=null;
for(let attempt=0;attempt<18;attempt++){
  try{
    await page.goto(url+'?mobile-perf-audit='+Date.now(),{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(1500);
    evidence=await page.evaluate(()=>({
      contract:window.KELO_MOBILE_PERFORMANCE_CONTRACT?.version||null,
      audit:window.KELO_MOBILE_PERFORMANCE_CONTRACT?.snapshot?.()||window.KELO_MOBILE_PERFORMANCE_AUDIT||null,
      hd:window.KELO_HD_RENDER||null,
      world:window.KELO_WORLD_AUDIT||null,
      atlas:window.KELO_ATLAS_AUDIT||null,
      perf:window.KELO_PERF?.getSnapshot?.()||null,
      canvas:(()=>{const c=document.getElementById('game-canvas');return c?{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}:null})()
    }));
    if(evidence.contract==='1.0.0'&&evidence.hd?.mobilePerformanceContractVersion==='1.0.0'&&evidence.world?.version==='world-v1.25')break;
    evidence=null;
  }catch(e){lastErr=e}
  await page.waitForTimeout(4000);
}
if(!evidence){await browser.close();throw new Error('LIVE did not converge to mobile performance contract 1.0.0 / world-v1.25: '+String(lastErr||''));}
await page.waitForTimeout(2000);
evidence=await page.evaluate(()=>({
  contract:window.KELO_MOBILE_PERFORMANCE_CONTRACT?.version||null,
  audit:window.KELO_MOBILE_PERFORMANCE_CONTRACT?.snapshot?.()||window.KELO_MOBILE_PERFORMANCE_AUDIT||null,
  hd:window.KELO_HD_RENDER||null,
  world:window.KELO_WORLD_AUDIT||null,
  atlas:window.KELO_ATLAS_AUDIT||null,
  perf:window.KELO_PERF?.getSnapshot?.()||null,
  canvas:(()=>{const c=document.getElementById('game-canvas');return c?{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}:null})()
}));
await page.screenshot({path:'artifacts/live-mobile-performance.png',fullPage:true});
const report={url,viewport:{width:390,height:844,dpr:2},...evidence,consoleErrors,pageErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/live-mobile-performance.json',JSON.stringify(report,null,2));
const errors=[];
if(evidence.contract!=='1.0.0')errors.push('contract version');
if(!evidence.audit?.mobile)errors.push('mobile detection');
if((evidence.hd?.dprCap||99)>2)errors.push('DPR cap');
if(evidence.canvas?.width!==780||evidence.canvas?.height!==1688)errors.push(`canvas ${evidence.canvas?.width}x${evidence.canvas?.height}`);
if((evidence.world?.chunkCacheCap||99)>12)errors.push('chunk cache cap');
if((evidence.world?.chunkCacheSize||0)>(evidence.world?.chunkCacheCap||0))errors.push('chunk cache overflow');
if((evidence.atlas?.decodedTextureMB||0)>(evidence.audit?.budgets?.decodedTextureMB||40))errors.push('decoded texture budget');
if((evidence.atlas?.residentDistrictAtlasCount||0)>(evidence.audit?.budgets?.residentDistrictAtlases||6))errors.push('district atlas residency budget');
if((evidence.audit?.violations||[]).length)errors.push('contract violations '+evidence.audit.violations.join(','));
if(consoleErrors.length)errors.push('console errors');
if(pageErrors.length)errors.push('page errors');
if(failedRequests.length)errors.push('failed requests');
if(httpErrors.length)errors.push('HTTP errors');
await browser.close();
if(errors.length){console.error(JSON.stringify(report,null,2));throw new Error(errors.join('; '));}
console.log(JSON.stringify({ok:true,contract:evidence.contract,dprCap:evidence.hd.dprCap,canvas:evidence.canvas,chunkCache:{size:evidence.world.chunkCacheSize,cap:evidence.world.chunkCacheCap},decodedTextureMB:evidence.atlas.decodedTextureMB,residentDistrictAtlasCount:evidence.atlas.residentDistrictAtlasCount,fps:evidence.perf?.fps||null,diagnostics:{consoleErrors:0,pageErrors:0,failedRequests:0,httpErrors:0}},null,2));