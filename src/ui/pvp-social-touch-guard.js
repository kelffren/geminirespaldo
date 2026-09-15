/* KELO-INDEX
 * area: UI / PVP SUPPORT
 * owner: KeloPvPSocialTouchGuard; core extension owners KeloInputLocks + KeloSimulation
 * keys: PVP SOCIAL TOUCH TRAINING DUMMY INPUT LOCK SIMULATION FOUNDATION KNOCKBACK
 * purpose: bloquea UI social durante PvP y estabiliza el dummy maestro contra wandering legacy sin cancelar desplazamientos válidos producidos por combate moderno
 * public-api: KeloPvPSocialTouchGuard, KeloPvPTrainingDummyGuard
 * consumes: KeloInputLocks, KeloSimulation, KeloPvPWorld, KeloMasterBots
 * state-owned: snapshot/anchor local del dummy de entrenamiento y registro del hook tardío
 * extension-points: KeloSimulation.after; KeloInputLocks.releaseOwner
 * reuse: soporte transitorio del mundo PvP mientras el training target siga siendo actor legacy
 * legacy: checkSocialTouch sigue envuelto localmente; NO envolver updateSimulation ni escribir KELO_MODAL_INPUT_LOCK
 * do-not: no decidir daño, autoridad online ni física general
 */
