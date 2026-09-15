import assert from 'node:assert/strict';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { registerBasicTools } from '../src/studio/tools/register-basic-tools.mjs';
import { createPlaceEntityCommand } from '../src/studio/document/document-commands.mjs';

const kernel=createStudioKernel({document:createWorldDocument({worldId:'world:paint-copies',settings:{tileSize:32,chunkSize:512}})});
const tools=registerBasicTools(kernel);
const source={id:'source-tree',prefabId:'tree',transform:{x:100,y:100,rotation:0},bounds:{w:40,h:40}};
await kernel.execute(createPlaceEntityCommand(source));
kernel.selection.set(source.id);

const started=tools.paintCopies.start({snap:1});
assert.equal(started.templateCount,1);
assert.equal(started.spacing,40,'auto spacing should respect the source footprint when it is larger than the grid');

tools.paintCopies.beginAt(200,100,{snap:1});
tools.paintCopies.strokeTo(400,100,{snap:1});
const preview=tools.paintCopies.getPreviews();
assert.equal(preview.length,6,'fast pointer travel must interpolate all spaced stamps, including start and end');
assert.deepEqual(preview.map(row=>row.transform.x),[180,220,260,300,340,380],'preview centers should remain 40px apart around the pointer path');
assert.equal(new Set(preview.map(row=>row.id)).size,preview.length,'every preview must have a unique entity id');
assert.equal(preview.every(row=>row.id!==source.id),true);

const historyBefore=kernel.history.undoDepth;
const committed=await tools.paintCopies.commit();
assert.equal(committed.stamps,6);
assert.equal(committed.rows.length,6);
assert.equal(kernel.document.entities.length,7);
assert.equal(kernel.history.undoDepth,historyBefore+1,'one paint stroke must become exactly one History action');
assert.equal(kernel.selection.get().length,6,'painted copies should become the active selection after commit');

await kernel.undo();
assert.equal(kernel.document.entities.length,1,'one Undo must remove the entire painted stroke');
assert.equal(kernel.document.entities[0].id,source.id);

// Multi-selection templates preserve internal offsets and still batch into one stroke.
await kernel.execute(createPlaceEntityCommand({id:'source-lamp',prefabId:'lamp',transform:{x:160,y:100,rotation:0},bounds:{w:20,h:40}}));
kernel.selection.set(['source-tree','source-lamp']);
const group=tools.paintCopies.start({snap:1,spacing:60});
assert.equal(group.templateCount,2);
tools.paintCopies.beginAt(300,300,{snap:1});
tools.paintCopies.strokeTo(420,300,{snap:1});
const groupPreview=tools.paintCopies.getPreviews();
assert.equal(groupPreview.length,6,'three stamps of a two-object template should preview six entities');
for(let i=0;i<groupPreview.length;i+=2){
  assert.equal(groupPreview[i+1].transform.x-groupPreview[i].transform.x,60,'group member offset must be preserved');
  assert.equal(groupPreview[i+1].transform.y-groupPreview[i].transform.y,0);
}
const groupHistory=kernel.history.undoDepth;
await tools.paintCopies.commit();
assert.equal(kernel.history.undoDepth,groupHistory+1,'group paint must also be one History action');

console.log(JSON.stringify({ok:true,autoSpacing:true,interpolation:true,uniqueIds:true,groupTemplate:true,oneUndoPerStroke:true},null,2));
