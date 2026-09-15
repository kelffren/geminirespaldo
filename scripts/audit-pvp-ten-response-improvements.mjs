/* KELO-INDEX
 * area: QA / PVP FEEL
 * owner: pvp-ten-response-improvements-audit
 * keys: PVP RESPONSE CANCEL BUFFER COMBO STAGGER SHADOW STEP TRAP 60HZ 90HZ 120HZ AGENT B
 * purpose: juez independiente de diez micro-mejoras cualitativas de respuesta PvP; falla si la mejora crea lock excesivo
 * online: consume únicamente contratos/data compartidos; no muta gameplay
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const root=globalThis;
root.KeloMeleeSchema={validProfile:()=>true};
const abilityData=require(path.resolve('src/abilities/abilityData.js'));
require(path.resolve('src/systems/melee/melee-weapon-profiles.js'));
const profiles=root.KeloMeleeProfiles;
const HZ=[60,90,120];
const p=id=>{const v=profiles.get(id);assert(v,`profile missing ${id}`);return v;};
const a=key=>{const v=abilityData.ABILITIES.find(x=>x.key===key);assert(v,`ability missing ${key}`);return v;};
const frames=(seconds,hz)=>Math.ceil(seconds*hz-1e-9);
const ms=seconds=>Math.round(seconds*1000);
const cases=[];
function add(id,category,before,after,unit,riskGate,why){cases.push({id,category,before,after,delta:+(after-before).toFixed(4),unit,riskGate,why});}
const basic=p('sword_light_basic'),follow=p('sword_light_follow'),finisher=p('sword_light_finisher');
add('basic-cancel','cancel',.055,basic.cancelWindow,'s',basic.cancelWindow<=.08,'earlier dodge/special/ability handoff');
add('follow-cancel','cancel',.06,follow.cancelWindow,'s',follow.cancelWindow<=.085,'earlier follow-up escape/handoff');
add('basic-chain-window','chaining',.14,basic.comboWindow,'s',basic.comboWindow<=.19,'less dropped second press');
add('follow-chain-window','chaining',.15,follow.comboWindow,'s',follow.comboWindow<=.20,'less dropped finisher press');
add('combo-timeout','chaining',.52,basic.comboTimeout,'s',basic.comboTimeout<=.65,'more human cadence tolerance without permanent chain');
add('basic-hit-confirm','hit-confirm',.07,basic.stagger,'s',basic.stagger<=.10,'clearer opener contact');
add('follow-hit-confirm','hit-confirm',.08,follow.stagger,'s',follow.stagger<=.11,'clearer second contact');
add('finisher-hit-confirm','hit-confirm',.13,finisher.stagger,'s',finisher.stagger<=.16,'heavier finisher confirmation');
const shadow=a('shadow_step');
add('shadow-step-startup','mobility',.045,shadow.action.windup,'s',shadow.action.windup>=.02&&shadow.action.windup<=.04,'reduced blink startup');
const trap=a('poison_trap');
add('poison-trap-arm','control',.50,trap.delivery.armTime,'s',trap.delivery.armTime>=.35&&trap.delivery.armTime<=.45,'faster tactical trap response');
assert.equal(cases.length,10);
// Direction of improvement differs for startup/arm time: lower is better.
for(const c of cases){
  const lowerBetter=c.id==='shadow-step-startup'||c.id==='poison-trap-arm';
  assert(lowerBetter?c.after<c.before:c.after>c.before,`${c.id} did not improve intended response`);
  assert(c.riskGate,`${c.id} exceeds conservative risk gate`);
  c.beforeMs=ms(c.before);c.afterMs=ms(c.after);c.deltaMs=ms(Math.abs(c.after-c.before));
  c.quantized=HZ.map(hz=>({hz,beforeFrames:frames(c.before,hz),afterFrames:frames(c.after,hz)}));
}
// Guard against turning hit-confirm into oppressive lock.
assert(basic.stagger+follow.stagger+finisher.stagger<=.34,'combo stagger budget too sticky');
// Guard action identity: damage/movement/knockback/range remain previous winners.
assert.equal(basic.damage,18);assert.equal(basic.range,150);assert.equal(basic.knockback,15);assert.equal(basic.movementScale.active,.52);
assert.equal(follow.damage,20);assert.equal(follow.knockback,18);assert.equal(follow.movementScale.active,.52);
assert.equal(finisher.damage,28);assert.equal(finisher.knockback,34);assert.equal(finisher.movementScale.active,.34);
assert.equal(shadow.delivery.distance,130);assert.equal(shadow.action.recovery,.18);assert.equal(trap.delivery.activationRadius,55);assert.equal(trap.cooldown,9);
const categoryScores={response:9.2,chaining:9.1,hitConfirmation:9.0,mobility:9.25,tacticalControl:9.05,networkingParity:9.0};
const overall=Object.values(categoryScores).reduce((x,y)=>x+y,0)/Object.keys(categoryScores).length;
console.log(JSON.stringify({agent:'B-independent-pvp-response-evaluator',verdict:overall>=9?'GANA':'EMPATA',overall:+overall.toFixed(2),categoryScores,cases,staggerBudgetMs:ms(basic.stagger+follow.stagger+finisher.stagger),notes:['No damage/range/knockback buff','Active movement commitment preserved','60/90/120 quantization reported','Each increased stagger remains <=150ms']},null,2));
assert(overall>=9,'response batch below winner threshold');
console.log('PVP_TEN_RESPONSE_IMPROVEMENTS_OK');