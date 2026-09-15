import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStudioKernel} from '../src/studio/core/studio-kernel.mjs';
import {createWorldDocument} from '../src/studio/document/world-document.mjs';
import {createCreatorActions} from '../src/studio/tools/creator-actions.mjs';

const original=[
  {id:'a',prefabId:'wide-wall',transform:{x:0,y:0,rotation:0,scale:1},bounds:{w:64,h:16},components:{}},
  {id:'b',prefabId:'tall-prop',transform:{x:96,y:32,rotation:90,scale:1},bounds:{w:32,h:64},components:{}}
];
const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:group-rotate',settings:{tileSize:32,chunkSize:256},entities:original})});
const actions=createCreatorActions(kernel);kernel.tools.register?.({...actions,id:'creatorActions'});
kernel.selection.set(['a','b']);
let executed=null;const off=kernel.commands.on(event=>{if(event.type==='execute')executed=event.command;});

const rotated=await actions.rotateSelection(90);
assert.equal(rotated.length,2,'all selected entities must remain selected after rotation');
assert.deepEqual(rotated.map(row=>[row.id,row.transform.x,row.transform.y,row.transform.rotation]),[
  ['a',72,-8,90],['b',32,48,180]
],'heterogeneous and pre-rotated assets must rotate around the visual group center without top-left drift');
const visualCenter=(rows)=>{
  const rects=rows.map(row=>{
    const scale=Number(row.transform?.scale)||1,w=row.bounds.w*scale,h=row.bounds.h*scale,angle=((Number(row.transform?.rotation)||0)%360+360)%360;
    const radians=angle*Math.PI/180,cos=Math.abs(Math.cos(radians)),sin=Math.abs(Math.sin(radians)),rw=w*cos+h*sin,rh=w*sin+h*cos,cx=row.transform.x+w/2,cy=row.transform.y+h/2;
    return{x:cx-rw/2,y:cy-rh/2,x2:cx+rw/2,y2:cy+rh/2};
  });
  return[
    Math.round(((Math.min(...rects.map(r=>r.x))+Math.max(...rects.map(r=>r.x2)))/2)*1e6)/1e6,
    Math.round(((Math.min(...rects.map(r=>r.y))+Math.max(...rects.map(r=>r.y2)))/2)*1e6)/1e6
  ];
};
assert.deepEqual(visualCenter(original),[72,40],'fixture visual center must be deterministic');
assert.deepEqual(visualCenter(rotated),[72,40],'group rotation must preserve the visual center of differently-sized and pre-rotated assets');
assert.equal(kernel.history.undoDepth,1,'group rotation must be one history entry');
assert.equal(executed?.type,'entity.batch.rotate','group rotation must serialize as one composite command');
assert.equal(executed?.commands?.length,2,'composite rotation must retain one patch per selected entity');

await kernel.undo();
assert.deepEqual(kernel.document.entities.map(row=>[row.id,row.transform.x,row.transform.y,row.transform.rotation]),original.map(row=>[row.id,row.transform.x,row.transform.y,row.transform.rotation]),'one Undo must restore the complete original composition');
await kernel.redo();
assert.deepEqual(kernel.document.entities.map(row=>[row.id,row.transform.x,row.transform.y,row.transform.rotation]),[
  ['a',72,-8,90],['b',32,48,180]
],'one Redo must restore the visual-center-rotated composition');
assert.equal(kernel.history.undoDepth,1,'Redo must restore one history entry');

await kernel.undo();kernel.selection.set(['a']);
await actions.rotateSelection(90);
const single=kernel.document.entities.find(row=>row.id==='a');
assert.deepEqual([single.transform.x,single.transform.y,single.transform.rotation],[0,0,90],'single-object rotation must preserve its established position behavior');

const source=fs.readFileSync(new URL('../src/studio/tools/creator-actions.mjs',import.meta.url),'utf8');
assert.match(source,/selectionVisualPivot\(rows,tile\)/,'group rotation must derive its pivot from visual bounds');
assert.match(source,/entityCenter\(row,tile\)/,'group rotation must rotate visual entity centers rather than raw origins');
assert.match(source,/createCompositeCommand\(commands/,'rotation persistence must remain one composite CommandBus operation');
assert.doesNotMatch(source,/document\.entities\s*=|document\.entities\.splice|KELO_WORLD_EDIT/,'creator actions must not bypass CommandBus/authority with direct document mutation');
off();
console.log(JSON.stringify({ok:true,groupRotation:true,heterogeneousBounds:true,preRotatedAsset:true,pivot:'visual-bounds-center',visualCenter:[72,40],oneUndo:true,oneRedo:true,singlePositionStable:true,authorityBypass:false},null,2));