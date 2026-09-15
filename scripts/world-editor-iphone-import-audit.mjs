import assert from 'node:assert/strict';
import { importCurrentKeloWorld } from '../src/studio/adapters/current-world-importer.mjs';

const snapshot={
  worldId:'world:kelo-main',
  placements:[{placementId:'iphone-smoke-tree',assetId:'tree',x:96,y:128,rotation:0,scale:1,updatedAt:1}],
  cells:{},
  collisions:{}
};

const calls=[];
const adapter={
  worldEditRequest:async(op,payload)=>{
    calls.push({op,payload});
    if(op!=='world:preview:enter')throw new Error(`unexpected ${op}`);
    return {viewSnapshot:snapshot,viewMeta:{kind:'preview',id:'draft:iphone',draftId:'draft:iphone',revisionVersion:7}};
  },
  propertyRequest:async()=>{throw new Error('property path must not run');},
  assetCatalog:{get:id=>id==='tree'?{id,width:32,height:48}:null},
  tileRegistry:{worldTileSize:32},
  worldRenderer:{chunkSize:512}
};

const doc=await importCurrentKeloWorld({adapter,mode:'world',actorId:'iphone-audit',view:'draft',draftId:'draft:iphone'});
assert.deepEqual(calls.map(row=>row.op),['world:preview:enter'],'iPhone Studio draft import must avoid persistence-heavy world:draft:get when preview read is supported');
assert.equal(calls[0].payload.draftId,'draft:iphone','known draft id must cross the authority boundary');
assert.equal(doc.entities.length,1,'mobile World import must produce an editable object');
assert.equal(doc.entities[0].id,'iphone-smoke-tree');
assert.equal(doc.entities[0].transform.x,96);
assert.equal(doc.entities[0].transform.y,128);

const fallbackCalls=[];
const fallbackAdapter={...adapter,worldEditRequest:async(op,payload)=>{
  fallbackCalls.push(op);
  if(op==='world:preview:enter')throw new Error('UNKNOWN_WORLD_EDIT_OPERATION');
  if(op==='world:draft:get')return {viewSnapshot:snapshot,viewMeta:{kind:'draft',id:payload.draftId,draftId:payload.draftId,revisionVersion:7}};
  throw new Error(`unexpected ${op}`);
}};
const fallbackDoc=await importCurrentKeloWorld({adapter:fallbackAdapter,mode:'world',actorId:'remote-audit',view:'draft',draftId:'draft:remote'});
assert.deepEqual(fallbackCalls,['world:preview:enter','world:draft:get'],'older remote authorities must retain the draft:get compatibility fallback');
assert.equal(fallbackDoc.entities.length,1,'fallback authority must still mount editable World content');

console.log(JSON.stringify({ok:true,iphoneDraftReadFastPath:true,persistentDraftGetAvoided:true,remoteFallback:true,editableObjects:doc.entities.length}));
