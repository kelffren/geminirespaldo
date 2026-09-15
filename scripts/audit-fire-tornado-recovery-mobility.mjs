/* KELO-INDEX
 * area: QA / PVP CAST RECOVERY MOBILITY
 * owner: deterministic audit only
 * keys: FIRE TORNADO RECOVERY MOVEMENT 60HZ 90HZ 120HZ A B WINNER
 * purpose: compara baseline .52, Candidate A .72 y winner actual .78 preservando windup/active .52
 * consumes: abilityData + ability-action-timeline
 * online: valida semántica compartida consumible por cliente y server
 * do-not: NO gameplay writes, NO production state
 */
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const data=require('../src/abilities/abilityData.js');
const timeline=require('../src/abilities/ability-action-timeline.js');
const SPEED=185.28;
const BASE={windup:.52,active:.52,recovery:.52};
const A={windup:.52,active:.52,recovery:.72};
const def=data.ABILITIES.find(x=>x.key==='fire_tornado');
if(!def)throw new Error('FIRE_TORNADO_MISSING');
const actual=timeline.normalize(def);
function run(hz,scales){
  const action={windup:actual.windup,active:actual.active,recovery:actual.recovery,movementScale:scales};
  const s=timeline.create(action),dt=1/hz;let recovery=0,first100=0,recoveryTime=0,maxStep=0;
  while(!s.done){
    const phase=s.phase,scale=timeline.movementScaleFor(s),dx=SPEED*scale*dt;
    if(phase==='recovery'){
      recovery+=dx;maxStep=Math.max(maxStep,dx);
      if(recoveryTime<.1)first100+=dx;
      recoveryTime+=dt;
    }
    timeline.advance(s,dt);
  }
  return {recovery,first100,maxStep};
}
if(actual.windup!==.18||actual.active!==.05||actual.recovery!==.34)throw new Error('FIRE_TORNADO_TIMING_CHANGED');
if(!actual.movementScale||typeof actual.movementScale!=='object')throw new Error('FIRE_TORNADO_PHASE_POLICY_MISSING');
if(Math.abs(actual.movementScale.windup-.52)>1e-9||Math.abs(actual.movementScale.active-.52)>1e-9)throw new Error('FIRE_TORNADO_COMMITMENT_CHANGED');
if(Math.abs(actual.movementScale.recovery-.78)>1e-9)throw new Error('WINNER_EXPECTED_RECOVERY_078');
const rows=[];
for(const hz of [60,90,120]){
  const baseline=run(hz,BASE),a=run(hz,A),b=run(hz,actual.movementScale);
  const gainA=(a.recovery/baseline.recovery-1)*100,gainB=(b.recovery/baseline.recovery-1)*100,gainBvsA=(b.recovery/a.recovery-1)*100;
  const row={hz,
    baselineRecoveryPx:+baseline.recovery.toFixed(4),candidateARecoveryPx:+a.recovery.toFixed(4),winnerRecoveryPx:+b.recovery.toFixed(4),
    candidateAGainPct:+gainA.toFixed(2),winnerGainPct:+gainB.toFixed(2),winnerVsAPct:+gainBvsA.toFixed(2),
    baselineFirst100Px:+baseline.first100.toFixed(4),candidateAFirst100Px:+a.first100.toFixed(4),winnerFirst100Px:+b.first100.toFixed(4),
    baselineVelocity:+(SPEED*.52).toFixed(3),candidateAVelocity:+(SPEED*.72).toFixed(3),winnerVelocity:+(SPEED*.78).toFixed(3),winnerMaxStepPx:+b.maxStep.toFixed(4)};
  rows.push(row);
  if(gainB<48||gainB>52)throw new Error(`WINNER_GAIN_OUT_OF_BAND:${hz}:${gainB}`);
  if(gainBvsA<7||gainBvsA>10)throw new Error(`WINNER_REFINEMENT_OUT_OF_BAND:${hz}:${gainBvsA}`);
  if(b.maxStep>2.5)throw new Error(`WINNER_STEP_TOO_LARGE:${hz}:${b.maxStep}`);
}
console.log(JSON.stringify({ability:def.key,action:actual,rows},null,2));
console.log('FIRE_TORNADO_RECOVERY_WINNER_078_OK');
