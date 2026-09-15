import assert from 'node:assert/strict';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { registerBasicTools } from '../src/studio/tools/register-basic-tools.mjs';
import { createPlaceEntityCommand } from '../src/studio/document/document-commands.mjs';

const entity=(id,x,y,w=40,h=40)=>({id,prefabId:'audit',transform:{x,y,rotation:0},bounds:{w,h}});
async function fixture(rows){
  const kernel=createStudioKernel({document:createWorldDocument({worldId:`world:spacing:${Math.random()}`,settings:{tileSize:32,chunkSize:512}})});
  const tools=registerBasicTools(kernel);
  for(const row of rows)await kernel.execute(createPlaceEntityCommand(row));
  return{kernel,tools};
}

// Place an object exactly between two existing objects with equal gaps.
{
  const {kernel,tools}=await fixture([
    entity('moving',32,100),
    entity('left',100,100),
    entity('right',220,100)
  ]);
  kernel.selection.set('moving');
  tools.transform.begin('moving');
  const preview=tools.transform.previewMove(167,100,{snap:32,smart:true,magnet:10,spacing:true});
  assert.equal(preview.x,160,'moving object should magnetize to equal 20px gaps between neighbors');
  assert.equal(preview.snapTarget.spacingX,true,'spacing snap must be identified on X');
  const spacing=tools.transform.getGuides().filter(g=>g.kind==='spacing'&&g.axis==='x');
  assert.equal(spacing.length,2,'between mode must expose both equal gaps');
  assert.equal(spacing.every(g=>g.gap===20),true,'both spacing guides must report 20px');
  await tools.transform.commit();
  const moved=kernel.document.entities.find(row=>row.id==='moving');
  assert.equal(moved.transform.x,160,'equal spacing must persist after commit');
}

// Continue an existing horizontal rhythm: 20px gap, 20px gap, then moving copy.
{
  const {kernel,tools}=await fixture([
    entity('first',20,100),
    entity('second',80,100),
    entity('moving',300,100)
  ]);
  kernel.selection.set('moving');
  tools.transform.begin('moving');
  const preview=tools.transform.previewMove(145,100,{snap:32,smart:true,magnet:10,spacing:true});
  assert.equal(preview.x,140,'third object should continue the existing 20px horizontal spacing');
  assert.equal(preview.snapTarget.spacingX,true);
  const spacing=tools.transform.getGuides().filter(g=>g.kind==='spacing'&&g.axis==='x');
  assert.equal(spacing.length,2,'repeat mode must show the reference gap and the new matching gap');
  assert.equal(spacing.every(g=>g.gap===20),true);
  await tools.transform.commit();
  const moved=kernel.document.entities.find(row=>row.id==='moving');
  assert.equal(moved.transform.x,140);
}

// Same rhythm vertically for trees/lamps/columns arranged in a column.
{
  const {kernel,tools}=await fixture([
    entity('first',100,20),
    entity('second',100,80),
    entity('moving',100,300)
  ]);
  kernel.selection.set('moving');
  tools.transform.begin('moving');
  const preview=tools.transform.previewMove(100,145,{snap:32,smart:true,magnet:10,spacing:true});
  assert.equal(preview.y,140,'third object should continue the existing 20px vertical spacing');
  assert.equal(preview.snapTarget.spacingY,true);
  const spacing=tools.transform.getGuides().filter(g=>g.kind==='spacing'&&g.axis==='y');
  assert.equal(spacing.length,2);
  assert.equal(spacing.every(g=>g.gap===20),true);
  await tools.transform.commit();
  const moved=kernel.document.entities.find(row=>row.id==='moving');
  assert.equal(moved.transform.y,140);
}

console.log(JSON.stringify({ok:true,equalBetween:true,repeatHorizontal:true,repeatVertical:true,visibleSpacingGuides:true},null,2));
