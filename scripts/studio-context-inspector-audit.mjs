import assert from 'node:assert/strict';
import fs from 'node:fs';
import { contextInspectorFields, selectSimilarEntityIds } from '../src/studio/ui/studio-context-inspector.mjs';

const fields=contextInspectorFields({transform:{x:12.5,y:-8,rotation:45,scale:1.25}});
assert.deepEqual(fields,{x:12.5,y:-8,rotation:45,scalePercent:125},'context inspector fields must reflect transform values');

const sample={entities:[
  {id:'tree-a',prefabId:'tree.oak'},
  {id:'rock-a',prefabId:'rock.01'},
  {id:'tree-b',prefabId:'tree.oak'},
  {id:'tree-c',prefabId:'tree.oak'},
  {id:'missing-prefab'}
]};
assert.deepEqual(selectSimilarEntityIds(sample,sample.entities[0]),['tree-a','tree-b','tree-c'],'select similar must return every matching prefab in stable document order');
assert.deepEqual(selectSimilarEntityIds(sample,sample.entities[1]),['rock-a'],'select similar must not include different prefabs');
assert.deepEqual(selectSimilarEntityIds(sample,sample.entities[4]),[],'entities without prefab ids must not broaden selection');
assert.deepEqual(selectSimilarEntityIds({entities:[]},{prefabId:'tree.oak'}),[],'empty documents must remain safe');

const source=fs.readFileSync(new URL('../src/studio/ui/studio-context-inspector.mjs',import.meta.url),'utf8');
assert.match(source,/ks-context-inspector-on \.ks-selection-float\{display:none!important\}/,'new inspector must replace the older floating HUD rather than stack on top of it');
assert.match(source,/fieldMarkup\('x','X'\)/,'context card must expose X');
assert.match(source,/fieldMarkup\('y','Y'\)/,'context card must expose Y');
assert.match(source,/fieldMarkup\('rotation','ROT'/,'context card must expose rotation');
assert.match(source,/fieldMarkup\('scalePercent','ESC'/,'context card must expose scale');
assert.match(source,/\.ks-right \.ks-properties/,'property edits must proxy the existing Properties UI');
assert.match(source,/dispatchEvent\(new EventCtor\('change'/,'property edits must delegate through the existing change pipeline');
assert.match(source,/\['select','move'\]\.includes/,'card must remain contextual to object editing modes');
assert.match(source,/paintCopies\?\.state\?\.\(\)\.enabled/,'card must hide while Paint Copies owns the canvas');
assert.match(source,/document\.activeElement!==input/,'live refresh must not overwrite a field while the user is typing');
assert.match(source,/data-context-close/,'user must be able to hide the contextual inspector without deselecting the object');
assert.match(source,/data-context-toggle/,'user must be able to collapse the contextual inspector');
assert.match(source,/data-context-action="pick"/,'context inspector must expose repeat-selected as a direct brush action');
assert.match(source,/entity\?\.prefabId/,'repeat-selected must derive the reusable asset from the selected entity prefab id');
assert.match(source,/\.ks-asset-search/,'repeat-selected must reuse the existing asset search bridge instead of inventing placement semantics');
assert.match(source,/target\.click\(\)/,'repeat-selected must delegate to the existing asset click placement flow');
assert.match(source,/search\.value=previous/,'repeat-selected must restore the user asset search after delegating placement');
assert.match(source,/data-context-action="similar"/,'context inspector must expose select-similar as a direct action');
assert.match(source,/kernel\.selection\.set\(ids\)/,'select-similar must reuse the Studio selection owner');
assert.doesNotMatch(source,/kernel\.execute\(/,'selection-only contextual actions must not create world commands');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'context inspector must remain authority-isolated');
assert.match(source,/grid-template-columns:repeat\(6,1fr\)/,'context actions must remain a compact single row after select-similar');
assert.match(source,/@media\(max-width:760px\)/,'context actions must retain mobile-specific sizing');

const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(entry,/createStudioContextInspector/,'Studio entry must install the contextual inspector');
assert.match(entry,/contextInspector\.destroy\(\)/,'Studio close must clean up the contextual inspector');
assert.match(entry,/kelo-studio-foundation-v1\.16\.0-multi-align/,'context inspector audit must track the current Studio foundation rather than a stale release');

console.log(JSON.stringify({ok:true,contextFields:true,propertyProxy:true,cleanHudReplacement:true,modeAware:true,collapsible:true,repeatSelectedBrush:true,selectSimilar:true,stablePrefabSelection:true,authorityIsolated:true,mobileCompact:true},null,2));
