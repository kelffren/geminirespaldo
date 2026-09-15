import fs from 'node:fs';
import { chromium } from 'playwright';
const BASE=(process.env.AUDIT_URL||'http://127.0.0.1:8000/').replace(/\?+$/,'');
const executablePath=process.env.CHROME_BIN||undefined;
fs.mkdirSync('artifacts/sprite-ability-irregular',{recursive:true});
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));
try{
  await page.goto(`${BASE}?offline=1&mapEditor=1&irregular-import-audit=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KELO_CREATORS_LAUNCHER&&window.KELO_ADMIN_KEYS?.can?.('ability.edit',window.KELO_ADMIN_KEYS.playerId())===true&&window.KeloInputLocks,{timeout:20000});
  await page.evaluate(()=>{document.documentElement.dataset.keloAuthGate='off';void window.KELO_CREATORS_LAUNCHER.open();});
  await page.waitForSelector('#kelo-creators-hub',{state:'visible',timeout:10000});
  await page.getByRole('button',{name:'Abrir Sprite Ability'}).click();
  await page.waitForSelector('#kelo-studio-workspace',{state:'visible',timeout:10000});
  await page.waitForSelector('.sab-easy-mode-toggle',{state:'visible',timeout:5000});
  await page.getByRole('button',{name:'⚙ AVANZADO'}).click();
  await page.waitForFunction(()=>document.getElementById('kelo-studio-workspace')?.dataset?.sabEasy==='0');
  await page.waitForSelector('.sab-irregular-launch',{state:'attached',timeout:5000});
  await page.waitForSelector('.sab-irregular-file',{state:'attached',timeout:5000});

  const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=920;c.height=520;const x=c.getContext('2d');const boxes=[[26,28,92,132],[205,52,118,96],[446,16,82,154],[706,60,112,118],[42,292,128,102],[266,254,88,142],[506,306,122,92],[750,268,96,136]];boxes.forEach((b,i)=>{x.fillStyle=`rgba(${60+i*20},${95+i*13},${210-i*9},1)`;x.fillRect(...b);x.fillStyle='rgba(255,255,255,.95)';x.fillRect(b[0]+Math.round(b[2]*.28),b[1]+Math.round(b[3]*.18),Math.max(12,Math.round(b[2]*.3)),Math.max(12,Math.round(b[3]*.22)));});return c.toDataURL('image/png').split(',')[1];}),'base64');
  await page.locator('.sab-irregular-file').setInputFiles({name:'irregular-freeform.png',mimeType:'image/png',buffer:png});
  await page.waitForSelector('.sab-irregular',{state:'visible',timeout:10000});
  const detected=await page.locator('.sii-frame').count();if(detected!==8)throw new Error(`IRREGULAR_DETECTED:${detected}`);

  await page.getByRole('button',{name:'DIVIDIR V',exact:true}).click();
  if(await page.locator('.sii-frame').count()!==9)throw new Error('IRREGULAR_SPLIT_UI_FAILED');
  await page.getByRole('button',{name:'UNIR SIG.',exact:true}).click();
  if(await page.locator('.sii-frame').count()!==8)throw new Error('IRREGULAR_MERGE_UI_FAILED');
  const foot=page.getByRole('button',{name:/FOOT LOCK/});
  if(!await foot.evaluate(el=>el.classList.contains('on')))throw new Error('IRREGULAR_FOOT_LOCK_DEFAULT_OFF');
  await foot.click();if(await foot.evaluate(el=>el.classList.contains('on')))throw new Error('IRREGULAR_FOOT_LOCK_TOGGLE_OFF_FAILED');
  await foot.click();if(!await foot.evaluate(el=>el.classList.contains('on')))throw new Error('IRREGULAR_FOOT_LOCK_TOGGLE_ON_FAILED');
  const padding=page.locator('.sii-range input[type=range]');await padding.evaluate(el=>{el.value='12';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.screenshot({path:'artifacts/sprite-ability-irregular/irregular-import.png',fullPage:true});
  await page.getByRole('button',{name:'NORMALIZAR Y USAR',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.sab-irregular'),null,{timeout:10000});
  await page.waitForFunction(async()=>{const b=(await import('./src/creators/sprite-ability/sprite-ability-live-controller.mjs')).getSpriteAbilityBuilder();return Boolean(b?.draft?.sheet?.dataUrl)&&String(b?.draft?.sheet?.fileName||'').includes('irregular-normalized')&&b.draft.sheet.endFrame>=7;},null,{timeout:15000});
  const report=await page.evaluate(async()=>{const b=(await import('./src/creators/sprite-ability/sprite-ability-live-controller.mjs')).getSpriteAbilityBuilder();return{import:window.__KELO_SPRITE_IRREGULAR_LAST__||null,sheet:{fileName:b.draft.sheet.fileName,columns:b.draft.sheet.columns,rows:b.draft.sheet.rows,startFrame:b.draft.sheet.startFrame,endFrame:b.draft.sheet.endFrame,frameWidth:b.draft.sheet.frameWidth,frameHeight:b.draft.sheet.frameHeight,autoFit:b.draft.sheet.autoFit},pageErrors:[]};});
  report.pageErrors=pageErrors;if(!report.import||report.import.final!==8||report.import.footLock!==true||report.import.padding!==12)throw new Error(`IRREGULAR_IMPORT_REPORT:${JSON.stringify(report.import)}`);if(report.sheet.columns!==4||report.sheet.rows!==2)throw new Error(`IRREGULAR_GRID:${report.sheet.columns}x${report.sheet.rows}`);if(pageErrors.length)throw new Error(`IRREGULAR_PAGE_ERRORS:${pageErrors.join(' | ')}`);
  fs.writeFileSync('artifacts/sprite-ability-irregular/report.json',JSON.stringify(report,null,2));console.log('SPRITE ABILITY IRREGULAR IMPORT MOBILE AUDIT: PASS');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
