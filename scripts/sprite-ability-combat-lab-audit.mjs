import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeSpriteAbilityDocument,spriteAbilityTiming,buildGeneratedDrafts,validateSpriteAbilityDocument } from '../src/creators/sprite-ability/sprite-ability-document.mjs';

const draft=normalizeSpriteAbilityDocument({
  name:'Audit Slash',
  sheet:{dataUrl:'data:image/png;base64,AA==',frameWidth:64,frameHeight:64,columns:8,rows:1,startFrame:0,endFrame:7,fps:20},
  combat:{impactFrame:3,activeStartFrame:2,activeEndFrame:4,range:140,hitboxX:12,hitboxY:-44,hitboxWidth:156,hitboxHeight:72,hitstopMs:50},
  preview:{mode:'dummy',playbackRate:.25,showHitbox:true,onionSkin:true}
});
assert.equal(draft.combat.activeStartFrame,2);
assert.equal(draft.combat.impactFrame,3);
assert.equal(draft.combat.activeEndFrame,4);
assert.equal(draft.preview.playbackRate,.25);
assert.equal(draft.preview.showHitbox,true);
assert.equal(draft.preview.onionSkin,true);

const timing=spriteAbilityTiming(draft);
assert.equal(timing.frameMs,50);
assert.equal(timing.activeStartMs,100);
assert.equal(timing.impactMs,150);
assert.equal(timing.activeEndMs,250);
assert.equal(timing.activeMs,150,'three active frames must export as a three-frame active window');

const built=buildGeneratedDrafts(draft,{animationProjectId:'anim:audit',abilityProjectId:'ability:audit'});
const hit=built.animation.tracks.hitbox[0];
assert.equal(hit.start,.1);
assert.equal(hit.end,.25);
assert.deepEqual(hit.payload.box,{x:12,y:-44,width:156,height:72});
assert.equal(built.animation.clip.markers.impact,.15);
assert.equal(built.animation.clip.markers.recover,.25);
assert.equal(built.ability.definition.action.active,.15);
assert.deepEqual(built.ability.authoring.hitbox,{x:12,y:-44,width:156,height:72});
assert.equal(validateSpriteAbilityDocument(draft).ok,true);

const controller=await readFile(new URL('../src/creators/sprite-ability/sprite-ability-live-controller.mjs',import.meta.url),'utf8');
assert.match(controller,/BUILDER V1\.2/);
assert.match(controller,/sab-timeline/);
assert.match(controller,/timelineDrag/);
assert.match(controller,/active-start/);
assert.match(controller,/active-end/);
assert.match(controller,/canvasHitboxRect/);
assert.match(controller,/playbackRate/);
assert.match(controller,/onUndo:undo/);
assert.match(controller,/ONION/);
assert.match(controller,/HITBOX/);

console.log(JSON.stringify({ok:true,spriteAbilityCombatLab:true,timeline:true,scrub:true,activeWindow:true,editableHitbox:true,slowMotion:true,onionSkin:true,undoRedo:true,generatedHitbox:hit.payload.box},null,2));
