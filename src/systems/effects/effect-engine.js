/* KELO-INDEX
 * area: EFFECTS
 * owner: KeloEffectEngine
 * keys: ENGINE REGISTRY DAMAGE HEAL SHIELD STATUS CC REUSABLE EVENTS
 * purpose: despacha efectos por tipo mediante handlers registrables; unifica abilities/melee con DamageResolver y StatusEffects
 * public-api: register/apply/applyAll/has/metrics
 * online: mismo contrato puede ejecutarse detrás de server authority; presentation consume eventos semánticos
 * do-not: NO hit geometry, NO target selection, NO VFX, NO ability IDs hardcodeados
 */
(function(root){
  'use strict';
  const VERSION='effect-engine-v2.0.0-pvp-bible';
  const handlers=new Map();let applied=0;
  function emit(name,payload){try{if(root.KeloEvents&&typeof root.KeloEvents.emit==='function')root.KeloEvents.emit(name,payload);}catch(_){} }
  function register(type,handler){const key=String(type||'');if(!key||typeof handler!=='function')throw new Error('INVALID_EFFECT_HANDLER');handlers.set(key,handler);return key;}
  function apply(effect,context){const e=effect&&typeof effect==='object'?effect:{},type=String(e.type||'');if(!root.KeloEffectSchema||!root.KeloEffectSchema.supports(type))return Object.freeze({ok:false,reason:'UNKNOWN_EFFECT_TYPE',type});const handler=handlers.get(type);if(!handler)return Object.freeze({ok:false,reason:'EFFECT_RUNTIME_NOT_REGISTERED',type});const result=handler(e,context||{})||{};applied+=1;return Object.freeze(Object.assign({ok:result.ok!==false,type},result));}
  function applyAll(effects,context){return(Array.isArray(effects)?effects:[]).map(effect=>apply(effect,context));}
  function damageHandler(effect,ctx){
    if(!root.KeloDamageResolver)return{ok:false,reason:'DAMAGE_RESOLVER_UNAVAILABLE'};const target=ctx.target;if(!target)return{ok:false,reason:'INVALID_TARGET'};
    const result=root.KeloDamageResolver.apply(target,Math.max(0,Number(effect.amount)||0),ctx);
    const payload=Object.assign({},ctx,{target,targetActor:target,targetActorId:String(target.id||''),damageType:String(effect.damageType||ctx.damageType||'physical'),requested:result.requested,amount:result.amount,absorbed:result.absorbed,hp:result.hp,killed:result.killed,blocked:result.blocked,blockReason:result.blockReason||null});
    if(result.blocked)emit(root.KeloCombatSchema&&root.KeloCombatSchema.events.DAMAGE_BLOCKED||'combat:damage_blocked',payload);
    else{
      if(result.absorbed>0)emit(root.KeloCombatSchema&&root.KeloCombatSchema.events.SHIELD_ABSORBED||'combat:shield_absorbed',payload);
      emit(root.KeloCombatSchema&&root.KeloCombatSchema.events.DAMAGE_APPLIED||'combat:damage_applied',payload);if(result.killed)emit(root.KeloCombatSchema&&root.KeloCombatSchema.events.ENTITY_KILLED||'combat:entity_killed',payload);
    }
    return result;
  }
  function healHandler(effect,ctx){const target=ctx.target;if(!target)return{ok:false,reason:'INVALID_TARGET'};const max=Math.max(0,Number(target.maxHp)||100),before=target.hp==null?max:Math.max(0,Number(target.hp)||0),hp=Math.min(max,before+Math.max(0,Number(effect.amount)||0));target.hp=hp;return{amount:hp-before,hpBefore:before,hp};}
  function shieldHandler(effect,ctx){const target=ctx.target;if(!target)return{ok:false,reason:'INVALID_TARGET'};const amount=Math.max(0,Number(effect.amount)||0);target.keloShield=Math.max(0,Number(target.keloShield)||0)+amount;if(Number(effect.duration)>0)target.keloShieldT=Number(effect.duration);const payload=Object.assign({},ctx,{target,targetActor:target,targetActorId:String(target.id||''),amount,shield:target.keloShield,duration:Number(effect.duration)||0});emit('SHIELD_APPLIED',payload);return{amount,shield:target.keloShield,duration:Number(effect.duration)||0};}
  function statusHandler(effect,ctx){if(!root.KeloStatusEffects||typeof root.KeloStatusEffects.apply!=='function')return{ok:false,reason:'STATUS_ENGINE_UNAVAILABLE'};const normalized=effect.type==='status'?effect:Object.assign({},effect,{status:effect.type});return root.KeloStatusEffects.apply(ctx.target,normalized,ctx);}
  register('damage',damageHandler);register('heal',healHandler);register('shield',shieldHandler);register('status',statusHandler);
  ['burn','slow','poison','bleed','stun','knockback','stagger','root','silence','invulnerable','movement_buff','damage_buff','damage_debuff','buff','debuff'].forEach(type=>register(type,statusHandler));
  register('lifesteal',function(effect,ctx){const dealt=damageHandler(Object.assign({},effect,{type:'damage'}),ctx);if(dealt.ok&&dealt.amount>0&&ctx.source)healHandler({amount:dealt.amount*Math.max(0,Number(effect.ratio)||1)},Object.assign({},ctx,{target:ctx.source}));return dealt;});
  root.KELO_EFFECT_ENGINE_AUDIT={version:VERSION,ready:true,registeredHandlers:()=>handlers.size,abilitySpecificLogic:false,presentationFree:true,damageOwner:'KeloDamageResolver',statusOwner:'KeloStatusEffects'};
  root.KeloEffectEngine=Object.freeze({version:VERSION,register,apply,applyAll,has:type=>handlers.has(String(type||'')),metrics:()=>Object.freeze({handlers:handlers.size,applied})});
})(typeof globalThis!=='undefined'?globalThis:window);
