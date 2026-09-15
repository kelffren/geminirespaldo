import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSpatialChunkIndex } from '../src/studio/spatial/spatial-chunk-index.mjs';
import { overlappingEntitiesAtPoint } from '../src/studio/input/studio-overlap-cycle-controller.mjs';

const spatial=createSpatialChunkIndex({chunkSize:128});
const entities=[];
for(let i=0;i<5000;i++){
  const entity={id:`far-${i}`};
  entities.push(entity);
  spatial.upsert({id:entity.id,category:'entity',rect:{x:10000+i*256,y:10000,w:32,h:32},data:entity,order:i});
}
const base={id:'base'},mid={id:'mid'},top={id:'top'};
for(const [entity,order] of [[base,5000],[mid,5001],[top,5002]]){
  entities.push(entity);
  spatial.upsert({id:entity.id,category:'entity',rect:{x:32,y:32,w:64,h:64},data:entity,order});
}

const hits=overlappingEntitiesAtPoint({entities,spatial},48,48);
assert.deepEqual(hits.map(row=>row.id),['top','mid','base'],'overlap cycling must preserve reverse document/render order');
const stats=spatial.stats().lastQuery;
assert.equal(stats.results,3,'local spatial query should return only the three nearby overlaps');
assert.ok(stats.membershipChecks<=3,`overlap query should stay local; got ${stats.membershipChecks} membership checks for ${entities.length} entities`);
assert.deepEqual(overlappingEntitiesAtPoint({entities,spatial},96,96).map(row=>row.id),['top','mid','base'],'spatial fast path must preserve inclusive right/bottom edge hit semantics');

const fallbackRects=new Map([
  ['base',{rect:{x:0,y:0,w:20,h:20}}],
  ['top',{rect:{x:0,y:0,w:20,h:20}}]
]);
const fallbackSpatial={queryRect:()=>[{id:'base',data:base}],get:id=>fallbackRects.get(String(id))||null};
assert.deepEqual(overlappingEntitiesAtPoint({entities:[base,top],spatial:fallbackSpatial},10,10).map(row=>row.id),['top','base'],'legacy/custom spatial models without order metadata must retain the safe full-scan fallback');

const overlapSource=fs.readFileSync(new URL('../src/studio/input/studio-overlap-cycle-controller.mjs',import.meta.url),'utf8');
const kernelSource=fs.readFileSync(new URL('../src/studio/core/studio-kernel.mjs',import.meta.url),'utf8');
assert.match(overlapSource,/spatial\.queryRect\(\{x:px-1,y:py-1,w:2,h:2\},\{category:'entity'\}\)/,'overlap selector must use a tiny chunk-index query that preserves inclusive edge hits');
assert.match(kernelSource,/data:e,order/,'world spatial rows must retain document order metadata');
assert.doesNotMatch(overlapSource,/KELO_WORLD_EDIT\s*\./,'selection optimization must not bypass authority');

console.log(JSON.stringify({ok:true,totalEntities:entities.length,localOverlaps:hits.length,membershipChecks:stats.membershipChecks,fullDocumentScanAvoided:stats.membershipChecks<entities.length,renderOrderPreserved:true,inclusiveEdgesPreserved:true,legacyFallback:true,authorityDirectWrite:false},null,2));
