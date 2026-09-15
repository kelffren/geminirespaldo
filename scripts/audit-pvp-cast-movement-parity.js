/* KELO-INDEX
 * area: QA / PVP ABILITY MOVEMENT
 * owner: deterministic audit only
 * keys: PVP CAST MOVEMENT PARITY FIREBALL FIRE TORNADO ICE WALL ICE NOVA STONE SHIELD 60HZ 90HZ 120HZ PHASE AWARE
 * purpose: compara baseline sin prediction contra candidate shared timeline y semántica autoritativa para movementScale de casts
 * consumes: abilityData + ability-action-timeline
 * do-not: NO gameplay writes, NO production state
 */
'use strict';
const path=require('path');
const data=require(path.resolve(__dirname,'../src/abilities/abilityData.js'));
const timeline=require(path.resolve(__dirname,'../src/abilities/ability-action-timeline.js'));
const SPEED=185.28;
const KEYS=['fireball','fire_tornado','ice_wall','ice_nova','stone_shield','shadow_step','wind_dash'];
function def(key){const d=(data.ABILITIES||[]).find(x=>x.key===key);if(!d)throw new Error('ABILITY_MISSING:'+key);return d;}
function serverRun(d,hz,meleeScale){
  const dt=1/hz,s=timeline.create(d);let distance=0,steps=0,phaseSteps=[];
  while(!s.done&&steps<1000){const castScale=timeline.movementScaleFor(s),scale=Math.min(meleeScale,castScale);phaseSteps.push({phase:s.phase,scale});distance+=SPEED*scale*dt;timeline.advance(s,dt);steps++;}
  return{distance,steps,phaseSteps};
}
function clientCandidate(d,hz,meleeScale){
  // Support hook priority 69 applies min(melee,cast)/melee, then existing pvp hook priority 70 applies melee.
  const dt=1/hz,s=timeline.create(d);let distance=0,steps=0,phaseSteps=[];
  while(!s.done&&steps<1000){const castScale=timeline.movementScaleFor(s),factor=Math.min(meleeScale,castScale)/Math.max(.000001,meleeScale),finalScale=meleeScale*factor;phaseSteps.push({phase:s.phase,scale:finalScale});distance+=SPEED*finalScale*dt;timeline.advance(s,dt);steps++;}
  return{distance,steps,phaseSteps};
}
function baselineSameTimelineNoCastSlow(d,hz,meleeScale){
  const dt=1/hz,s=timeline.create(d);let distance=0,steps=0;
  while(!s.done&&steps<1000){distance+=SPEED*meleeScale*dt;timeline.advance(s,dt);steps++;}
  return{distance,steps};
}
const rows=[];
for(const key of KEYS){for(const hz of [60,90,120]){for(const meleeScale of [1,.52,.34]){
  const d=def(key),srv=serverRun(d,hz,meleeScale),cli=clientCandidate(d,hz,meleeScale),base=baselineSameTimelineNoCastSlow(d,hz,meleeScale);
  const delta=Math.abs(srv.distance-cli.distance),phaseMismatch=srv.phaseSteps.some((x,i)=>!cli.phaseSteps[i]||x.phase!==cli.phaseSteps[i].phase||Math.abs(x.scale-cli.phaseSteps[i].scale)>1e-12);
  rows.push({key,hz,meleeScale,baselinePx:+base.distance.toFixed(5),serverPx:+srv.distance.toFixed(5),candidatePx:+cli.distance.toFixed(5),candidateServerDeltaPx:+delta.toFixed(12),baselineSemanticErrorPx:+Math.abs(base.distance-srv.distance).toFixed(5),steps:srv.steps,phaseMismatch});
  if(delta>1e-9||phaseMismatch)throw new Error(`CAST_PARITY_FAIL:${key}:${hz}:${meleeScale}:${delta}`);
}}}
function assertPhasePolicy(key,expected,label){
  const action=timeline.normalize(def(key)),subset=rows.filter(r=>r.key===key&&r.meleeScale===1);
  if(!action.movementScale||typeof action.movementScale!=='object')throw new Error(`${label}_PHASE_POLICY_MISSING`);
  if(Math.abs(action.movementScale.windup-expected.windup)>1e-9||Math.abs(action.movementScale.active-expected.active)>1e-9||Math.abs(action.movementScale.recovery-expected.recovery)>1e-9)throw new Error(`${label}_PHASE_POLICY_CHANGED`);
  if(!subset.every(r=>r.candidateServerDeltaPx<1e-9&&!r.phaseMismatch))throw new Error(`${label}_PHASE_PARITY_FAILED`);
  return{action,rows:subset};
}
const tornado=assertPhasePolicy('fire_tornado',{windup:.52,active:.52,recovery:.78},'TORNADO');
if(!tornado.rows.every(r=>r.baselineSemanticErrorPx>20))throw new Error('TORNADO_COMMITMENT_GAP_NOT_REPRODUCED');
const stone=assertPhasePolicy('stone_shield',{windup:.55,active:.55,recovery:.80},'STONE_SHIELD');
const nova=assertPhasePolicy('ice_nova',{windup:.64,active:.64,recovery:.82},'ICE_NOVA');
const wind=rows.filter(r=>r.key==='wind_dash'&&r.meleeScale===1);
if(!wind.every(r=>r.baselineSemanticErrorPx<1e-9&&r.candidateServerDeltaPx<1e-9))throw new Error('WIND_DASH_SHOULD_NOT_SLOW');
console.log(JSON.stringify({ok:true,version:timeline.version,maxCandidateServerDeltaPx:Math.max(...rows.map(r=>r.candidateServerDeltaPx)),fireTornadoAction:tornado.action,fireTornado:tornado.rows,stoneShieldAction:stone.action,stoneShield:stone.rows,iceNovaAction:nova.action,iceNova:nova.rows,windDash:wind,rows},null,2));