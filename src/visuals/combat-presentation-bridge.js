/* KELO-INDEX
 * area: VISUAL
 * keys: COMBAT BRIDGE EVENTS MELEE PRESENTATION SEMANTIC FAMILY
 * hace: traduce eventos de gameplay a eventos del pipeline visual; es la única frontera combat -> presentation
 * gameplay: nunca decide hit, daño, rango o cooldown
 * invariant: basic/special siguen siendo variantes de gameplay; un profile registrado en KeloMeleeProfiles pertenece a la familia visual melee
 */
(function(root){
  'use strict';
  const VERSION='combat-presentation-bridge-v1.1.0-melee-family';
  let bound=false,stops=[];
  const audit=root.KELO_COMBAT_PRESENTATION_BRIDGE_AUDIT={version:VERSION,ready:false,bound:false,attackEvents:0,hitEvents:0,meleeProfileEvents:0,gameplayMutation:false};

  function visualEmit(name,payload){if(root.KeloVisualEventBus&&typeof root.KeloVisualEventBus.emit==='function')root.KeloVisualEventBus.emit(name,payload);}
  function isMeleePayload(payload){
    if(!payload)return false;
    if(payload.kind==='melee')return true;
    const profileId=payload.profileId==null?'':String(payload.profileId);
    const profiles=root.KeloMeleeProfiles;
    const registered=!!(profileId&&profiles&&typeof profiles.get==='function'&&profiles.get(profileId));
    if(registered)audit.meleeProfileEvents+=1;
    return registered;
  }
  function bind(){
    if(bound)return true;
    const bus=root.KeloEvents,schema=root.KeloCombatSchema;
    if(!bus||!schema||!root.KeloVisualEventBus)return false;
    const events=schema.events;
    stops.push(bus.on(events.ATTACK_STARTED,function(payload){if(!isMeleePayload(payload))return;audit.attackEvents+=1;visualEmit('MELEE_ATTACK_STARTED',payload);}));
    stops.push(bus.on(events.HIT_CONFIRMED,function(payload){if(!isMeleePayload(payload))return;audit.hitEvents+=1;visualEmit('MELEE_HIT_CONFIRMED',payload);}));
    bound=true;audit.ready=true;audit.bound=true;return true;
  }
  function unbind(){stops.forEach(function(stop){try{stop();}catch(e){}});stops=[];bound=false;audit.bound=false;}
  if(!bind()){
    let attempts=0;const timer=setInterval(function(){attempts+=1;if(bind()||attempts>=80)clearInterval(timer);},50);
  }
  root.KeloCombatPresentationBridge=Object.freeze({version:VERSION,bind:bind,unbind:unbind,isMeleePayload:isMeleePayload,get bound(){return bound;}});
})(typeof globalThis!=='undefined'?globalThis:window);
