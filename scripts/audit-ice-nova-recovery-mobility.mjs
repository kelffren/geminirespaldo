/* KELO-INDEX
 * area: QA / PVP FEEL
 * owner: deterministic audit only
 * keys: ICE NOVA RECOVERY MOBILITY REVERSAL 60HZ 90HZ 120HZ A B
 * purpose: same-trace baseline/candidate evaluation for phase-aware Ice Nova recovery locomotion
 * consumes: abilityData + ability-action-timeline
 * do-not: NO gameplay writes, NO production state
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const data=require('../src/abilities/abilityData.js');
const timeline=require('../src/abilities/ability-action-timeline.js');
const SPEED=185.28, BASELINE=.64, CANDIDATE_A=.76, CANDIDATE_B=.82;
const src=(data.ABILITIES||[]).find(x=>x.key==='ice_nova');
if(!src) throw new Error('ICE_NOVA_MISSING');
function def(scale){return {...src,action:{...src.action,movementScale:{windup:BASELINE,active:BASELINE,recovery:scale}}};}
function run(scale,hz){
  const d=def(scale), s=timeline.create(d), dt=1/hz;
  let recoveryPx=0,totalPx=0,maxStep=0,recoverySteps=0; const phases=[];
  while(!s.done&&phases.length<200){
    const phase=s.phase, ms=timeline.movementScaleFor(s), step=SPEED*ms*dt;
    phases.push({phase,scale:ms,step}); totalPx+=step; maxStep=Math.max(maxStep,step);
    if(phase==='recovery'){recoveryPx+=step; recoverySteps++;}
    timeline.advance(s,dt);
  }
  const wind=phases.filter(x=>x.phase==='windup'), active=phases.filter(x=>x.phase==='active');
  if(!wind.every(x=>Math.abs(x.scale-BASELINE)<1e-9)||!active.every(x=>Math.abs(x.scale-BASELINE)<1e-9)) throw new Error('ICE_NOVA_COMMITMENT_CHANGED');
  return {hz,scale,recoveryPx:+recoveryPx.toFixed(4),totalPx:+totalPx.toFixed(4),maxStep:+maxStep.toFixed(4),recoverySteps};
}
const rows=[]; for(const hz of [60,90,120]) for(const scale of [BASELINE,CANDIDATE_A,CANDIDATE_B]) rows.push(run(scale,hz));
const by=s=>rows.filter(r=>r.scale===s), base=by(BASELINE), a=by(CANDIDATE_A), b=by(CANDIDATE_B);
const spread=x=>Math.max(...x.map(r=>r.recoveryPx))-Math.min(...x.map(r=>r.recoveryPx));
for(let i=0;i<3;i++){
  if(a[i].recoveryPx<=base[i].recoveryPx+4) throw new Error('CANDIDATE_A_GAIN_TOO_SMALL');
  if(b[i].recoveryPx<=a[i].recoveryPx+1.5) throw new Error('CANDIDATE_B_REFINEMENT_TOO_SMALL');
  if(b[i].maxStep>=4) throw new Error('CANDIDATE_B_STEP_TOO_LARGE');
}
if(spread(b)>=2) throw new Error('CANDIDATE_B_REFRESH_SPREAD');
const current=timeline.normalize(src).movementScale;
if(!current||typeof current!=='object') throw new Error('ICE_NOVA_PRODUCTION_POLICY_NOT_PHASE_AWARE');
if(Math.abs(current.windup-BASELINE)>1e-9||Math.abs(current.active-BASELINE)>1e-9) throw new Error('ICE_NOVA_COMMITMENT_DRIFT');
if(![CANDIDATE_A,CANDIDATE_B].some(x=>Math.abs(current.recovery-x)<1e-9)) throw new Error('ICE_NOVA_UNRECOGNIZED_CANDIDATE');
const result={ok:true,baseline:BASELINE,candidateA:CANDIDATE_A,candidateB:CANDIDATE_B,currentProduction:current,rows,refreshSpreadPx:+spread(b).toFixed(4)};
fs.mkdirSync('audit-artifacts',{recursive:true}); fs.writeFileSync('audit-artifacts/ice-nova-recovery-deterministic.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2)); console.log('ICE_NOVA_RECOVERY_MOBILITY_AB_OK');