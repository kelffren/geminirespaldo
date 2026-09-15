import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base=process.env.LIVE_URL||'https://kelffren.github.io/gemini/';
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:390,height:844}});
const page=await ctx.newPage();
const pageErrors=[];
const consoleErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});

async function loadCurrentLive(){
  let lastError='';
  for(let attempt=1;attempt<=18;attempt++){
    try{
      await page.goto(base+`?housePanel=1&liveSmoke=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:20000});
      await page.waitForFunction(()=>window.KELO_HOUSE_UI&&window.KELO_HOUSES&&window.KELO_INSTANCES&&window.KELO_PROPERTY_SYSTEM,{timeout:8000});
      return attempt;
    }catch(err){
      lastError=String(err?.message||err);
      await new Promise(r=>setTimeout(r,5000));
    }
  }
  throw new Error(`LIVE_HOUSE_NOT_READY: ${lastError}`);
}

const attempts=await loadCurrentLive();
await page.evaluate(()=>window.openSocialTool('properties'));
await page.waitForFunction(()=>getComputedStyle(document.getElementById('kelo-house-panel')).display!=='none',{timeout:10000});
const before=await page.evaluate(()=>({scene:window.KELO_SCENE_CONTEXT.current(),panel:getComputedStyle(document.getElementById('kelo-house-panel')).display}));
await page.locator('#hi-enter').click();
await page.waitForFunction(()=>window.KELO_SCENE_CONTEXT.current().zoneType==='instance'&&window.KELO_SCENE_CONTEXT.current().instanceType==='house',{timeout:15000});
const entered=await page.evaluate(()=>({scene:window.KELO_SCENE_CONTEXT.current(),current:window.KELO_INSTANCES.current(),exit:getComputedStyle(document.getElementById('hi-exit')).display,body:document.body.className}));
assert.equal(entered.scene.zoneType,'instance');
assert.equal(entered.scene.instanceType,'house');
assert.equal(entered.current.type,'house');
assert.notEqual(entered.exit,'none');
await page.screenshot({path:'artifacts/house-live-enter-mobile.png',fullPage:true});
await page.locator('#hi-exit').click();
await page.waitForFunction(()=>window.KELO_SCENE_CONTEXT.current().zoneType==='world',{timeout:15000});
const after=await page.evaluate(()=>({scene:window.KELO_SCENE_CONTEXT.current(),current:window.KELO_INSTANCES.current()}));
assert.equal(after.scene.zoneType,'world');
assert.equal(after.current,null);
assert.deepEqual(pageErrors,[]);

const report={ok:true,url:base,attempts,before,entered,after,pageErrors,consoleErrors};
fs.writeFileSync('artifacts/house-live-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await ctx.close();
await browser.close();
