/* KELO-INDEX
 * area: MELEE
 * owner: KeloMeleeEngine
 * keys: ENGINE PROFILE COMBAT ADAPTER REUSABLE DIRECTION SWEEP RESOURCE CHARGES COMBO MOVEMENT
 * purpose: selecciona perfiles melee, resuelve combo/resource helpers y delega hit/damage a KeloCombatEngine
 * public-api: beginAttack/attack/attackSweep/getProfile + createResource/tickResource/consumeResource/comboProfile/movementScaleFor/chargeValue
 * online: helpers puros se reutilizan en cliente prediction y server authority; servidor posee resource competitivo final
 * do-not: NO dibujar, NO DOM, NO mutar HP directamente
 */
(function(root){
  'use strict';
  const VERSION='melee-engine-v3.0.0-pvp-bible';
  function profileOf(id){return root.KeloMeleeProfiles&&root.KeloMeleeProfiles.get(String(id||'sword_light_basic'));}
  function base(o,profile){return{attacker:o.attacker,profile,profileId:profile.id,kind:'melee',weaponClass:profile.weaponClass,attackProfile:profile.attackProfile,direction:o.direction,cooldownRemaining:o.cooldownRemaining,attackId:o.attackId,startedAt:o.startedAt,source:o.source||'melee-engine',visual:o.visual,skipStart:o.skipStart};}
  function beginAttack(options){const o=options||{},combat=root.KeloCombatEngine,profile=profileOf(o.profileId);if(!profile||!combat||typeof combat.beginAttack!=='function')return Object.freeze({ok:false,reason:'MELEE_FOUNDATION_UNAVAILABLE'});return combat.beginAttack(base(o,profile));}
  function attack(options){const o=options||{},combat=root.KeloCombatEngine,profile=profileOf(o.profileId);if(!profile||!combat)return Object.freeze({ok:false,reason:'MELEE_FOUNDATION_UNAVAILABLE'});return combat.attack(Object.assign(base(o,profile),{target:o.target}));}
  function attackSweep(options){const o=options||{},combat=root.KeloCombatEngine,profile=profileOf(o.profileId);if(!profile||!combat||typeof combat.attackSweep!=='function')return Object.freeze({ok:false,reason:'MELEE_SWEEP_UNAVAILABLE',hits:[]});return combat.attackSweep(Object.assign(base(o,profile),{targets:Array.isArray(o.targets)?o.targets:[]}));}

  function movementScaleFor(profileOrId,phase){
    const p=typeof profileOrId==='string'?profileOf(profileOrId):profileOrId;if(!p)return 1;const raw=p.movementScale;
    if(Number.isFinite(Number(raw)))return Math.max(0,Math.min(1,Number(raw)));
    if(raw&&typeof raw==='object'&&Number.isFinite(Number(raw[phase])))return Math.max(0,Math.min(1,Number(raw[phase])));
    return 1;
  }
  function createResource(profileOrId,current){
    const p=typeof profileOrId==='string'?profileOf(profileOrId):profileOrId,max=Math.max(1,Math.floor(Number(p&&p.charges)||1));
    const value=current==null?max:Math.max(0,Math.min(max,Math.floor(Number(current)||0)));
    return{profileId:p&&p.id||null,current:value,max,rechargeElapsed:0};
  }
  function syncResource(resource,profileOrId){
    const p=typeof profileOrId==='string'?profileOf(profileOrId):profileOrId;if(!p)return resource||null;
    const max=Math.max(1,Math.floor(Number(p.charges)||1));
    if(!resource||resource.profileId!==p.id)return createResource(p,Math.min(max,resource&&resource.current==null?max:resource&&resource.current));
    resource.max=max;resource.current=Math.max(0,Math.min(max,Math.floor(Number(resource.current)||0)));resource.rechargeElapsed=Math.max(0,Number(resource.rechargeElapsed)||0);return resource;
  }
  function tickResource(resource,profileOrId,dt){
    const p=typeof profileOrId==='string'?profileOf(profileOrId):profileOrId,r=syncResource(resource,p);if(!r||!p)return r;
    const recharge=Math.max(0,Number(p.rechargeTime)||0);if(r.current>=r.max){r.current=r.max;r.rechargeElapsed=0;return r;}if(recharge<=0){r.current=r.max;r.rechargeElapsed=0;return r;}
    r.rechargeElapsed+=Math.max(0,Number(dt)||0);
    while(r.current<r.max&&r.rechargeElapsed+1e-9>=recharge){r.rechargeElapsed-=recharge;r.current++;}
    if(r.current>=r.max)r.rechargeElapsed=0;return r;
  }
  function consumeResource(resource,profileOrId,amount){
    const r=syncResource(resource,profileOrId),cost=Math.max(1,Math.floor(Number(amount)||1));
    if(!r||r.current<cost)return Object.freeze({ok:false,reason:'NO_CHARGES',current:r?r.current:0,max:r?r.max:0,resource:r});
    r.current-=cost;return Object.freeze({ok:true,current:r.current,max:r.max,resource:r});
  }
  function comboProfile(rootProfileOrId,step){
    const rootProfile=typeof rootProfileOrId==='string'?profileOf(rootProfileOrId):rootProfileOrId;if(!rootProfile)return null;
    const chain=Array.isArray(rootProfile.combo)&&rootProfile.combo.length?rootProfile.combo:[rootProfile.id],index=Math.max(0,Math.floor(Number(step)||0))%chain.length;
    return profileOf(chain[index])||rootProfile;
  }
  function nextComboStep(rootProfileOrId,step){const p=typeof rootProfileOrId==='string'?profileOf(rootProfileOrId):rootProfileOrId,chain=p&&Array.isArray(p.combo)&&p.combo.length?p.combo:[p&&p.id];if(!p||!chain.length)return 0;return(Math.max(0,Math.floor(Number(step)||0))+1)%chain.length;}
  function chargeValue(profileOrId,heldSeconds){
    const p=typeof profileOrId==='string'?profileOf(profileOrId):profileOrId,c=p&&p.input&&p.input.charge;if(!c)return Object.freeze({charge01:0,chargeLevel:0,ready:true});
    const held=Math.max(0,Number(heldSeconds)||0),min=Math.max(0,Number(c.minTime)||0),max=Math.max(min,Number(c.maxTime)||min||1),charge01=Math.max(0,Math.min(1,(held-min)/Math.max(.001,max-min)));
    let level=0;if(held>=Number(c.level2Time||Infinity))level=2;else if(held>=Number(c.level1Time||Infinity))level=1;
    return Object.freeze({charge01,chargeLevel:level,ready:held>=min,heldSeconds:held});
  }

  root.KELO_MELEE_ENGINE_AUDIT={version:VERSION,ready:true,usesCombatEngine:true,directHpMutation:false,presentationFree:true,directional:true,sweep:true,charges:true,comboHelpers:true,phaseMovement:true,chargeLifecycle:true};
  root.KeloMeleeEngine=Object.freeze({version:VERSION,beginAttack,attack,attackSweep,getProfile:profileOf,movementScaleFor,createResource,syncResource,tickResource,consumeResource,comboProfile,nextComboStep,chargeValue});
})(typeof globalThis!=='undefined'?globalThis:window);
