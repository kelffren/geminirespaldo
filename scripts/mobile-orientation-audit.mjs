import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e?.message||e)));
await page.goto(base+'?orientationAudit=1',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.KELO_ORIENTATION&&document.getElementById('kelo-orientation-btn')&&document.documentElement.dataset.keloOrientation==='portrait',{timeout:20000});
await page.waitForTimeout(250);

const portrait=await page.evaluate(()=>({
  orientation:document.documentElement.dataset.keloOrientation,
  bodyPortrait:document.body.classList.contains('kelo-orientation-portrait'),
  buttonTarget:document.getElementById('kelo-orientation-btn')?.dataset.target,
  inRail:document.getElementById('kelo-orientation-btn')?.parentElement?.classList.contains('lx-rail'),
  canvas:{width:document.getElementById('game-canvas').width,height:document.getElementById('game-canvas').height},
  api:window.KELO_ORIENTATION.supported()
}));
assert.equal(portrait.orientation,'portrait');
assert.equal(portrait.bodyPortrait,true);
assert.equal(portrait.buttonTarget,'landscape');
assert.equal(portrait.inRail,true);
assert.equal(portrait.canvas.width,390);
assert.equal(portrait.canvas.height,844);
await page.screenshot({path:'artifacts/mobile-orientation-portrait.png',fullPage:true});

await page.setViewportSize({width:844,height:390});
await page.waitForFunction(()=>document.documentElement.dataset.keloOrientation==='landscape');
await page.waitForTimeout(250);
const landscape=await page.evaluate(()=>({
  orientation:document.documentElement.dataset.keloOrientation,
  bodyLandscape:document.body.classList.contains('kelo-orientation-landscape'),
  buttonTarget:document.getElementById('kelo-orientation-btn')?.dataset.target,
  label:document.querySelector('#kelo-orientation-btn [data-orientation-label]')?.textContent,
  canvas:{width:document.getElementById('game-canvas').width,height:document.getElementById('game-canvas').height}
}));
assert.equal(landscape.orientation,'landscape');
assert.equal(landscape.bodyLandscape,true);
assert.equal(landscape.buttonTarget,'portrait');
assert.equal(landscape.label,'HORIZONTAL');
assert.equal(landscape.canvas.width,844);
assert.equal(landscape.canvas.height,390);
await page.screenshot({path:'artifacts/mobile-orientation-landscape.png',fullPage:true});

await page.locator('#kelo-orientation-btn').click();
await page.waitForTimeout(150);
const afterClick=await page.evaluate(()=>({preferred:window.KELO_ORIENTATION.preferred(),target:document.getElementById('kelo-orientation-btn')?.dataset.target}));
assert.equal(afterClick.preferred,'portrait');
assert.equal(afterClick.target,'portrait');
assert.deepEqual(errors,[]);

const report={ok:true,portrait,landscape,afterClick,errors};
fs.writeFileSync('artifacts/mobile-orientation-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
