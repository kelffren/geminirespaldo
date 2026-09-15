/* KELO-INDEX
 * area: QA / CAMERA FEEL
 * owner: live-camera-reversal-judge
 * keys: CAMERA REVERSAL LOOKAHEAD MOBILE DESKTOP CHROMIUM RESPONSE CONTINUITY
 * purpose: ejecuta el runtime real y mide RIGHT→LEFT del look-ahead en mobile landscape y desktop
 * online: N/A; presentación cliente, sin mutar autoridad ni persistencia
 * do-not: NO gameplay, NO tuning, NO segundo camera owner
 */
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const viewports=[
  {name:'mobile-landscape',viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true},
  {name:'desktop',viewport:{width:1440,height:900},deviceScaleFactor:1,isMobile:false,hasTouch:false}
];
const results=[];
try{
  for(const cfg of viewports){
    const context=await browser.newContext(cfg);
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
    await page.goto(base+(base.includes('?')?'&':'?')+'offline=1&camera-reversal='+Date.now(),{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(()=>!!(window.KeloCamera&&window.KeloInput),null,{timeout:15000});
    await page.evaluate(()=>{
      window.__qaCameraDir=1;
      window.__qaCameraInput=window.KeloInput.after('qa:camera-reversal-input',ctx=>{
        if(!ctx?.input)return;ctx.input.normX=window.__qaCameraDir;ctx.input.normY=0;
      },9999);
    });
    await page.waitForTimeout(1100);
    const before=await page.evaluate(()=>window.KeloCamera.snapshot());
    await page.evaluate(()=>{window.__qaCameraDir=-1;window.__qaCameraFlipAt=performance.now();});
    const samples=[];
    let crossed=false;
    const deadline=Date.now()+260;
    while(Date.now()<deadline){
      const s=await page.evaluate(()=>({t:performance.now()-window.__qaCameraFlipAt,cam:window.KeloCamera.snapshot()}));
      samples.push(s);
      if(s.cam.lookOffsetX<=0){crossed=true;break;}
      await page.waitForTimeout(4);
    }
    const crossMs=crossed?samples.at(-1).t:null;
    let maxLookStep=0;
    for(let i=1;i<samples.length;i++)maxLookStep=Math.max(maxLookStep,Math.abs(samples[i].cam.lookOffsetX-samples[i-1].cam.lookOffsetX));
    await page.waitForTimeout(120);
    const after=await page.evaluate(()=>window.KeloCamera.snapshot());
    const row={viewport:cfg.name,before:{lookOffsetX:before.lookOffsetX,zoom:before.effectiveZoom,version:before.version},crossMs,maxLookStep,after:{lookOffsetX:after.lookOffsetX,reversal:after.reversalResponse},pageErrors:errors};
    row.ok=errors.length===0&&before.lookOffsetX>20&&crossMs!=null&&crossMs<=105&&maxLookStep<22&&after.lookOffsetX<0&&before.version==='kelo-camera-v1.6.1-reversal-response'&&before.reversalResponse?.multiplier===2.5;
    results.push(row);
    await context.close();
  }
}finally{await browser.close();}
const ok=results.every(r=>r.ok);
console.log(JSON.stringify({ok,results},null,2));
if(!ok)throw new Error('LIVE_CAMERA_REVERSAL_FEEL_FAILED');