/* KELO-INDEX
 * area: PVP / ARENA HIGHLIGHTS
 * owner: KeloArenaHighlights
 * keys: ARENA HIGHLIGHTS FIRST BLOOD DOUBLE KILL SHUTDOWN TOWER CORE SIGIL COMEBACK ESCAPE PLAY OF MATCH TIMELINE
 * purpose: detectar y priorizar momentos competitivos verificables a partir de eventos/snapshots existentes; no decide gameplay
 * public-api: snapshot/current/last/playOfMatch/timeline/reset
 * consumes: KeloArena + KeloSimulation + KeloCombatSchema + KeloEvents + KeloArenaLanePressure
 * state-owned: momentos efímeros del match, kill streaks de presentación y último resumen cerrado
 * online: highlights cliente son presentation/analytics; servidor deberá validar highlights oficiales de Ranked y MVP global
 * do-not: NO modificar HP/MMR/Mastery/score, NO envolver CombatEngine, NO segundo loop, NO inferir kills/objetivos sin evidencia
 */
(function(root){
'use strict';
if(root.KeloArenaHighlights||!root.KeloArena||!root.KeloEvents||!root.KeloSimulation)return;
const VERSION='kelo-arena-highlights-v1.1.0-play-of-match';
const CFG=Object.freeze({multiKillWindow:5,shutdownStreak:3,comebackDeficit:20,criticalHp:.10,escapeSeconds:5,sigilStealProgress:1.5,maxMoments:32});
const WEIGHTS=Object.freeze({first_blood:38,double_kill:58,triple_kill:88,shutdown:78,tower_break:68,core_exposed:82,war_sigil_steal:94,comeback:86,critical_escape:52});
let matchId=null,mode=null,moments=[],lastMoments=[],lastPlay=null,eventsBound=false,firstBlood=false,lastLocalKillAt=-Infinity,localMulti=0,heroStreaks=new Map(),maxDeficit={alpha:0,beta:0},comebackEmitted={alpha:false,beta:false},structureAlive={},critical=null,sigilTrack={team:null,progress:0,contestedTeam:null,contestedProgress:0};
const nowSec=()=>{const s=arena();return s&&s.match?Number(s.match.elapsed)||0:0;};
function arena(){try{return root.KeloArena.snapshot();}catch(_){return null;}}
function local(){return typeof localPlayer!=='undefined'?localPlayer:null;}
function teamOf(a){return a&&a._arenaTeam||a&&a.team||null;}
function idOf(a,id){return String(id!=null?id:a&&(a.id||a.playerKey)||'');}
function isLocal(a,id){const p=local();if(!p)return false;if(a&&a===p)return true;const pid=String(p.id||p.playerKey||'local');return String(id||'')===pid;}
function isHero(a){return !!(a&&(a.isArenaBot||a._arenaTeam)&&!a.isArenaStructure&&!a.isArenaMinion);}
function label(type){return({first_blood:'FIRST BLOOD',double_kill:'DOUBLE KILL',triple_kill:'TRIPLE KILL',shutdown:'SHUTDOWN',tower_break:'TORRE DESTRUIDA',core_exposed:'NÚCLEO EXPUESTO',war_sigil_steal:'WAR SIGIL STEAL',comeback:'REMONTADA EN CURSO',critical_escape:'ESCAPE CRÍTICO'}[type]||String(type||'HIGHLIGHT').toUpperCase());}
function scoreMoment(m){if(!m)return 0;let score=Number(WEIGHTS[m.type])||20;if(m.type==='shutdown')score+=Math.max(0,(Number(m.endedStreak)||0)-CFG.shutdownStreak)*4;if(m.type==='triple_kill')score+=Math.max(0,(Number(m.count)||3)-3)*8;if(m.type==='comeback')score+=Math.min(20,Math.max(0,(Number(m.deficit)||0)-CFG.comebackDeficit)*.5);if(m.type==='war_sigil_steal')score+=Math.min(12,Math.max(0,Number(m.stolenProgress)||0)*3);return Math.round(score);}
function choosePlay(list){const src=(Array.isArray(list)?list:[]).slice();if(!src.length)return null;src.sort((a,b)=>{const d=scoreMoment(b)-scoreMoment(a);if(d)return d;return (Number(b.at)||0)-(Number(a.at)||0);});const m=src[0];return Object.freeze(Object.assign({},m,{impactScore:scoreMoment(m)}));}
function reset(){matchId=null;mode=null;moments=[];firstBlood=false;lastLocalKillAt=-Infinity;localMulti=0;heroStreaks=new Map();maxDeficit={alpha:0,beta:0};comebackEmitted={alpha:false,beta:false};structureAlive={};critical=null;sigilTrack={team:null,progress:0,contestedTeam:null,contestedProgress:0};}
function begin(s){reset();matchId=s.match.id;mode=s.match.mode;(s.match.structures||[]).forEach(x=>structureAlive[x.id]=Number(x.hp)>0);}
function emitMoment(type,detail){if(!matchId)return null;const m=Object.freeze(Object.assign({id:matchId+'_'+(moments.length+1),type,label:label(type),at:+nowSec().toFixed(2),mode},detail||{}));moments.push(m);if(moments.length>CFG.maxMoments)moments.shift();try{root.dispatchEvent(new CustomEvent('kelo:arena-highlight',{detail:m}));}catch(_){}try{root.KeloEvents.emit('arena:highlight',m);}catch(_){}return m;}
function close(){if(!matchId)return;lastMoments=Object.freeze(moments.slice().sort((a,b)=>(Number(a.at)||0)-(Number(b.at)||0)));lastPlay=choosePlay(lastMoments);try{root.dispatchEvent(new CustomEvent('kelo:arena-play-of-match',{detail:lastPlay}));}catch(_){}try{root.KeloEvents.emit('arena:play-of-match',lastPlay);}catch(_){} }
function onKill(p){if(!matchId||!p||!isHero(p.targetActor))return;const killerId=idOf(p.actor,p.actorId),victimId=idOf(p.targetActor,p.targetActorId),killerTeam=teamOf(p.actor),victimTeam=teamOf(p.targetActor);if(!firstBlood){firstBlood=true;emitMoment('first_blood',{actorId:killerId,targetId:victimId,team:killerTeam,local:isLocal(p.actor,p.actorId)});}const victimStreak=heroStreaks.get(victimId)||0;if(victimStreak>=CFG.shutdownStreak)emitMoment('shutdown',{actorId:killerId,targetId:victimId,team:killerTeam,endedStreak:victimStreak,local:isLocal(p.actor,p.actorId)});heroStreaks.set(victimId,0);if(killerId)heroStreaks.set(killerId,(heroStreaks.get(killerId)||0)+1);if(isLocal(p.actor,p.actorId)){const t=nowSec();localMulti=t-lastLocalKillAt<=CFG.multiKillWindow?localMulti+1:1;lastLocalKillAt=t;if(localMulti===2)emitMoment('double_kill',{actorId:killerId,team:killerTeam,local:true});else if(localMulti>=3)emitMoment('triple_kill',{actorId:killerId,team:killerTeam,count:localMulti,local:true});}if(isLocal(p.targetActor,p.targetActorId))critical=null;}
function bindEvents(){if(eventsBound)return true;const E=root.KeloCombatSchema&&root.KeloCombatSchema.events;if(!E)return false;if(E.ENTITY_KILLED)root.KeloEvents.on(E.ENTITY_KILLED,onKill);eventsBound=true;return true;}
function sampleStructures(s){if(!s.match||s.match.mode!=='moba')return;(s.match.structures||[]).forEach(x=>{const was=structureAlive[x.id];const alive=Number(x.hp)>0;if(was===true&&!alive&&x.kind==='tower'){emitMoment('tower_break',{structureId:x.id,team:x.team,local:x.team==='beta'});emitMoment('core_exposed',{team:x.team,local:x.team==='beta'});}structureAlive[x.id]=alive;});}
function sampleComeback(s){if(!s.match||s.match.mode!=='control')return;const a=Number(s.match.score&&s.match.score.alpha)||0,b=Number(s.match.score&&s.match.score.beta)||0;maxDeficit.alpha=Math.max(maxDeficit.alpha,b-a);maxDeficit.beta=Math.max(maxDeficit.beta,a-b);if(!comebackEmitted.alpha&&maxDeficit.alpha>=CFG.comebackDeficit&&a>b){comebackEmitted.alpha=true;emitMoment('comeback',{team:'alpha',deficit:+maxDeficit.alpha.toFixed(1),local:true});}if(!comebackEmitted.beta&&maxDeficit.beta>=CFG.comebackDeficit&&b>a){comebackEmitted.beta=true;emitMoment('comeback',{team:'beta',deficit:+maxDeficit.beta.toFixed(1),local:false});}}
function sampleCritical(){const p=local();if(!p||Number(p.maxHp)<=0)return;const ratio=Number(p.hp)/Number(p.maxHp),t=nowSec();if(ratio>0&&ratio<=CFG.criticalHp&&!critical)critical={since:t,startHp:Number(p.hp)||0};if(critical){if(Number(p.hp)<=0){critical=null;return;}if(t-critical.since>=CFG.escapeSeconds){emitMoment('critical_escape',{team:'alpha',hp:Number(p.hp)||0,maxHp:Number(p.maxHp)||0,local:true});critical=null;}else if(ratio>.35)critical=null;}}
function sampleSigil(){let lane=null;try{lane=root.KeloArenaLanePressure&&root.KeloArenaLanePressure.snapshot&&root.KeloArenaLanePressure.snapshot();}catch(_){}if(!lane||!lane.active||!lane.sigil)return;const sg=lane.sigil;if(sg.active){if(sg.team&&sigilTrack.team&&sg.team!==sigilTrack.team&&sigilTrack.progress>=CFG.sigilStealProgress){sigilTrack.contestedTeam=sigilTrack.team;sigilTrack.contestedProgress=sigilTrack.progress;}sigilTrack.team=sg.team;sigilTrack.progress=Number(sg.progress)||0;}else{sigilTrack.team=null;sigilTrack.progress=0;}}
function onSigilCaptured(e){if(!matchId)return;const d=e&&e.detail||{},team=d.team;if(sigilTrack.contestedTeam&&team&&team!==sigilTrack.contestedTeam){emitMoment('war_sigil_steal',{team,fromTeam:sigilTrack.contestedTeam,stolenProgress:+sigilTrack.contestedProgress.toFixed(1),local:team==='alpha'});}sigilTrack={team:null,progress:0,contestedTeam:null,contestedProgress:0};}
function tick(){bindEvents();const s=arena();if(!s||s.status!=='active'||!s.match)return;if(matchId!==s.match.id)begin(s);sampleStructures(s);sampleComeback(s);sampleCritical();sampleSigil();}
root.addEventListener('kelo:arena-match-started',e=>{bindEvents();const s=e&&e.detail||arena();if(s&&s.match)begin(s);});
root.addEventListener('kelo:arena-match-finished',close);
root.addEventListener('kelo:arena-aborted',reset);
root.addEventListener('kelo:arena-lane-sigil-captured',onSigilCaptured);
root.KeloSimulation.after('arena:highlights',tick,75);
function current(){return Object.freeze(moments.slice().sort((a,b)=>(Number(a.at)||0)-(Number(b.at)||0)));}
function timeline(which){const src=which==='current'?current():lastMoments;return Object.freeze((src||[]).map(m=>Object.freeze(Object.assign({},m,{impactScore:scoreMoment(m)}))));}
function playOfMatch(which){if(which==='current')return choosePlay(current());return lastPlay;}
function snapshot(){return Object.freeze({version:VERSION,bound:eventsBound,matchId,mode,current:current(),last:lastMoments,playOfMatch:lastPlay,timeline:timeline()});}
root.KeloArenaHighlights=Object.freeze({version:VERSION,snapshot,current,last:()=>lastMoments,playOfMatch,timeline,scoreMoment,reset});
root.KELO_ARENA_HIGHLIGHTS_AUDIT=Object.freeze({version:VERSION,owner:'KeloArenaHighlights',semantic:true,firstBlood:true,multiKill:true,shutdown:true,towerCore:true,warSigilSteal:true,comeback:true,criticalEscape:true,playOfMatch:true,timeline:true,globalMvp:false,combatWrapper:false,gameplayAuthority:false,secondLoop:false,serverValidationPending:true});
})(typeof globalThis!=='undefined'?globalThis:window);
