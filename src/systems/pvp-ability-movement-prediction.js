/* KELO-INDEX
 * area: PVP / ABILITY MOVEMENT
 * owner: KeloPvPWorld support over KeloAbilities + KeloMovement
 * keys: PVP ABILITY CAST MOVEMENT PREDICTION WINDUP ACTIVE RECOVERY SERVER PARITY
 * purpose: predice localmente el movementScale temporal de abilities usando la primitive compartida sin crear otro movement owner ni loader
 * consumes: KeloAbilityActionTimeline, KeloAbilities.bus, KeloPvPWorld.state, KeloMeleeEngine, KeloMovement, KeloSimulation
 * online: replica la composición server min(meleeScale,castScale) antes de status; server conserva autoridad
 * do-not: NO damage, NO delivery, NO cooldown, NO VFX, NO second movement loop, NO script loader
 */
(function(root){
'use strict';
const timeline=root.KeloAbilityActionTimeline;
if(!timeline||!root.KeloMovement||!root.KeloSimulation)return;
let cast=null,lastAbilityKey=null,bound=false,unsubscribe=null;
const audit=root.KELO_PVP_CAST_MOVEMENT_AUDIT={version:'pvp-cast-movement-prediction-v1.1',ready:false,bound:false,abilityKey:null,active:false,phase:null,movementScale:1,meleeScale:1};
function pvpActive(){try{return !!(root.KeloPvPWorld&&root.KeloPvPWorld.state&&root.KeloPvPWorld.state.mode!=='social');}catch(_){return false;}}
function definitionOf(key){const defs=root.ABILITIES||[];return defs.find(d=>d&&d.key===key)||null;}
function meleeScale(){
  const a=root.KeloPvPWorld&&root.KeloPvPWorld.state&&root.KeloPvPWorld.state.basicAttack;
  if(!a||!root.KeloMeleeEngine)return 1;
  const p=root.KeloMeleeEngine.getProfile(a.profileId);
  return p?root.KeloMeleeEngine.movementScaleFor(p,a.phase):1;
}
function onCast(payload){
  if(!pvpActive()||!payload||!payload.abilityKey)return;
  const def=definitionOf(payload.abilityKey);if(!def)return;
  cast=timeline.create(def);lastAbilityKey=def.key;
}
function movementHook(ctx){
  if(!cast||cast.done||!pvpActive()||!ctx||!ctx.input)return;
  const c=timeline.movementScaleFor(cast),m=meleeScale(),base=Math.max(0.000001,m),target=Math.min(m,c),factor=target/base;
  ctx.input.normX=(Number(ctx.input.normX)||0)*factor;
  ctx.input.normY=(Number(ctx.input.normY)||0)*factor;
}
function tick(ctx){
  if(!pvpActive())cast=null;
  else if(cast&&!cast.done)timeline.advance(cast,Math.max(0,Number(ctx&&ctx.dt)||0));
  if(cast&&cast.done)cast=null;
  audit.abilityKey=lastAbilityKey;audit.active=!!cast;audit.phase=cast&&cast.phase||null;audit.movementScale=cast?timeline.movementScaleFor(cast):1;audit.meleeScale=meleeScale();
}
function bind(){
  if(bound)return true;
  if(!root.KeloAbilities||!root.KeloAbilities.bus)return false;
  unsubscribe=root.KeloAbilities.bus.on('ABILITY_CAST',onCast);
  root.KeloMovement.before('pvp-world:ability-cast-scale',movementHook,69);
  root.KeloSimulation.after('pvp-world:ability-cast-timeline',tick,61);
  bound=true;audit.ready=true;audit.bound=true;return true;
}
root.KeloPvPCastMovementPrediction=Object.freeze({version:audit.version,bind,isReady:function(){return bound;},get active(){return !!cast;},get phase(){return cast&&cast.phase||null;}});
root.addEventListener&&root.addEventListener('kelo:runtime-foundations-ready',bind,{once:true});
bind();
})(typeof globalThis!=='undefined'?globalThis:window);
