/* KELO-INDEX
 * area: QA / PVP CAST RECOVERY MOBILITY
 * owner: deterministic audit only
 * keys: FIREBALL RECOVERY MOVEMENT REVERSAL 60HZ 90HZ 120HZ
 * purpose: compara el recovery escalar legacy .78 contra la policy phase-aware del Fireball actual usando la primitive compartida
 * consumes: abilityData + ability-action-timeline
 * do-not: NO gameplay writes, NO production state
 */
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const data=require('../src/abilities/abilityData.js');
const timeline=require('../src/abilities/ability-action-timeline.js');
const SPEED=185.28;
const fireball=data.ABILITIES.find(x=>x.key==='fireball');
if(!fireball)throw new Error('FIREBALL_MISSING');
const actual=timeline.normalize(fireball);
if(!actual.movementScale||typeof actual.movementScale!=='object')throw new Error('FIREBALL_PHASE_POLICY_MISSING');
if(Math.abs(actual.movementScale.windup-.78)>1e-9||Math.abs(actual.movementScale.active-.78)>1e-9)throw new Error('FIREBALL_COMMITMENT_CHANGED');
const BASE={windup:.78,active:.78,recovery:.78};
function run(hz,scales){
  const dt=1/hz;
  const action={windup:actual.windup,active:actual.active,recovery:actual.recovery,movementScale:scales};
  const s=timeline.create(action);let total=0,recovery=0,recoverySteps=0,first100=0;
  while(!s.done){
    const phase=s.phase,scale=timeline.movementScaleFor(s),dx=SPEED*scale*dt;
    total+=dx;
    if(phase==='recovery'){
      recovery+=dx;recoverySteps++;
      if((recoverySteps-1)*dt<.1)first100+=dx;
    }
    timeline.advance(s,dt);
  }
  return{total,recovery,first100,recoverySteps};
}
const rows=[];
for(const hz of [60,90,120]){
  const baseline=run(hz,BASE),candidate=run(hz,actual.movementScale);
  const gainPct=(candidate.recovery/baseline.recovery-1)*100;
  const first100GainPct=(candidate.first100/baseline.first100-1)*100;
  const candidateVelocity=SPEED*actual.movementScale.recovery;
  const baselineVelocity=SPEED*.78;
  const row={hz,baselineRecoveryPx:+baseline.recovery.toFixed(4),candidateRecoveryPx:+candidate.recovery.toFixed(4),recoveryGainPct:+gainPct.toFixed(2),baselineFirst100Px:+baseline.first100.toFixed(4),candidateFirst100Px:+candidate.first100.toFixed(4),first100GainPct:+first100GainPct.toFixed(2),baselineVelocity:+baselineVelocity.toFixed(3),candidateVelocity:+candidateVelocity.toFixed(3)};
  rows.push(row);
  if(gainPct<8||gainPct>20)throw new Error(`RECOVERY_GAIN_OUT_OF_BAND:${hz}:${gainPct}`);
  if(first100GainPct<8||first100GainPct>20)throw new Error(`RECOVERY_FIRST100_OUT_OF_BAND:${hz}:${first100GainPct}`);
}
console.log(JSON.stringify({ok:true,fireball:{windup:actual.windup,active:actual.active,recovery:actual.recovery,movementScale:actual.movementScale},rows},null,2));
