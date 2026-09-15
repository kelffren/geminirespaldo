import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveStudioNudgeStep, resolveSelectedStudioEntities } from '../src/studio/input/studio-nudge-controller.mjs';

const fakeRoot={document:{querySelector:()=>({value:'16'})}};
const fakeKernel={document:{settings:{tileSize:32}}};
assert.equal(resolveStudioNudgeStep({root:fakeRoot,kernel:fakeKernel}),16,'nudge must follow the live Snap selector');
assert.equal(resolveStudioNudgeStep({root:fakeRoot,kernel:fakeKernel,shiftKey:true}),1,'Shift+nudge must always provide 1px precision');
assert.equal(resolveStudioNudgeStep({root:fakeRoot,kernel:fakeKernel,altKey:true}),64,'Alt+nudge must move by four live Snap steps');
assert.equal(resolveStudioNudgeStep({root:fakeRoot,kernel:fakeKernel,mode:'fine'}),1,'mobile Fine must provide 1px precision');
assert.equal(resolveStudioNudgeStep({root:fakeRoot,kernel:fakeKernel,mode:'coarse'}),64,'mobile Coarse must provide four Snap steps');
assert.equal(resolveStudioNudgeStep({root:fakeRoot,kernel:fakeKernel,mode:'snap'}),16,'mobile Snap must reuse live Snap');
assert.equal(resolveStudioNudgeStep({root:fakeRoot,kernel:fakeKernel,shiftKey:true,altKey:true}),1,'Shift precision must win over coarse Alt mode');
assert.equal(resolveStudioNudgeStep({root:{document:{querySelector:()=>null}},kernel:fakeKernel}),32,'nudge must fall back to world tile size');
assert.equal(resolveStudioNudgeStep({root:{document:{querySelector:()=>null}},kernel:fakeKernel,mode:'coarse'}),128,'mobile Coarse must also scale tile fallback');

{
  const accesses=new Array(2000).fill(0);
  const entities=accesses.map((_,index)=>({
    get id(){accesses[index]++;return `entity-${index}`;},
    transform:{x:index,y:index}
  }));
  const selection=Array.from({length:800},(_,index)=>`entity-${index*2}`);
  const resolved=resolveSelectedStudioEntities(entities,selection);
  assert.equal(resolved.length,800,'large nudge selections must resolve every selected entity');
  assert.deepEqual(resolved.slice(0,3).map(row=>row.transform.x),[0,2,4],'selection order must be preserved by indexed lookup');
  assert.equal(Math.max(...accesses),1,'entity ids must be indexed once per resolution instead of rescanned once per selected id');
  assert.equal(accesses.reduce((sum,count)=>sum+count,0),entities.length,'large-selection lookup cost must stay linear in entity count');
  assert.deepEqual(resolveSelectedStudioEntities([{id:'a'},{id:'b'}],['missing','b']),[{id:'b'}],'missing selection ids must remain harmless');
}

const source=fs.readFileSync(new URL('../src/studio/input/studio-nudge-controller.mjs',import.meta.url),'utf8');
assert.match(source,/ArrowLeft:\{x:-1,y:0\}/,'left arrow must be wired');
assert.match(source,/ArrowRight:\{x:1,y:0\}/,'right arrow must be wired');
assert.match(source,/ArrowUp:\{x:0,y:-1\}/,'up arrow must be wired');
assert.match(source,/ArrowDown:\{x:0,y:1\}/,'down arrow must be wired');
assert.match(source,/MOBILE_MODES=Object\.freeze\(\['snap','fine','coarse'\]\)/,'mobile pad must expose Snap/Fine/Coarse modes');
assert.match(source,/data-nudge-dir="up"/,'touch pad must expose up');
assert.match(source,/data-nudge-dir="left"/,'touch pad must expose left');
assert.match(source,/data-nudge-dir="right"/,'touch pad must expose right');
assert.match(source,/data-nudge-dir="down"/,'touch pad must expose down');
assert.match(source,/min-width:46px;min-height:46px/,'mobile nudge targets must exceed 44px');
assert.match(source,/env\(safe-area-inset-bottom\)/,'mobile nudge pad must respect iPhone safe area');
assert.match(source,/mobileStep\(\)/,'touch directions must resolve through the shared nudge step');
assert.match(source,/const step=mobileStep\(\)/,'mobile mode indicator must resolve the exact active movement distance');
assert.match(source,/modeButton\.dataset\.step=String\(step\)/,'mobile mode indicator must expose exact step for UI/audit hooks');
assert.match(source,/modeButton\.textContent=`\$\{step\} PX`/,'mobile pad must show the exact pixel distance instead of an ambiguous mode label');
assert.match(source,/Nudge \$\{mobileMode\}: \$\{step\} pixels/,'mobile nudge accessibility label must include exact distance');
assert.match(source,/void nudge\(vector\[0\],vector\[1\],\{step:mobileStep\(\)\}\)/,'touch pad must call the same reversible nudge function');
assert.match(source,/COARSE_MULTIPLIER=4/,'coarse nudge multiplier must stay explicit and auditable');
assert.match(source,/input,textarea,select,\[contenteditable="true"\]/,'nudge must never steal arrows while editing UI fields');
assert.match(source,/event\.metaKey\|\|event\.ctrlKey\|\|editableTarget/,'Ctrl/Meta shortcuts and editable fields must retain arrow ownership');
assert.doesNotMatch(source,/event\.altKey\|\|editableTarget/,'Alt must remain available for coarse arrow nudging');
assert.match(source,/\['select','move'\]\.includes/,'nudge must only own movement in object editing modes');
assert.match(source,/event\.repeat/,'held keys must not flood Undo history');
assert.match(source,/resolveSelectedStudioEntities\(kernel\.document\.entities,kernel\.selection\.get\(\)\)/,'nudge must use the indexed selection resolver');
assert.doesNotMatch(source,/entities\.find\(/,'nudge must not rescan the full entity array once per selected id');
assert.match(source,/createCompositeCommand\(commands,\{type:'entity\.batch\.nudge'/,'multi-selection nudges must be one reversible batch');
assert.match(source,/await kernel\.execute\(command\)/,'persistent nudges must flow through Kernel CommandBus');
assert.match(source,/\[data-ext="snap"\]/,'nudge must read the creator Snap control instead of inventing a second grid setting');
assert.doesNotMatch(source,/KELO_WORLD_EDIT\s*\./,'nudge input must not write authority directly');
assert.match(source,/observer\?\.disconnect\(\)/,'touch-pad observer must be cleaned up');
assert.match(source,/pad\?\.remove\(\)/,'touch pad must be removed on Studio close');

const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(entry,/createStudioNudgeController/,'Studio entry must install nudge input');
assert.match(entry,/nudgeController\.destroy\(\)/,'Studio close must release nudge input');
assert.match(entry,/kelo-studio-foundation-v\d+\.\d+\.\d+/,'Studio must expose a current foundation version');

console.log(JSON.stringify({ok:true,keyboardNudge:true,mobileTouchPad:true,modes:['snap','fine','coarse'],exactMobileStepLabel:true,minTouchTarget:46,liveSnap:true,linearSelectionLookup:true,largeSelectionFixture:{entities:2000,selected:800,idReads:2000},multiSelectionBatch:true,commandBus:true,authorityDirectWrite:false,cleanup:true},null,2));
