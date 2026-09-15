import assert from 'node:assert/strict';
import {createStudioKernel} from '../src/studio/core/studio-kernel.mjs';
import {createWorldDocument} from '../src/studio/document/world-document.mjs';
import {createSelectTool} from '../src/studio/tools/select-tool.mjs';

const document=createWorldDocument({
  worldId:'audit:select-toggle',
  settings:{tileSize:32,chunkSize:256},
  entities:[
    {id:'wall:a',prefabId:'wall',transform:{x:0,y:0,rotation:0},bounds:{w:32,h:32},components:{buildingPiece:{type:'wall'}}},
    {id:'wall:b',prefabId:'wall',transform:{x:64,y:0,rotation:0},bounds:{w:32,h:32},components:{buildingPiece:{type:'wall'}}},
    {id:'wall:c',prefabId:'wall',transform:{x:128,y:0,rotation:0},bounds:{w:32,h:32},components:{buildingPiece:{type:'wall'}}}
  ]
});
const kernel=createStudioKernel({document});
const select=createSelectTool(kernel,{root:{innerWidth:390,matchMedia:()=>({matches:true}),KeloCamera:{snapshot:()=>({effectiveZoom:.25})}}});

select.selectPoint(8,8);
assert.deepEqual(kernel.selection.get(),['wall:a'],'normal tap selects the first piece');
select.selectPoint(72,8,{append:true});
assert.deepEqual(kernel.selection.get(),['wall:a','wall:b'],'append tap adds a second piece');
select.selectPoint(136,8,{append:true});
assert.deepEqual(kernel.selection.get(),['wall:a','wall:b','wall:c'],'append tap can build a multi-selection');
select.selectPoint(72,8,{append:true});
assert.deepEqual(kernel.selection.get(),['wall:a','wall:c'],'repeating append on a selected piece must remove only that piece');
select.selectPoint(72,8,{append:true});
assert.deepEqual(kernel.selection.get(),['wall:a','wall:c','wall:b'],'another append tap must add the piece back without disturbing the rest');
select.selectPoint(8,8,{append:true});
select.selectPoint(136,8,{append:true});
select.selectPoint(72,8,{append:true});
assert.deepEqual(kernel.selection.get(),[],'each selected piece can be removed independently until the selection is empty');
assert.equal(kernel.history.undoDepth,0,'selection toggles must remain transient and must not create history entries');
assert.equal(kernel.document.entities.length,3,'selection toggles must not mutate the world document');

console.log(JSON.stringify({ok:true,appendToggle:true,removeInOneTap:true,multiSelectionPreserved:true,historyEntries:0,documentMutations:0},null,2));
