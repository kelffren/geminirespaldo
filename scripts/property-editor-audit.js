/* KELO-INDEX
 * area: PROPERTY
 * keys: AUDIT PARCEL UNITS PLACEMENT AUTHORITY
 * hace: prueba determinista del contrato unidades->colocaciones y límites de parcela
 * online: valida la boca local que debe conservar semántica al pasar al servidor
 */
'use strict';
const fs=require('fs');const vm=require('vm');const path=require('path');const assert=require('assert');
const root=path.resolve(__dirname,'..');
global.window=global;global.CONFIG={worldWidth:3600,worldHeight:3200};global.STATE={plot:{x:2000,y:1500,w:400,h:300,furniture:[]}};global.obstacles=[];global.keloNet={playerKey:'audit-player'};global.renderPlot=function(){};
const mem=new Map();global.localStorage={getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)};
global.Image=class AuditImage{constructor(){this.onload=null;this.onerror=null;this.naturalWidth=0;this.naturalHeight=0;this._src='';}set src(value){this._src=String(value||'');}get src(){return this._src;}};
global.KELO_TILE_REGISTRY={worldTileSize:32};
global.KELO_PROP_CONTRACT={assets:{tree:{id:'tree',src:'assets/tree.png',frameWidth:32,frameHeight:64,columns:1}},props:[{id:'tree-world-1',family:'nature_prop',asset:'tree',frame:0,layerGroup:'test',layerRole:'back',position:{x:10,y:10},size:{w:32,h:64},footprint:{x:18,y:58,w:16,h:12},collider:{mode:'none'},district:'central'}]};
global.KELO_PREFAB_CONTRACT={assets:{},prefabs:[]};
const layers=[];global.KELO_ENVIRONMENT_LAYERS={register:x=>{layers.push(x);return x.id;}};global.KELO_ATLAS_CONTRACT={acquire:()=>Promise.resolve({})};
function run(rel){vm.runInThisContext(fs.readFileSync(path.join(root,rel),'utf8'),{filename:rel});}
run('src/property/property-asset-catalog.js');run('src/property/property-system.js');
(async()=>{
  const C=global.KELO_PROPERTY_CATALOG,S=global.KELO_PROPERTY_SYSTEM;assert(C&&S,'property globals missing');
  const asset=C.list()[0];assert(asset,'catalog should expose a placeable asset');
  const p=await S.request('ensureLegacyParcel',{ownerId:'audit-player'});assert.equal(p.parcelId,'parcel:legacy:104');
  await assert.rejects(()=>S.request('place',{ownerId:'audit-player',parcelId:p.parcelId,assetId:asset.id,x:2048,y:1536}),/NO_OWNED_UNITS/);
  await S.request('grantUnits',{ownerId:'audit-player',assetId:asset.id,quantity:2,developer:true});
  const a=await S.request('place',{ownerId:'audit-player',parcelId:p.parcelId,assetId:asset.id,x:2048,y:1536});
  const b=await S.request('place',{ownerId:'audit-player',parcelId:p.parcelId,assetId:asset.id,x:2112,y:1536});
  assert(a.placementId!==b.placementId,'placement ids must be unique');assert.equal(S.getAvailableUnits(asset.id,'audit-player'),0);
  await S.request('move',{ownerId:'audit-player',placementId:b.placementId,x:2144,y:1568});assert.equal(S.getAvailableUnits(asset.id,'audit-player'),0,'moving must not consume or release a unit');
  await assert.rejects(()=>S.request('place',{ownerId:'audit-player',parcelId:p.parcelId,assetId:asset.id,x:2176,y:1536}),/NO_OWNED_UNITS/);
  await S.request('remove',{ownerId:'audit-player',placementId:a.placementId});assert.equal(S.getAvailableUnits(asset.id,'audit-player'),1,'removing must release one deployable unit');
  await assert.rejects(()=>S.request('place',{ownerId:'audit-player',parcelId:p.parcelId,assetId:asset.id,x:1984,y:1472}),/OUTSIDE_PARCEL/);
  const wp=await S.request('ensureWorldEditorParcel',{ownerId:'developer'});const worldPlacement=await S.request('place',{ownerId:'developer',parcelId:wp.parcelId,assetId:asset.id,x:64,y:64});const beforeScale=S.placementBounds(worldPlacement);const scaled=await S.request('scale',{ownerId:'developer',placementId:worldPlacement.placementId,scale:1.5});const afterScale=S.placementBounds(scaled);assert.equal(scaled.scale,1.5);assert.equal(afterScale.w,beforeScale.w*1.5);assert.equal(afterScale.h,beforeScale.h*1.5);
  assert.equal(layers.filter(x=>x.id.indexOf('property-placements-')===0).length,2,'back/front property layers required');
  const exp=S.exportLayout(wp.parcelId);assert.equal(exp.contract,'kelo-property-layout-v1');assert(exp.placements.length>=1);
  console.log(JSON.stringify({ok:true,catalog:C.list().length,playerPlacements:S.getPlacements(p.parcelId).length,worldPlacements:S.getPlacements(wp.parcelId).length,layers:layers.length,movePreservesUnits:true,scale:true,imageStub:'node-audit-only'}));
})().catch(err=>{console.error(err);process.exitCode=1;});