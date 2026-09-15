/* KELO-INDEX
 * area: PVP / MELEE / AUDIT
 * keys: HEAVY RECOVERY MOVEMENT FIXED-TIMESTEP 60HZ 90HZ 120HZ
 * purpose: compara baseline y candidatos de movilidad post-impact del heavy usando el perfil LIVE
 * online: cliente y servidor consumen el mismo KeloMeleeProfile; este audit verifica el contrato data-driven
 */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const box={console,Map,Set,WeakMap,Math,Date,Object,Array,String,Number,Boolean,JSON};box.globalThis=box;box.window=box;vm.createContext(box);
for(const rel of ['src/systems/melee/melee-schema.js','src/systems/melee/melee-weapon-profiles.js'])vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),box,{filename:rel});
const p=box.KeloMeleeProfiles&&box.KeloMeleeProfiles.get('sword_heavy_charge');
if(!p)throw new Error('HEAVY_PROFILE_MISSING');
const SPEED=185.28,baselineScale={windup:.58,active:.25,recovery:.55};
function continuous(scale){return SPEED*(p.windup*scale.windup+p.active*scale.active+p.recovery*scale.recovery);}
function fixed(hz,scale){const dt=1/hz,keys=['windup','active','recovery'],dur={windup:p.windup,active:p.active,recovery:p.recovery};let phase=0,t=0,d=0,steps=0;while(phase<keys.length&&steps<1000){const k=keys[phase];d+=SPEED*Number(scale[k])*dt;t+=dt;steps++;if(t>=dur[k]){phase++;t=0;}}return{hz,distancePx:d,steps};}
const current=p.movementScale,base=continuous(baselineScale),candidate=continuous(current),free=SPEED*(p.windup+p.active+p.recovery);
const out={profile:p.id,scaleBefore:baselineScale,scaleAfter:current,continuous:{baselineDistancePx:base,candidateDistancePx:candidate,gainPx:candidate-base,freeDistancePx:free,baselineSuppressionPx:free-base,candidateSuppressionPx:free-candidate},fixed:[60,90,120].map(hz=>({hz,before:fixed(hz,baselineScale),after:fixed(hz,current),gainPx:fixed(hz,current).distancePx-fixed(hz,baselineScale).distancePx}))};
if(Number(current.windup)!==.58||Number(current.active)!==.25)throw new Error('HEAVY_WEIGHT_PHASE_CHANGED');
if(Number(current.recovery)<=.55)throw new Error('HEAVY_RECOVERY_NOT_IMPROVED');
if(Number(current.recovery)>=.76)throw new Error('HEAVY_RECOVERY_ERASES_FINISHER_HIERARCHY');
if(out.continuous.gainPx<=0)throw new Error('HEAVY_RECOVERY_NO_CONTROL_GAIN');
console.log(JSON.stringify(out,null,2));
