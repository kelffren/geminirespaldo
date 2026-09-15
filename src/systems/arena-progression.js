/* KELO-INDEX
 * area: PVP / ARENA PROGRESSION
 * owner: KeloArenaProgression
 * keys: ARENA MASTERY RIVALRY BO3 SERIES SKILL OBJECTIVES TELEMETRY HIGHLIGHTS PROGRESSION
 * purpose: progresión competitiva persistente separada de MMR; escucha resultados/telemetría/highlights Arena y proyecta Mastery, objetivos y series
 * public-api: snapshot/getMastery/getRivalry/rematchSeries/resetSeries
 * consumes: KeloArena + KeloArenaTelemetry + KeloArenaHighlights + kelo:arena-match-finished
 * state-owned: mastery XP, objetivos completados, rivalidades y serie BO3 local/fallback
 * online: progreso competitivo final deberá validarse/persistirse en servidor; localStorage es fallback de prototipo
 * do-not: NO modificar HP/MMR/rating/ganador, NO buffs de stats, NO loot aleatorio, NO segundo loop
 */
(function(root){
'use strict';
if(root.KeloArenaProgression||!root.KeloArena)return;
const VERSION='kelo-arena-progression-v1.2.0-highlights';
const STORAGE='kelo_arena_progression_v1';
const MASTERY_TIERS=Object.freeze([
 Object.freeze({id:'rookie',label:'Iniciado',min:0}),Object.freeze({id:'fighter',label:'Combatiente',min:100}),Object.freeze({id:'duelist',label:'Duelista',min:250}),Object.freeze({id:'tactician',label:'Táctico',min:500}),Object.freeze({id:'master',label:'Maestro',min:900}),Object.freeze({id:'champion',label:'Campeón',min:1500}),Object.freeze({id:'legend',label:'Leyenda de Arena',min:2400})
]);
const OBJECTIVES=Object.freeze([
 Object.freeze({id:'first_win',label:'Primera Victoria',description:'Gana tu primera partida de Arena.'}),
 Object.freeze({id:'control_win',label:'Controlador',description:'Gana una partida 3v3 Control.'}),
 Object.freeze({id:'moba_win',label:'Duelista MOBA',description:'Gana una partida 1v1 MOBA.'}),
 Object.freeze({id:'overtime_win',label:'Sangre Fría',description:'Gana durante OVERTIME.'}),
 Object.freeze({id:'comeback_win',label:'Nunca Rendirse',description:'Gana una partida marcada como REMONTADA.'}),
 Object.freeze({id:'core_breaker',label:'Rompenúcleos',description:'Gana un MOBA destruyendo el núcleo rival.'}),
 Object.freeze({id:'accurate_fighter',label:'Mano Firme',description:'Termina una Arena con 10+ ataques y al menos 60% de precisión.'}),
 Object.freeze({id:'objective_anchor',label:'Ancla del Objetivo',description:'Acumula 30 s dentro del objetivo de Control en una partida.'}),
 Object.freeze({id:'siege_pressure',label:'Presión de Asedio',description:'Inflige 150+ de daño a estructuras en una partida MOBA.'}),
 Object.freeze({id:'clean_duel',label:'Duelo Limpio',description:'Gana un MOBA sin morir por sobreextensión.'}),
 Object.freeze({id:'effective_dodge',label:'Paso Fantasma',description:'Consigue una esquiva efectiva confirmada por bloqueo/invulnerabilidad.'}),
 Object.freeze({id:'interruptor',label:'Interruptor',description:'Interrumpe al menos una acción rival con CC fuerte.'}),
 Object.freeze({id:'first_blood_master',label:'Primer Golpe',description:'Consigue FIRST BLOOD en Arena.'}),
 Object.freeze({id:'shutdown_hunter',label:'Cazarrecompensas',description:'Consigue un SHUTDOWN contra una racha rival.'}),
 Object.freeze({id:'tower_breaker',label:'Rompetorres',description:'Participa en la destrucción de la torre rival en 1v1 MOBA.'}),
 Object.freeze({id:'sigil_thief',label:'Ladrón del Sigilo',description:'Roba un War Sigil después de que el rival acumule progreso.'}),
 Object.freeze({id:'critical_survivor',label:'Último Suspiro',description:'Sobrevive a un ESCAPE CRÍTICO con 10% HP o menos.'}),
 Object.freeze({id:'three_streak',label:'En Racha',description:'Consigue 3 victorias consecutivas.'}),
 Object.freeze({id:'ten_matches',label:'Veterano I',description:'Completa 10 partidas.'}),Object.freeze({id:'twenty_five_matches',label:'Veterano II',description:'Completa 25 partidas.'})
]);
function fresh(){return{xp:0,matches:0,wins:0,objectives:{},rivalries:{},activeSeries:null,lastGain:null};}
function read(){const base=fresh();try{const raw=JSON.parse(localStorage.getItem(STORAGE)||'null');if(raw&&typeof raw==='object'){base.xp=Math.max(0,Number(raw.xp)||0);base.matches=Math.max(0,raw.matches|0);base.wins=Math.max(0,raw.wins|0);base.objectives=raw.objectives&&typeof raw.objectives==='object'?raw.objectives:{};base.rivalries=raw.rivalries&&typeof raw.rivalries==='object'?raw.rivalries:{};base.activeSeries=raw.activeSeries&&typeof raw.activeSeries==='object'?raw.activeSeries:null;base.lastGain=raw.lastGain&&typeof raw.lastGain==='object'?raw.lastGain:null;}}catch(_){}return base;}
const state=read();
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(_){}}
function emit(name,detail){try{root.dispatchEvent(new CustomEvent('kelo:arena-progression-'+name,{detail}));}catch(_){}try{root.KeloEvents&&root.KeloEvents.emit('arena:progression:'+name,detail);}catch(_){}}
function mastery(xp){xp=Number.isFinite(Number(xp))?Math.max(0,Number(xp)):state.xp;let tier=MASTERY_TIERS[0],next=null;for(let i=0;i<MASTERY_TIERS.length;i++){if(xp>=MASTERY_TIERS[i].min)tier=MASTERY_TIERS[i];else{next=MASTERY_TIERS[i];break;}}const span=next?Math.max(1,next.min-tier.min):1,progress=next?Math.max(0,Math.min(1,(xp-tier.min)/span)):1;return Object.freeze({id:tier.id,label:tier.label,xp:Math.round(xp),next:next&&next.label||null,nextAt:next&&next.min||null,progress});}
function opponentFrom(snapshot){if(!snapshot||!snapshot.match||!Array.isArray(snapshot.match.roster))return null;const row=snapshot.match.roster.find(r=>r&&r.team==='beta'&&(r.type==='human'||r.type==='bot'))||snapshot.match.roster.find(r=>r&&r.team==='beta');if(!row)return null;return{id:String(row.id||row.name||'unknown'),name:String(row.name||'Rival'),type:String(row.type||'unknown'),isBot:row.type==='bot'||/\[Bot\]/i.test(String(row.name||''))};}
function rivalryKey(opponent,mode){return String(mode||'arena')+'::'+String(opponent&&opponent.id||'unknown');}
function ensureRivalry(opponent,mode){const key=rivalryKey(opponent,mode);if(!state.rivalries[key])state.rivalries[key]={key,opponentId:opponent.id,opponentName:opponent.name,isBot:!!opponent.isBot,mode:String(mode||'arena'),wins:0,losses:0,matches:0,lastPlayedAt:0};return state.rivalries[key];}
function ensureSeries(opponent,mode){const key=rivalryKey(opponent,mode);if(!state.activeSeries||state.activeSeries.key!==key||state.activeSeries.complete)state.activeSeries={key,opponentId:opponent.id,opponentName:opponent.name,isBot:!!opponent.isBot,mode:String(mode||'arena'),playerWins:0,opponentWins:0,games:0,complete:false,winner:null};return state.activeSeries;}
function unlock(id,unlocked){if(state.objectives[id])return false;state.objectives[id]={id,unlockedAt:Date.now()};unlocked.push(id);return true;}
function telemetry(){try{return root.KeloArenaTelemetry&&root.KeloArenaTelemetry.last?root.KeloArenaTelemetry.last():null;}catch(_){return null;}}
function highlights(){try{return root.KeloArenaHighlights&&root.KeloArenaHighlights.last?root.KeloArenaHighlights.last():[];}catch(_){return[];}}
function hasLocalMoment(list,type){return Array.isArray(list)&&list.some(m=>m&&m.type===type&&m.local===true);}
function evaluateObjectives(result,t,h,unlocked){if(result.won)unlock('first_win',unlocked);if(result.won&&result.mode==='control')unlock('control_win',unlocked);if(result.won&&result.mode==='moba')unlock('moba_win',unlocked);if(result.won&&Array.isArray(result.accolades)&&result.accolades.includes('OVERTIME'))unlock('overtime_win',unlocked);if(result.won&&Array.isArray(result.accolades)&&result.accolades.includes('REMONTADA'))unlock('comeback_win',unlocked);if(result.won&&result.mode==='moba'&&result.reason==='core-destroyed')unlock('core_breaker',unlocked);if(t){if(t.attacks>=10&&t.accuracy>=.6)unlock('accurate_fighter',unlocked);if(t.objectiveSeconds>=30)unlock('objective_anchor',unlocked);if(t.damageStructures>=150)unlock('siege_pressure',unlocked);if(result.won&&result.mode==='moba'&&t.overextensions===0)unlock('clean_duel',unlocked);if(t.effectiveDodges>=1)unlock('effective_dodge',unlocked);if(t.interrupts>=1)unlock('interruptor',unlocked);}if(hasLocalMoment(h,'first_blood'))unlock('first_blood_master',unlocked);if(hasLocalMoment(h,'shutdown'))unlock('shutdown_hunter',unlocked);if(hasLocalMoment(h,'tower_break'))unlock('tower_breaker',unlocked);if(hasLocalMoment(h,'war_sigil_steal'))unlock('sigil_thief',unlocked);if(hasLocalMoment(h,'critical_escape'))unlock('critical_survivor',unlocked);const a=root.KeloArena&&root.KeloArena.snapshot?root.KeloArena.snapshot():null;const streak=a&&a.profile&&a.profile.bests?Number(a.profile.bests.currentStreak)||0:0;if(streak>=3)unlock('three_streak',unlocked);if(state.matches>=10)unlock('ten_matches',unlocked);if(state.matches>=25)unlock('twenty_five_matches',unlocked);}
function xpFor(result,t,h){const quality=Math.max(0,Math.min(1,Number(result.quality)||0));let raw=18;if(result.won)raw+=14;if(result.reason==='core-destroyed'||result.reason==='control-score')raw+=6;raw+=Math.min(18,(result.accolades&&result.accolades.length||0)*6);if(t){if(t.attacks>=10&&t.accuracy>=.6)raw+=4;if(t.objectiveSeconds>=25||t.damageStructures>=120)raw+=4;if(t.effectiveDodges||t.interrupts)raw+=Math.min(6,(t.effectiveDodges+t.interrupts)*2);}const localHighlights=Array.isArray(h)?h.filter(m=>m&&m.local===true).length:0;raw+=Math.min(6,localHighlights*2);const factor=.35+.65*quality;return Math.max(4,Math.round(raw*factor));}
function process(snapshot){const result=snapshot&&snapshot.lastResult;if(!result||result.aborted)return;const opponent=opponentFrom(snapshot);if(!opponent)return;const t=telemetry(),h=highlights();state.matches++;if(result.won)state.wins++;const gain=xpFor(result,t,h),before=mastery();state.xp+=gain;const after=mastery(),rivalry=ensureRivalry(opponent,result.mode);rivalry.matches++;rivalry.lastPlayedAt=Date.now();if(result.won)rivalry.wins++;else rivalry.losses++;const series=ensureSeries(opponent,result.mode);series.games++;if(result.won)series.playerWins++;else series.opponentWins++;if(series.playerWins>=2||series.opponentWins>=2){series.complete=true;series.winner=series.playerWins>series.opponentWins?'player':'opponent';}const unlocked=[];evaluateObjectives(result,t,h,unlocked);state.lastGain={xp:gain,from:before.label,to:after.label,tierUp:before.id!==after.id,unlocked:Object.freeze(unlocked.slice()),opponentName:opponent.name,isBot:opponent.isBot,series:Object.freeze({...series}),telemetry:t?Object.freeze({...t}):null,highlights:Object.freeze(h.slice())};persist();emit('updated',snapshotProgression());}
function snapshotProgression(){const m=mastery(),series=state.activeSeries?Object.freeze({...state.activeSeries}):null;return Object.freeze({version:VERSION,mastery:m,matches:state.matches,wins:state.wins,objectives:Object.freeze(OBJECTIVES.map(o=>Object.freeze({id:o.id,label:o.label,description:o.description,unlocked:!!state.objectives[o.id]}))),rivalries:Object.freeze(Object.values(state.rivalries).map(r=>Object.freeze({...r}))),activeSeries:series,lastGain:state.lastGain?Object.freeze({...state.lastGain}):null});}
function getRivalry(id,mode){const r=state.rivalries[String(mode||'arena')+'::'+String(id||'')];return r?Object.freeze({...r}):null;}
function resetSeries(){state.activeSeries=null;persist();emit('series-reset',snapshotProgression());return snapshotProgression();}
function rematchSeries(){const s=state.activeSeries;if(!s||s.complete||!root.KeloArena||typeof root.KeloArena.rematch!=='function')return Promise.resolve(root.KeloArena&&root.KeloArena.snapshot?root.KeloArena.snapshot():null);const a=root.KeloArena.snapshot&&root.KeloArena.snapshot();if(!a||a.status!=='idle')return Promise.resolve(a);return root.KeloArena.rematch();}
root.addEventListener('kelo:arena-match-finished',e=>process(e&&e.detail||null));
root.KeloArenaProgression=Object.freeze({version:VERSION,tiers:MASTERY_TIERS,objectives:OBJECTIVES,snapshot:snapshotProgression,getMastery:mastery,getRivalry,rematchSeries,resetSeries});
root.KELO_ARENA_PROGRESSION_AUDIT=Object.freeze({version:VERSION,owner:'KeloArenaProgression',mastery:true,skillObjectives:true,telemetryObjectives:true,highlightObjectives:true,rivalries:true,bo3:true,statBuffs:false,mmrAuthority:false,secondLoop:false,localFallback:true,serverAuthorityPending:true});emit('ready',snapshotProgression());
})(typeof globalThis!=='undefined'?globalThis:window);