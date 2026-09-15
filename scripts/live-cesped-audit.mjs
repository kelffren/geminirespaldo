import fs from 'node:fs';
import { chromium } from 'playwright';

const url=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],pageErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>pageErrors.push(e?.stack||String(e)));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()})});
await page.goto(url+'?cespedAudit='+Date.now(),{waitUntil:'domcontentloaded',timeout:120000});
await page.waitForFunction(()=>window.KELO_SURFACE_GROUND_AUDIT?.ready===true,{timeout:120000});
await page.waitForTimeout(2500);
const state=await page.evaluate(async()=>{
  const grass=window.KELO_SURFACE_GROUND_AUDIT||null;
  const env=window.KELO_ENVIRONMENT_LAYER_AUDIT||null;
  const props=window.KELO_GENERIC_PROP_AUDIT||null;
  const canvas=document.querySelector('#game-canvas');
  const status=await fetch('assets/cesped-runtime.PNG?art=501',{cache:'no-store'}).then(r=>r.status).catch(()=>0);
  let samples=[];
  try{
    const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
    const pts=[[.2,.25],[.5,.25],[.8,.25],[.2,.5],[.5,.5],[.8,.5],[.2,.75],[.5,.75],[.8,.75]];
    samples=pts.map(([px,py])=>{const d=g.getImageData(Math.max(0,Math.min(w-1,Math.floor(w*px))),Math.max(0,Math.min(h-1,Math.floor(h*py))),1,1).data;return [d[0],d[1],d[2],d[3]]});
  }catch(e){samples=[['sample-error',String(e)]]}
  const whiteSamples=samples.filter(s=>Array.isArray(s)&&s.length===4&&s[0]>245&&s[1]>245&&s[2]>245&&s[3]>245).length;
  return {grass,env,props,atlasStatus:status,canvas:canvas?{width:canvas.width,height:canvas.height,cssWidth:canvas.getBoundingClientRect().width,cssHeight:canvas.getBoundingClientRect().height}:null,samples,whiteSamples};
});
await page.screenshot({path:'artifacts/live-cesped-390x844.png',fullPage:true});
const report={url,state,consoleErrors,pageErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/cesped-report.json',JSON.stringify(report,null,2));
await browser.close();
const g=state.grass;
const problems=[];
if(!g?.ready||g?.failed)problems.push('surface ground not ready');
if(g?.asset!=='cesped')problems.push('wrong ground asset');
if(g?.tileCount!==25)problems.push('expected 25 grass tiles');
if(state.atlasStatus!==200)problems.push('cesped runtime HTTP '+state.atlasStatus);
if(state.whiteSamples>2)problems.push('too many white canvas samples '+state.whiteSamples);
if(consoleErrors.length)problems.push('console errors='+consoleErrors.length);
if(pageErrors.length)problems.push('page errors='+pageErrors.length);
if(failedRequests.length)problems.push('failed requests='+failedRequests.length);
if(httpErrors.length)problems.push('HTTP errors='+httpErrors.length);
if(problems.length){console.error(JSON.stringify({problems,report},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,ground:g,atlasStatus:state.atlasStatus,whiteSamples:state.whiteSamples,canvas:state.canvas},null,2));
