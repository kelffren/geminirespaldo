import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeAlignedPositions,computeDistributedPositions,createChangedMoveCommands } from '../src/studio/ui/studio-multi-align.mjs';

const rows=[
  {id:'a',transform:{x:10,y:20,scale:1},bounds:{w:20,h:30}},
  {id:'b',transform:{x:80,y:70,scale:2},bounds:{w:10,h:10}},
  {id:'c',transform:{x:45,y:40,scale:1},bounds:{w:15,h:25}}
];

assert.deepEqual(computeAlignedPositions(rows,'left').map(r=>r.x),[10,10,10],'left aligns all origins to selection minX');
assert.deepEqual(computeAlignedPositions(rows,'top').map(r=>r.y),[20,20,20],'top aligns all origins to selection minY');
assert.deepEqual(computeAlignedPositions(rows,'right').map(r=>r.x),[80,80,85],'right alignment must respect each scaled width');
assert.deepEqual(computeAlignedPositions(rows,'bottom').map(r=>r.y),[60,70,65],'bottom alignment must respect each height');
assert.deepEqual(computeAlignedPositions(rows,'hcenter').map(r=>r.x),[45,45,47.5],'horizontal center preserves object widths around group center');
assert.deepEqual(computeAlignedPositions(rows,'vcenter').map(r=>r.y),[40,45,42.5],'vertical center preserves object heights around group center');
assert.deepEqual(computeAlignedPositions([rows[0]],'left'),[],'single selection must not create an alignment mutation');

const spread=[
  {id:'left',transform:{x:0,y:5,scale:1},bounds:{w:10,h:10}},
  {id:'wide',transform:{x:30,y:40,scale:2},bounds:{w:10,h:10}},
  {id:'middle',transform:{x:65,y:20,scale:1},bounds:{w:10,h:20}},
  {id:'right',transform:{x:100,y:80,scale:1},bounds:{w:10,h:10}}
];
const horizontal=computeDistributedPositions(spread,'horizontal');
assert.deepEqual(horizontal.map(r=>r.x),[0,30,70,100],'horizontal distribution must make edge gaps equal while respecting scaled widths');
assert.deepEqual(horizontal.map(r=>r.y),[5,40,20,80],'horizontal distribution must preserve y');
const vertical=computeDistributedPositions(spread,'vertical');
assert.deepEqual(vertical.map(r=>r.y),[5,51.67,23.33,80],'vertical distribution must sort spatially, preserve outer objects and account for object heights');
assert.deepEqual(vertical.map(r=>r.x),[0,30,65,100],'vertical distribution must preserve x');
assert.deepEqual(computeDistributedPositions(spread.slice(0,2),'horizontal'),[],'distribution requires at least three objects');

const changed=createChangedMoveCommands(rows,[
  {id:'a',x:10,y:20},
  {id:'b',x:12,y:14},
  {id:'missing',x:1,y:2}
]);
assert.equal(changed.length,1,'command builder must skip unchanged and missing entities');
assert.deepEqual(changed[0].serialize(),{type:'entity.move',id:'b',from:null,to:{x:12,y:14}},'command builder must preserve canonical reversible move serialization');

let idReads=0;
const largeCount=2000;
const largeEntities=Array.from({length:largeCount},(_,index)=>{
  const entity={transform:{x:index,y:index}};
  Object.defineProperty(entity,'id',{enumerable:true,get(){idReads++;return `entity-${index}`;}});
  return entity;
});
const largeTargets=Array.from({length:largeCount},(_,index)=>({id:`entity-${index}`,x:index+1,y:index}));
const largeCommands=createChangedMoveCommands(largeEntities,largeTargets);
assert.equal(largeCommands.length,largeCount,'large multi-selection must produce one move command per changed entity');
assert.ok(idReads<=largeCount+2,`entity ids must be read in one linear indexing pass, got ${idReads} reads for ${largeCount} entities`);
assert.equal(largeCommands.at(-1).serialize().id,`entity-${largeCount-1}`,'linear lookup must preserve target identity/order');

const source=fs.readFileSync(new URL('../src/studio/ui/studio-multi-align.mjs',import.meta.url),'utf8');
assert.match(source,/createMoveEntityCommand/,'alignment must use reversible move commands');
assert.match(source,/createCompositeCommand/,'group alignment must enter history as one composite action');
assert.match(source,/kernel\.execute\(createCompositeCommand/,'persistent mutation must pass through Studio CommandBus');
assert.match(source,/const byId=new Map\(\)/,'multi-align command build must index selected entities once');
assert.match(source,/byId\.get\(id\)/,'target lookup must use constant-time id indexing');
assert.doesNotMatch(source,/entities\.find\(/,'multi-align command construction must not regress to per-target linear scans');
assert.match(source,/type:'selection\.align'/,'alignment authority serialization must have a deterministic group command type');
assert.match(source,/type:'selection\.distribute'/,'distribution authority serialization must have a deterministic group command type');
assert.match(source,/data-distribute="horizontal"/,'toolbar must expose horizontal distribution');
assert.match(source,/data-distribute="vertical"/,'toolbar must expose vertical distribution');
assert.match(source,/button\.disabled=count<3/,'distribution actions must clearly disable below three selected objects');
assert.match(source,/kernel\.selection\.onChange/,'toolbar must react immediately to multi-selection changes');
assert.match(source,/count>1/,'toolbar must stay hidden for single selection');
assert.match(source,/@media\(max-width:760px\)/,'touch layout must have an explicit mobile treatment');
assert.match(source,/overflow-x:auto/,'expanded multi-action toolbar must remain reachable on narrow mobile screens');
assert.match(source,/label\.textContent!==nextLabel/,'observer-driven refresh must not rewrite its own label on every pass');
assert.match(source,/attributeFilter:\['data-active-tool','data-sheet-open','data-creator-minimized'\]/,'observer must ignore cosmetic class mutations');
assert.doesNotMatch(source,/KELO_WORLD_EDIT\s*\./,'UI must not bypass authority with direct world writes');

const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(entry,/createStudioMultiAlign/,'Studio boot must install multi align');
assert.match(entry,/multiAlign\.destroy\(\)/,'Studio close must cleanup multi align');

console.log(JSON.stringify({ok:true,left:true,rightScaled:true,centers:true,top:true,bottom:true,distributeHorizontal:true,distributeVertical:true,scaledSpacing:true,linearCommandBuild:true,largeSelection:largeCount,commandBus:true,compositeUndo:true,mobileReachable:true,observerStable:true,cleanup:true},null,2));
