import { chromium } from 'playwright';
import fs from 'node:fs';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome'});
const errors=[];
async function makePage(viewport,url){const context=await browser.newContext({viewport,hasTouch:viewport.width<700,isMobile:viewport.width<700});const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.goto(url,{waitUntil:'domcontentloaded'});return{context,page};}

{
  const {context,page}=await makePage({width:390,height:844},base+'?audit=world-builder-normal');
  await page.evaluate(()=>{localStorage.removeItem('kelo_admin_keys_v1');localStorage.removeItem('kelo_world_builder_state_v1');localStorage.removeItem('kelo_property_state_v1');});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KELO_ADMIN_KEYS&&window.KELO_WORLD_BUILDER_UI);
  await page.waitForTimeout(300);
  const normal=await page.evaluate(()=>({can:window.KELO_ADMIN_KEYS.can('world.edit',window.KELO_ADMIN_KEYS.playerId()),fab:document.getElementById('kelo-world-builder-fab')?.style.display||getComputedStyle(document.getElementById('kelo-world-builder-fab')).display}));
  if(normal.can)throw new Error('normal player unexpectedly has world.edit');
  if(normal.fab!=='none')throw new Error('World Builder FAB visible without Admin Key');
  await context.close();
}

const adminUrl=base+'?mapEditor=1&audit=world-builder-admin';
const {context,page}=await makePage({width:390,height:844},adminUrl);
await page.evaluate(()=>{localStorage.removeItem('kelo_admin_keys_v1');localStorage.removeItem('kelo_world_builder_state_v1');localStorage.removeItem('kelo_property_state_v1');});
await page.reload({waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.KELO_ADMIN_KEYS?.can?.('world.edit',window.KELO_ADMIN_KEYS.playerId())&&window.KELO_WORLD_BUILDER&&window.KELO_WORLD_BUILDER_UI&&window.KELO_WORLD_BUILDER_PROPERTY_RENDERER_AUDIT&&document.getElementById('kelo-world-builder-fab'));
await page.waitForTimeout(700);
const rendererState=await page.evaluate(()=>({installed:window.KELO_WORLD_RENDERER?.worldBuilderPropertyRenderer===true,audit:window.KELO_WORLD_BUILDER_PROPERTY_RENDERER_AUDIT}));
if(!rendererState.installed)throw new Error('World Builder Property renderer not installed');
if(!rendererState.audit?.propertySourceOfTruth||!rendererState.audit?.directFallback)throw new Error('Property renderer audit contract missing');
await page.locator('#kelo-world-builder-fab').click();
await page.waitForFunction(()=>document.getElementById('kelo-world-builder')?.style.display==='flex');
const initial=await page.evaluate(()=>({badge:document.querySelector('#kelo-world-builder .wb-badge')?.textContent,layer:window.KELO_WORLD_BUILDER_UI.layer,materials:window.KELO_WORLD_BUILDER.materials,authority:window.KELO_WORLD_BUILDER.authoritySource()}));
if(initial.badge!=='BORRADOR LOCAL')throw new Error('local draft badge missing');
if(initial.layer!=='terrain')throw new Error('terrain layer not default');
if(!initial.materials.includes('grass')||!initial.materials.includes('marble'))throw new Error('terrain materials missing');
if(initial.authority!=='local-draft')throw new Error('wrong local authority source');

await page.mouse.click(195,250);
await page.waitForTimeout(150);
let afterPaint=await page.evaluate(()=>window.KELO_WORLD_BUILDER.snapshot());
if(Object.keys(afterPaint.cells).length<1)throw new Error('terrain paint did not persist');

await page.locator('[data-wb-layer="path"]').click();
await page.locator('#wb-controls button', {hasText:'MÁRMOL'}).first().click();
await page.mouse.click(230,250);
await page.waitForTimeout(150);
afterPaint=await page.evaluate(()=>window.KELO_WORLD_BUILDER.snapshot());
if(!Object.values(afterPaint.cells).some(x=>x.role==='path'))throw new Error('path paint missing');

await page.locator('[data-wb-layer="objects"]').click();
await page.waitForFunction(()=>document.querySelectorAll('#wb-list .wb-card').length>0);
await page.waitForFunction(()=>document.querySelector('#wb-list .wb-card[data-asset-id][data-ready="1"]'),null,{timeout:6000});
const selectedTemplate=await page.evaluate(()=>{const id=document.querySelector('#wb-list .wb-card[data-asset-id][data-ready="1"]')?.dataset.assetId,t=window.KELO_PROPERTY_CATALOG.get(id);return{id:t.id,label:t.label,assetKeys:[...new Set((t.parts||[]).map(p=>p.assetKey))],ready:window.KELO_WORLD_BUILDER_PROPERTY_RENDERER.readyKeys,errors:window.KELO_WORLD_BUILDER_PROPERTY_RENDERER.errors};});
if(selectedTemplate.assetKeys.some(k=>!selectedTemplate.ready.includes(k)||selectedTemplate.errors[k]))throw new Error('World Builder exposed a broken asset '+JSON.stringify(selectedTemplate));
await page.locator('#wb-list .wb-card[data-asset-id][data-ready="1"]').first().click();
await page.mouse.click(270,250);
await page.waitForTimeout(400);
const objects=await page.evaluate(async()=>{const p=await window.KELO_PROPERTY_SYSTEM.request('ensureWorldEditorParcel',{ownerId:'developer'});return{parcel:p,rows:window.KELO_PROPERTY_SYSTEM.getPlacements(p.parcelId),catalog:window.KELO_PROPERTY_CATALOG.list().length,renderer:window.KELO_WORLD_RENDERER?.worldBuilderPropertyRenderer===true,imageCount:window.KELO_WORLD_BUILDER_PROPERTY_RENDERER?.imageCount||0};});
if(objects.catalog<1)throw new Error('property catalog empty');
if(objects.rows.length<1)throw new Error('world object placement missing');
if(objects.parcel.kind!=='world_editor')throw new Error('objects are not using world_editor parcel');
if(!objects.renderer)throw new Error('Property direct renderer detached after placement');
if(objects.imageCount<1)throw new Error('Property atlas images never became ready');
await page.screenshot({path:'artifacts/world-builder-mobile-object.png',fullPage:true});

await page.locator('[data-wb-layer="collision"]').click();
await page.mouse.click(305,250);
await page.waitForTimeout(150);
const collisionCount=await page.evaluate(()=>window.KELO_WORLD_BUILDER.collisions().length);
if(collisionCount<1)throw new Error('admin collision missing');
await page.screenshot({path:'artifacts/world-builder-mobile.png',fullPage:true});

const beforeReload=await page.evaluate(async()=>{const p=await window.KELO_PROPERTY_SYSTEM.request('ensureWorldEditorParcel',{ownerId:'developer'});return{world:window.KELO_WORLD_BUILDER.snapshot(),objects:window.KELO_PROPERTY_SYSTEM.getPlacements(p.parcelId)};});
await page.reload({waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.KELO_WORLD_BUILDER&&window.KELO_PROPERTY_SYSTEM&&window.KELO_WORLD_BUILDER_PROPERTY_RENDERER_AUDIT&&window.KELO_ADMIN_KEYS?.can?.('world.edit',window.KELO_ADMIN_KEYS.playerId()));
await page.waitForTimeout(500);
const afterReload=await page.evaluate(async()=>{const p=await window.KELO_PROPERTY_SYSTEM.request('ensureWorldEditorParcel',{ownerId:'developer'});return{world:window.KELO_WORLD_BUILDER.snapshot(),objects:window.KELO_PROPERTY_SYSTEM.getPlacements(p.parcelId),fab:getComputedStyle(document.getElementById('kelo-world-builder-fab')).display,renderer:window.KELO_WORLD_RENDERER?.worldBuilderPropertyRenderer===true};});
if(Object.keys(afterReload.world.cells).length!==Object.keys(beforeReload.world.cells).length)throw new Error('terrain recovery mismatch');
if(Object.keys(afterReload.world.collisions).length!==Object.keys(beforeReload.world.collisions).length)throw new Error('collision recovery mismatch');
if(afterReload.objects.length!==beforeReload.objects.length)throw new Error('property object recovery mismatch');
if(afterReload.fab==='none')throw new Error('admin builder unavailable after reload');
if(!afterReload.renderer)throw new Error('Property renderer missing after reload');

await page.evaluate(()=>window.KELO_PROPERTY_EDITOR?.open?.('parcel'));
await page.waitForTimeout(100);
const worldTab=page.locator('#pe-tabs [data-mode="world"]');
if(await worldTab.count()){
  await worldTab.click();
  await page.waitForTimeout(150);
  const routed=await page.evaluate(()=>window.KELO_WORLD_BUILDER_UI.isOpen===true);
  if(!routed)throw new Error('legacy MUNDO tab did not route to World Builder');
}
await context.close();

{
  const {context:desktopContext,page:desktop}=await makePage({width:1440,height:900},adminUrl);
  await desktop.waitForFunction(()=>window.KELO_ADMIN_KEYS?.can?.('world.edit',window.KELO_ADMIN_KEYS.playerId())&&window.KELO_WORLD_BUILDER_UI&&window.KELO_WORLD_BUILDER_PROPERTY_RENDERER_AUDIT);
  await desktop.locator('#kelo-world-builder-fab').click();
  await desktop.waitForTimeout(250);
  const box=await desktop.locator('#kelo-world-builder').boundingBox();
  if(!box||box.x<0||box.y<0||box.x+box.width>1440||box.y+box.height>900)throw new Error('desktop builder panel outside viewport');
  await desktop.screenshot({path:'artifacts/world-builder-desktop.png',fullPage:true});
  await desktopContext.close();
}

if(errors.length)throw new Error('page errors: '+errors.join(' | '));
fs.writeFileSync('artifacts/world-builder-audit.json',JSON.stringify({ok:true,cells:Object.keys(beforeReload.world.cells).length,objects:beforeReload.objects.length,collisions:Object.keys(beforeReload.world.collisions).length,propertyRenderer:true,propertyImages:objects.imageCount,errors},null,2));
console.log(JSON.stringify({ok:true,cells:Object.keys(beforeReload.world.cells).length,objects:beforeReload.objects.length,collisions:Object.keys(beforeReload.world.collisions).length,propertyRenderer:true,propertyImages:objects.imageCount},null,2));
await browser.close();
