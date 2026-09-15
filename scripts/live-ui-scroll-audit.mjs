import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedTitle=process.env.EXPECTED_TITLE||'Kelo World — V6.14';
fs.mkdirSync('artifacts',{recursive:true});

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const cdp=await context.newCDPSession(page);
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

let ready=false;
for(let attempt=1;attempt<=24;attempt++){
  try{
    await page.goto(`${base}?ui-scroll-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
    ready=await page.evaluate(expected=>document.title===expected&&!!window.KeloNobility&&!!document.getElementById('menu-sheet'),expectedTitle);
    if(ready)break;
  }catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}
if(!ready)throw new Error(`LIVE never reached ${expectedTitle}`);

consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?ui-scroll-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(1800);
await page.evaluate(()=>window.KeloNobility.open());
await page.waitForTimeout(400);

const before=await page.evaluate(()=>{
  const root=document.getElementById('kelo-nobility');
  const shell=root?.querySelector('.nob-shell');
  const menu=document.getElementById('menu-sheet');
  const panels=[...document.querySelectorAll('.app-panel')].map(el=>({id:el.id,touchAction:getComputedStyle(el).touchAction,overflowY:getComputedStyle(el).overflowY}));
  if(!root||!shell)throw new Error('Nobility scroll surface missing');
  shell.scrollTop=0;
  return{
    title:document.title,
    rootTouchAction:getComputedStyle(root).touchAction,
    shellTouchAction:getComputedStyle(shell).touchAction,
    menuTouchAction:getComputedStyle(menu).touchAction,
    clientHeight:shell.clientHeight,
    scrollHeight:shell.scrollHeight,
    scrollTop:shell.scrollTop,
    panels
  };
});

const box=await page.locator('.nob-shell').boundingBox();
if(!box)throw new Error('Nobility shell has no bounding box');
const x=Math.round(box.x+box.width*0.5);
const startY=Math.round(box.y+box.height*0.78);
const endY=Math.round(box.y+box.height*0.28);
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:startY,radiusX:4,radiusY:4,force:1,id:1}]});
for(let i=1;i<=10;i++){
  const y=Math.round(startY+(endY-startY)*(i/10));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y,radiusX:4,radiusY:4,force:1,id:1}]});
  await page.waitForTimeout(30);
}
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
await page.waitForTimeout(700);

const after=await page.evaluate(()=>{
  const shell=document.querySelector('#kelo-nobility .nob-shell');
  return{scrollTop:shell.scrollTop,clientHeight:shell.clientHeight,scrollHeight:shell.scrollHeight};
});
await page.screenshot({path:'artifacts/live-ui-scroll.png',fullPage:true});
const maxScroll=Math.max(0,before.scrollHeight-before.clientHeight);
const requiredScroll=Math.min(maxScroll,12);
const report={ready,before,after,maxScroll,requiredScroll,delta:after.scrollTop-before.scrollTop,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/ui-scroll-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();

if(before.title!==expectedTitle)throw new Error(`Title mismatch ${before.title} !== ${expectedTitle}`);
if(before.rootTouchAction!=='pan-y'||before.shellTouchAction!=='pan-y'||before.menuTouchAction!=='pan-y')throw new Error(`Scrollable UI touch-action invalid: ${JSON.stringify(before)}`);
if(maxScroll<8)throw new Error(`Nobility panel is not vertically overflowed enough to test: ${maxScroll}`);
if(after.scrollTop<requiredScroll||report.delta<requiredScroll)throw new Error(`Real mobile swipe did not scroll panel: ${JSON.stringify({maxScroll,requiredScroll,before:before.scrollTop,after:after.scrollTop,delta:report.delta})}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
