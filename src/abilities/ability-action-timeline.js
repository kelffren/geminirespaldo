/* KELO-INDEX
 * area: ABILITY / ACTION TIMELINE
 * owner: KeloAbilityActionTimeline pure primitive
 * keys: ABILITY CAST WINDUP ACTIVE RECOVERY MOVEMENT SCALE FIXED STEP PREDICTION SERVER PARITY
 * purpose: normaliza y avanza la timeline temporal de una ability sin gameplay, DOM, timers ni autoridad
 * public-api: normalize/create/movementScaleFor/advance
 * online: cliente y server pueden consumir exactamente la misma semántica de fase
 * do-not: NO damage, NO VFX, NO input, NO networking, NO movement owner
 */
(function(root,factory){
  const api=factory();
  if(root)root.KeloAbilityActionTimeline=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const PHASES=Object.freeze(['windup','active','recovery']);
function normalize(value){
  const a=value&&value.action?value.action:(value||{}),m=a.movementScale;
  let scale=1;
  if(Number.isFinite(Number(m)))scale=clamp(Number(m),0,1);
  else if(m&&typeof m==='object')scale=Object.freeze({windup:clamp(Number.isFinite(Number(m.windup))?Number(m.windup):1,0,1),active:clamp(Number.isFinite(Number(m.active))?Number(m.active):1,0,1),recovery:clamp(Number.isFinite(Number(m.recovery))?Number(m.recovery):1,0,1)});
  return Object.freeze({windup:Math.max(0,Number(a.windup)||0),active:Math.max(0,Number(a.active)||0),recovery:Math.max(0,Number(a.recovery)||0),movementScale:scale});
}
function create(value){return{action:normalize(value),phase:'windup',time:0,done:false};}
function movementScaleFor(state){if(!state||state.done)return 1;const m=state.action&&state.action.movementScale;return Number.isFinite(Number(m))?Number(m):m&&Number.isFinite(Number(m[state.phase]))?Number(m[state.phase]):1;}
function advance(state,dt){
  if(!state||state.done)return state;
  state.time+=Math.max(0,Number(dt)||0);
  const duration=Number(state.action&&state.action[state.phase])||0;
  if(state.time<duration)return state;
  if(state.phase==='windup'){state.phase='active';state.time=0;}
  else if(state.phase==='active'){state.phase='recovery';state.time=0;}
  else{state.done=true;state.time=0;}
  return state;
}
return Object.freeze({version:'ability-action-timeline-v1',phases:PHASES,normalize,create,movementScaleFor,advance});
});
