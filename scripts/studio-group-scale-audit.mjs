import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStudioKernel} from '../src/studio/core/studio-kernel.mjs';
import {createWorldDocument} from '../src/studio/document/world-document.mjs';
import {createCreatorActions} from '../src/studio/tools/creator-actions.mjs';

const original=[
  {id:'a',prefabId:'wide-wall',transform:{x:0,y:0,rotation:0,scale:1},bounds:{w:64,h:16},components:{}},
  {id:'b',prefabId:'tall-prop',transform:{x:96,y:32,rotation:0,scale:1},bounds:{w:32,h:64},components:{}}
];
const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:group-scale',settings:{tileSize:32,chunkSize:256},entities:original})});
const actions=createCreatorActions(kernel);kernel.tools.register?.({...actions,id:'creatorActions'});
kernel.selection.set(['a','b']);
let executed=null;const off=kernel.commands.on(event=>{if(event.type==='execute')executed=event.command;});

const scaled=await actions.scaleSelection({delta:.5});
assert.equal(scaled.length,2,'all selected entities must remain selected after scaling');
assert.deepEqual(scaled.map(row=>[row.id,row.transform.x,row.transform.y,row.transform.scale]),[
  ['a',-32,-24,1.5],['b',112,24,1.5]
],'heterogeneous assets must scale around the visual group center without top-left drift');
const visualCenter=(rows)=>{
  const rects=rows.map(row=>({x:row.transform.x,y:row.transform.y,x2:row.transform.x+row.bounds.w*row.transform.scale,y2:row.transform.y+row.bounds.h*row.transform.scale}));
  return[(Math.min(...rects.map(r=>r.x))+Math.max(...rects.map(r=>r.x2)))/2,(Math.min(...rects.map(r=>r.y))+Math.max(...rects.map(r=>r.y2)))/2];
};
assert.deepEqual(visualCenter(original),[64,48],'fixture visual center must be deterministic');
assert.deepEqual(visualCenter(scaled),[64,48],'group scale must preserve the visual center of differently-sized assets');
assert.equal(kernel.history.undoDepth,1,'group scale must be one history entry');
assert.equal(executed?.type,'entity.batch.scale','group scale must serialize as one composite command');
assert.equal(executed?.commands?.length,2,'composite scale must retain one patch per changed selected entity');

await kernel.undo();
assert.deepEqual(kernel.document.entities.map(row=>[row.id,row.transform.x,row.transform.y,row.transform.scale]),original.map(row=>[row.id,row.transform.x,row.transform.y,row.transform.scale]),'one Undo must restore the complete original composition');
await kernel.redo();
assert.deepEqual(kernel.document.entities.map(row=>[row.id,row.transform.x,row.transform.y,row.transform.scale]),[
  ['a',-32,-24,1.5],['b',112,24,1.5]
],'one Redo must restore the visual-center-scaled composition');
assert.equal(kernel.history.undoDepth,1,'Redo must restore one history entry');

await kernel.undo();kernel.selection.set(['a']);
await actions.scaleSelection({delta:.5});
const single=kernel.document.entities.find(row=>row.id==='a');
assert.deepEqual([single.transform.x,single.transform.y,single.transform.scale],[0,0,1.5],'single-object scaling must preserve its established top-left behavior');

const mixedOriginal=[
  {id:'m1',prefabId:'scale-1',transform:{x:0,y:0,rotation:0,scale:1},bounds:{w:32,h:32},components:{}},
  {id:'m2',prefabId:'scale-2',transform:{x:96,y:0,rotation:0,scale:2},bounds:{w:16,h:16},components:{}},
  {id:'m3',prefabId:'scale-max',transform:{x:192,y:0,rotation:0,scale:8},bounds:{w:4,h:4},components:{}}
];
const mixedKernel=createStudioKernel({document:createWorldDocument({worldId:'audit:group-scale:mixed',settings:{tileSize:32,chunkSize:256},entities:mixedOriginal})});
const mixedActions=createCreatorActions(mixedKernel);mixedKernel.selection.set(['m1','m2','m3']);
let mixedExecuted=null;const mixedOff=mixedKernel.commands.on(event=>{if(event.type==='execute')mixedExecuted=event.command;});
const mixedScaled=await mixedActions.scaleSelection({delta:.5});
assert.deepEqual(mixedScaled.map(row=>[row.id,row.transform.x,row.transform.y,row.transform.scale]),[
  ['m1',-56,-8,1.5],['m2',92,-4,2.5],['m3',192,0,8]
],'mixed starting scales must reposition each changed entity by its own actual scale ratio while clamped members stay anchored');
assert.equal(mixedExecuted?.type,'entity.batch.scale','mixed-scale persistence must remain one composite CommandBus operation');
assert.equal(mixedExecuted?.commands?.length,2,'a max-scale member that cannot change must not emit a no-op patch');
assert.equal(mixedKernel.history.undoDepth,1,'mixed-scale edit must remain one Undo step');
await mixedKernel.undo();
assert.deepEqual(mixedKernel.document.entities.map(row=>[row.id,row.transform.x,row.transform.y,row.transform.scale]),mixedOriginal.map(row=>[row.id,row.transform.x,row.transform.y,row.transform.scale]),'mixed-scale Undo must restore every original transform');
await mixedKernel.redo();
assert.deepEqual(mixedKernel.document.entities.map(row=>[row.id,row.transform.x,row.transform.y,row.transform.scale]),[
  ['m1',-56,-8,1.5],['m2',92,-4,2.5],['m3',192,0,8]
],'mixed-scale Redo must restore ratio-correct placement without drifting the clamped member');
assert.equal(mixedKernel.history.undoDepth,1,'mixed-scale Redo must restore exactly one history entry');
mixedOff();

const source=fs.readFileSync(new URL('../src/studio/tools/creator-actions.mjs',import.meta.url),'utf8');
assert.match(source,/selectionVisualPivot\(/,'group scale must derive a pivot from visual entity bounds');
assert.match(source,/entityCenter\(/,'group scale must reposition entity centers rather than raw origins');
assert.match(source,/const factor=next\/current/,'mixed-scale movement must use each entity\'s actual scale ratio');
assert.match(source,/const commands=changed\.map/,'clamped unchanged members must not emit no-op scale patches');
assert.match(source,/createCompositeCommand\(commands/,'scale persistence must remain one composite CommandBus operation');
assert.doesNotMatch(source,/document\.entities\s*=|document\.entities\.splice|KELO_WORLD_EDIT/,'creator actions must not bypass CommandBus/authority with direct document mutation');
off();
console.log(JSON.stringify({ok:true,groupScale:true,heterogeneousBounds:true,pivot:'visual-bounds-center',visualCenter:[64,48],factor:1.5,mixedScaleRatios:true,clampedAnchor:true,noOpPatches:0,oneUndo:true,oneRedo:true,singlePositionStable:true,authorityBypass:false},null,2));
