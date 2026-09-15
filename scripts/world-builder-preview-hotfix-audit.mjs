import { chromium } from 'playwright';
import fs from 'node:fs';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:chrome});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(String(e)));

await page.goto(base+'?mapEditor=1&audit=preview-hotfix',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.KELO_WORLD_EDIT?.ready&&window.KELO_WORLD_BUILDER_UI&&window.KELO_WORLD_BUILDER_PREVIEW_FIX&&window.KELO_ADMIN_KEYS?.can?.('world.edit',window.KELO_ADMIN_KEYS.playerId()),{timeout:12000});

await page.evaluate(()=>{
  localStorage.removeItem('kelo_world_edit_authority_v1');
  localStorage.removeItem('kelo_world_builder_state_v1');
  localStorage.removeItem('kelo_property_state_v1');
});
await page.reload({waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.KELO_WORLD_EDIT?.ready&&window.KELO_WORLD_BUILDER_UI&&window.KELO_WORLD_BUILDER_PREVIEW_FIX&&window.KELO_ADMIN_KEYS?.can?.('world.edit',window.KELO_ADMIN_KEYS.playerId()),{timeout:12000});

await page.locator('#kelo-world-builder-fab').click();
await page.waitForFunction(()=>window.KELO_WORLD_BUILDER_UI.isOpen&&window.KELO_WORLD_BUILDER_UI.currentDraft?.draftId&&document.getElementById('wb-preview'));
const setup=await page.evaluate(async()=>{
  const E=window.KELO_WORLD_EDIT,U=window.KELO_WORLD_BUILDER_UI,pid=window.KELO_ADMIN_KEYS.playerId(),d=U.currentDraft;
  await E.request('world:tile:paint',{actorId:pid,draftId:d.draftId,x:320,y:320,brushSize:1,material:'marble',role:'terrain'});
  return {draftId:d.draftId,beforeView:E.getViewState(),cells:Object.keys(window.KELO_WORLD_BUILDER.snapshot().cells||{}).length};
});

await page.locator('#wb-preview').click();
await page.waitForFunction(()=>window.KELO_WORLD_BUILDER_PREVIEW_FIX.active===true&&document.body.classList.contains('kelo-world-preview-clean')&&window.KELO_WORLD_EDIT.getViewState().kind==='preview');
const preview=await page.evaluate(()=>({
  fixActive:window.KELO_WORLD_BUILDER_PREVIEW_FIX.active,
  view:window.KELO_WORLD_EDIT.getViewState(),
  builderDisplay:getComputedStyle(document.getElementById('kelo-world-builder')).display,
  exitDisplay:getComputedStyle(document.getElementById('kelo-world-preview-exit')).display,
  uiOpen:window.KELO_WORLD_BUILDER_UI.isOpen,
  guideOpen:window.KELO_WORLD_BUILDER_UI.guideState().open,
  cells:Object.keys(window.KELO_WORLD_BUILDER.snapshot().cells||{}).length
}));
if(!preview.fixActive||preview.view.kind!=='preview'||preview.builderDisplay!=='none'||preview.exitDisplay==='none'||preview.uiOpen||preview.guideOpen||preview.cells<1)throw new Error('Preview clean-state failed '+JSON.stringify(preview));
await page.screenshot({path:'artifacts/world-builder-preview-mobile.png',fullPage:true});

await page.locator('#kelo-world-preview-exit').click();
await page.waitForFunction(()=>window.KELO_WORLD_BUILDER_PREVIEW_FIX.active===false&&!document.body.classList.contains('kelo-world-preview-clean')&&window.KELO_WORLD_BUILDER_UI.isOpen===true&&window.KELO_WORLD_EDIT.getViewState().kind==='draft');
const returned=await page.evaluate(()=>({
  view:window.KELO_WORLD_EDIT.getViewState(),
  builderDisplay:getComputedStyle(document.getElementById('kelo-world-builder')).display,
  previewButton:document.getElementById('wb-preview')?.textContent||'',
  guideOpen:window.KELO_WORLD_BUILDER_UI.guideState().open
}));
if(returned.view.kind!=='draft'||returned.builderDisplay==='none'||!returned.previewButton.includes('VISTA PREVIA')||!returned.guideOpen)throw new Error('Return-to-edit failed '+JSON.stringify(returned));

await page.setViewportSize({width:844,height:390});
await page.locator('#wb-preview').click();
await page.waitForFunction(()=>window.KELO_WORLD_BUILDER_PREVIEW_FIX.active===true&&window.KELO_WORLD_EDIT.getViewState().kind==='preview');
const landscapeExit=await page.locator('#kelo-world-preview-exit').boundingBox();
if(!landscapeExit||landscapeExit.x<0||landscapeExit.y<0||landscapeExit.x+landscapeExit.width>844||landscapeExit.y+landscapeExit.height>390)throw new Error('Landscape preview exit outside viewport');
await page.screenshot({path:'artifacts/world-builder-preview-landscape.png',fullPage:true});

if(errors.length)throw new Error('page errors '+errors.join(' | '));
const report={ok:true,setup,preview,returned,errors,contracts:{cleanPreview:true,exitButton:true,requestBoundary:'KELO_WORLD_EDIT.request',portrait:'390x844',landscape:'844x390'}};
fs.writeFileSync('artifacts/world-builder-preview-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
