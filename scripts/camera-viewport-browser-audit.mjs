import fs from 'node:fs';
import { chromium } from 'playwright';

const url=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox']});

async function auditMobile(){
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e?.message||e)));
  await page.goto(url+'?cameraFoundationAudit=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KeloCamera&&window.KELO_ORIENTATION&&window.KELO_HD_RENDER,{timeout:20000});
  await page.waitForTimeout(500);
  const portrait=await page.evaluate(()=>{
    const s=KeloCamera.snapshot();
    const canvas=document.getElementById('game-canvas');
    const center=KeloCamera.screenToWorld(innerWidth/2,innerHeight/2);
    return {snapshot:s,canvas:[canvas.width,canvas.height],center,orientation:KELO_ORIENTATION.current(),hd:KELO_HD_RENDER};
  });
  if(portrait.orientation!=='portrait')throw new Error('portrait orientation not active');
  if(Math.abs(portrait.snapshot.effectiveZoom-portrait.snapshot.baseZoom)>0.002)throw new Error('portrait effective/base zoom mismatch');
  if(portrait.canvas[0]!==Math.floor(390*portrait.snapshot.dpr)||portrait.canvas[1]!==Math.floor(844*portrait.snapshot.dpr))throw new Error('portrait DPR canvas mismatch '+portrait.canvas.join('x'));
  if(Math.abs(portrait.center.x-portrait.snapshot.x)>0.01||Math.abs(portrait.center.y-portrait.snapshot.y)>0.01)throw new Error('screen center does not map to camera center');
  if(portrait.hd.cameraOwner!=='KeloCamera'||portrait.hd.directViewportWrites!==false)throw new Error('HD support is not consuming KeloCamera');

  const roundTrip=await page.evaluate(()=>{
    const point={x:1337.25,y:1666.75};const screen=KeloCamera.worldToScreen(point.x,point.y);const world=KeloCamera.screenToWorld(screen.x,screen.y);return{point,screen,world};
  });
  if(Math.abs(roundTrip.point.x-roundTrip.world.x)>0.01||Math.abs(roundTrip.point.y-roundTrip.world.y)>0.01)throw new Error('screen/world roundtrip mismatch');

  const target=await page.evaluate(()=>{KeloCamera.setTarget(1777,1888,{source:'browser-audit'});return KeloCamera.snapshot();});
  if(target.targetX!==1777||target.targetY!==1888)throw new Error('target API mismatch');
  await page.screenshot({path:'artifacts/camera-foundation-portrait.png',fullPage:true});

  const portraitBase=portrait.snapshot.baseZoom;
  const portraitSpan=844/portrait.snapshot.effectiveZoom;
  await page.setViewportSize({width:844,height:390});
  await page.waitForFunction(()=>window.KELO_ORIENTATION?.current()==='landscape');
  await page.waitForTimeout(500);
  const landscape=await page.evaluate(()=>({snapshot:KeloCamera.snapshot(),orientation:KELO_ORIENTATION.current(),canvas:[document.getElementById('game-canvas').width,document.getElementById('game-canvas').height]}));
  if(landscape.orientation!=='landscape')throw new Error('landscape orientation not active');
  if(Math.abs(landscape.snapshot.baseZoom-portraitBase)>0.002)throw new Error('base zoom changed on rotate');
  const expected=portraitBase*(390/844);
  if(Math.abs(landscape.snapshot.effectiveZoom-expected)>0.003)throw new Error(`landscape zoom ${landscape.snapshot.effectiveZoom} != ${expected}`);
  const landscapeSpan=390/landscape.snapshot.effectiveZoom;
  if(Math.abs(landscapeSpan-portraitSpan)>1)throw new Error('vertical FOV changed on rotate');
  if(landscape.canvas[0]!==Math.floor(844*landscape.snapshot.dpr)||landscape.canvas[1]!==Math.floor(390*landscape.snapshot.dpr))throw new Error('landscape DPR canvas mismatch '+landscape.canvas.join('x'));

  const cycled=await page.evaluate(()=>{const before=KeloCamera.getBaseZoom();window.cycleZoom();return{before,after:KeloCamera.getBaseZoom(),effective:KeloCamera.getEffectiveZoom(),reference:Math.max(innerWidth,innerHeight)/KeloCamera.getBaseZoom(),span:innerHeight/KeloCamera.getEffectiveZoom()};});
  if(Math.abs(cycled.before-cycled.after)<0.001)throw new Error('cycleZoom did not change owner base zoom');
  if(Math.abs(cycled.reference-cycled.span)>1)throw new Error('cycleZoom broke equivalent vertical FOV');
  if(errors.length)throw new Error('mobile page errors: '+errors.join(' | '));
  await page.screenshot({path:'artifacts/camera-foundation-landscape.png',fullPage:true});
  await context.close();
  return{portrait,landscape,cycled,errors};
}

async function auditDesktop(){
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e?.message||e)));
  await page.goto(url+'?cameraFoundationDesktop=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KeloCamera&&window.KELO_HD_RENDER,{timeout:20000});
  await page.waitForTimeout(350);
  const state=await page.evaluate(()=>({snapshot:KeloCamera.snapshot(),canvas:[document.getElementById('game-canvas').width,document.getElementById('game-canvas').height],api:Object.keys(KeloCamera)}));
  if(state.canvas[0]!==Math.floor(1440*state.snapshot.dpr)||state.canvas[1]!==Math.floor(900*state.snapshot.dpr))throw new Error('desktop viewport mismatch');
  for(const name of ['setTarget','focus','setBaseZoom','cycleZoom','screenToWorld','worldToScreen','syncViewport'])if(!state.api.includes(name))throw new Error('desktop API missing '+name);
  if(errors.length)throw new Error('desktop page errors: '+errors.join(' | '));
  await context.close();
  return{state,errors};
}

const mobile=await auditMobile();
const desktop=await auditDesktop();
const report={ok:true,mobile,desktop};
fs.writeFileSync('artifacts/camera-foundation-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({ok:true,portrait:mobile.portrait.snapshot,landscape:mobile.landscape.snapshot,desktop:desktop.state.snapshot},null,2));
await browser.close();
