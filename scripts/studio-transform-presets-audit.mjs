import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveSelectedRows } from '../src/studio/ui/studio-transform-presets.mjs';

const source=fs.readFileSync(new URL('../src/studio/ui/studio-transform-presets.mjs',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');

const ids=['rotNeg90','rot180','rot0','scale50','scale75','scale100','scale125','scale150','scale200','snap'];
for(const id of ids)assert.match(source,new RegExp(`data-transform-preset="${id}"`),`missing transform preset UI: ${id}`);
assert.equal((source.match(/data-transform-preset="[^"]+"/g)||[]).length,10,'transform preset panel must expose exactly ten focused actions');
assert.match(source,/createCompositeCommand\(commands/,'multi-selection presets must batch into one reversible command');
assert.match(source,/await kernel\.execute\(createCompositeCommand/,'persistent presets must flow through Kernel CommandBus');
assert.match(source,/createMoveEntityCommand/,'snap selection must use canonical move commands');
assert.match(source,/createPatchEntityCommand/,'rotation and scale presets must use canonical patch commands');
assert.match(source,/Math\.round\(ax\/step\)\*step-ax/,'group snap must derive one anchor delta');
assert.match(source,/rows\.map\(row=>createMoveEntityCommand/,'group snap must preserve relative spacing across the selection');
assert.match(source,/scale50:\(\)=>scaleExact\(\.5\)/,'50% scale preset missing');
assert.match(source,/scale75:\(\)=>scaleExact\(\.75\)/,'75% scale preset missing');
assert.match(source,/scale100:\(\)=>scaleExact\(1\)/,'100% scale preset missing');
assert.match(source,/scale125:\(\)=>scaleExact\(1\.25\)/,'125% scale preset missing');
assert.match(source,/scale150:\(\)=>scaleExact\(1\.5\)/,'150% scale preset missing');
assert.match(source,/scale200:\(\)=>scaleExact\(2\)/,'200% scale preset missing');
assert.match(source,/rotNeg90:\(\)=>rotateBy\(-90\)/,'negative 90-degree rotation preset missing');
assert.match(source,/rot180:\(\)=>rotateBy\(180\)/,'180-degree rotation preset missing');
assert.match(source,/rot0:rotationReset/,'rotation reset preset missing');
assert.match(source,/min-height:48px/,'mobile preset touch targets must be at least 48px');
assert.match(source,/env\(safe-area-inset-bottom\)/,'mobile preset panel must respect iPhone safe area');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'transform preset UI must not write authority directly');

let idReads=0;
const entityCount=5000,selectionCount=2000;
const entities=Array.from({length:entityCount},(_,index)=>{
  const row={transform:{x:index,y:index}};
  Object.defineProperty(row,'id',{enumerable:true,get(){idReads++;return `entity-${index}`;}});
  return row;
});
const selectedIds=Array.from({length:selectionCount},(_,index)=>`entity-${selectionCount-1-index}`);
const selectedRows=resolveSelectedRows(selectedIds,entities);
assert.equal(selectedRows.length,selectionCount,'selection resolver must retain all valid selected entities');
assert.equal(selectedRows[0].transform.x,selectionCount-1,'selection resolver must preserve selection order');
assert.equal(selectedRows.at(-1).transform.x,0,'selection resolver must preserve selection order through the final entity');
assert.ok(idReads<=entityCount+2,`selection resolution must index document entities once, got ${idReads} id reads for ${entityCount} entities`);
assert.match(source,/const byId=new Map\(\)/,'transform selection lookup must build one id index');
assert.match(source,/byId\.get\(String\(id\)\)/,'transform selection lookup must use constant-time id resolution');
assert.doesNotMatch(source,/entities\.find\(/,'transform selection lookup must not regress to one document scan per selected id');

assert.match(entry,/createStudioTransformPresets/,'Studio entry must import transform presets');
assert.match(entry,/transformPresets=createStudioTransformPresets\(\{root,kernel\}\)/,'Studio entry must instantiate transform presets with Kernel');
assert.match(entry,/transformPresets\.destroy\(\)/,'Studio close must clean transform preset UI');
assert.match(entry,/version:\s*'kelo-studio-foundation-v1\.\d+\.\d+[^']*'/,'foundation version must expose a current Studio foundation version');

console.log(JSON.stringify({ok:true,presets:ids.length,rotations:3,scales:6,groupSnap:1,singleUndo:true,commandBus:true,authorityBypass:false,mobileTargetPx:48,linearSelectionLookup:true,documentEntities:entityCount,selectedEntities:selectionCount,idReads},null,2));
