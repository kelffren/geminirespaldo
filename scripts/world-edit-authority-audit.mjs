import { chromium } from 'playwright';
import fs from 'node:fs';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:chrome});
const pageErrors=[];

async function newPage(viewport={width:390,height:844},suffix=''){
  const context=await browser.newContext({viewport,hasTouch:viewport.width<900,isMobile:viewport.width<900});
  const page=await context.newPage();
  page.on('pageerror',e=>pageErrors.push(`${suffix}:${String(e)}`));
  await page.goto(base+suffix,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KELO_ADMIN_KEYS&&window.KELO_WORLD_EDIT?.ready&&window.KELO_WORLD_BUILDER&&window.KELO_PROPERTY_SYSTEM,{timeout:10000});
  return {context,page};
}
async function reset(page,{creator=false}={}){
  const pid=await page.evaluate(()=>window.KELO_ADMIN_KEYS.playerId());
  await page.evaluate(({pid,creator})=>{
    localStorage.removeItem('kelo_world_edit_authority_v1');
    localStorage.removeItem('kelo_world_builder_state_v1');
    localStorage.removeItem('kelo_property_state_v1');
    localStorage.removeItem('kelo_admin_keys_v1');
    if(creator){
      localStorage.setItem('kelo_admin_keys_v1',JSON.stringify({
        schema:1,revision:1,keys:{
          'admin-key:audit-creator':{
            schema:1,keyId:'admin-key:audit-creator',templateId:'admin-key',ownerId:pid,
            label:'Llave Admin · Creador Audit',
            scopes:['world.edit','world.export','world.import'],
            active:true,issuedBy:'audit',createdAt:Date.now(),revokedAt:null
          }
        }
      }));
    }
  },{pid,creator});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KELO_ADMIN_KEYS&&window.KELO_WORLD_EDIT?.ready&&window.KELO_WORLD_BUILDER&&window.KELO_PROPERTY_SYSTEM,{timeout:10000});
  return pid;
}
async function firstReadyAsset(page){
  await page.waitForFunction(()=>window.KELO_WORLD_BUILDER_PROPERTY_RENDERER&&window.KELO_PROPERTY_CATALOG,{timeout:10000});
  await page.waitForFunction(()=>{
    const rr=window.KELO_WORLD_BUILDER_PROPERTY_RENDERER,ready=new Set(rr.readyKeys||[]),errors=rr.errors||{};
    return window.KELO_PROPERTY_CATALOG.list().some(t=>{
      const keys=[...new Set((t.parts||[]).map(p=>p.assetKey).filter(Boolean))];
      return keys.length&&keys.every(k=>ready.has(k)&&!errors[k]);
    });
  },null,{timeout:10000});
  return page.evaluate(()=>{
    const rr=window.KELO_WORLD_BUILDER_PROPERTY_RENDERER,ready=new Set(rr.readyKeys||[]),errors=rr.errors||{};
    const t=window.KELO_PROPERTY_CATALOG.list().find(t=>{
      const keys=[...new Set((t.parts||[]).map(p=>p.assetKey).filter(Boolean))];
      return keys.length&&keys.every(k=>ready.has(k)&&!errors[k]);
    });
    return t?.id||null;
  });
}

// CASE A — normal player: no draft/edit/publish.
{
  const {context,page}=await newPage({width:390,height:844},'?audit=world-edit-normal');
  await reset(page);
  const normal=await page.evaluate(async()=>{
    const pid=window.KELO_ADMIN_KEYS.playerId();
    const out={pid,canEdit:window.KELO_ADMIN_KEYS.can('world.edit',pid),canPublish:window.KELO_ADMIN_KEYS.can('world.publish',pid),draftDenied:false,publishDenied:false};
    try{await window.KELO_WORLD_EDIT.request('world:draft:create',{actorId:pid});}catch(e){out.draftDenied=String(e.message).includes('ADMIN_KEY_PERMISSION_DENIED');}
    try{await window.KELO_WORLD_EDIT.request('world:publish',{actorId:pid,draftId:'draft:none'});}catch(e){out.publishDenied=String(e.message).includes('ADMIN_KEY_PERMISSION_DENIED');}
    return out;
  });
  if(normal.canEdit||normal.canPublish||!normal.draftDenied||!normal.publishDenied)throw new Error('CASE A failed '+JSON.stringify(normal));
  await context.close();
}

