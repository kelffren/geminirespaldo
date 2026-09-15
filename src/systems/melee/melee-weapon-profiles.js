/* KELO-INDEX
 * area: MELEE
 * owner: KeloMeleeProfiles
 * keys: CONTENT PROFILES SWORD DATA ACTION WINDUP ACTIVE RECOVERY ARC COMBO SPECIAL CHARGE MOVEMENT CANCEL REACTION
 * purpose: catálogo declarativo de perfiles melee; armas/combos/specials nuevos no modifican engines
 * gameplay: sword basic conserva identidad ligera y añade combo/charges/timeline por data
 * online: servidor carga los mismos IDs/perfiles; balance competitivo puede resolver modifiers encima
 */
(function(root){
  'use strict';
  const VERSION='melee-weapon-profiles-v3.7.0-pvp-response-pass';
  const registry=new Map();
  function freezeScale(value){
    if(value&&typeof value==='object')return Object.freeze({windup:value.windup==null?1:Number(value.windup),active:value.active==null?1:Number(value.active),recovery:value.recovery==null?1:Number(value.recovery)});
    return Number.isFinite(Number(value))?Number(value):1;
  }
  function freezeInput(value){if(!value||typeof value!=='object')return null;const c=value.charge&&typeof value.charge==='object'?Object.freeze({minTime:Number(value.charge.minTime)||0,level1Time:Number(value.charge.level1Time)||0,level2Time:Number(value.charge.level2Time)||0,maxTime:Number(value.charge.maxTime)||0}):null;return Object.freeze({mode:String(value.mode||'instant'),charge:c});}
  function register(def){
    if(!root.KeloMeleeSchema||!root.KeloMeleeSchema.validProfile(def))throw new Error('INVALID_MELEE_PROFILE:'+String(def&&def.id||''));
    const item=Object.freeze({
      id:String(def.id),weaponClass:String(def.weaponClass),attackProfile:String(def.attackProfile),damage:Number(def.damage),range:Number(def.range),cooldown:Number(def.cooldown),damageType:String(def.damageType||'physical'),
      hitShape:String(def.hitShape||'range'),arcDegrees:Number(def.arcDegrees)||0,forwardOffset:Number(def.forwardOffset)||0,hitRadius:Number(def.hitRadius)||0,hitWidth:Number(def.hitWidth)||0,
      windup:Number(def.windup)||0,active:Number(def.active)||0,recovery:Number(def.recovery)||0,movementScale:freezeScale(def.movementScale),
      knockback:Number(def.knockback)||0,stagger:Number(def.stagger)||0,charges:Math.max(1,Math.floor(Number(def.charges)||1)),rechargeTime:Number(def.rechargeTime)||0,cancelWindow:Number(def.cancelWindow)||0,
      combo:Array.isArray(def.combo)?Object.freeze(def.combo.map(String)):Object.freeze([]),comboWindow:Number(def.comboWindow)||0,comboTimeout:Number(def.comboTimeout)||0,
      canCancelInto:Array.isArray(def.canCancelInto)?Object.freeze(def.canCancelInto.map(String)):Object.freeze([]),specialAttackProfileId:def.specialAttackProfileId==null?null:String(def.specialAttackProfileId),
      input:freezeInput(def.input),visualProfileId:def.visualProfileId==null?null:String(def.visualProfileId)
    });
    registry.set(item.id,item);return item;
  }
  function get(id){return registry.get(String(id||''))||null;}
  function list(){return Array.from(registry.values());}

  register({
    id:'sword_light_basic',weaponClass:'sword',attackProfile:'light_slash',damage:18,range:150,cooldown:.12,damageType:'physical',
    hitShape:'sector',arcDegrees:92,forwardOffset:18,windup:.085,active:.075,recovery:.18,
    movementScale:{windup:.86,active:.52,recovery:1},knockback:15,stagger:.085,
    charges:2,rechargeTime:.58,cancelWindow:.07,comboWindow:.17,comboTimeout:.60,
    combo:['sword_light_basic','sword_light_follow','sword_light_finisher'],canCancelInto:['dodge','special','ability'],specialAttackProfileId:'sword_heavy_charge',visualProfileId:'melee_sword_light_v3'
  });
  register({
    id:'sword_light_follow',weaponClass:'sword',attackProfile:'light_slash',damage:20,range:154,cooldown:.10,damageType:'physical',
    hitShape:'sector',arcDegrees:104,forwardOffset:20,windup:.07,active:.07,recovery:.17,
    movementScale:{windup:.9,active:.52,recovery:1},knockback:18,stagger:.095,
    charges:2,rechargeTime:.58,cancelWindow:.075,comboWindow:.18,comboTimeout:.60,canCancelInto:['dodge','special','ability'],visualProfileId:'melee_sword_light_follow_v1'
  });
  register({
    id:'sword_light_finisher',weaponClass:'sword',attackProfile:'heavy_slash',damage:28,range:164,cooldown:.16,damageType:'physical',
    hitShape:'sector',arcDegrees:116,forwardOffset:22,windup:.11,active:.085,recovery:.26,
    movementScale:{windup:.80,active:.34,recovery:.80},knockback:34,stagger:.15,
    charges:2,rechargeTime:.58,cancelWindow:.045,comboWindow:0,comboTimeout:.60,canCancelInto:['dodge'],visualProfileId:'melee_sword_finisher_v1'
  });
  register({
    id:'sword_heavy_charge',weaponClass:'sword',attackProfile:'charged_slash',damage:32,range:172,cooldown:.45,damageType:'physical',
    hitShape:'sector',arcDegrees:108,forwardOffset:20,windup:.12,active:.09,recovery:.34,
    movementScale:{windup:.62,active:.25,recovery:.68},knockback:46,stagger:.18,
    charges:1,rechargeTime:1.15,cancelWindow:.03,comboWindow:0,comboTimeout:0,canCancelInto:['dodge'],
    input:{mode:'charge',charge:{minTime:.08,level1Time:.28,level2Time:.62,maxTime:1.05}},visualProfileId:'melee_sword_heavy_charge_v1'
  });

  root.KELO_MELEE_PROFILE_AUDIT={version:VERSION,ready:true,profiles:function(){return registry.size;},basicProfile:'sword_light_basic',basicDamage:18,basicRange:150,basicHitShape:'sector',basicArcDegrees:92,basicCharges:2,comboSteps:3,specialProfile:'sword_heavy_charge',basicActiveMovementScale:.52,basicRecoveryMovementScale:1,followRecoveryMovementScale:1,finisherWindupMovementScale:.80,finisherRecoveryMovementScale:.80,heavyWindupMovementScale:.62,heavyRecoveryMovementScale:.68,basicCancelWindow:.07,followCancelWindow:.075,basicComboWindow:.17,followComboWindow:.18,comboTimeout:.60,basicStagger:.085,followStagger:.095,finisherStagger:.15};
  root.KeloMeleeProfiles=Object.freeze({version:VERSION,register,get,list});
})(typeof globalThis!=='undefined'?globalThis:window);