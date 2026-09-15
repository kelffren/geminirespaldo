import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedFountain=process.env.EXPECTED_FOUNTAIN||'plaza-fountain-v3.0';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

function contractOk(d){
  const f=d.fountain,l=d.layers,g=d.generic;
  const front=l?.layers?.find(x=>x.id==='plaza-fountain-front');
  return f?.ready&&!f?.failed&&f?.version===expectedFountain&&f?.assetMode==='single-authored-png-v1'&&
    f?.alignmentMode==='bottom-centered-on-plaza-v1'&&f?.decorationResetVisible===true&&
    g?.ready===true&&g?.failed===false&&g?.rendererMode==='data-driven-props-v6-reset-visible'&&g?.contractVersion==='1.6.0'&&
    front?.ready===true&&front?.phase==='props_front'&&front?.timing==='post_actor'&&front?.visibleDuringReset===true;
}

let loaded=false;
for(let attempt=1;attempt<=24;attempt++){
  try{
    await page.goto(`${base}?fuentekelo-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
    const d=await page.evaluate(()=>({fountain:window.KELO_PLAZA_FOUNTAIN_AUDIT||null,layers:window.KELO_ENVIRONMENT_LAYER_AUDIT||null,generic:window.KELO_GENERIC_PROP_AUDIT||null}));
    if(contractOk(d)){loaded=true;break;}
  }catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}
consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?fuentekelo-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(2500);
const state=await page.evaluate(()=>{
  localPlayer.x=1440;localPlayer.y=1600;camera.x=1440;camera.y=1520;camera.targetX=1440;camera.targetY=1520;render();
  const c=document.getElementById('game-canvas');
  return {fountain:{...window.KELO_PLAZA_FOUNTAIN_AUDIT},layers:window.KELO_ENVIRONMENT_LAYER_AUDIT||null,generic:window.KELO_GENERIC_PROP_AUDIT||null,canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight},dataUrl:c.toDataURL('image/png')};
});
fs.writeFileSync('artifacts/live-fuentekelo-390x844.png',Buffer.from(state.dataUrl.split(',')[1],'base64'));
delete state.dataUrl;
const report={loaded,state,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/fuentekelo-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();

if(!loaded)throw new Error('LIVE never reached fuentekelo contract');
if(!contractOk(state))throw new Error(`Final fuentekelo contract invalid: ${JSON.stringify(state)}`);
if(state.fountain?.sourceWidth!==1312||state.fountain?.sourceHeight!==1199)throw new Error('fuentekelo source dimensions invalid');
if(state.fountain?.x!==1080||state.fountain?.y!==862||state.fountain?.width!==720||state.fountain?.height!==658||state.fountain?.baseY!==1505)throw new Error(`fuentekelo geometry invalid: ${JSON.stringify(state.fountain)}`);
if((state.generic?.frontDrawCountByGroup?.plazaFountain||0)<1)throw new Error('fuentekelo front pass did not execute');
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