// CASE B + F — creator: draft mutates, persists after reload, submit allowed, publish denied.
let creatorEvidence=null;
{
  const {context,page}=await newPage({width:390,height:844},'?audit=world-edit-creator');
  const pid=await reset(page,{creator:true});
  await page.waitForFunction(()=>window.KELO_ADMIN_KEYS.can('world.edit',window.KELO_ADMIN_KEYS.playerId())&&!window.KELO_ADMIN_KEYS.can('world.publish',window.KELO_ADMIN_KEYS.playerId()));
  const assetId=await firstReadyAsset(page);
  if(!assetId)throw new Error('CASE B no ready Property asset');
  creatorEvidence=await page.evaluate(async({assetId})=>{
    const E=window.KELO_WORLD_EDIT,pid=window.KELO_ADMIN_KEYS.playerId();
    const created=await E.request('world:draft:create',{actorId:pid});
    const draftId=created.draft.draftId;
    await E.request('world:tile:paint',{actorId:pid,draftId,x:320,y:320,brushSize:1,material:'grass',role:'terrain'});
    const placed=await E.request('world:placement:create',{actorId:pid,draftId,assetId,x:416,y:416,rotation:0});
    await E.request('world:placement:move',{actorId:pid,draftId,placementId:placed.placement.placementId,x:480,y:416});
    await E.request('world:collision:create',{actorId:pid,draftId,x:544,y:416,w:64,h:64});
    const saved=await E.request('world:draft:save',{actorId:pid,draftId});
    return {pid,draftId,placementId:placed.placement.placementId,changeCount:saved.draft.changeCount};
  },{assetId});
  if(creatorEvidence.changeCount<4)throw new Error('CASE B change count too low');

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KELO_WORLD_EDIT?.ready&&window.KELO_ADMIN_KEYS?.can?.('world.edit',window.KELO_ADMIN_KEYS.playerId()));
  const recovered=await page.evaluate(async({draftId})=>{
    const E=window.KELO_WORLD_EDIT,pid=window.KELO_ADMIN_KEYS.playerId();
    const current=await E.getCurrentDraft();
    const view=await E.request('world:draft:get',{actorId:pid,draftId});
    const runtime=window.KELO_WORLD_BUILDER.snapshot();
    const objects=window.KELO_PROPERTY_SYSTEM.getPlacements('parcel:world:editor');
    const submitted=await E.request('world:draft:submit',{actorId:pid,draftId});
    let publishDenied=false;try{await E.request('world:publish',{actorId:pid,draftId});}catch(e){publishDenied=String(e.message).includes('ADMIN_KEY_PERMISSION_DENIED');}
    return {
      sameDraft:current.draft?.draftId===draftId,
      cells:Object.keys(runtime.cells||{}).length,
      collisions:Object.keys(runtime.collisions||{}).length,
      objects:objects.length,
      submitted:submitted.draft?.status,
      publishDenied,
      source:E.authoritySource(),
      uiStorageFree:window.KELO_WORLD_BUILDER_UI_AUDIT?.uiStorageFree===true
    };
  },{draftId:creatorEvidence.draftId});
  if(!recovered.sameDraft||recovered.cells<1||recovered.collisions<1||recovered.objects<1||recovered.submitted!=='SUBMITTED'||!recovered.publishDenied||recovered.source!=='local'||!recovered.uiStorageFree)throw new Error('CASE B/F failed '+JSON.stringify(recovered));
  await context.close();
}

