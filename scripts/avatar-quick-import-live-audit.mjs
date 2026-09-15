/* KELO-INDEX
 * area: CREATORS / AVATAR QA
 * keys: AVATAR UNIVERSAL-COMPILER MOBILE CANONICAL-RIG STRIP HORIZONTAL VERTICAL READY-STATE
 * purpose: real mobile-browser proof for V5 upload, canonical preview, transparent grids and horizontal/vertical strips
 * online: N/A; network is stubbed so the test isolates the browser compiler/UI
 */
import {chromium} from 'playwright';
import zlib from 'node:zlib';

const BASE=(process.env.AUDIT_URL||'http://127.0.0.1:4173/').replace(/\?+$/,'');
const executablePath=process.env.CHROME_BIN||undefined;
function crc32(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
function makeSheet({width=1254,height=1254,columns=4,rows=4,transparent=false,irregular=false}={}){
  const stride=width*4,raw=Buffer.alloc((stride+1)*height),bg=transparent?[0,0,0,0]:[255,255,255,255];
  for(let y=0;y<height;y++){const row=y*(stride+1);raw[row]=0;for(let x=0;x<width;x++){const i=row+1+x*4;raw[i]=bg[0];raw[i+1]=bg[1];raw[i+2]=bg[2];raw[i+3]=bg[3];}}
  const px=(x,y,c)=>{if(x<0||y<0||x>=width||y>=height)return;const i=y*(stride+1)+1+x*4;raw[i]=c[0];raw[i+1]=c[1];raw[i+2]=c[2];raw[i+3]=c[3]??255;};
  const rect=(x0,y0,x1,y1,c)=>{for(let y=Math.max(0,Math.floor(y0));y<Math.min(height,Math.ceil(y1));y++)for(let x=Math.max(0,Math.floor(x0));x<Math.min(width,Math.ceil(x1));x++)px(x,y,c);};
  const cw=width/columns,ch=height/rows;
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const jx=irregular?[-.08,.03,-.02,.07][col%4]*cw:0,jy=irregular?[.05,-.05,.03,-.02][row%4]*ch:0,cx=(col+.5)*cw+jx,cy=(row+.5)*ch+jy,scale=Math.min(cw,ch),skin=[198,118,72,255],dark=[46,35,31,255],gold=[190,127,28,255];
    rect(cx-scale*.18,cy-scale*.18,cx+scale*.18,cy+scale*.25,skin);rect(cx-scale*.10,cy-scale*.36,cx+scale*.10,cy-scale*.16,skin);rect(cx-scale*.15,cy-scale*.10,cx+scale*.15,cy+scale*.08,[255,255,255,255]);rect(cx-scale*.18,cy+scale*.05,cx+scale*.18,cy+scale*.09,gold);rect(cx-scale*.15,cy+scale*.20,cx-scale*.03,cy+scale*.39,skin);rect(cx+scale*.03,cy+scale*.20,cx+scale*.15,cy+scale*.39,skin);
    if(row===0)rect(cx-scale*.07,cy-scale*.31,cx+scale*.07,cy-scale*.25,dark);else if(row===1)rect(cx-scale*.10,cy-scale*.31,cx-scale*.04,cy-scale*.25,dark);else if(row===2)rect(cx+scale*.04,cy-scale*.31,cx+scale*.10,cy-scale*.25,dark);
  }
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:8})),chunk('IEND',Buffer.alloc(0))]);
}

