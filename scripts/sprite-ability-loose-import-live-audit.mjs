import fs from 'node:fs';
import { chromium } from 'playwright';
const BASE=(process.env.AUDIT_URL||'http://127.0.0.1:8000/').replace(/\?+$/,'');
const executablePath=process.env.CHROME_BIN||undefined;
fs.mkdirSync('artifacts/sprite-ability-loose',{recursive:true});
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));
try{
  await page.goto(`${BASE}?offline=1&mapEditor=1&loose-import-audit=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KELO_CREATORS_LAUNCHER&&window.KELO_ADMIN_KEYS?.can?.('ability.edit',window.KELO_ADMIN_KEYS.playerId())===true&&window.KeloInputLocks,{timeout:20000});
  await page.evaluate(()=>{document.documentElement.dataset.keloAuthGate='off';void window.KELO_CREATORS_LAUNCHER.open();});
  await page.waitForSelector('#kelo-creators-hub',{state:'visible',timeout:10000});
  await page.getByRole('button',{name:'Abrir Sprite Ability'}).click();
  await page.waitForSelector('#kelo-studio-workspace',{state:'visible',timeout:10000});
  await page.waitForSelector('.sab-easy-mode-toggle',{state:'visible',timeout:5000});
  await page.getByRole('button',{name:'⚙ AVANZADO'}).click();
  await page.waitForFunction(()=>document.getElementById('kelo-studio-workspace')?.dataset?.sabEasy==='0');
  await page.waitForSelector('.sab-loose-launch',{state:'attached',timeout:5000});
  await page.waitForSelector('.sab-loose-file',{state:'attached',timeout:5000});

  const files=[];
  for(let index=0;index<4;index++){
    const b64=await page.evaluate(i=>{const widths=[94,126,82,112],heights=[132,96,148,118],w=widths[i],h=heights[i],c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#ffffff';x.fillRect(0,0,w,h);x.fillStyle=`rgb(${45+i*35},${105+i*20},${220-i*20})`;const left=i===3?0:Math.round(w*.2),top=Math.round(h*.12),rw=Math.round(w*.58),rh=Math.round(h*.76);x.fillRect(left,top,rw,rh);x.fillStyle='#f6d866';x.fillRect(left+Math.round(rw*.3),top+Math.round(rh*.15),Math.max(8,Math.round(rw*.24)),Math.max(8,Math.round(rh*.18)));return c.toDataURL('image/png').split(',')[1];},index);
    files.push({name:`frame-${index}.png`,mimeType:'image/png',buffer:Buffer.from(b64,'base64')});
  }
  await page.locator('.sab-loose-file').setInputFiles(files);
  await page.waitForFunction(async()=>{const b=(await import('./src/creators/sprite-ability/sprite-ability-live-controller.mjs')).getSpriteAbilityBuilder(),s=b?.draft?.sheet;return Boolean(s?.dataUrl)&&String(s?.fileName||'').includes('loose-4-frames')&&s.columns===4&&s.rows===1&&s.startFrame===0&&s.endFrame===3;},null,{timeout:15000});
  await page.waitForFunction(()=>document.querySelectorAll('.sab-frame canvas').length===4,null,{timeout:5000});
  const report=await page.evaluate(async()=>{
    const b=(await import('./src/creators/sprite-ability/sprite-ability-live-controller.mjs')).getSpriteAbilityBuilder(),s=b.draft.sheet,canvases=[...document.querySelectorAll('.sab-frame canvas')].slice(0,4);let whiteOpaquePixels=0,opaquePixels=0,transparentPixels=0,framesWithTransparentPixels=0,framesWithOpaquePixels=0;const frames=canvases.map((c,index)=>{const p=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data;let white=0,opaque=0,transparent=0;for(let i=0;i<p.length;i+=4){const a=p[i+3];if(a<20)transparent++;else{opaque++;if(a>200&&p[i]>245&&p[i+1]>245&&p[i+2]>245)white++;}}whiteOpaquePixels+=white;opaquePixels+=opaque;transparentPixels+=transparent;if(transparent>0)framesWithTransparentPixels++;if(opaque>0)framesWithOpaquePixels++;return{index,whiteOpaquePixels:white,opaquePixels:opaque,transparentPixels:transparent};});return{sheet:{fileName:s.fileName,columns:s.columns,rows:s.rows,startFrame:s.startFrame,endFrame:s.endFrame,frameWidth:s.frameWidth,frameHeight:s.frameHeight,autoFit:s.autoFit},rendered:{frames,whiteOpaquePixels,opaquePixels,transparentPixels,framesWithTransparentPixels,framesWithOpaquePixels},asset:{prefix:String(s.dataUrl).slice(0,32),length:String(s.dataUrl).length}};
  });
  report.pageErrors=pageErrors;
  if(report.sheet.columns!==4||report.sheet.rows!==1||report.sheet.endFrame!==3)throw new Error(`LOOSE_GRID:${report.sheet.columns}x${report.sheet.rows}:${report.sheet.endFrame}`);
  if(report.rendered.framesWithTransparentPixels!==4||report.rendered.framesWithOpaquePixels!==4)throw new Error(`LOOSE_RENDER_ALPHA:${JSON.stringify(report.rendered)}`);
  if(report.rendered.whiteOpaquePixels>12)throw new Error(`LOOSE_BACKGROUND_WHITE_REMAINS:${report.rendered.whiteOpaquePixels}`);
  if(report.rendered.transparentPixels<=0||report.rendered.opaquePixels<=0)throw new Error(`LOOSE_PIXEL_BALANCE:${JSON.stringify(report.rendered)}`);
  if(pageErrors.length)throw new Error(`LOOSE_PAGE_ERRORS:${pageErrors.join(' | ')}`);
  await page.screenshot({path:'artifacts/sprite-ability-loose/loose-import-builder.png',fullPage:true});
  fs.writeFileSync('artifacts/sprite-ability-loose/report.json',JSON.stringify(report,null,2));
  console.log('SPRITE ABILITY LOOSE IMPORT MOBILE AUDIT: PASS');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