// CASE C/D/E/G — root publish, rollback, preview and real responsive UI.
let rootReport=null;
{
  const {context,page}=await newPage({width:390,height:844},'?audit=world-edit-root');
  await page.evaluate(()=>{
    localStorage.removeItem('kelo_world_edit_authority_v1');
    localStorage.removeItem('kelo_world_builder_state_v1');
    localStorage.removeItem('kelo_property_state_v1');
    localStorage.removeItem('kelo_admin_keys_v1');
  });
  await page.goto(base+'?mapEditor=1&audit=world-edit-root',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KELO_WORLD_EDIT?.ready&&window.KELO_ADMIN_KEYS?.can?.('world.publish',window.KELO_ADMIN_KEYS.playerId())&&window.KELO_WORLD_BUILDER_UI,{timeout:10000});

  rootReport=await page.evaluate(async()=>{
    const E=window.KELO_WORLD_EDIT,pid=window.KELO_ADMIN_KEYS.playerId();
    const d2=(await E.request('world:draft:create',{actorId:pid,forceNew:true})).draft;
    await E.request('world:tile:paint',{actorId:pid,draftId:d2.draftId,x:672,y:672,brushSize:1,material:'grass',role:'terrain'});
    await E.request('world:draft:submit',{actorId:pid,draftId:d2.draftId});
    await E.request('world:draft:approve',{actorId:pid,draftId:d2.draftId});
    const p2=await E.request('world:publish',{actorId:pid,draftId:d2.draftId});

    const d3=(await E.request('world:draft:create',{actorId:pid,forceNew:true})).draft;
    await E.request('world:tile:paint',{actorId:pid,draftId:d3.draftId,x:736,y:672,brushSize:1,material:'marble',role:'path'});
    await E.request('world:draft:submit',{actorId:pid,draftId:d3.draftId});
    await E.request('world:draft:approve',{actorId:pid,draftId:d3.draftId});
    const p3=await E.request('world:publish',{actorId:pid,draftId:d3.draftId});

    const rb=await E.request('world:rollback',{actorId:pid,revisionId:p2.revision.revisionId});
    const revs=(await E.listRevisions()).revisions;
    const r2=(await E.request('world:revision:get',{actorId:pid,revisionId:p2.revision.revisionId})).snapshot;
    const r4=(await E.request('world:revision:get',{actorId:pid,revisionId:rb.revision.revisionId})).snapshot;
    const rollbackEquivalent=window.KELO_WORLD_REVISIONS.sameSnapshot(r2,r4);

    const dp=(await E.request('world:draft:create',{actorId:pid,forceNew:true})).draft;
    await E.request('world:tile:paint',{actorId:pid,draftId:dp.draftId,x:800,y:672,brushSize:1,material:'marble',role:'terrain'});
    await E.request('world:view:published',{actorId:pid});
    const liveCells=Object.keys(window.KELO_WORLD_BUILDER.snapshot().cells||{}).length;
    await E.request('world:preview:enter',{actorId:pid,draftId:dp.draftId});
    const previewCells=Object.keys(window.KELO_WORLD_BUILDER.snapshot().cells||{}).length;
    await E.request('world:preview:exit',{actorId:pid});
    const afterPreviewCells=Object.keys(window.KELO_WORLD_BUILDER.snapshot().cells||{}).length;

    const audits=(await E.request('world:audit:list',{actorId:pid})).audit;
    return {
      v2:p2.revision.number,v3:p3.revision.number,v4:rb.revision.number,
      rollbackFrom:rb.revision.rolledBackFromRevisionId,
      rollbackEquivalent,
      historyNumbers:revs.map(r=>r.number),
      previewChanged:previewCells!==liveCells,
      previewRestored:afterPreviewCells===liveCells,
      auditCount:audits.length,
      currentDraftId:dp.draftId,
      source:E.authoritySource(),
      remotePlaceholder:typeof window.RemoteWorldEditAuthority==='function'
    };
  });
  if(rootReport.v2!==2||rootReport.v3!==3||rootReport.v4!==4||!rootReport.rollbackEquivalent||!rootReport.previewChanged||!rootReport.previewRestored||rootReport.auditCount<8||rootReport.source!=='local'||!rootReport.remotePlaceholder)throw new Error('CASE C/D/E failed '+JSON.stringify(rootReport));

  // UI portrait
  await page.locator('#kelo-world-builder-fab').click();
  await page.waitForFunction(()=>window.KELO_WORLD_BUILDER_UI.isOpen===true&&document.getElementById('wb-flow-state')?.textContent?.length);
  await page.waitForTimeout(250);
  let box=await page.locator('#kelo-world-builder').boundingBox();
  if(!box||box.x<0||box.y<0||box.x+box.width>390||box.y+box.height>844)throw new Error('portrait World Builder outside viewport');
  const uiText=await page.evaluate(()=>({
    flow:document.getElementById('wb-flow-state')?.textContent,
    live:document.getElementById('wb-live')?.textContent,
    badge:document.getElementById('wb-badge')?.textContent,
    hasSubmit:!!document.getElementById('wb-submit'),
    audit:window.KELO_WORLD_BUILDER_UI_AUDIT
  }));
  if(!uiText.live?.includes('LIVE v4')||!uiText.audit?.draftReviewPublish||!uiText.audit?.autosaveDebounced)throw new Error('portrait workflow UI missing '+JSON.stringify(uiText));
  await page.screenshot({path:'artifacts/world-edit-authority-mobile-portrait.png',fullPage:true});

  // Landscape exact target.
  await page.setViewportSize({width:844,height:390});
  await page.waitForTimeout(250);
  box=await page.locator('#kelo-world-builder').boundingBox();
  if(!box||box.x<0||box.y<0||box.x+box.width>844||box.y+box.height>390)throw new Error('landscape World Builder outside viewport');
  await page.screenshot({path:'artifacts/world-edit-authority-mobile-landscape.png',fullPage:true});

  await context.close();
}

// Desktop UI.
{
  const {context,page}=await newPage({width:1440,height:900},'?audit=world-edit-desktop');
  await page.evaluate(()=>{
    localStorage.removeItem('kelo_world_edit_authority_v1');
    localStorage.removeItem('kelo_world_builder_state_v1');
    localStorage.removeItem('kelo_property_state_v1');
    localStorage.removeItem('kelo_admin_keys_v1');
  });
  await page.goto(base+'?mapEditor=1&audit=world-edit-desktop',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KELO_WORLD_EDIT?.ready&&window.KELO_ADMIN_KEYS?.can?.('world.edit',window.KELO_ADMIN_KEYS.playerId())&&window.KELO_WORLD_BUILDER_UI,{timeout:10000});
  await page.locator('#kelo-world-builder-fab').click();
  await page.waitForTimeout(250);
  const box=await page.locator('#kelo-world-builder').boundingBox();
  if(!box||box.x<0||box.y<0||box.x+box.width>1440||box.y+box.height>900)throw new Error('desktop World Builder outside viewport');
  await page.screenshot({path:'artifacts/world-edit-authority-desktop.png',fullPage:true});
  await context.close();
}

if(pageErrors.length)throw new Error('page errors: '+pageErrors.join(' | '));
const report={ok:true,creator:creatorEvidence,root:rootReport,pageErrors,contracts:{
  requestBoundary:'KELO_WORLD_EDIT.request',
  localAuthority:true,
  remotePlaceholder:true,
  immutableRevisions:true,
  rollbackCreatesRevision:true,
  propertySourceOfTruth:true
}};
fs.writeFileSync('artifacts/world-edit-authority-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
