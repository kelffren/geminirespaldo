/* KELO-INDEX
 * area: QA / CREATORS / SPRITE ABILITY
 * keys: MOBILE LIVE EASY MODE UPLOAD IRREGULAR SPRITESHEET AUTO FIT PREVIEW DUMMY GENERATE ANIMATION ABILITY COMBAT LAB
 * purpose: abre el Builder exacto a 390x844, valida Easy Mode, sube una hoja 1983x793 no divisible, exige auto-fit 8x4 y verifica generación de drafts
 */
import fs from 'node:fs';
import { chromium } from 'playwright';
const BASE=(process.env.AUDIT_URL||'http://127.0.0.1:8000/').replace(/\?+$/,'');
const executablePath=process.env.CHROME_BIN||undefined;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
fs.mkdirSync('artifacts/sprite-ability-builder',{recursive:true});
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));
async function builderSnapshot(){return page.evaluate(async()=>{const s=(await import('./src/creators/sprite-ability/sprite-ability-live-controller.mjs')).getSpriteAbilityBuilder();return s?{projectId:s.projectId,version:s.version,draft:s.draft}:null;});}
async function waitBuilder(predicate,{timeout=10000,label='builder state'}={}){const started=Date.now();let value=null;while(Date.now()-started<timeout){value=await builderSnapshot();if(predicate(value))return value;await sleep(80);}throw new Error(`SPRITE_ABILITY_WAIT_TIMEOUT:${label}:${JSON.stringify(value)}`);}
try{
  await page.goto(`${BASE}?offline=1&mapEditor=1&sprite-ability-audit=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KELO_CREATORS_LAUNCHER&&window.KELO_ADMIN_KEYS?.can?.('ability.edit',window.KELO_ADMIN_KEYS.playerId())===true&&window.KeloInputLocks,{timeout:20000});
  await page.evaluate(()=>{document.documentElement.dataset.keloAuthGate='off';});
  const irregularPng=Buffer.from(await page.evaluate(()=>{
    const w=1983,h=793,cols=8,rows=4,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.clearRect(0,0,w,h);
    for(let r=0;r<rows;r++)for(let col=0;col<cols;col++){
      const x0=col*w/cols,x1=(col+1)*w/cols,y0=r*h/rows,y1=(r+1)*h/rows,cx=(x0+x1)/2,cy=(y0+y1)/2;
      x.fillStyle=`rgba(${45+col*13},${110+r*25},240,1)`;x.fillRect(cx-(x1-x0)*.27,cy-(y1-y0)*.28,(x1-x0)*.54,(y1-y0)*.56);
      x.beginPath();x.arc(cx+(col%2?18:-18),cy-12,Math.max(5,(y1-y0)*.08),0,Math.PI*2);x.fillStyle='rgba(255,255,255,.9)';x.fill();
    }
    return c.toDataURL('image/png').split(',')[1];
  }),'base64');
  await page.evaluate(()=>window.KELO_CREATORS_LAUNCHER.open());
  await page.waitForSelector('#kelo-creators-hub',{state:'visible',timeout:10000});
  const spriteButton=page.getByRole('button',{name:'Abrir Sprite Ability'});if(!await spriteButton.isEnabled())throw new Error('SPRITE_ABILITY_CARD_NOT_ACTIVE');
  await spriteButton.click();await page.waitForSelector('#kelo-studio-workspace',{state:'visible',timeout:10000});
  const initial=await page.evaluate(async()=>{const m=await import('./src/creators/sprite-ability/sprite-ability-live-controller.mjs'),s=m.getSpriteAbilityBuilder();return{version:s?.version,projectId:s?.projectId,lockOwners:window.KeloInputLocks.snapshot().owners||[]};});
  if(initial.version!=='sprite-ability-builder-v1.2.0-combat-lab'||!initial.projectId||!initial.lockOwners.includes('kelo-sprite-ability-builder'))throw new Error(`SPRITE_ABILITY_BOOT_FAILED:${JSON.stringify(initial)}`);
  await page.waitForSelector('#kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"]',{state:'attached',timeout:5000});
  const easyDock=page.locator('.sab-easy-dock');if(!await easyDock.isVisible())throw new Error('SPRITE_ABILITY_EASY_DOCK_NOT_VISIBLE');
  const easyLabels=await easyDock.locator('button span').allTextContents();for(const label of ['SUBIR','VER','PROBAR','AJUSTAR','GUARDAR'])if(!easyLabels.includes(label))throw new Error(`SPRITE_ABILITY_EASY_FLOW_MISSING:${label}`);
  const advancedToggle=page.getByRole('button',{name:'⚙ AVANZADO'});if(!await advancedToggle.isVisible())throw new Error('SPRITE_ABILITY_ADVANCED_TOGGLE_NOT_VISIBLE');await advancedToggle.click();
  await page.waitForFunction(()=>document.getElementById('kelo-studio-workspace')?.dataset?.sabEasy==='0',null,{timeout:5000});
  await page.waitForSelector('.ksw-left.mobile-open',{state:'attached',timeout:3000});
  const upload=page.locator('.ksw-left input[type=file]');await upload.setInputFiles({name:'irregular-1983x793.png',mimeType:'image/png',buffer:irregularPng});
  const uploaded=await waitBuilder(s=>s?.draft?.sheet?.autoFit?.applied===true&&s.draft.sheet.columns===8&&s.draft.sheet.rows===4,{timeout:15000,label:'auto-fit 8x4'});
  const sheet=uploaded.draft.sheet;
  if(sheet.imageWidth%sheet.columns!==0||sheet.imageHeight%sheet.rows!==0||sheet.frameWidth*sheet.columns!==sheet.imageWidth||sheet.frameHeight*sheet.rows!==sheet.imageHeight)throw new Error(`SPRITE_ABILITY_NOT_NORMALIZED:${JSON.stringify(sheet)}`);
  if(sheet.autoFit.sourceWidth!==1983||sheet.autoFit.sourceHeight!==793)throw new Error(`SPRITE_ABILITY_SOURCE_DIMENSIONS_LOST:${JSON.stringify(sheet.autoFit)}`);
  if(sheet.autoFit.confidence<.5)throw new Error(`SPRITE_ABILITY_AUTO_FIT_LOW_CONFIDENCE:${sheet.autoFit.confidence}`);
  await page.getByRole('button',{name:'SHEET'}).click();await page.waitForTimeout(160);await page.screenshot({path:'artifacts/sprite-ability-builder/auto-fit-sheet.png',fullPage:true});
  const fps=page.locator('.ksw-left .ksw-field').filter({hasText:'FPS'}).locator('input');await fps.evaluate(el=>{el.value='20';el.dispatchEvent(new Event('change',{bubbles:true}));});
  const eventsTab=page.locator('.ksw-mobile-tabs [data-panel="right"]');if(!await eventsTab.isVisible())throw new Error('SPRITE_ABILITY_EVENTS_TAB_NOT_VISIBLE');await eventsTab.click();
  const impact=page.locator('.ksw-right .ksw-field').filter({hasText:'Impact Frame'}).locator('input');await impact.evaluate(el=>{el.value='7';el.dispatchEvent(new Event('change',{bubbles:true}));});
  const activeStart=page.locator('.ksw-right .ksw-field').filter({hasText:'Active Start'}).locator('input');await activeStart.evaluate(el=>{el.value='6';el.dispatchEvent(new Event('change',{bubbles:true}));});
  const activeEnd=page.locator('.ksw-right .ksw-field').filter({hasText:'Active End'}).locator('input');await activeEnd.evaluate(el=>{el.value='8';el.dispatchEvent(new Event('change',{bubbles:true}));});
  const damage=page.locator('.ksw-right .ksw-field').filter({hasText:'Damage'}).locator('input');await damage.evaluate(el=>{el.value='37';el.dispatchEvent(new Event('change',{bubbles:true}));});
  const knockback=page.locator('.ksw-right .ksw-field').filter({hasText:'Knockback'}).locator('input');await knockback.evaluate(el=>{el.value='29';el.dispatchEvent(new Event('change',{bubbles:true}));});
  await waitBuilder(s=>s?.draft?.sheet?.fps===20&&s.draft.combat.activeStartFrame===6&&s.draft.combat.impactFrame===7&&s.draft.combat.activeEndFrame===8&&s.draft.combat.damage===37&&s.draft.combat.knockback===29,{label:'edited parameters'});
  const timeline=page.locator('.sab-timeline');if(!await timeline.isVisible())throw new Error('SPRITE_ABILITY_TIMELINE_NOT_VISIBLE');
  await page.getByRole('button',{name:'DUMMY'}).click();await waitBuilder(s=>s?.draft?.preview?.mode==='dummy',{label:'dummy mode'});await page.waitForTimeout(180);await page.screenshot({path:'artifacts/sprite-ability-builder/dummy-preview.png',fullPage:true});
  const beforeGenerate=(await builderSnapshot()).draft;
  await page.getByRole('button',{name:'⚡ GENERATE'}).click();
  const settled=await waitBuilder(s=>!!(s?.draft?.generated?.animationProjectId&&s?.draft?.generated?.abilityProjectId),{timeout:10000,label:'generated project ids'});
  const generated=await page.evaluate(async ids=>{const platform=(await import('./src/creators/creator-entry.mjs')).getKeloCreatorsPlatform(),rows=await platform.projects.list({});const animation=await platform.projects.loadDraft(ids.animationProjectId),ability=await platform.projects.loadDraft(ids.abilityProjectId);return{ids,rows:rows.map(p=>({id:p.projectId,type:p.type,name:p.name})),animation:{type:animation?.documentType,asset:animation?.assetSource?.dataUrl?.slice(0,22),fps:animation?.clip?.fps,impact:animation?.clip?.markers?.impact,width:animation?.assetSource?.width,height:animation?.assetSource?.height,autoFit:animation?.authoring?.autoFit,hitbox:animation?.tracks?.hitbox?.[0]},ability:{type:ability?.documentType,animationProjectId:ability?.links?.animationProjectId,damage:ability?.definition?.effects?.find(x=>x.type==='damage')?.amount,active:ability?.definition?.action?.active,autoFit:ability?.authoring?.spriteAutoFit}};},settled.draft.generated);
  if(generated.animation.type!=='ANIMATION'||!generated.animation.asset?.startsWith('data:image/png;base64,')||generated.animation.fps!==20||generated.animation.width%8!==0||generated.animation.height%4!==0||generated.animation.autoFit?.sourceWidth!==1983||generated.animation.hitbox?.start!==.3||generated.animation.hitbox?.end!==.45||generated.ability.type!=='ABILITY'||generated.ability.animationProjectId!==generated.ids.animationProjectId||generated.ability.damage!==37||generated.ability.active!==.15||generated.ability.autoFit?.sourceHeight!==793)throw new Error(`SPRITE_ABILITY_GENERATION_FAILED:${JSON.stringify(generated)}`);
  await page.screenshot({path:'artifacts/sprite-ability-builder/generated.png',fullPage:true});
  await page.locator('.ksw-top [data-act="close"]').click();await page.waitForFunction(()=>!document.getElementById('kelo-studio-workspace'),null,{timeout:5000});
  const locks=await page.evaluate(()=>window.KeloInputLocks.snapshot().owners||[]);if(locks.includes('kelo-sprite-ability-builder'))throw new Error('SPRITE_ABILITY_LOCK_LEAK');
  if(pageErrors.length)throw new Error(`SPRITE_ABILITY_PAGE_ERRORS:${pageErrors.join(' | ')}`);
  const report={ok:true,viewport:'390x844',initial,easyMode:{labels:easyLabels,advancedEntered:true},autoFit:{source:`${sheet.autoFit.sourceWidth}x${sheet.autoFit.sourceHeight}`,detected:`${sheet.columns}x${sheet.rows}`,normalized:`${sheet.imageWidth}x${sheet.imageHeight}`,cell:`${sheet.frameWidth}x${sheet.frameHeight}`,confidence:sheet.autoFit.confidence},beforeGenerate:{fps:beforeGenerate.sheet.fps,activeStart:beforeGenerate.combat.activeStartFrame,impact:beforeGenerate.combat.impactFrame,activeEnd:beforeGenerate.combat.activeEndFrame,damage:beforeGenerate.combat.damage,knockback:beforeGenerate.combat.knockback,mode:beforeGenerate.preview.mode},generated,locksAfterClose:locks,pageErrors};fs.writeFileSync('artifacts/sprite-ability-builder/report.json',JSON.stringify(report,null,2));console.log('KELO SPRITE ABILITY BUILDER COMBAT LAB MOBILE AUDIT: PASS');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
