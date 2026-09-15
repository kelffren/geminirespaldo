/* KELO-INDEX
 * area: PVP / MELEE AUDIT
 * owner: KeloMeleeProfiles verification
 * keys: PVP MELEE FOLLOW FINISHER RECOVERY MOVEMENT FIXED STEP AUDIT
 * purpose: verifies light-combo recovery mobility at 60/90/120 Hz without altering attack timings
 * online: client and server consume the same KeloMeleeProfiles data
 * do-not: NO runtime gameplay owner; audit only
 */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const box={console,Map,Set,WeakMap,Math,Date,Object,Array,String,Number,Boolean,JSON};box.globalThis=box;box.window=box;vm.createContext(box);
for(const rel of ['src/systems/melee/melee-schema.js','src/systems/melee/melee-weapon-profiles.js'])vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),box,{filename:rel});
const profiles=box.KeloMeleeProfiles;
const follow=profiles&&profiles.get('sword_light_follow'),finisher=profiles&&profiles.get('sword_light_finisher');
if(!follow)throw new Error('FOLLOW_PROFILE_MISSING');
if(!finisher)throw new Error('FINISHER_PROFILE_MISSING');
if(!follow.movementScale||Number(follow.movementScale.recovery)!==1)throw new Error('FOLLOW_RECOVERY_NOT_FULL_MOBILITY');
if(!finisher.movementScale||Number(finisher.movementScale.recovery)!==.76)throw new Error('FINISHER_RECOVERY_NOT_TUNED');
const SPEED=185.28;
function distance(profile,scale){return SPEED*(profile.windup*scale.windup+profile.active*scale.active+profile.recovery*scale.recovery);}
function fixedStep(profile,hz,scale){const dt=1/hz,phases=['windup','active','recovery'];let phase=0,time=0,distancePx=0,steps=0;while(phase<phases.length&&steps<1000){const key=phases[phase];distancePx+=SPEED*Number(scale[key])*dt;time+=dt;steps++;if(time>=profile[key]){phase++;time=0;}}return{hz,distancePx,steps};}
function sample(profile,scale){return{continuousDistancePx:distance(profile,scale),fixed:[60,90,120].map(hz=>fixedStep(profile,hz,scale))};}
const followBefore={windup:.9,active:.52,recovery:.8},followAfter=follow.movementScale;
const finisherBefore={windup:.76,active:.34,recovery:.64},finisherA={windup:.76,active:.34,recovery:.72},finisherB=finisher.movementScale;
const followBaseline=sample(follow,followBefore),followCandidate=sample(follow,followAfter);
const finisherBaseline=sample(finisher,finisherBefore),finisherCandidateA=sample(finisher,finisherA),finisherCandidateB=sample(finisher,finisherB);
const result={
  speedPxPerSec:SPEED,
  follow:{recoveryScaleBefore:.8,recoveryScaleAfter:follow.movementScale.recovery,baseline:followBaseline,candidate:followCandidate,gainPx:followCandidate.continuousDistancePx-followBaseline.continuousDistancePx},
  finisher:{recoveryScaleBefore:.64,candidateARecoveryScale:.72,candidateBRecoveryScale:finisher.movementScale.recovery,baseline:finisherBaseline,candidateA:finisherCandidateA,candidateB:finisherCandidateB,gainAFromBaselinePx:finisherCandidateA.continuousDistancePx-finisherBaseline.continuousDistancePx,gainBFromBaselinePx:finisherCandidateB.continuousDistancePx-finisherBaseline.continuousDistancePx,gainBOverAPx:finisherCandidateB.continuousDistancePx-finisherCandidateA.continuousDistancePx}
};
if(result.follow.gainPx<=0)throw new Error('FOLLOW_RECOVERY_NO_MOBILITY_GAIN');
if(result.finisher.gainAFromBaselinePx<=0||result.finisher.gainBFromBaselinePx<=result.finisher.gainAFromBaselinePx)throw new Error('FINISHER_RECOVERY_REFINEMENT_INVALID');
if(finisher.movementScale.recovery>=1)throw new Error('FINISHER_RECOVERY_LOST_WEIGHT_DIFFERENTIATION');
console.log(JSON.stringify(result,null,2));
