/* KELO-INDEX
 * area: EFFECTS / STATUS
 * owner: KeloStatusEffects
 * keys: STATUS CC STUN ROOT SLOW SILENCE STAGGER INVULNERABLE BURN POISON BLEED STACK REFRESH
 * purpose: capability de status reutilizable consumida por KeloEffectEngine; no conoce abilities concretas ni visuals
 * public-api: apply/remove/clear/has/snapshot/tick/movementMultiplier/isActionBlocked/isInvulnerable
 * consumes: KeloCombatSchema, KeloDamageResolver, KeloEvents, KeloSimulation opcional
 * state-owned: instancias temporales de status por actor; NO HP base, NO ability cooldowns, NO VFX
 * online: servidor puede ejecutar el mismo contrato; cliente usa snapshots/eventos semánticos para presentation/prediction
 * reuse: abilities, melee stagger, dodge iFrames, mounts y futuros buffs
 * do-not: NO dibujar, NO DOM, NO target scanning, NO segundo ability engine
 */
(function(root){
  'use strict';
  if(root.KeloStatusEffects)return;
  const VERSION='status-effects-v1.0.0-pvp-bible';
  const byTarget=new WeakMap();
  let seq=1,appliedCount=0,removedCount=0,ticks=0;
  const PERIODIC=new Set(['burn','poison','bleed']);
  const BLOCK_MOVE=new Set(['stun','root']);
  const BLOCK_ATTACK=new Set(['stun','stagger']);
  const BLOCK_ABILITY=new Set(['stun','silence','stagger']);
  function nowId(type){return'status_'+String(type||'effect')+'_'+(seq++).toString(36);}
  function emit(name,payload){try{if(root.KeloEvents&&typeof root.KeloEvents.emit==='function')root.KeloEvents.emit(name,payload);}catch(_){} }
  function list(target,create){let rows=target&&byTarget.get(target);if(!rows&&target&&create){rows=[];byTarget.set(target,rows);}return rows||[];}
  function normalize(effect,ctx){
    const e=effect&&typeof effect==='object'?effect:{},type=String(e.status||e.type||'');
    if(!type||!(root.KeloCombatSchema&&root.KeloCombatSchema.isCcType&&root.KeloCombatSchema.isCcType(type)))return null;
    return{
      id:String(e.id||nowId(type)),type,source:ctx&&ctx.source||null,sourceId:String(e.sourceId||ctx&&ctx.source&&ctx.source.id||''),target:ctx&&ctx.target||null,
      duration:Math.max(0,Number(e.duration)||0),remaining:Math.max(0,Number(e.duration)||0),stacks:Math.max(1,Math.floor(Number(e.stacks)||1)),maxStacks:Math.max(1,Math.floor(Number(e.maxStacks)||1)),
      magnitude:Number(e.magnitude)||0,refreshPolicy:String(e.refreshPolicy||'refresh'),dispellable:e.dispellable!==false,tags:Array.isArray(e.gameplayTags)?e.gameplayTags.map(String):[],visualProfileId:e.visualProfileId==null?null:String(e.visualProfileId),
      tickInterval:Math.max(.05,Number(e.tickInterval)||1),tick:Math.max(.05,Number(e.tickInterval)||1),damageType:String(e.damageType||type)
    };
  }
  function publicStatus(s){return Object.freeze({id:s.id,type:s.type,sourceId:s.sourceId,duration:s.duration,remaining:s.remaining,stacks:s.stacks,magnitude:s.magnitude,refreshPolicy:s.refreshPolicy,dispellable:s.dispellable,tags:Object.freeze(s.tags.slice()),visualProfileId:s.visualProfileId});}
  function apply(target,effect,context){
    if(!target)return Object.freeze({ok:false,reason:'INVALID_TARGET'});const ctx=Object.assign({},context||{},{target}),incoming=normalize(effect,ctx);if(!incoming)return Object.freeze({ok:false,reason:'INVALID_STATUS'});
    const rows=list(target,true),same=rows.find(s=>s.type===incoming.type&&s.sourceId===incoming.sourceId);
    let status=incoming;
    if(same){
      status=same;
      if(incoming.refreshPolicy==='ignore')return Object.freeze({ok:true,ignored:true,status:publicStatus(status)});
      if(incoming.refreshPolicy==='extend')status.remaining+=incoming.duration;
      else if(incoming.refreshPolicy==='stack'){status.stacks=Math.min(status.maxStacks,Math.max(status.stacks+incoming.stacks,1));status.remaining=Math.max(status.remaining,incoming.duration);status.magnitude=Math.max(status.magnitude,incoming.magnitude);}
      else{status.remaining=incoming.duration;status.duration=incoming.duration;status.magnitude=incoming.magnitude;status.stacks=Math.min(status.maxStacks,incoming.stacks);}
      status.tick=Math.min(status.tick,incoming.tickInterval);
    }else rows.push(status);
    appliedCount++;const payload={status:publicStatus(status),target,targetActor:target,targetActorId:String(target.id||''),source:ctx.source||null,sourceActorId:status.sourceId};
    emit(root.KeloCombatSchema.events.CC_APPLIED,payload);emit('STATUS_APPLIED',payload);
    return Object.freeze({ok:true,status:publicStatus(status)});
  }
  function remove(target,idOrType,reason){const rows=list(target,false),key=String(idOrType||'');let removed=0;for(let i=rows.length-1;i>=0;i--){if(rows[i].id!==key&&rows[i].type!==key)continue;const s=rows.splice(i,1)[0];removed++;removedCount++;const payload={status:publicStatus(s),target,targetActor:target,targetActorId:String(target&&target.id||''),reason:reason||'removed'};emit(root.KeloCombatSchema.events.CC_REMOVED,payload);emit('STATUS_REMOVED',payload);}return removed;}
  function clear(target,reason){const rows=list(target,false).slice();rows.forEach(s=>remove(target,s.id,reason||'clear'));return rows.length;}
  function has(target,type){return list(target,false).some(s=>s.type===String(type||'')&&s.remaining>0);}
  function isInvulnerable(target){return has(target,'invulnerable');}
  function movementMultiplier(target){let mul=1;list(target,false).forEach(s=>{if(s.remaining<=0)return;if(s.type==='slow')mul*=Math.max(0,1-Math.max(0,s.magnitude));else if(s.type==='movement_buff')mul*=Math.max(0,1+s.magnitude);else if(BLOCK_MOVE.has(s.type))mul=0;});return Math.max(0,mul);}
  function isActionBlocked(target,action){const rows=list(target,false).filter(s=>s.remaining>0),a=String(action||'');if(a==='move')return rows.some(s=>BLOCK_MOVE.has(s.type));if(a==='ability')return rows.some(s=>BLOCK_ABILITY.has(s.type));if(a==='attack'||a==='special')return rows.some(s=>BLOCK_ATTACK.has(s.type));return false;}
  function periodicDamage(status,target){
    if(!root.KeloDamageResolver||isInvulnerable(target))return null;const amount=Math.max(0,status.magnitude*status.stacks),result=root.KeloDamageResolver.apply(target,amount);
    const payload={source:status.source,target,targetActor:target,targetActorId:String(target.id||''),status:status.type,damageType:status.damageType,amount:result.amount,hp:result.hp,absorbed:result.absorbed,killed:result.killed};
    emit(root.KeloCombatSchema.events.DAMAGE_APPLIED,payload);if(result.killed)emit(root.KeloCombatSchema.events.ENTITY_KILLED,payload);return result;
  }
  function tickTarget(target,dt){const rows=list(target,false);for(let i=rows.length-1;i>=0;i--){const s=rows[i];s.remaining-=dt;if(PERIODIC.has(s.type)){s.tick-=dt;while(s.tick<=0&&s.remaining>0){s.tick+=s.tickInterval;periodicDamage(s,target);}}
      if(s.remaining<=0){rows.splice(i,1);removedCount++;const payload={status:publicStatus(s),target,targetActor:target,targetActorId:String(target.id||''),reason:'expired'};emit(root.KeloCombatSchema.events.CC_REMOVED,payload);emit('STATUS_REMOVED',payload);}}
  }
  const knownTargets=new Set();
  function track(target){if(target)knownTargets.add(target);return target;}
  const rawApply=apply;
  function applyTracked(target,effect,context){track(target);return rawApply(target,effect,context);}
  function tick(dt){dt=Math.max(0,Number(dt)||0);ticks++;Array.from(knownTargets).forEach(target=>{if(!target){knownTargets.delete(target);return;}tickTarget(target,dt);if(!list(target,false).length)knownTargets.delete(target);});}
  function snapshot(target){return Object.freeze(list(target,false).filter(s=>s.remaining>0).map(publicStatus));}
  if(root.KeloSimulation&&typeof root.KeloSimulation.after==='function')root.KeloSimulation.after('status-effects:tick',ctx=>tick(ctx.dt),850);
  root.KELO_STATUS_EFFECTS_AUDIT=Object.freeze({version:VERSION,ready:true,owner:true,semanticEvents:true,periodicDamageUsesKeloDamageResolver:true,simulationHook:!!(root.KeloSimulation&&root.KeloSimulation.after)});
  root.KeloStatusEffects=Object.freeze({version:VERSION,apply:applyTracked,remove,clear,has,snapshot,tick,movementMultiplier,isActionBlocked,isInvulnerable,metrics:()=>Object.freeze({applied:appliedCount,removed:removedCount,ticks,targets:knownTargets.size})});
})(typeof globalThis!=='undefined'?globalThis:window);
