import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createTransformTool } from '../src/studio/tools/transform-tool.mjs';

function kernelFor(entities,selection=[]){
  const byId=new Map(entities.map(entity=>[String(entity.id),entity]));
  return {
    document:{entities},
    selection:{get:()=>selection.slice()},
    spatial:{
      get:id=>{const e=byId.get(String(id));if(!e)return null;const scale=Math.max(.1,Number(e.transform?.scale)||1);return {id:e.id,rect:{x:Number(e.transform?.x)||0,y:Number(e.transform?.y)||0,w:Math.max(1,(Number(e.bounds?.w)||1)*scale),h:Math.max(1,(Number(e.bounds?.h)||1)*scale),data:e};},
      queryRect:()=>[]
    },
    execute:async()=>{}
  };
}

const one={id:'a',transform:{x:0,y:0,rotation:0},bounds:{w:32,h:32}};
const single=createTransformTool(kernelFor([one],['a']));
single.begin('a');
let preview=single.previewMove(19,45,{snap:32,smart:false});
assert.equal(preview.x,32,'preview x must show the same 32px-grid coordinate that commit will use');
assert.equal(preview.y,32,'preview y must show the same 32px-grid coordinate that commit will use');
assert.deepEqual(preview.snapTarget,{x:32,y:32,snap:32,magneticX:false,magneticY:false,spacingX:false,spacingY:false},'snap target must equal rendered preview target');

single.cancel();single.begin('a');
preview=single.previewMove(19,45,{snap:1,smart:false});
assert.equal(preview.x,19,'1px precision mode must remain pixel exact');
assert.equal(preview.y,45,'1px precision mode must remain pixel exact');

const a={id:'a',transform:{x:5,y:7},bounds:{w:16,h:16}};
const b={id:'b',transform:{x:37,y:39},bounds:{w:16,h:16}};
const group=createTransformTool(kernelFor([a,b],['a','b']));
group.begin('a');
preview=group.previewMove(22,50,{snap:16,smart:false});
assert.equal(preview.rows[0].preview.x,16,'group anchor x must visibly resolve to the snapped pointer target');
assert.equal(preview.rows[0].preview.y,48,'group anchor y must visibly resolve to the snapped pointer target');
assert.equal(preview.rows[1].preview.x,48,'group members must preserve their 32px relative x offset');
assert.equal(preview.rows[1].preview.y,80,'group members must preserve their 32px relative y offset');

const source=fs.readFileSync(new URL('../src/studio/tools/transform-tool.mjs',import.meta.url),'utf8');
assert.match(source,/finalTx=xSnap\?tx\+xSnap\.delta:Math\.round\(tx\/s\)\*s/,'unsnapped x preview must round to grid before rendering');
assert.match(source,/finalTy=ySnap\?ty\+ySnap\.delta:Math\.round\(ty\/s\)\*s/,'unsnapped y preview must round to grid before rendering');
assert.match(source,/state\.snapTarget=\{x:finalTx,y:finalTy/,'preview and commit must share one resolved target');
assert.match(source,/kernel\.execute\(commands\[0\]\)|kernel\.execute\(createCompositeCommand/,'persistent transforms must still commit through CommandBus');
assert.doesNotMatch(source,/KELO_WORLD_EDIT|worldEditRequest/,'transform tool must remain authority-transport agnostic');

console.log(JSON.stringify({ok:true,gridPreviewCommitParity:true,snap32:true,pixelPrecision:true,groupOffsetsPreserved:true,commandBusPreserved:true},null,2));
