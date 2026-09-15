import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox']});

async function load(viewport,suffix=''){
  const ctx=await browser.newContext({viewport});
  const page=await ctx.newPage();
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
  await page.addInitScript(()=>{localStorage.removeItem('kelo_house_snapshots_v1');localStorage.removeItem('kelo_property_state_v1');});
  await page.goto(base+`?houseTest=1${suffix}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KELO_HOUSE_AUTHORITY&&window.KELO_INSTANCES&&window.KELO_PROPERTY_SYSTEM&&window.KELO_PROPERTY_CATALOG?.list?.().length>0,{timeout:20000});
  return{ctx,page,pageErrors};
}

const mobile=await load({width:390,height:844});
const result=await mobile.page.evaluate(async()=>{
  const S=window.KELO_PROPERTY_SYSTEM,A=window.KELO_HOUSE_AUTHORITY,I=window.KELO_INSTANCES,C=window.KELO_PROPERTY_CATALOG;
  const owner=S.playerId(),houseId=`home:${owner}`;
  const asset=C.list().find(t=>t.width<=160&&t.height<=160)||C.list()[0];
  if(!asset)throw new Error('NO_ASSET_FOR_HOUSE_AUDIT');
  await S.authorityLocalRequest('grantUnits',{ownerId:owner,assetId:asset.id,quantity:3,developer:true});
  const entered=await A.request('house:enter',{houseId,ownerId:owner,actorId:owner,config:{idleTTL:0}});
  const current=I.current();
  const parcel=await S.request('ensureLegacyParcel',{ownerId:owner});
  const before={owned:S.getOwnedUnits(asset.id,owner),available:S.getAvailableUnits(asset.id,owner)};
  const x=parcel.bounds.x+Math.max(asset.snap||32,64),y=parcel.bounds.y+Math.max(asset.snap||32,64);
  const placed=await S.request('place',{ownerId:owner,actorId:owner,parcelId:parcel.parcelId,assetId:asset.id,x,y,rotation:0});
  const afterPlace={owned:S.getOwnedUnits(asset.id,owner),available:S.getAvailableUnits(asset.id,owner)};
  const step=Math.max(asset.snap||32,32);
  const moved=await S.request('move',{ownerId:owner,actorId:owner,placementId:placed.placementId,x:x+step,y});
  const afterMove={owned:S.getOwnedUnits(asset.id,owner),available:S.getAvailableUnits(asset.id,owner)};
  const rotated=await S.request('rotate',{ownerId:owner,actorId:owner,placementId:placed.placementId,delta:1});
  const afterRotate={owned:S.getOwnedUnits(asset.id,owner),available:S.getAvailableUnits(asset.id,owner)};
  let visitorDenied=false;
  try{await S.request('move',{ownerId:'visitor-a',actorId:'visitor-a',placementId:placed.placementId,x:x+step*2,y});}catch(err){visitorDenied=err.message==='HOUSE_PERMISSION_DENIED';}
  const saved=await A.request('house:get',{houseId,ownerId:owner,actorId:owner});
  await S.authorityLocalRequest('replaceHouseLayout',{ownerId:owner,parcelId:parcel.parcelId,placements:[],authorityRestore:true});
  const cleared=S.getPlacements(parcel.parcelId).length;
  await I.destroyInstance(current.instanceId,{reason:'crash'});
  const afterCrashContext=window.KELO_SCENE_CONTEXT.current();
  const reentered=await A.request('house:enter',{houseId,ownerId:owner,actorId:owner,config:{idleTTL:0}});
  const restored=S.getPlacements(reentered.parcelId);
  return{owner,houseId,assetId:asset.id,entered,current,parcel,before,afterPlace,afterMove,afterRotate,placed,moved,rotated,visitorDenied,savedRevision:saved.revision,savedLayoutRevision:saved.layoutRevision,cleared,afterCrashContext,reentered,restored};
});

assert.equal(result.current.type,'house');
assert.equal(result.parcel.kind,'house');
assert.equal(result.current.instanceId,result.entered.instanceId);
assert.equal(result.before.owned,result.afterPlace.owned);
assert.equal(result.afterPlace.available,result.before.available-1);
assert.deepEqual(result.afterMove,result.afterPlace);
assert.deepEqual(result.afterRotate,result.afterPlace);
assert.equal(result.visitorDenied,true);
assert.equal(result.cleared,0);
assert.equal(result.afterCrashContext.zoneType,'world');
assert.equal(result.restored.length,1);
assert.equal(result.restored[0].placementId,result.placed.placementId);
assert.equal(result.restored[0].x,result.moved.x);
assert.equal(result.restored[0].y,result.moved.y);
assert.equal(result.restored[0].rotation,result.rotated.rotation);
assert.ok(result.savedRevision>=3);

const propertyEditorLive=await mobile.page.evaluate(()=>!!window.KELO_PROPERTY_EDITOR);
let mobileBox=null;
if(propertyEditorLive){
  await mobile.page.evaluate(()=>window.openSocialTool('properties'));
  await mobile.page.waitForFunction(()=>{const el=document.getElementById('kelo-property-editor');return !!el&&getComputedStyle(el).display!=='none';});
  mobileBox=await mobile.page.locator('#kelo-property-editor').boundingBox();
  assert.ok(mobileBox&&mobileBox.x>=0&&mobileBox.y>=0&&mobileBox.x+mobileBox.width<=390.5&&mobileBox.y+mobileBox.height<=844.5);
  await mobile.page.screenshot({path:'artifacts/house-instance-mobile.png',fullPage:true});
}else{
  await mobile.page.screenshot({path:'artifacts/house-instance-mobile.png',fullPage:true});
}

await mobile.page.evaluate(async()=>{await window.KELO_HOUSE_UI.leave();});
await mobile.page.waitForFunction(()=>window.KELO_SCENE_CONTEXT.current().zoneType==='world');
await mobile.page.evaluate(()=>window.openSocialTool('properties'));
await mobile.page.waitForFunction(()=>{const el=document.getElementById('kelo-house-panel');return !!el&&getComputedStyle(el).display!=='none';});
await mobile.page.screenshot({path:'artifacts/house-instance-mobile-panel.png',fullPage:true});
assert.deepEqual(mobile.pageErrors,[]);
await mobile.ctx.close();

const desktop=await load({width:1440,height:900},'&housePanel=1');
await desktop.page.waitForFunction(()=>{const el=document.getElementById('kelo-house-panel');return !!el&&getComputedStyle(el).display!=='none';});
const desktopBox=await desktop.page.locator('#kelo-house-panel').boundingBox();
assert.ok(desktopBox&&desktopBox.x>=0&&desktopBox.y>=0&&desktopBox.x+desktopBox.width<=1440&&desktopBox.y+desktopBox.height<=900);
await desktop.page.screenshot({path:'artifacts/house-instance-desktop.png',fullPage:true});
assert.deepEqual(desktop.pageErrors,[]);
await desktop.ctx.close();
await browser.close();

const report={ok:true,mobile:{viewport:'390x844',propertyEditorLive,editorBox:mobileBox},desktop:{viewport:'1440x900',panelBox:desktopBox},flow:{instanceId:result.current.instanceId,parcelId:result.parcel.parcelId,assetId:result.assetId,visitorDenied:result.visitorDenied,recoveredPlacement:result.restored[0],savedRevision:result.savedRevision,savedLayoutRevision:result.savedLayoutRevision}};
fs.writeFileSync('artifacts/house-instance-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));