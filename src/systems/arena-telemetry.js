/* KELO-INDEX
 * area: PVP / ARENA TELEMETRY
 * owner: KeloArenaTelemetry
 * keys: ARENA TELEMETRY ACCURACY DAMAGE OBJECTIVE DODGE INTERRUPT OVEREXTENSION COACH
 * purpose: medir comportamiento competitivo observable durante Arena sin decidir combate, rating ni progresión
 * public-api: snapshot/current/last/reset
 * consumes: KeloArena + KeloSimulation + KeloCombatSchema + KeloEvents + KeloArenaLanePressure
 * state-owned: métricas efímeras del match y último resumen cerrado
 * online: telemetría cliente es informativa; stats competitivas oficiales deben derivarse/validarse server-side
 * do-not: NO modificar HP/MMR/Mastery, NO envolver CombatEngine, NO segundo loop, NO inferir métricas sin evidencia
 */
(function(root){
'use strict';
if(root.KeloArenaTelemetry||!root.KeloArena||!root.KeloEvents||!root.KeloSimulation)return;
const VERSION='kelo-arena-telemetry-v1.0.1-lazy-schema';
const WORLD=Object.freeze({x:2660,y:360,w:720,h:720,cx:3020,cy:720});
let matchId=null,mode=null,lastSummary=null,stats=fresh(),eventsBound=false;
function fresh(){return{attacks:0,attacksHit:0,damageHeroes:0,damageStructures:0,damageMinions:0,damageTaken:0,damageAvoided:0,kills:0,deaths:0,dodges:0,effectiveDodges:0,interrupts:0,objectiveSeconds:0,pressureSeconds:0,overextensions:0,ccApplied:0};}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function arena(){try{return root.KeloArena.snapshot();}catch(_){return null;}}
function local(){return typeof localPlayer!=='undefined'?localPlayer:null;}
function isLocalActor(a,id){const p=local();if(!p)return false;if(a&&a===p)return true;const pid=String(p.id||p.playerKey||'local');return id!=null&&String(id)===pid;}
function targetKind(t){if(!t)return'unknown';if(t.isArenaStructure)return'structure';if(t.isArenaMinion)return'minion';if(t.isArenaBot||t._arenaTeam)return'hero';return'unknown';}
function reset(){matchId=null;mode=null;stats=fresh();}
function begin(s){reset();matchId=s.match.id;mode=s.match.mode;}
function accuracy(){return stats.attacks?clamp(stats.attacksHit/stats.attacks,0,1):0;}
function buildSummary(){return Object.freeze(Object.assign({},stats,{matchId,mode,accuracy:accuracy(),objectiveSeconds:+stats.objectiveSeconds.toFixed(1),pressureSeconds:+stats.pressureSeconds.toFixed(1)}));}
function close(){if(matchId)lastSummary=buildSummary();}
function onResolved(p){if(!matchId||!p||!isLocalActor(p.actor,p.actorId))return;stats.attacks++;if(p.confirmedHit===true||Number(p.hitCount)>0)stats.attacksHit++;}
function onDamage(p){if(!matchId||!p)return;const amount=Math.max(0,Number(p.amount)||0);if(isLocalActor(p.actor,p.actorId)){const k=targetKind(p.targetActor);if(k==='structure')stats.damageStructures+=amount;else if(k==='minion')stats.damageMinions+=amount;else if(k==='hero')stats.damageHeroes+=amount;}if(isLocalActor(p.targetActor,p.targetActorId))stats.damageTaken+=amount;}
function onBlocked(p){if(!matchId||!p||!isLocalActor(p.targetActor,p.targetActorId))return;const avoided=Math.max(0,Number(p.amount)||Number(p.damage&&p.damage.requested)||Number(p.gameplay&&p.gameplay.damage)||0);stats.damageAvoided+=avoided;const reason=String(p.blockReason||p.reason||'').toLowerCase();if(reason.includes('invul')||reason.includes('dodge')||reason.includes('iframe'))stats.effectiveDodges++;}
function onDodge(p){if(matchId&&p&&isLocalActor(p.actor,p.actorId))stats.dodges++;}
function onCc(p){if(!matchId||!p||!isLocalActor(p.actor||p.source,p.actorId||p.sourceId))return;stats.ccApplied++;const type=String(p.type||p.ccType||p.effectType||p.effect&&p.effect.type||'').toLowerCase();if(type==='stun'||type==='silence'||type==='stagger'||type==='root')stats.interrupts++;}
function onKill(p){if(!matchId||!p)return;if(isLocalActor(p.actor,p.actorId))stats.kills++;if(isLocalActor(p.targetActor,p.targetActorId)){stats.deaths++;const s=arena(),pl=local();if(s&&s.match&&pl&&s.match.mode==='moba'&&pl.x>WORLD.cx+110){let alliedMinion=false;try{const lane=root.KeloArenaLanePressure&&root.KeloArenaLanePressure.snapshot&&root.KeloArenaLanePressure.snapshot();alliedMinion=!!(lane&&lane.units&&lane.units.some(u=>u.team==='alpha'&&u.x>WORLD.cx&&Math.abs(u.x-pl.x)<150));}catch(_){}if(!alliedMinion)stats.overextensions++;}}}
function bindEvents(){if(eventsBound)return true;const E=root.KeloCombatSchema&&root.KeloCombatSchema.events;if(!E)return false;root.KeloEvents.on(E.ATTACK_RESOLVED,onResolved);root.KeloEvents.on(E.DAMAGE_APPLIED,onDamage);root.KeloEvents.on(E.DAMAGE_BLOCKED,onBlocked);root.KeloEvents.on(E.DODGE_STARTED,onDodge);root.KeloEvents.on(E.CC_APPLIED,onCc);root.KeloEvents.on(E.ENTITY_KILLED,onKill);eventsBound=true;return true;}
function sample(dt,s){const p=local();if(!p||!s||!s.match)return;if(s.match.mode==='control'){const r=Number(s.ruleSet&&s.ruleSet.captureRadius)||118;if(Math.hypot(p.x-WORLD.cx,p.y-WORLD.cy)<=r)stats.objectiveSeconds+=dt;}else if(s.match.mode==='moba'){const tower=s.match.structures&&s.match.structures.find(x=>x.id==='arena_tower_beta'),core=s.match.structures&&s.match.structures.find(x=>x.id==='arena_core_beta'),target=tower&&tower.hp>0?tower:core;if(target&&Math.hypot(p.x-(target.x||0),p.y-(target.y||0))<=190)stats.pressureSeconds+=dt;}}
function tick(ctx){bindEvents();const s=arena();if(!s||s.status!=='active'||!s.match)return;if(matchId!==s.match.id)begin(s);sample(clamp(Number(ctx&&ctx.dt)||0,0,.05),s);}
root.addEventListener('kelo:arena-match-started',e=>{bindEvents();const s=e&&e.detail||arena();if(s&&s.match)begin(s);});root.addEventListener('kelo:arena-match-finished',()=>close());root.addEventListener('kelo:arena-aborted',()=>reset());
root.KeloSimulation.after('arena:telemetry',tick,74);
function current(){return Object.freeze(Object.assign({},stats,{matchId,mode,accuracy:accuracy(),objectiveSeconds:+stats.objectiveSeconds.toFixed(1),pressureSeconds:+stats.pressureSeconds.toFixed(1)}));}
function snapshot(){return Object.freeze({version:VERSION,bound:eventsBound,current:current(),last:lastSummary});}
root.KeloArenaTelemetry=Object.freeze({version:VERSION,snapshot,current,last:()=>lastSummary,reset});root.KELO_ARENA_TELEMETRY_AUDIT=Object.freeze({version:VERSION,owner:'KeloArenaTelemetry',semanticEvents:true,lazySchemaBinding:true,combatWrapper:false,secondLoop:false,ratingAuthority:false,masteryAuthority:false,serverValidationPending:true});
})(typeof globalThis!=='undefined'?globalThis:window);