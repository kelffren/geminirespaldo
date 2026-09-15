import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncWorldSpatialCommand } from '../src/studio/core/studio-kernel.mjs';

let idReads=0;
const entities=Array.from({length:5000},(_,i)=>{
  const id=`entity-${i}`;
  return {
    get id(){idReads++;return id;},
    transform:{x:i,y:0,scale:1},
    bounds:{w:16,h:16}
  };
});
const changedIds=Array.from({length:1000},(_,i)=>`entity-${4000+i}`);
const command={type:'batch',commands:[
  ...changedIds.map(id=>({type:'entity.update',id})),
  {type:'entity.delete',id:'missing-a'},
  {type:'entity.delete',id:'missing-b'}
]};
const upserts=[],removals=[];
const spatial={
  upsert:row=>upserts.push(row),
  remove:id=>removals.push(String(id))
};

syncWorldSpatialCommand({command,document:{entities},spatial});
assert.equal(upserts.length,1000,'every existing changed entity must be refreshed once');
assert.deepEqual(removals.sort(),['missing-a','missing-b'],'missing changed ids must be removed from the spatial index');
assert.equal(upserts[0].order,4000,'batch sync must preserve document/render order metadata');
assert.equal(upserts.at(-1).order,4999,'batch sync must preserve order for the final entity');
assert.ok(idReads<=6000,`batch sync must stay near one document pass; observed ${idReads} entity id reads`);
assert.ok(idReads<5000*1000/100,`batch sync regressed toward per-id document scans: ${idReads} reads`);

let singleReads=0;
const singleRows=Array.from({length:5000},(_,i)=>{
  const id=`single-${i}`;
  return {get id(){singleReads++;return id;},transform:{x:i,y:0,scale:1},bounds:{w:1,h:1}};
});
const singleUpserts=[];
syncWorldSpatialCommand({command:{type:'entity.update',id:'single-3'},document:{entities:singleRows},spatial:{upsert:row=>singleUpserts.push(row),remove:()=>{}}});
assert.equal(singleUpserts[0].order,3,'single entity sync must keep exact order');
assert.ok(singleReads<=6,`single-entity fast path must not scan the whole document; observed ${singleReads} reads`);

const source=fs.readFileSync(new URL('../src/studio/core/studio-kernel.mjs',import.meta.url),'utf8');
assert.match(source,/if\(ids\.size===1\)/,'single-edit fast path must remain explicit');
assert.match(source,/for\(let order=0;order<rows\.length&&pending\.size;order\+\+\)/,'multi-edit sync must use one bounded document pass');
assert.doesNotMatch(source,/KELO_WORLD_EDIT\s*\./,'spatial synchronization must not bypass CommandBus authority');

console.log(JSON.stringify({
  ok:true,
  totalEntities:entities.length,
  changedEntities:changedIds.length,
  entityIdReads:idReads,
  naiveWorstCaseReads:entities.length*changedIds.length,
  readReductionVsNaiveWorstCase:Number((1-idReads/(entities.length*changedIds.length)).toFixed(6)),
  singleEntityReads:singleReads,
  removalsPreserved:true,
  renderOrderPreserved:true,
  authorityDirectWrite:false
},null,2));
