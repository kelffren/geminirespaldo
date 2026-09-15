/* KELO-INDEX
 * area: QA / STUDIO LIVE
 * owner: Studio LIVE CI
 * purpose: valida CREATORS -> World -> Studio -> objects/surface/collision -> authority/history/save -> close
 * public-api: CLI `node scripts/studio-live-audit.mjs`
 * consumes: deployed Kelo World, KELO_ADMIN_KEYS, KELO_STUDIO_LAUNCHER, Creator Hub, KeloInputLocks, KELO_WORLD_BUILDER
 * state-owned: ninguno; usa un browser context efímero con storage aislado
 * extension-points: ampliar solo con comportamientos creator estables
 * reuse: workflow studio-live-audit.yml
 * do-not: no publicar Drafts, no depender de estado persistente del usuario, no fijar números de versión para readiness
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE=(process.env.AUDIT_URL||'https://kelffren.github.io/gemini/').replace(/\?+$/,'');
const executablePath=process.env.CHROME_BIN||undefined;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));

async function deployed(path,markers){
  const url=new URL(path,BASE).href;
  try{
    const response=await context.request.get(`${url}?studio-live-probe=${Date.now()}`,{headers:{'cache-control':'no-cache','pragma':'no-cache'}});
    const text=response.ok()?await response.text():'';
    return response.ok()&&markers.every(marker=>text.includes(marker));
  }catch{return false;}
}

// Pages can briefly expose a mixed old/new tree after a push. Readiness is based
// on stable capabilities/contracts, never frozen implementation version numbers.
let deployReady=false;
for(let attempt=0;attempt<60;attempt++){
  const checks=await Promise.all([
    deployed('src/ui/studio-launcher.js',["creators/ui/creator-hub.mjs",'KELO_CREATORS_LAUNCHER','NO polling']),
    deployed('src/creators/ui/creator-hub.mjs',['openCreatorHub','Abrir ${label}',"['animation','Animation','active']"]),
    deployed('src/creators/workspaces/world-workspace.mjs',['CREATOR_WORLD_STUDIO_ENTRY_MISSING','live-studio-controller.mjs']),
    deployed('src/studio/ui/studio-live-shell.mjs',['createStudioLiveShell','data-pane="assets"','data-mode="terrain"','data-mode="path"','data-mode="collision"','data-act="edit-assets"'])
  ]);
  if(checks.every(Boolean)){deployReady=true;break;}
  await sleep(2000);
}
if(!deployReady){await browser.close();throw new Error('STUDIO_CREATOR_DEPLOY_NOT_READY');}

let ready=false,lastError=null;
for(let attempt=0;attempt<20;attempt++){
  try{
    await page.goto(`${BASE}?mapEditor=1&studio-live-audit=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(1000);
    ready=await page.evaluate(()=>{
      const src=[...document.scripts].map(s=>s.getAttribute('src')||'');
      const actor=window.KELO_ADMIN_KEYS?.playerId?.();
      const launcher=window.KELO_STUDIO_LAUNCHER;
      return src.some(x=>x.includes('src/ui/studio-launcher.js'))&&
        typeof launcher?.open==='function'&&typeof launcher?.sync==='function'&&
        window.KELO_CREATORS_LAUNCHER===launcher&&launcher.allowed===true&&
        !!actor&&window.KELO_ADMIN_KEYS?.can?.('world.edit',actor)===true&&
        !!window.KeloInputLocks&&!!window.KeloCamera&&!!window.KELO_WORLD_EDIT?.ready&&!!window.KELO_WORLD_BUILDER;
    });
    if(ready)break;
  }catch(e){lastError=e;}
  await page.waitForTimeout(2500);
}
if(!ready){await browser.close();throw new Error(`STUDIO_LIVE_DEPLOY_NOT_READY:${String(lastError||'launcher/admin/authority/world-builder not ready')}`);}

const resourcesAtBoot=await page.evaluate(()=>performance.getEntriesByType('resource').map(x=>x.name));
if(resourcesAtBoot.some(x=>/\/src\/(?:studio|creators)\//.test(x))){await browser.close();throw new Error('CREATOR_LAZY_BOOT_VIOLATION');}

await page.evaluate(()=>window.KELO_CREATORS_LAUNCHER.open());
await page.waitForSelector('#kelo-creators-hub',{state:'visible',timeout:10000});
const resourcesAtHub=await page.evaluate(()=>performance.getEntriesByType('resource').map(x=>x.name));
if(!resourcesAtHub.some(x=>/\/src\/creators\//.test(x)))throw new Error('CREATOR_HUB_DYNAMIC_IMPORT_NOT_OBSERVED');
if(resourcesAtHub.some(x=>/\/src\/studio\//.test(x)))throw new Error('STUDIO_LOADED_BEFORE_WORLD_WORKSPACE');
await page.getByRole('button',{name:'Abrir World'}).click();
await page.waitForFunction(()=>{
  const el=document.getElementById('kelo-studio-live');
  return !!(document.body.classList.contains('kelo-studio-active')&&el&&el.dataset.keloWorldLoading!=='1'&&el.querySelector('[data-mode="terrain"]'));
},null,{timeout:25000});
const opened=await page.evaluate(()=>({
  shell:!!document.getElementById('kelo-studio-live'),
  hub:!!document.getElementById('kelo-creators-hub'),
  surfaceModes:['terrain','path','collision'].every(mode=>!!document.querySelector(`#kelo-studio-live [data-mode="${mode}"]`)),
  lockOwners:window.KeloInputLocks?.snapshot?.().owners||[],
  studioResources:performance.getEntriesByType('resource').map(x=>x.name).filter(x=>/\/src\/studio\//.test(x)),
  status:document.querySelector('#kelo-studio-live .ks-status')?.textContent||''
}));
if(!opened.shell||opened.hub)throw new Error('STUDIO_WORLD_WORKSPACE_NOT_OPEN');
if(!opened.surfaceModes)throw new Error('STUDIO_SURFACE_CONTROLS_MISSING');
if(!opened.lockOwners.includes('kelo-studio'))throw new Error('STUDIO_FOUNDATION_LOCK_NOT_ACQUIRED');
if(!opened.studioResources.length)throw new Error('STUDIO_DYNAMIC_IMPORT_NOT_OBSERVED');

// Mobile premium flow: Assets starts collapsed. Open it through the same EDIT
// affordance a player/creator uses, then interact only with the visible mobile pane.
await page.locator('#kelo-studio-live .ks-deck [data-act="edit-assets"]').click();
await page.waitForFunction(()=>{
  const root=document.querySelector('#kelo-studio-live');
  return root?.dataset.sheetOpen==='1'&&root.querySelector('.ks-mobile-pane[data-pane="assets"]')?.classList.contains('on');
},null,{timeout:5000});
const rows=page.locator('#kelo-studio-live .ks-mobile-pane[data-pane="assets"] [data-asset]');
if(await rows.count()<1)throw new Error('STUDIO_ASSET_BROWSER_EMPTY');
await rows.first().waitFor({state:'visible',timeout:5000});
const beforePlacements=await page.evaluate(()=>window.KELO_PROPERTY_SYSTEM?.getPlacements?.('parcel:world:editor')?.length||0);
await rows.first().click();
await page.waitForFunction(()=>document.querySelector('#kelo-studio-live')?.dataset.compact==='asset',null,{timeout:5000});
const canvas=page.locator('#game-canvas'),box=await canvas.boundingBox();
if(!box)throw new Error('STUDIO_GAME_CANVAS_MISSING');
const x=Math.round(box.x+box.width*0.52),y=Math.round(box.y+Math.min(box.height*0.24,190));
await page.mouse.click(x,y);
await page.waitForFunction(()=>document.querySelector('#kelo-studio-live .ks-bottom.ks-compact [data-act="undo"]')?.disabled===false,null,{timeout:10000});
const afterPlace=await page.evaluate(()=>({
  placements:window.KELO_PROPERTY_SYSTEM?.getPlacements?.('parcel:world:editor')?.length||0,
  status:document.querySelector('#kelo-studio-live .ks-status')?.textContent||''
}));
if(afterPlace.placements<=beforePlacements)throw new Error(`STUDIO_PLACE_DID_NOT_COMMIT:${beforePlacements}->${afterPlace.placements}`);

// Reopen the full mobile workspace without clearing the active asset, then enter Move.
await page.locator('#kelo-studio-live .ks-bottom.ks-compact .ks-compact-bar [data-act="edit-assets"]').click();
await page.waitForFunction(()=>{
  const root=document.querySelector('#kelo-studio-live');
  return root?.dataset.compact==='full'&&root.dataset.sheetOpen==='1';
},null,{timeout:5000});
await page.locator('#kelo-studio-live .ks-deck [data-mode="move"]').click();
await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+64,y+64,{steps:4});await page.mouse.up();
await page.waitForFunction(()=>/·\s*2\s+undo/.test(document.querySelector('#kelo-studio-live .ks-status')?.textContent||''),null,{timeout:10000});
await page.locator('#kelo-studio-live .ks-deck [data-act="undo"]').click();
await page.waitForFunction(()=>/·\s*1\s+undo/.test(document.querySelector('#kelo-studio-live .ks-status')?.textContent||''),null,{timeout:10000});
await page.locator('#kelo-studio-live .ks-deck [data-act="redo"]').click();
await page.waitForFunction(()=>/·\s*2\s+undo/.test(document.querySelector('#kelo-studio-live .ks-status')?.textContent||''),null,{timeout:10000});

const surfacePoint=async(clientX,clientY)=>page.evaluate(({clientX,clientY})=>{
  const p=window.KeloCamera?.screenToWorld?.(clientX,clientY)||(typeof window.screenToWorld==='function'?window.screenToWorld(clientX,clientY):{x:clientX,y:clientY});
  const t=Math.max(1,Number(window.KELO_WORLD_BUILDER?.tileSize)||32);
  return{x:Math.floor(Math.max(0,p.x)/t)*t,y:Math.floor(Math.max(0,p.y)/t)*t,t};
},{clientX,clientY});
const groundScreen={x:Math.round(box.x+box.width*.72),y:Math.round(box.y+Math.min(box.height*.16,130))};
const roadScreen={x:Math.round(box.x+box.width*.82),y:groundScreen.y};
const collisionScreen={x:groundScreen.x,y:Math.round(box.y+Math.min(box.height*.29,230))};
const groundWorld=await surfacePoint(groundScreen.x,groundScreen.y),roadWorld=await surfacePoint(roadScreen.x,roadScreen.y),collisionWorld=await surfacePoint(collisionScreen.x,collisionScreen.y);

await page.locator('#kelo-studio-live .ks-deck [data-mode="terrain"]').click();
await page.mouse.click(groundScreen.x,groundScreen.y);
await page.waitForFunction(({x,y})=>window.KELO_WORLD_BUILDER?.cells?.().some(c=>c.x===x&&c.y===y&&c.role!=='path'),{x:groundWorld.x,y:groundWorld.y},{timeout:10000});
const afterGround=await page.evaluate(({x,y})=>({cell:window.KELO_WORLD_BUILDER.cells().find(c=>c.x===x&&c.y===y)||null,status:document.querySelector('#kelo-studio-live .ks-status')?.textContent||''}),{x:groundWorld.x,y:groundWorld.y});
if(!afterGround.cell)throw new Error('STUDIO_GROUND_DID_NOT_COMMIT');

await page.locator('#kelo-studio-live .ks-deck [data-mode="path"]').click();
await page.mouse.click(roadScreen.x,roadScreen.y);
await page.waitForFunction(({x,y})=>window.KELO_WORLD_BUILDER?.cells?.().some(c=>c.x===x&&c.y===y&&c.role==='path'),{x:roadWorld.x,y:roadWorld.y},{timeout:10000});
const afterRoad=await page.evaluate(({x,y})=>({cell:window.KELO_WORLD_BUILDER.cells().find(c=>c.x===x&&c.y===y)||null,status:document.querySelector('#kelo-studio-live .ks-status')?.textContent||''}),{x:roadWorld.x,y:roadWorld.y});
if(afterRoad.cell?.role!=='path')throw new Error('STUDIO_ROAD_DID_NOT_COMMIT');

const beforeCollisions=await page.evaluate(()=>window.KELO_WORLD_BUILDER?.collisions?.().length||0);
await page.locator('#kelo-studio-live .ks-deck [data-mode="collision"]').click();
await page.mouse.click(collisionScreen.x,collisionScreen.y);
await page.waitForFunction(({x,y,before})=>{const list=window.KELO_WORLD_BUILDER?.collisions?.()||[];return list.length>before&&list.some(c=>c.x===x&&c.y===y);},{x:collisionWorld.x,y:collisionWorld.y,before:beforeCollisions},{timeout:10000});
const afterCollision=await page.evaluate(({x,y})=>({collisions:window.KELO_WORLD_BUILDER.collisions().length,collision:window.KELO_WORLD_BUILDER.collisions().find(c=>c.x===x&&c.y===y)||null,status:document.querySelector('#kelo-studio-live .ks-status')?.textContent||''}),{x:collisionWorld.x,y:collisionWorld.y});
if(!afterCollision.collision)throw new Error('STUDIO_COLLISION_DID_NOT_COMMIT');

await page.locator('#kelo-studio-live .ks-deck [data-act="undo"]').click();
await page.waitForFunction(before=>window.KELO_WORLD_BUILDER?.collisions?.().length===before,beforeCollisions,{timeout:10000});
const afterCollisionUndo=await page.evaluate(()=>({collisions:window.KELO_WORLD_BUILDER?.collisions?.().length||0,status:document.querySelector('#kelo-studio-live .ks-status')?.textContent||''}));
if(afterCollisionUndo.collisions!==beforeCollisions)throw new Error('STUDIO_COLLISION_UNDO_DID_NOT_RESTORE');

await page.locator('#kelo-studio-live .ks-deck [data-mode="terrain"]').click();
await page.locator('#kelo-studio-live .ks-deck [data-act="erase"]').click();
await page.mouse.click(groundScreen.x,groundScreen.y);
await page.waitForFunction(({x,y})=>!window.KELO_WORLD_BUILDER?.cells?.().some(c=>c.x===x&&c.y===y),{x:groundWorld.x,y:groundWorld.y},{timeout:10000});
const afterErase=await page.evaluate(({x,y})=>({exists:window.KELO_WORLD_BUILDER.cells().some(c=>c.x===x&&c.y===y),status:document.querySelector('#kelo-studio-live .ks-status')?.textContent||''}),{x:groundWorld.x,y:groundWorld.y});
if(afterErase.exists)throw new Error('STUDIO_GROUND_ERASE_DID_NOT_COMMIT');

// Save is deliberately separate from publish. A successful click must keep the
// live draft/session active and produce no page error.
await page.locator('#kelo-studio-live .ks-top [data-act="save"]').click();
await page.waitForTimeout(250);
if(!await page.locator('#kelo-studio-live').isVisible())throw new Error('STUDIO_SAVE_CLOSED_SESSION');

await page.screenshot({path:'artifacts/studio-live-open.png',fullPage:true});
await page.locator('#kelo-studio-live .ks-top [data-act="close"]').click();
await page.waitForFunction(()=>!document.body.classList.contains('kelo-studio-active')&&!document.getElementById('kelo-studio-live'),null,{timeout:10000});
const closed=await page.evaluate(()=>({lockOwners:window.KeloInputLocks?.snapshot?.().owners||[],view:window.KELO_WORLD_EDIT?.getViewState?.()||null}));
if(closed.lockOwners.includes('kelo-studio'))throw new Error('STUDIO_FOUNDATION_LOCK_LEAK');
if(pageErrors.length)throw new Error(`STUDIO_PAGE_ERRORS:${pageErrors.join(' | ')}`);

const report={ok:true,url:BASE,viewport:{width:390,height:844,dpr:2},deployReady,lazyAtBoot:true,lazyStudioUntilWorld:true,opened,placementDelta:afterPlace.placements-beforePlacements,afterPlace,moveUndoRedo:true,ground:{world:groundWorld,afterGround,afterErase},road:{world:roadWorld,afterRoad},collision:{world:collisionWorld,before:beforeCollisions,afterCollision,afterCollisionUndo},save:true,closed,pageErrors};
fs.writeFileSync('artifacts/studio-live.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
