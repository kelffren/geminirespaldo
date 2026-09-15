import { chromium } from 'playwright';
import fs from 'node:fs';

const url=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome'});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.goto(url,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.KELO_ORIENTATION&&typeof window.KELO_ORIENTATION.baseZoom==='function');
await page.waitForTimeout(1200);

const portrait=await page.evaluate(()=>({
  orientation:window.KELO_ORIENTATION.current(),
  base:window.KELO_ORIENTATION.baseZoom(),
  effective:window.KELO_ORIENTATION.effectiveZoom(),
  span:window.KELO_ORIENTATION.verticalWorldSpan(),
  reference:window.KELO_ORIENTATION.portraitReferenceWorldSpan(),
  canvas:[document.getElementById('game-canvas')?.width,document.getElementById('game-canvas')?.height]
}));
if(portrait.orientation!=='portrait')throw new Error('portrait orientation not detected');
if(!Number.isFinite(portrait.base)||portrait.base<=0)throw new Error('invalid portrait base zoom '+portrait.base);
if(Math.abs(portrait.effective-portrait.base)>0.001)throw new Error('portrait effective zoom changed');
if(Math.abs(portrait.span-portrait.reference)>1)throw new Error('portrait FOV reference mismatch');
if(portrait.canvas[0]!==390||portrait.canvas[1]!==844)throw new Error('portrait canvas mismatch '+portrait.canvas.join('x'));
await page.screenshot({path:'artifacts/orientation-equivalent-zoom-portrait.png',fullPage:true});

await page.setViewportSize({width:844,height:390});
await page.waitForTimeout(500);
await page.evaluate(()=>window.KELO_ORIENTATION.sync());
await page.waitForTimeout(700);
const landscape=await page.evaluate(()=>({
  orientation:window.KELO_ORIENTATION.current(),
  base:window.KELO_ORIENTATION.baseZoom(),
  effective:window.KELO_ORIENTATION.effectiveZoom(),
  span:window.KELO_ORIENTATION.verticalWorldSpan(),
  reference:window.KELO_ORIENTATION.portraitReferenceWorldSpan(),
  canvas:[document.getElementById('game-canvas')?.width,document.getElementById('game-canvas')?.height]
}));
if(landscape.orientation!=='landscape')throw new Error('landscape orientation not detected');
if(Math.abs(landscape.base-portrait.base)>0.001)throw new Error(`portrait base changed across rotation ${portrait.base} -> ${landscape.base}`);
const expected=portrait.base*(390/844);
if(Math.abs(landscape.effective-expected)>0.002)throw new Error(`landscape effective zoom ${landscape.effective} != ${expected}`);
if(Math.abs(landscape.span-portrait.span)>1)throw new Error(`landscape FOV ${landscape.span} != portrait FOV ${portrait.span}`);
if(Math.abs(landscape.span-landscape.reference)>1)throw new Error(`landscape FOV ${landscape.span} != portrait reference ${landscape.reference}`);
if(landscape.canvas[0]!==844||landscape.canvas[1]!==390)throw new Error('landscape canvas mismatch '+landscape.canvas.join('x'));
await page.screenshot({path:'artifacts/orientation-equivalent-zoom-landscape.png',fullPage:true});

await page.evaluate(()=>window.cycleZoom());
await page.waitForTimeout(150);
const cycled=await page.evaluate(()=>({base:window.KELO_ORIENTATION.baseZoom(),effective:window.KELO_ORIENTATION.effectiveZoom(),span:window.KELO_ORIENTATION.verticalWorldSpan(),reference:window.KELO_ORIENTATION.portraitReferenceWorldSpan()}));
if(Math.abs(cycled.base-portrait.base)<0.001)throw new Error('cycleZoom did not change portrait base zoom');
if(Math.abs(cycled.span-cycled.reference)>1)throw new Error('cycleZoom broke equivalent FOV');
await page.evaluate(base=>window.KELO_ORIENTATION.setBaseZoom(base),portrait.base);

if(errors.length)throw new Error('page errors: '+errors.join(' | '));
fs.writeFileSync('artifacts/orientation-equivalent-zoom.json',JSON.stringify({portrait,landscape,cycled,errors},null,2));
console.log(JSON.stringify({ok:true,portrait,landscape,cycled},null,2));
await browser.close();
