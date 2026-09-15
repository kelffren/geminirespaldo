/* KELO-INDEX
 * area: AUDIT / CREATORS IMAGE TREATMENT LIVE
 * owner: LIVE browser audit for Kelo Image Treatment Engine + Sprite Factory bridge
 * purpose: prove GitHub Pages serves the native treatment owner and Sprite Factory consumes it in a real browser
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const base=String(process.env.AUDIT_URL||'https://kelffren.github.io/gemini/').replace(/\/?$/,'/');
const executablePath=process.env.CHROME_BIN||'/usr/bin/google-chrome';
await fs.mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath});
const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
const consoleLines=[];
page.on('console',msg=>consoleLines.push(`${msg.type()}:${msg.text()}`));
page.on('pageerror',error=>consoleLines.push(`pageerror:${error.message}`));
const stamp=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
let result;
try{
  await page.goto(`${base}?imageTreatmentLiveAudit=${encodeURIComponent(stamp)}`,{waitUntil:'domcontentloaded',timeout:60000});
  result=await page.evaluate(async ({stamp})=>{
    const engine=await import(`/gemini/src/creators/core/image-treatment-engine.mjs?live=${encodeURIComponent(stamp)}`);
    const width=3,height=3,data=new Uint8ClampedArray(width*height*4);
    for(let i=0;i<data.length;i+=4){data[i]=30;data[i+1]=36;data[i+2]=44;data[i+3]=255;}
    let i=0;data[i]=245;data[i+1]=231;data[i+2]=219;data[i+3]=0;
    i=(1*width+1)*4;data[i]=245;data[i+1]=245;data[i+2]=245;data[i+3]=128;
    const treated=engine.treatImagePixels(data,width,height,{profile:'sprite',haloThreshold:30,interiorAlpha:220});
    const center=Array.from(treated.data.slice((1*width+1)*4,(1*width+1)*4+4));
    const corner=Array.from(treated.data.slice(0,4));
    const bridge=await import(`/gemini/src/creators/ui/sprite-factory-online.mjs?live=${encodeURIComponent(stamp)}`);
    const factory=await bridge.openSpriteFactoryOnline({root:window});
    await new Promise(resolve=>setTimeout(resolve,750));
    const shell=document.querySelector('#kelo-sprite-factory'),note=shell?.querySelector('.ksf-note')?.textContent||'',online=window.__KELO_SPRITE_FACTORY_ONLINE__||null;
    const output={
      engineVersion:treated.report.version,
      profile:treated.report.profile,
      alphaPreserved:treated.report.alphaPreserved,
      transparentRgbSanitized:treated.report.operations.transparentRgbSanitized,
      haloPixelsRepaired:treated.report.operations.haloPixelsRepaired,
      center,corner,
      factoryOpen:!!shell,
      bridgeVersion:online?.version||null,
      bridgeImageTreatment:online?.imageTreatment||null,
      noteMentionsTreatment:/Image Treatment/i.test(note),
      dimensions:factory?.sheet?[factory.sheet.width,factory.sheet.height]:null
    };
    factory?.close?.();
    return output;
  },{stamp});
  await page.screenshot({path:'artifacts/image-treatment-live.png',fullPage:true});
}finally{
  await browser.close();
}

assert.equal(result.engineVersion,'image-treatment-v1.0.0');
assert.equal(result.profile,'sprite');
assert.equal(result.alphaPreserved,true);
assert.equal(result.transparentRgbSanitized,1);
assert.equal(result.haloPixelsRepaired,1);
assert.deepEqual(result.corner,[0,0,0,0]);
assert.deepEqual(result.center,[30,36,44,128]);
assert.equal(result.factoryOpen,true);
assert.equal(result.bridgeVersion,'v1.5-image-treatment');
assert.equal(result.bridgeImageTreatment,'image-treatment-v1.0.0');
assert.equal(result.noteMentionsTreatment,true);
assert.deepEqual(result.dimensions,[256,512]);
console.log(JSON.stringify({ok:true,url:base,result,consoleLines:consoleLines.filter(line=>/image|sprite|error/i.test(line)).slice(0,20)},null,2));
