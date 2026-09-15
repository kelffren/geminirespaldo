/* KELO-INDEX
 * area: WORLD EDIT
 * keys: REVISION SNAPSHOT IMMUTABLE ROLLBACK STABLE ID CONFLICT
 * hace: utilidades puras para snapshots, revisiones inmutables e IDs estables del mundo
 * online: mismo formato viaja al servidor; no contiene storage ni transporte
 */
(function(){
'use strict';
if(window.KELO_WORLD_REVISIONS)return;

const VERSION='world-revision-system-v1.0.0';
let seq=1;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const normalizeScale=v=>{const n=Number(v);return Math.max(.1,Math.min(8,Number.isFinite(n)?Math.round(n*100)/100:1));};
function stableId(prefix){
  const uuid=globalThis.crypto?.randomUUID?.();
  return `${prefix}:${uuid||`${Date.now().toString(36)}:${(seq++).toString(36)}`}`;
}
function normalizePlacement(raw){
  if(!raw||!raw.placementId||!raw.assetId)return null;
  return {
    placementId:String(raw.placementId),
    parcelId:String(raw.parcelId||'parcel:world:editor'),
    ownerId:String(raw.ownerId||'developer'),
    assetId:String(raw.assetId),
    x:Number(raw.x)||0,
    y:Number(raw.y)||0,
    rotation:((Math.floor(Number(raw.rotation)||0)%4)+4)%4,
    scale:normalizeScale(raw.scale),
    layer:String(raw.layer||'property'),
    createdAt:Number(raw.createdAt)||Date.now(),
    updatedAt:Number(raw.updatedAt)||Date.now()
  };
}
function normalizeSnapshot(input){
  const src=input||{},placements=[];
  for(const raw of Array.isArray(src.placements)?src.placements:[]){
    const rec=normalizePlacement(raw);if(rec)placements.push(rec);
  }
  return {
    schema:1,
    worldId:String(src.worldId||'world:kelo-main'),
    cells:clone(src.cells&&typeof src.cells==='object'?src.cells:{}),
    collisions:clone(src.collisions&&typeof src.collisions==='object'?src.collisions:{}),
    placements,
    generatedAt:Number(src.generatedAt)||Date.now()
  };
}
function createRevision({worldId='world:kelo-main',number=1,snapshot,createdBy='system',sourceDraftId=null,rolledBackFromRevisionId=null}={}){
  return {
    revisionId:stableId('revision'),
    worldId:String(worldId),
    number:Math.max(1,Math.floor(Number(number)||1)),
    status:'PUBLISHED',
    immutable:true,
    createdBy:String(createdBy||'system'),
    createdAt:Date.now(),
    sourceDraftId:sourceDraftId?String(sourceDraftId):null,
    rolledBackFromRevisionId:rolledBackFromRevisionId?String(rolledBackFromRevisionId):null,
    snapshot:normalizeSnapshot({...snapshot,worldId})
  };
}
function snapshotSignature(snapshot){
  const s=normalizeSnapshot(snapshot);
  const placements=s.placements.slice().sort((a,b)=>a.placementId.localeCompare(b.placementId));
  const cells=Object.fromEntries(Object.entries(s.cells).sort(([a],[b])=>a.localeCompare(b)));
  const collisions=Object.fromEntries(Object.entries(s.collisions).sort(([a],[b])=>a.localeCompare(b)));
  return JSON.stringify({cells,collisions,placements});
}
function sameSnapshot(a,b){return snapshotSignature(a)===snapshotSignature(b);}

window.KELO_WORLD_REVISIONS=Object.freeze({
  version:VERSION,
  clone,
  stableId,
  normalizeSnapshot,
  createRevision,
  snapshotSignature,
  sameSnapshot
});
window.KELO_WORLD_REVISIONS_AUDIT=Object.freeze({
  version:VERSION,
  immutableRevisionFactory:true,
  stableIds:true,
  snapshotConsolidation:true,
  rollbackCreatesNewRevision:true
});
})();
