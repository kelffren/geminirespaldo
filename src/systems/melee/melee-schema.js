/* KELO-INDEX
 * area: MELEE
 * owner: KeloMeleeSchema
 * keys: SCHEMA WEAPON ATTACK PROFILE HIT SHAPE WINDUP ACTIVE RECOVERY MOVEMENT COMBO SPECIAL CHARGE
 * purpose: vocabulario reusable de perfiles melee action-combat; valida timeline/combo/special sin poseer gameplay state
 * state-owned: ninguno
 * online: mismo contrato client/server; IDs estables y data serializable
 * do-not: NO ejecutar ataques, NO mutar actores, NO presentation
 */
(function(root){
  'use strict';
  const VERSION='melee-schema-v3.0.0-pvp-bible';
  const WEAPON_CLASSES=Object.freeze(['unarmed','sword','katana','axe','dagger','club','hammer','spear']);
  const ATTACK_PROFILES=Object.freeze(['light_slash','heavy_slash','thrust','spin','overhead','charged_slash','counter']);
  const HIT_SHAPES=Object.freeze(['range','circle','sector','arc','cone','capsule','rectangle','oriented_rect']);
  const INPUT_MODES=Object.freeze(['instant','press_release','hold_release','charge']);
  function finiteNonNegative(value,optional){return optional&&value==null?true:Number.isFinite(Number(value))&&Number(value)>=0;}
  function validMovementScale(value){
    if(value==null)return true;
    if(Number.isFinite(Number(value)))return Number(value)>=0&&Number(value)<=1;
    if(!value||typeof value!=='object')return false;
    return ['windup','active','recovery'].every(function(k){return value[k]==null||(Number.isFinite(Number(value[k]))&&Number(value[k])>=0&&Number(value[k])<=1);});
  }
  function validInput(raw){
    if(raw==null)return true;if(!raw||typeof raw!=='object'||INPUT_MODES.indexOf(String(raw.mode||'instant'))<0)return false;
    const c=raw.charge;if(c==null)return true;if(!c||typeof c!=='object')return false;
    const vals=['minTime','level1Time','level2Time','maxTime'].map(k=>c[k]==null?0:Number(c[k]));
    if(vals.some(v=>!Number.isFinite(v)||v<0))return false;
    return vals[0]<=vals[1]&&vals[1]<=vals[2]&&vals[2]<=vals[3];
  }
  function validProfile(def){
    if(!(def&&def.id&&WEAPON_CLASSES.indexOf(String(def.weaponClass||''))>=0&&ATTACK_PROFILES.indexOf(String(def.attackProfile||''))>=0))return false;
    if(!finiteNonNegative(def.range)||!finiteNonNegative(def.cooldown)||!finiteNonNegative(def.damage))return false;
    if(def.hitShape!=null&&HIT_SHAPES.indexOf(String(def.hitShape))<0)return false;
    for(const key of ['arcDegrees','forwardOffset','hitRadius','hitWidth','windup','active','recovery','knockback','stagger','charges','rechargeTime','cancelWindow','comboWindow','comboTimeout'])if(!finiteNonNegative(def[key],true))return false;
    if(!validMovementScale(def.movementScale)||!validInput(def.input))return false;
    if(def.combo!=null&&(!Array.isArray(def.combo)||!def.combo.length||def.combo.some(id=>!String(id||'').trim())))return false;
    if(def.canCancelInto!=null&&(!Array.isArray(def.canCancelInto)||def.canCancelInto.some(v=>!String(v||'').trim())))return false;
    return true;
  }
  root.KELO_MELEE_SCHEMA_AUDIT={version:VERSION,ready:true,weaponClasses:WEAPON_CLASSES.length,attackProfiles:ATTACK_PROFILES.length,hitShapes:HIT_SHAPES.length,actionPhases:true,phaseMovement:true,comboContract:true,specialInput:true};
  root.KeloMeleeSchema=Object.freeze({version:VERSION,weaponClasses:WEAPON_CLASSES,attackProfiles:ATTACK_PROFILES,hitShapes:HIT_SHAPES,inputModes:INPUT_MODES,validMovementScale,validInput,validProfile});
})(typeof globalThis!=='undefined'?globalThis:window);
