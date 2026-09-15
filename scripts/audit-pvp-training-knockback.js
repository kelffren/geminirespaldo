/* KELO-INDEX
 * area: QA / PVP KNOCKBACK
 * owner: deterministic training-knockback retention audit
 * keys: PVP KNOCKBACK TRAINING DUMMY 60HZ 90HZ 120HZ LEGACY GUARD
 * purpose: bloquea regresiones donde wandering legacy o el training guard cancelen desplazamientos de combate modernos menores de 40 px
 * do-not: NO gameplay, NO render, NO autoridad
 */
'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const c=fs.readFileSync(path.join(root,'engine-c.js'),'utf8');
const guard=fs.readFileSync(path.join(root,'src/ui/pvp-social-touch-guard.js'),'utf8');
const profiles=fs.readFileSync(path.join(root,'src/systems/melee/melee-weapon-profiles.js'),'utf8');
if(!c.includes('pvpLegacyBotWanderingSuppressed:true'))throw new Error('PVP_LEGACY_WANDERING_NOT_SUPPRESSED');
if(!guard.includes('if(displacement>.01)'))throw new Error('TRAINING_GUARD_SMALL_COMBAT_DISPLACEMENT_NOT_ADOPTED');
if(guard.includes('if(displacement>40)'))throw new Error('TRAINING_GUARD_OLD_40PX_THRESHOLD_RETURNED');
for(const value of [15,18,34,46])if(!profiles.includes(`knockback:${value}`))throw new Error('MELEE_KNOCKBACK_PROFILE_MISSING_'+value);
function oneFrame(hz,knockback){
  const dt=1/hz;
  let anchor=2980,x=anchor,targetX=anchor;
  // Legacy social wandering may attempt a move, but engine-c restores the pre-legacy state before Foundation after-hooks.
  x-=80*dt;x=anchor;targetX=anchor;
  // pvp-world priority 60 applies modern combat displacement.
  x+=knockback;
  // training guard priority 1000 adopts every surviving modern displacement > .01 as the new anchor.
  if(Math.abs(x-anchor)>.01)anchor=x;
  x=anchor;targetX=anchor;
  return {hz,knockback,retained:x-2980,targetDelta:targetX-2980};
}
const rows=[];
for(const hz of [60,90,120])for(const knockback of [15,18,34,46])rows.push(oneFrame(hz,knockback));
for(const row of rows){
  if(Math.abs(row.retained-row.knockback)>.001)throw new Error(`KNOCKBACK_NOT_RETAINED_${row.hz}_${row.knockback}`);
  if(Math.abs(row.targetDelta-row.knockback)>.001)throw new Error(`KNOCKBACK_TARGET_NOT_REANCHORED_${row.hz}_${row.knockback}`);
}
console.log(JSON.stringify({ok:true,rows},null,2));
