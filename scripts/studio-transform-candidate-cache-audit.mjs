import assert from 'node:assert/strict';
import { createTransformTool } from '../src/studio/tools/transform-tool.mjs';

let queryCount=0;
const moving={id:'moving',transform:{x:0,y:0,rotation:0},bounds:{w:32,h:32}};
const far={id:'far',transform:{x:1000,y:1000,rotation:0},bounds:{w:32,h:32}};
const rows=new Map([
  ['moving',{id:'moving',category:'entity',rect:{x:0,y:0,w:32,h:32},data:moving}],
  ['far',{id:'far',category:'entity',rect:{x:1000,y:1000,w:32,h:32},data:far}]
]);
const kernel={
  document:{entities:[moving,far]},
  selection:{get:()=>['moving']},
  spatial:{
    get:id=>rows.get(String(id))||null,
    queryRect:()=>{queryCount++;return [...rows.values()];}
  },
  execute:async()=>{throw new Error('audit must not commit world commands');}
};

const tool=createTransformTool(kernel);
tool.begin('moving');
for(const x of [0,8,16,24,32]){
  const preview=tool.previewMove(x,0,{snap:1,smart:true,magnet:10,guideRange:256});
  assert.equal(preview.x,x,'far cached rows outside the requested guide area must not magnetize the preview');
}
assert.equal(queryCount,1,'nearby pointer moves should reuse one expanded spatial query');
let diag=tool.getDiagnostics();
assert.equal(diag.candidateQueries,1,'diagnostics must report one real spatial candidate query');
assert.equal(diag.candidateCacheHits,4,'four subsequent nearby moves should be served from cache');

const moved=tool.previewMove(200,0,{snap:1,smart:true,magnet:10,guideRange:256});
assert.equal(moved.x,200,'cache refresh must preserve transform behavior');
assert.equal(queryCount,2,'moving outside cached coverage must refresh candidates exactly once');
diag=tool.getDiagnostics();
assert.equal(diag.candidateQueries,2);

const source=await import('node:fs').then(fs=>fs.readFileSync(new URL('../src/studio/tools/transform-tool.mjs',import.meta.url),'utf8'));
assert.match(source,/CANDIDATE_CACHE_MARGIN=96/,'candidate cache margin must stay explicit and measurable');
assert.match(source,/rectContains\(state\.candidateCache\.area,requested\)/,'cache reuse must require full requested-area coverage');
assert.match(source,/rectIntersects\(row\.rect,requested\)/,'cached supersets must be filtered back to the exact guide range');
assert.match(source,/kernel\.spatial\.queryRect/,'cache misses must continue using the canonical spatial index');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'transform candidate caching must not write authority directly');

console.log(JSON.stringify({ok:true,nearbyMoves:5,spatialQueriesBeforeCacheExit:1,cacheHits:4,refreshAfterExit:true,commandBusUntouched:true},null,2));
