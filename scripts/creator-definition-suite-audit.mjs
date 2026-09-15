import assert from 'node:assert/strict';
import { createDefinitionDraft, DEFINITION_WORKSPACE_ROWS, getDefinitionSpec, interpretDefinitionPrompt, validateDefinitionDraft } from '../src/creators/definition/definition-specs.mjs';
import { createDefinitionWorkspaceManifest, registerDefinitionWorkspaces } from '../src/creators/workspaces/definition-workspaces.mjs';

assert.equal(DEFINITION_WORKSPACE_ROWS.length,11,'definition suite should activate eleven workspaces');
assert.equal(new Set(DEFINITION_WORKSPACE_ROWS.map(x=>x.id)).size,DEFINITION_WORKSPACE_ROWS.length,'workspace ids must be unique');
assert.equal(new Set(DEFINITION_WORKSPACE_ROWS.map(x=>x.type)).size,DEFINITION_WORKSPACE_ROWS.length,'project types must be unique');
for(const row of DEFINITION_WORKSPACE_ROWS){const spec=getDefinitionSpec(row.type),draft=createDefinitionDraft(row.type,{name:`Audit ${spec.label}`}),checked=validateDefinitionDraft(row.type,draft);assert.equal(checked.ok,true,`${row.type} defaults should validate`);assert.equal(spec.fields.length>=5,true,`${row.type} needs a meaningful editable schema`);}

let d=interpretDefinitionPrompt('DUNGEON','a hard shadow dungeon with 12 rooms, level 25, boss: The Warden',{name:'Dungeon'});
assert.equal(d.fields.difficulty,'hard');assert.equal(d.fields.theme,'void');assert.equal(d.fields.rooms,12);assert.equal(d.fields.recommendedLevel,25);assert.match(d.fields.boss,/warden/i);

d=interpretDefinitionPrompt('NPC','a merchant called “Rina” who patrols, radius 160, says: Welcome to the plaza',{name:'NPC'});
assert.equal(d.name,'Rina');assert.equal(d.fields.role,'merchant');assert.equal(d.fields.behavior,'patrol');assert.equal(d.fields.interactionRadius,160);assert.match(d.fields.dialogue,/welcome/i);

d=interpretDefinitionPrompt('QUEST','a daily quest with 4 steps, reward: 250 KC, repeatable',{name:'Quest'});
assert.equal(d.fields.questType,'daily');assert.equal(d.fields.steps,4);assert.equal(d.fields.repeatable,true);assert.equal(d.fields.reward,'250 KC');

d=interpretDefinitionPrompt('ITEM','a legendary weapon, stack 1, value 5000, effect: burn on hit',{name:'Item'});
assert.equal(d.fields.rarity,'legendary');assert.equal(d.fields.itemType,'weapon');assert.equal(d.fields.stackSize,1);assert.equal(d.fields.value,5000);assert.match(d.fields.effect,/burn/i);

d=interpretDefinitionPrompt('ENVIRONMENT','night forest with fog, ambient density 70, magical music',{name:'Environment'});
assert.equal(d.fields.biome,'forest');assert.equal(d.fields.weather,'fog');assert.equal(d.fields.timeOfDay,'night');assert.equal(d.fields.ambientDensity,70);

d=interpretDefinitionPrompt('AUDIO','ambient loop, volume 65, range 600, trigger enter_zone',{name:'Audio'});
assert.equal(d.fields.audioType,'ambient');assert.equal(d.fields.loop,true);assert.equal(d.fields.volume,65);assert.equal(d.fields.range,600);

const registered=[];const registry={register(manifest){registered.push(manifest);return manifest;}};registerDefinitionWorkspaces(registry);assert.equal(registered.length,11);assert.equal(registered.every(x=>x.availability==='active'),true);assert.equal(registered.every(x=>x.projectTypes.length===1),true);
let opened=null;const manifest=createDefinitionWorkspaceManifest({id:'npc',type:'NPC',loader:async()=>({openGenericDefinitionCreator:async context=>{opened=context;return{ok:true};}})});const result=await manifest.open({root:{document:{}},projects:{},projectId:'creator-project:test'});assert.deepEqual(result,{ok:true});assert.equal(opened.definitionType,'NPC');assert.equal(opened.projectId,'creator-project:test');

console.log(JSON.stringify({ok:true,workspaces:registered.map(x=>x.id),promptInterpreter:true,defaultsValidate:true,lazyWorkspaceRouting:true},null,2));
