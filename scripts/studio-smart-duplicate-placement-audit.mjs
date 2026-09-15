import assert from 'node:assert/strict';
import fs from 'node:fs';
import { findClearDuplicateOffset, createCreatorActions } from '../src/studio/tools/creator-actions.mjs';

const tile=32;
const entity=(id,x,y,w=32,h=32)=>({id,prefabId:id,bounds:{w,h},transform:{x,y,scale:1}});

const source=entity('source',0,0);
assert.deepEqual(findClearDuplicateOffset([source],[source],tile),{dx:32,dy:0},'free right slot remains the fastest duplicate placement');

const rightBlocker=entity('right-blocker',32,0);
assert.deepEqual(findClearDuplicateOffset([source],[source,rightBlocker],tile),{dx:0,dy:32},'occupied right slot must fall through to the next clear adjacent slot');

const group=[entity('a',0,0),entity('b',32,0)];
const groupBlocker=entity('group-right-blocker',64,0,64,32);
assert.deepEqual(findClearDuplicateOffset(group,[...group,groupBlocker],tile),{dx:0,dy:32},'multi-selection keeps its shape and avoids an occupied group-sized slot');

const document={settings:{tileSize:tile},entities:[source,rightBlocker]};
let selection=['source'],executeCount=0,lastSerialized=null,armed=null;
const kernel={
  document,
  selection:{get:()=>[...selection],set:ids=>{selection=[...ids];},clear:()=>{selection=[];}},
  tools:{get:id=>id==='select'?{armGrab:ids=>{armed=[...ids];}}:null},
  async execute(command){executeCount++;lastSerialized=command.serialize();}
};
const actions=createCreatorActions(kernel);
const clones=await actions.duplicateSelection();
assert.equal(executeCount,1,'multi-command duplicate must remain one CommandBus/history action');
assert.equal(clones.length,1);
assert.equal(clones[0].transform.x,0);
assert.equal(clones[0].transform.y,32,'runtime duplicate must use the clear adjacent slot');
assert.equal(lastSerialized.type,'entity.batch.duplicate');
assert.equal(lastSerialized.commands.length,1);
assert.deepEqual(armed,selection,'new duplicate remains selected and grab-ready');

const sourceText=fs.readFileSync(new URL('../src/studio/tools/creator-actions.mjs',import.meta.url),'utf8');
assert(!sourceText.includes('KELO_WORLD_EDIT'), 'creator actions must not bypass Studio authority with direct world writes');
assert(sourceText.includes('kernel.execute(createCompositeCommand'), 'duplicate must stay behind kernel/CommandBus execution');

console.log('STUDIO_SMART_DUPLICATE_PLACEMENT_AUDIT: PASS');