const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.evaluate(async()=>{const mod=await import(`/src/creators/ui/avatar-workspace.mjs?v5-live=${Date.now()}`);window.__avatarV5Use=null;await mod.openAvatarQuickImport({root:window,avatarQuick:{hydrateActive:async()=>null,importAndUse:async(file,config)=>{window.__avatarV5Use={name:file.name,columns:config.columns,rows:config.rows,compilerVersion:config.compilerVersion,universalAuto:config.universalAuto,sourceRects:config.sourceRects?.length||0};return{manifest:{displayName:'QA Universal Avatar'}};}}});});
  await page.waitForSelector('#kelo-avatar-quick',{state:'visible',timeout:10000});
  const input=page.locator('#kelo-avatar-quick input[type="file"]');
  await input.setInputFiles({name:'kelo-irregular-1254.png',mimeType:'image/png',buffer:makeSheet({irregular:true})});
  await page.waitForFunction(()=>{const b=document.querySelector('#kelo-avatar-quick .kaq-use'),s=document.querySelector('#kelo-avatar-quick .kaq-status')?.textContent||'';return (b&&!b.disabled)||/UNIVERSAL_|AVATAR_/.test(s);},null,{timeout:45000});
  const ui=await page.evaluate(()=>({status:document.querySelector('.kaq-status')?.textContent||'',chips:[...document.querySelectorAll('.kaq-chip')].map(x=>x.textContent),advancedOpen:!!document.querySelector('.kaq-advanced')?.open,firstFrame:document.querySelector('.kaq-preview canvas')?.toDataURL()}));
  console.log('AVATAR_V5_UI_READY',JSON.stringify({status:ui.status,chips:ui.chips,advancedOpen:ui.advancedOpen}));
  if(!ui.chips.includes('AUTO-CROP'))throw new Error(`AVATAR_V5_AUTOCROP_MISSING:${ui.chips.join(',')}`);
  if(!ui.chips.includes('RIG KELO 4D'))throw new Error(`AVATAR_V5_CANONICAL_RIG_MISSING:${ui.chips.join(',')}`);
  if(!ui.chips.some(x=>x.startsWith('SALUD ')))throw new Error(`AVATAR_V5_HEALTH_MISSING:${ui.chips.join(',')}`);
  await page.waitForTimeout(190);const frame2=await page.locator('.kaq-preview canvas').evaluate(c=>c.toDataURL());if(frame2===ui.firstFrame)throw new Error('AVATAR_V5_PREVIEW_NOT_ANIMATING');

  const direct=await page.evaluate(async payload=>{const mod=await import(`/src/creators/avatar/kelo-universal-asset-compiler.mjs?v5-proof=${Date.now()}`),run=async(name,bytes)=>{const file=new File([new Uint8Array(bytes)],name,{type:'image/png'}),a=await mod.analyzeUniversalAvatarAsset(file,{root:window}),c=await mod.compileUniversalAvatarRuntime(file,a,{root:window});return{source:[a.columns,a.rows],hypotheses:a.hypotheses?.map(x=>x.mode)||[],stripHint:a.stripHint?{mode:a.stripHint.mode,frames:a.stripHint.frames,score:a.stripHint.score}:null,compilerVersion:a.compilerVersion,compiled:[c.columns,c.rows],rowMap:c.rowMap,canonicalRig:c.canonicalRig,scaleLocked:c.scaleLocked,footAnchor:c.footAnchor,health:c.validation?.health,strategy:c.strategy};};return{transparent:await run('transparent-3x4.png',payload.transparent),horizontal:await run('walk-strip-6x1.png',payload.horizontal),vertical:await run('walk-strip-1x6.png',payload.vertical)};},{transparent:[...makeSheet({width:360,height:480,columns:3,rows:4,transparent:true})],horizontal:[...makeSheet({width:480,height:80,columns:6,rows:1,transparent:true})],vertical:[...makeSheet({width:80,height:480,columns:1,rows:6,transparent:true})]});
  if(!/^5\./.test(String(direct.transparent.compilerVersion||''))||direct.transparent.source[0]!==3||direct.transparent.source[1]!==4||direct.transparent.compiled[1]!==4||!direct.transparent.canonicalRig)throw new Error(`AVATAR_V5_TRANSPARENT_FAILED:${JSON.stringify(direct.transparent)}`);
  if(direct.horizontal.compiled[0]!==6||direct.horizontal.compiled[1]!==4||direct.horizontal.strategy!=='projection-strip-horizontal'||direct.horizontal.stripHint?.frames!==6||!direct.horizontal.canonicalRig)throw new Error(`AVATAR_V5_HORIZONTAL_STRIP_FAILED:${JSON.stringify(direct.horizontal)}`);
  if(direct.vertical.compiled[0]!==6||direct.vertical.compiled[1]!==4||direct.vertical.strategy!=='projection-strip-vertical'||direct.vertical.stripHint?.frames!==6||!direct.vertical.canonicalRig)throw new Error(`AVATAR_V5_VERTICAL_STRIP_FAILED:${JSON.stringify(direct.vertical)}`);
  for(const face of ['left','down','up','right']){await page.locator(`.kaq-directions button[data-face="${face}"]`).click();if(!await page.locator(`.kaq-directions button[data-face="${face}"]`).evaluate(b=>b.classList.contains('on')))throw new Error(`AVATAR_V5_DIRECTION_PREVIEW_FAILED:${face}`);}
  await page.getByRole('button',{name:'USAR COMO AVATAR'}).click();await page.waitForFunction(()=>document.querySelector('.kaq-use')?.textContent?.includes('AVATAR ACTIVO'),null,{timeout:5000});
  const used=await page.evaluate(()=>window.__avatarV5Use);if(!used||used.columns!==4||used.rows!==4||used.sourceRects!==16||!/^5\./.test(String(used.compilerVersion||''))||used.universalAuto!==true)throw new Error(`AVATAR_V5_USE_FAILED:${JSON.stringify(used)}`);
  if(pageErrors.length)throw new Error(`AVATAR_V5_PAGE_ERRORS:${pageErrors.join(' | ')}`);
  console.log(JSON.stringify({ok:true,ui:{status:ui.status,chips:ui.chips},transparent:direct.transparent,horizontalStrip:direct.horizontal,verticalStrip:direct.vertical,activated:used},null,2));
}finally{await browser.close();}
