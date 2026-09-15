import fs from 'node:fs';
import { chromium } from 'playwright';
const BASE=(process.env.AUDIT_URL||'http://127.0.0.1:8000/').replace(/\?+$/,'');
const executablePath=process.env.CHROME_BIN||undefined;
fs.mkdirSync('artifacts/sprite-ability-repair',{recursive:true});
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));
const snap=()=>page.evaluate(async()=>{const b=(await import('./src/creators/sprite-ability/sprite-ability-live-controller.mjs')).getSpriteAbilityBuilder();return b?{projectId:b.projectId,sheet:{...b.draft.sheet},combat:{...b.draft.combat}}:null;});
const selectedThumb=()=>page.locator('.sr-frame.selected canvas').evaluate(c=>c.toDataURL());
const stageImage=()=>page.locator('.sr-stage').evaluate(c=>c.toDataURL());
const frameThumbs=()=>page.locator('.sr-frame canvas').evaluateAll(nodes=>nodes.map(c=>c.toDataURL()));
async function dragStage(fromX,fromY,toX,toY){const box=await page.locator('.sr-stage').boundingBox();if(!box)throw new Error('REPAIR_STAGE_BOX_MISSING');const ax=box.x+box.width*fromX,ay=box.y+box.height*fromY,bx=box.x+box.width*toX,by=box.y+box.height*toY;await page.mouse.move(ax,ay);await page.mouse.down();await page.mouse.move(bx,by,{steps:5});await page.mouse.up();await page.waitForTimeout(80);}
async function clickStage(x=.5,y=.72){const box=await page.locator('.sr-stage').boundingBox();if(!box)throw new Error('REPAIR_STAGE_BOX_MISSING');await page.mouse.click(box.x+box.width*x,box.y+box.height*y);await page.waitForTimeout(80);}
async function touchStage(events){await page.locator('.sr-stage').evaluate((stage,items)=>{const r=stage.getBoundingClientRect();for(const item of items){const up=item.type==='pointerup'||item.type==='pointercancel';stage.dispatchEvent(new PointerEvent(item.type,{bubbles:true,cancelable:true,pointerId:item.id,pointerType:'touch',isPrimary:item.primary===true,clientX:r.left+r.width*item.x,clientY:r.top+r.height*item.y,buttons:up?0:1,pressure:up?0:.5,width:18,height:18}));}},events);await page.waitForTimeout(100);}
try{
  await page.goto(`${BASE}?offline=1&mapEditor=1&sprite-repair-audit=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KELO_CREATORS_LAUNCHER&&window.KELO_ADMIN_KEYS?.can?.('ability.edit',window.KELO_ADMIN_KEYS.playerId())===true&&window.KeloInputLocks,{timeout:20000});
  await page.evaluate(()=>{document.documentElement.dataset.keloAuthGate='off';void window.KELO_CREATORS_LAUNCHER.open();});
  await page.waitForSelector('#kelo-creators-hub',{state:'visible',timeout:10000});
  await page.getByRole('button',{name:'Abrir Sprite Ability'}).click();
  await page.waitForSelector('#kelo-studio-workspace',{state:'visible',timeout:10000});
  await page.waitForSelector('.sab-easy-mode-toggle',{state:'visible',timeout:5000});
  await page.getByRole('button',{name:'⚙ AVANZADO'}).click();
  await page.waitForFunction(()=>document.getElementById('kelo-studio-workspace')?.dataset?.sabEasy==='0');

  const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');for(let r=0;r<2;r++)for(let col=0;col<4;col++){const ox=col*128,oy=r*128;x.fillStyle=`rgba(${70+col*30},${120+r*60},220,1)`;x.fillRect(ox+34,oy+24,60,88);x.fillStyle='rgba(255,255,255,.9)';x.fillRect(ox+52,oy+35,24,24);x.clearRect(ox,oy,10,10);}return c.toDataURL('image/png').split(',')[1];}),'base64');
  const replacementPng=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=96;c.height=96;const x=c.getContext('2d');x.clearRect(0,0,96,96);x.fillStyle='rgba(245,70,90,1)';x.fillRect(15,10,66,78);x.fillStyle='rgba(255,225,80,1)';x.beginPath();x.arc(48,38,15,0,Math.PI*2);x.fill();return c.toDataURL('image/png').split(',')[1];}),'base64');
  await page.locator('.ksw-left input[type=file]').setInputFiles({name:'repair-source.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(async()=>{const b=(await import('./src/creators/sprite-ability/sprite-ability-live-controller.mjs')).getSpriteAbilityBuilder();return !!b?.draft?.sheet?.dataUrl&&b.draft.sheet.endFrame>=7;},null,{timeout:12000});

  await page.evaluate(()=>{const ws=document.getElementById('kelo-studio-workspace');const set=(label,value)=>{for(const row of ws.querySelectorAll('.ksw-right .ksw-field'))if(row.querySelector('label')?.textContent?.trim()===label){const i=row.querySelector('input,select');i.value=String(value);i.dispatchEvent(new Event('change',{bubbles:true}));return;}};set('Impact Frame',3);set('Active Start',2);set('Active End',4);set('Hitbox X',11);set('Hitbox Y',-33);set('Hitbox W',77);set('Hitbox H',55);});
  await page.locator('[data-panel="left"]').click();
  await page.waitForSelector('.ksw-left.mobile-open',{state:'visible',timeout:5000});
  await page.waitForSelector('.sab-repair-launch',{state:'visible',timeout:5000});
  const before=await snap();
  await page.getByRole('button',{name:/REPARAR SPRITE/}).click();
  await page.waitForSelector('.sab-repair',{state:'visible',timeout:5000});
  await page.waitForSelector('.sr-stage[data-sr-touch-gestures="1"]',{state:'visible',timeout:5000});
  const touchHelp=await page.locator('.sr-touch-help').textContent();if(!touchHelp?.includes('MOVER: escala')||!touchHelp?.includes('BORRAR: tamaño'))throw new Error(`REPAIR_TOUCH_HELP_MISSING:${touchHelp}`);
  const tools=await page.locator('.sr-mode button').allTextContents();
  for(const label of ['✥ MOVER','⌖ PIVOT','✂ CROP','⌫ BORRAR'])if(!tools.includes(label))throw new Error(`REPAIR_TOOL_MISSING:${label}`);
  const count0=await page.locator('.sr-frame').count();if(count0!==8)throw new Error(`REPAIR_FRAME_COUNT:${count0}`);
  const scale=page.locator('.sr-range input[type=range]').first(),brush=page.locator('.sr-range input[type=range]').nth(1);

  await page.getByRole('button',{name:'✥ MOVER',exact:true}).click();
  let pixelBefore=await selectedThumb();await dragStage(.50,.50,.60,.46);let pixelAfter=await selectedThumb();if(pixelAfter===pixelBefore)throw new Error('REPAIR_MOVE_NO_PIXEL_CHANGE');
  if(!(await page.locator('.sr-preview-badge').textContent())?.includes('MOVE'))throw new Error('REPAIR_MOVE_MODE_NOT_ACTIVE');

  const scaleBefore=Number(await scale.inputValue()),pinchThumbBefore=await selectedThumb();
  await touchStage([{type:'pointerdown',id:31,primary:true,x:.42,y:.52},{type:'pointerdown',id:32,x:.58,y:.52},{type:'pointermove',id:31,primary:true,x:.31,y:.47},{type:'pointermove',id:32,x:.69,y:.43},{type:'pointerup',id:31,primary:true,x:.31,y:.47},{type:'pointerup',id:32,x:.69,y:.43}]);
  const scaleAfterPinch=Number(await scale.inputValue()),pinchThumbAfter=await selectedThumb();
  if(!(scaleAfterPinch>scaleBefore+.08))throw new Error(`REPAIR_TOUCH_PINCH_NO_SCALE:${scaleBefore}->${scaleAfterPinch}`);
  if(pinchThumbAfter===pinchThumbBefore)throw new Error('REPAIR_TOUCH_PINCH_NO_PIXEL_CHANGE');
  if(await page.locator('.sr-stage').getAttribute('data-sr-gesture'))throw new Error('REPAIR_TOUCH_PINCH_STUCK');

  await page.getByRole('button',{name:'⌖ PIVOT',exact:true}).click();
  const pivotThumbBefore=await selectedThumb(),pivotStageBefore=await stageImage();await clickStage(.56,.70);const pivotThumbAfter=await selectedThumb(),pivotStageAfter=await stageImage();
  if(pivotStageAfter===pivotStageBefore)throw new Error('REPAIR_PIVOT_MARKER_DID_NOT_MOVE');
  if(pivotThumbAfter!==pivotThumbBefore)throw new Error('REPAIR_PIVOT_MOVED_FRAME_PIXELS');
  if(!(await page.locator('.sr-preview-badge').textContent())?.includes('PIVOT'))throw new Error('REPAIR_PIVOT_MODE_NOT_ACTIVE');

  await page.getByRole('button',{name:'✂ CROP',exact:true}).click();
  pixelBefore=await selectedThumb();await dragStage(.38,.34,.66,.72);pixelAfter=await selectedThumb();if(pixelAfter===pixelBefore)throw new Error('REPAIR_CROP_NO_PIXEL_CHANGE');
  if(!(await page.locator('.sr-preview-badge').textContent())?.includes('CROP'))throw new Error('REPAIR_CROP_MODE_NOT_ACTIVE');

  await page.getByRole('button',{name:'⌫ BORRAR',exact:true}).click();
  const brushBefore=Number(await brush.inputValue());
  await touchStage([{type:'pointerdown',id:51,primary:true,x:.44,y:.58},{type:'pointerdown',id:52,x:.56,y:.58},{type:'pointermove',id:51,primary:true,x:.34,y:.58},{type:'pointermove',id:52,x:.66,y:.58},{type:'pointerup',id:51,primary:true,x:.34,y:.58},{type:'pointerup',id:52,x:.66,y:.58}]);
  const brushAfterPinch=Number(await brush.inputValue());
  if(!(brushAfterPinch>brushBefore))throw new Error(`REPAIR_TOUCH_BRUSH_NO_RESIZE:${brushBefore}->${brushAfterPinch}`);
  if(await page.locator('.sr-stage').getAttribute('data-sr-gesture'))throw new Error('REPAIR_TOUCH_BRUSH_STUCK');

  pixelBefore=await selectedThumb();
  await touchStage([{type:'pointerdown',id:41,primary:true,x:.49,y:.49},{type:'pointermove',id:41,primary:true,x:.52,y:.52}]);
  const ringState=await page.locator('.sr-touch-brush-ring').evaluate(el=>({hidden:el.hidden,width:parseFloat(el.style.width)||0,height:parseFloat(el.style.height)||0,left:el.style.left,top:el.style.top}));
  if(ringState.hidden||ringState.width<6||ringState.height<6)throw new Error(`REPAIR_TOUCH_BRUSH_RING_MISSING:${JSON.stringify(ringState)}`);
  await touchStage([{type:'pointermove',id:41,primary:true,x:.55,y:.55},{type:'pointerup',id:41,primary:true,x:.55,y:.55}]);
  pixelAfter=await selectedThumb();if(pixelAfter===pixelBefore)throw new Error('REPAIR_TOUCH_ERASER_NO_PIXEL_CHANGE');
  if(!(await page.locator('.sr-preview-badge').textContent())?.includes('ERASER'))throw new Error('REPAIR_ERASER_MODE_NOT_ACTIVE');
  if(!(await page.locator('.sr-touch-brush-ring').evaluate(el=>el.hidden)))throw new Error('REPAIR_TOUCH_BRUSH_RING_STUCK');

  pixelBefore=await selectedThumb();
  await page.locator('.sab-repair input[type=file]').setInputFiles({name:'single-frame-replacement.png',mimeType:'image/png',buffer:replacementPng});
  await page.waitForTimeout(180);pixelAfter=await selectedThumb();if(pixelAfter===pixelBefore)throw new Error('REPAIR_REPLACE_NO_PIXEL_CHANGE');

  const orderBefore=await frameThumbs();
  await page.getByRole('button',{name:'MOVER →',exact:true}).click();
  const orderAfter=await frameThumbs();
  if(orderAfter.length!==orderBefore.length||orderAfter[0]!==orderBefore[1]||orderAfter[1]!==orderBefore[0])throw new Error('REPAIR_REORDER_FAILED');
  await page.getByRole('button',{name:'← MOVER',exact:true}).click();

  await page.getByRole('button',{name:'DUPLICAR'}).click();if(await page.locator('.sr-frame').count()!==9)throw new Error('REPAIR_DUPLICATE_FAILED');
  await page.getByRole('button',{name:'ELIMINAR'}).click();if(await page.locator('.sr-frame').count()!==8)throw new Error('REPAIR_DELETE_FAILED');
  await page.getByRole('button',{name:'ONION SKIN'}).click();
  await page.getByRole('button',{name:'USAR COMO REF'}).click();
  await page.getByRole('button',{name:'ALINEAR TODOS'}).click();
  await page.getByRole('button',{name:'TRIM TODOS'}).click();
  await page.getByRole('button',{name:'CENTRAR'}).click();
  await scale.evaluate(el=>{el.value='1.17';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.getByRole('button',{name:'▶ PLAY',exact:true}).click();await page.waitForTimeout(180);await page.getByRole('button',{name:'Ⅱ PAUSE',exact:true}).click();
  await page.screenshot({path:'artifacts/sprite-ability-repair/repair-studio.png',fullPage:true});
  await page.evaluate(()=>{window.__spriteRepairToasts=[];const original=window.showToast;window.showToast=function(message,...args){window.__spriteRepairToasts.push(String(message));try{return original?.call(this,message,...args);}catch{return undefined;}};});
  await page.getByRole('button',{name:'APLICAR REPARACIÓN'}).click();
  try{await page.waitForFunction(()=>!document.querySelector('.sab-repair'),null,{timeout:12000});}
  catch(error){const debug=await page.evaluate(async()=>{const b=(await import('./src/creators/sprite-ability/sprite-ability-live-controller.mjs')).getSpriteAbilityBuilder();return{overlay:Boolean(document.querySelector('.sab-repair')),toasts:window.__spriteRepairToasts||[],status:document.querySelector('#kelo-studio-workspace .ksw-status')?.textContent||null,sheet:b?{fileName:b.draft.sheet.fileName,dataUrlChanged:Boolean(b.draft.sheet.dataUrl),columns:b.draft.sheet.columns,rows:b.draft.sheet.rows,startFrame:b.draft.sheet.startFrame,endFrame:b.draft.sheet.endFrame,frameWidth:b.draft.sheet.frameWidth,frameHeight:b.draft.sheet.frameHeight}:null,combat:b?{impactFrame:b.draft.combat.impactFrame,activeStartFrame:b.draft.combat.activeStartFrame,activeEndFrame:b.draft.combat.activeEndFrame}:null};});console.log('SPRITE_REPAIR_APPLY_DEBUG');console.log(JSON.stringify(debug,null,2));throw new Error(`SPRITE_REPAIR_APPLY_FAILED:${JSON.stringify(debug)}`,{cause:error});}
  const after=await snap();
  if(after.sheet.dataUrl===before.sheet.dataUrl)throw new Error('REPAIR_SHEET_NOT_REPLACED');
  if(after.sheet.endFrame!==7)throw new Error(`REPAIR_FRAME_RANGE_LOST:${after.sheet.endFrame}`);
  for(const [k,v] of Object.entries({impactFrame:3,activeStartFrame:2,activeEndFrame:4,hitboxX:11,hitboxY:-33,hitboxWidth:77,hitboxHeight:55}))if(after.combat[k]!==v)throw new Error(`REPAIR_COMBAT_NOT_PRESERVED:${k}:${after.combat[k]}!=${v}`);
  if(pageErrors.length)throw new Error(`REPAIR_PAGE_ERRORS:${pageErrors.join(' | ')}`);
  const report={ok:true,viewport:'390x844',frames:8,tools,touchHelp,scaleBefore,scaleAfterPinch,brushBefore,brushAfterPinch,brushRing:ringState,exercised:['one-finger-move','touch-pinch-scale','touch-midpoint-pan','pivot','crop','touch-pinch-brush-size','touch-eraser-footprint','touch-eraser','replace','reorder','duplicate','delete','onion','reference','align-all','trim-all','center','scale-slider','preview','apply'],before:{impact:before.combat.impactFrame,hitbox:[before.combat.hitboxX,before.combat.hitboxY,before.combat.hitboxWidth,before.combat.hitboxHeight]},after:{impact:after.combat.impactFrame,hitbox:[after.combat.hitboxX,after.combat.hitboxY,after.combat.hitboxWidth,after.combat.hitboxHeight],columns:after.sheet.columns,rows:after.sheet.rows,frame:`${after.sheet.frameWidth}x${after.sheet.frameHeight}`},pageErrors};
  fs.writeFileSync('artifacts/sprite-ability-repair/report.json',JSON.stringify(report,null,2));console.log('SPRITE REPAIR STUDIO MOBILE TOUCH AUDIT: PASS');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