(function(){
'use strict';
const VERSION='pvp-social-touch-guard-v1.4.0-combat-displacement';
const TRAINING_ARENA=Object.freeze({x:2660,y:360,w:720,h:720,padding:56,spawnX:3190,spawnY:720});
const SOCIAL_LOCK_OWNERS=Object.freeze(['self-actions','emotes','profile-transition']);
const training={anchorX:TRAINING_ARENA.spawnX,anchorY:TRAINING_ARENA.spawnY,lastCombat:false,lastCorrection:0,adoptedCombatMoves:0,snapshot:null,masterApplied:false};
let trainingSimulationHookId=null;

function combatActive(){
  if(window.KELO_COMBAT_ENABLED===true)return true;
  try{const s=window.KeloPvPWorld&&window.KeloPvPWorld.state;return !!(s&&s.mode&&s.mode!=='social');}catch(e){return false;}
}
function combatSimulationActive(){return window.KELO_COMBAT_ENABLED===true;}
function trainingDummy(){return (typeof simulatedPlayers!=='undefined'&&simulatedPlayers&&simulatedPlayers[0])?simulatedPlayers[0]:null;}
function pvpMaster(){return window.KeloMasterBots&&window.KeloMasterBots.getPvPMaster?window.KeloMasterBots.getPvPMaster('pvp_master_hook_01'):null;}
function cloneOwn(o){const out={};if(!o)return out;Object.keys(o).forEach(function(k){const v=o[k];if(typeof v!=='function')out[k]=v;});return out;}
function releaseSocialInputLocks(){
  const locks=window.KeloInputLocks;
  if(!locks||typeof locks.releaseOwner!=='function')return;
  SOCIAL_LOCK_OWNERS.forEach(function(owner){locks.releaseOwner(owner);});
}

function closeSocialUi(){
  try{if(typeof window.closeSocialModal==='function')window.closeSocialModal();}catch(e){}
  try{if(typeof window.closeInspect==='function')window.closeInspect();}catch(e){}
  const selectors=['#social-modal','#inspect-sheet','#kelo-self-actions','#kelo-emotes-panel','.social-modal','.player-inspect','[data-player-inspect]'];
  selectors.forEach(function(sel){document.querySelectorAll(sel).forEach(function(el){el.style.display='none';el.classList.remove('open');});});
  if(combatActive())document.querySelectorAll('.app-panel').forEach(function(el){el.style.display='none';el.classList.remove('open');});
  releaseSocialInputLocks();
}
function install(){
  const original=window.checkSocialTouch;
  if(typeof original!=='function'||original.__keloPvpSocialGuard)return false;
  function guarded(){if(combatActive()){closeSocialUi();return true;}return original.apply(this,arguments);}
  guarded.__keloPvpSocialGuard=true;guarded.__keloOriginal=original;window.checkSocialTouch=guarded;return true;
}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function safeX(x){return clamp(Number(x)||TRAINING_ARENA.spawnX,TRAINING_ARENA.x+TRAINING_ARENA.padding,TRAINING_ARENA.x+TRAINING_ARENA.w-TRAINING_ARENA.padding);}
function safeY(y){return clamp(Number(y)||TRAINING_ARENA.spawnY,TRAINING_ARENA.y+TRAINING_ARENA.padding,TRAINING_ARENA.y+TRAINING_ARENA.h-TRAINING_ARENA.padding);}
function applyPvPMaster(){
  const d=trainingDummy(),m=pvpMaster();if(!d||!m||training.masterApplied)return;
  training.snapshot=cloneOwn(d);
  d.id=m.id;d.name=m.name;d.title=m.title;d.pipelineId=m.pipelineId;d.masterRole='pvp';d.zone=m.zone;d.network=m.network;
  d.hp=m.hp;d.maxHp=m.maxHp;d.radius=m.radius;d.x=m.spawnX;d.y=m.spawnY;d.targetX=m.spawnX;d.targetY=m.spawnY;d.vx=0;d.vy=0;
  training.anchorX=m.spawnX;training.anchorY=m.spawnY;training.masterApplied=true;
}
function restoreSocialBot(){
  const d=trainingDummy();if(!d||!training.masterApplied||!training.snapshot)return;
  const keep=training.snapshot;Object.keys(d).forEach(function(k){if(!(k in keep))delete d[k];});Object.keys(keep).forEach(function(k){d[k]=keep[k];});
  training.snapshot=null;training.masterApplied=false;
}
function syncMasterRole(){
  const active=combatSimulationActive();
  if(active&&!training.masterApplied)applyPvPMaster();
  if(!active&&training.masterApplied)restoreSocialBot();
}
function publishTraining(event){
  const d=trainingDummy();
  window.KELO_PVP_TRAINING_DUMMY_AUDIT=Object.freeze({version:VERSION,event:event||null,combatEnabled:combatSimulationActive(),dummyId:d&&d.id||null,dummyName:d&&d.name||null,masterRole:d&&d.masterRole||null,pipelineId:d&&d.pipelineId||null,x:d&&d.x||null,y:d&&d.y||null,anchorX:training.anchorX,anchorY:training.anchorY,insideArena:!!(d&&d.x>=TRAINING_ARENA.x+TRAINING_ARENA.padding&&d.x<=TRAINING_ARENA.x+TRAINING_ARENA.w-TRAINING_ARENA.padding&&d.y>=TRAINING_ARENA.y+TRAINING_ARENA.padding&&d.y<=TRAINING_ARENA.y+TRAINING_ARENA.h-TRAINING_ARENA.padding),adoptedCombatMoves:training.adoptedCombatMoves,lastCorrection:training.lastCorrection,masterApplied:training.masterApplied,purpose:'dedicated-pvp-master-stationary-against-legacy-drift-preserves-modern-combat-displacement'});
}
function constrainTrainingDummy(){
  const d=trainingDummy();if(!d)return;
  const active=combatSimulationActive();
  if(active&&!training.lastCombat){applyPvPMaster();training.anchorX=safeX(d.x);training.anchorY=safeY(d.y);publishTraining('combat-enter');}
  training.lastCombat=active;if(!active)return;
  const candidateX=safeX(d.x),candidateY=safeY(d.y),displacement=Math.hypot(candidateX-training.anchorX,candidateY-training.anchorY);
  // engine-c neutraliza primero el wandering legacy. Cualquier desplazamiento que sobreviva hasta este hook
  // pertenece a la simulación PvP moderna (knockback/dash/owner futuro) y debe convertirse en el nuevo anchor,
  // incluso si es menor de 40 px. El umbral antiguo cancelaba precisamente el knockback ligero de 15 px.
  if(displacement>.01){training.anchorX=candidateX;training.anchorY=candidateY;training.adoptedCombatMoves++;publishTraining('combat-position-adopted');}
  const drift=Math.hypot((Number(d.x)||0)-training.anchorX,(Number(d.y)||0)-training.anchorY);if(drift>.01)training.lastCorrection=performance.now();
  d.x=training.anchorX;d.y=training.anchorY;d.targetX=training.anchorX;d.targetY=training.anchorY;d.vx=0;d.vy=0;if('_dash' in d)d._dash=null;
  publishTraining(drift>.01?'legacy-wander-blocked':'stable');
}
function trainingSimulationTick(){
  syncMasterRole();
  if(combatActive())closeSocialUi();
  constrainTrainingDummy();
}
function installTrainingGuard(){
  if(trainingSimulationHookId)return true;
  const sim=window.KeloSimulation;
  if(!sim||typeof sim.after!=='function')return false;
  trainingSimulationHookId=sim.after('pvp-social-touch-guard:training-dummy',trainingSimulationTick,1000);
  return !!trainingSimulationHookId;
}
function boot(){
  install();installTrainingGuard();setTimeout(install,0);setTimeout(install,250);setTimeout(installTrainingGuard,0);setTimeout(installTrainingGuard,250);syncMasterRole();publishTraining('boot');
}
window.addEventListener('kelo:pvp-enter',function(){closeSocialUi();setTimeout(function(){syncMasterRole();closeSocialUi();},0);});
window.addEventListener('kelo:pvp-leave',function(){setTimeout(function(){syncMasterRole();},0);});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.KeloPvPSocialTouchGuard=Object.freeze({version:VERSION,install,closeSocialUi,combatActive});
window.KeloPvPTrainingDummyGuard=Object.freeze({version:VERSION,install:installTrainingGuard,getState:function(){return Object.freeze({anchorX:training.anchorX,anchorY:training.anchorY,combatEnabled:combatSimulationActive(),adoptedCombatMoves:training.adoptedCombatMoves,masterApplied:training.masterApplied,simulationHookId:trainingSimulationHookId});}});
window.KELO_PVP_SOCIAL_TOUCH_AUDIT=Object.freeze({version:VERSION,blocksSocialProfilesInCombat:true,closesLegacyInspect:true,closesAllAppPanelsInCombat:true,trainingDummyGuard:true,preservesModernCombatDisplacement:true,dedicatedPvPMaster:true,separateMasterPipelines:true,simulationOwner:'KeloSimulation',directSimulationWrapper:false,inputLockOwner:'KeloInputLocks',directLegacyModalWrite:false});
})();
