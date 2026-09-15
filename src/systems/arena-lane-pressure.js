/* KELO-INDEX
 * area: PVP / ARENA SUPPORT
 * owner: KeloArenaLanePressure
 * keys: MOBA MINIONS WAVES WAR SIGIL LANE PRESSURE COMBAT ENGINE
 * purpose: añade presión de carril reutilizable al 1v1 MOBA sin crear otro combat engine ni otro loop
 * public-api: KeloArenaLanePressure.snapshot/clear
 * consumes: KeloArena + KeloSimulation + KeloCombatEngine + KeloMeleeEngine
 * state-owned: minions temporales, cadence de oleadas y objetivo War Sigil del ruleset MOBA local
 * online: soporte local/fallback; server deberá ser autoridad de waves/captura al pasar Ranked a producción
 * do-not: NO segundo loop, NO daño directo de minions, NO ocultar bots/minions como humanos
 */
(function(root){
'use strict';
if(root.KeloArenaLanePressure||!root.KeloArena||!root.KeloSimulation)return;
const VERSION='kelo-arena-lane-pressure-v1.0.0';
const BASE_ARENA=root.KeloArena;
const WORLD=Object.freeze({x:2660,y:360,w:720,h:720,cx:3020,cy:720});
const CFG=Object.freeze({waveEvery:20,firstWaveAt:7,minionsPerWave:3,minionHp:34,minionDamage:5,minionRange:54,minionSpeed:68,minionCooldown:.92,thinkEvery:.10,deathLinger:.45,sigilFirstAt:105,sigilRespawn:80,sigilRadius:58,sigilCaptureSeconds:3,empoweredHp:1.55,empoweredDamage:1.45,maxUnits:24});
const state={active:false,matchId:null,elapsed:0,nextWave:CFG.firstWaveAt,waveSeq:0,units:[],sigil:{active:false,nextAt:CFG.sigilFirstAt,progress:0,team:null},empoweredTeam:null,lastEvent:null};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const teamOf=a=>a&&a._arenaTeam||a&&a.team||null;
function arenaSnapshot(){try{return BASE_ARENA.snapshot();}catch(_){return null;}}
function isMobaActive(){const s=arenaSnapshot();return !!(s&&s.status==='active'&&s.match&&s.match.mode==='moba');}
function clear(){state.active=false;state.matchId=null;state.elapsed=0;state.nextWave=CFG.firstWaveAt;state.waveSeq=0;state.units.length=0;state.sigil={active:false,nextAt:CFG.sigilFirstAt,progress:0,team:null};state.empoweredTeam=null;state.lastEvent='clear';}
function emit(name,detail){state.lastEvent=name;try{root.dispatchEvent(new CustomEvent('kelo:arena-lane-'+name,{detail}));}catch(_){}try{root.KeloEvents&&root.KeloEvents.emit('arena:lane:'+name,detail);}catch(_){}}
function syncMatch(){const s=arenaSnapshot();if(!s||s.status!=='active'||!s.match||s.match.mode!=='moba'){if(state.active)clear();return null;}if(!state.active||state.matchId!==s.match.id){clear();state.active=true;state.matchId=s.match.id;state.nextWave=CFG.firstWaveAt;state.sigil.nextAt=CFG.sigilFirstAt;emit('started',{matchId:state.matchId});}return s;}
function laneY(slot){return WORLD.cy+(slot-1)*18;}
function makeMinion(team,slot,empowered){const left=team==='alpha',hp=Math.round(CFG.minionHp*(empowered?CFG.empoweredHp:1));return{id:'arena_minion_'+team+'_'+(++state.waveSeq)+'_'+slot,name:(empowered?'Élite ':'')+'Soldado '+(team==='alpha'?'Azul':'Rojo'),kind:'minion',team,_arenaTeam:team,isArenaMinion:true,empowered:!!empowered,x:left?WORLD.x+118:WORLD.x+WORLD.w-118,y:laneY(slot),vx:0,vy:0,radius:13,hp,maxHp:hp,_ai:{think:0,cooldown:.15,deadFor:0},_face:left?'right':'left'};}
function spawnWave(team,forcedEmpowered){const empowered=forcedEmpowered===true||state.empoweredTeam===team;if(state.empoweredTeam===team)state.empoweredTeam=null;for(let i=0;i<CFG.minionsPerWave;i++)state.units.push(makeMinion(team,i,empowered));while(state.units.length>CFG.maxUnits)state.units.shift();emit('wave',{team,empowered,count:CFG.minionsPerWave});}
function spawnBoth(){spawnWave('alpha',false);spawnWave('beta',false);}
function livingUnits(team){return state.units.filter(u=>u.hp>0&&(!team||u.team===team));}
function heroes(){const s=arenaSnapshot();if(!s||!s.match)return[];return s.match.roster.map(r=>BASE_ARENA.getActorById(r.id)).filter(Boolean);}
function structures(){const s=arenaSnapshot();if(!s||!s.match)return[];return s.match.structures.map(x=>BASE_ARENA.getActorById(x.id)).filter(Boolean);}
function hostileMinions(viewer){const t=teamOf(viewer)||'alpha';return livingUnits().filter(u=>u.team!==t);}
function getUnitById(id){const key=String(id||'');return state.units.find(u=>String(u.id)===key)||null;}
function nearest(from,list){let best=null,bd=Infinity;for(const t of list){if(!t||Number(t.hp)<=0)continue;const d=Math.hypot(t.x-from.x,t.y-from.y);if(d<bd){bd=d;best=t;}}return{target:best,distance:bd};}
function objectiveFor(u){const enemy=u.team==='alpha'?'beta':'alpha',tower=structures().find(s=>teamOf(s)===enemy&&s.kind==='tower'&&s.hp>0),core=structures().find(s=>teamOf(s)===enemy&&s.kind==='core'&&s.hp>0);return tower||core||null;}
function minionProfile(u){const base=root.KeloMeleeEngine&&root.KeloMeleeEngine.getProfile&&root.KeloMeleeEngine.getProfile('sword_light_basic');if(!base)return null;return Object.assign({},base,{id:'arena_minion_strike',damage:CFG.minionDamage*(u.empowered?CFG.empoweredDamage:1),range:CFG.minionRange,arcDegrees:105,knockback:0,stagger:0,windup:.12,active:.04,recovery:.20});}
function attack(u,target){if(!root.KeloCombatEngine||!target)return false;const profile=minionProfile(u);if(!profile)return false;const dx=target.x-u.x,dy=target.y-u.y,l=Math.hypot(dx,dy)||1,dir={x:dx/l,y:dy/l};const result=root.KeloCombatEngine.attackSweep({attacker:u,targets:[target],direction:dir,profile,profileId:profile.id,attackId:'minion_'+u.id+'_'+Math.floor(state.elapsed*1000),startedAt:state.elapsed*1000,source:'arena-minion',skipStart:false});return !!(result&&result.hits&&result.hits.length);}
function move(u,target,dt){const dx=target.x-u.x,dy=target.y-u.y,d=Math.hypot(dx,dy)||1;if(d<=CFG.minionRange*.82)return;u.x+=dx/d*CFG.minionSpeed*dt;u.y+=dy/d*CFG.minionSpeed*dt;u._face=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');u.x=clamp(u.x,WORLD.x+38,WORLD.x+WORLD.w-38);u.y=clamp(u.y,WORLD.cy-58,WORLD.cy+58);}
function updateUnit(u,dt){if(u.hp<=0){u._ai.deadFor+=dt;return;}u._ai.cooldown=Math.max(0,u._ai.cooldown-dt);u._ai.think-=dt;if(u._ai.think>0)return;u._ai.think=CFG.thinkEvery;const enemyMin=nearest(u,livingUnits(u.team==='alpha'?'beta':'alpha'));
 const enemyHeroes=nearest(u,heroes().filter(h=>teamOf(h)!==u.team&&Number(h.hp)>0));let target=null;
 if(enemyMin.target&&enemyMin.distance<105)target=enemyMin.target;else if(enemyHeroes.target&&enemyHeroes.distance<82)target=enemyHeroes.target;else target=objectiveFor(u);
 if(!target)return;const d=Math.hypot(target.x-u.x,target.y-u.y);if(d<=CFG.minionRange&&u._ai.cooldown<=0){attack(u,target);u._ai.cooldown=CFG.minionCooldown;}else move(u,target,CFG.thinkEvery);}
function sigilPresence(){const near={alpha:0,beta:0};for(const h of heroes()){if(Number(h.hp)<=0)continue;if(Math.hypot(h.x-WORLD.cx,h.y-WORLD.cy)<=CFG.sigilRadius)near[teamOf(h)||'alpha']++;}return near;}
function updateSigil(dt){if(!state.sigil.active){if(state.elapsed>=state.sigil.nextAt){state.sigil.active=true;state.sigil.progress=0;state.sigil.team=null;emit('sigil-spawn',{at:state.elapsed});}return;}const near=sigilPresence(),owner=near.alpha>0&&near.beta===0?'alpha':near.beta>0&&near.alpha===0?'beta':null;if(!owner){state.sigil.progress=Math.max(0,state.sigil.progress-dt*.5);state.sigil.team=null;return;}if(state.sigil.team!==owner){state.sigil.team=owner;state.sigil.progress=0;}state.sigil.progress+=dt;if(state.sigil.progress<CFG.sigilCaptureSeconds)return;state.sigil.active=false;state.sigil.nextAt=state.elapsed+CFG.sigilRespawn;state.sigil.progress=0;state.empoweredTeam=owner;spawnWave(owner,true);emit('sigil-captured',{team:owner,nextAt:state.sigil.nextAt});}
function tick(ctx){const s=syncMatch();if(!s)return;const dt=clamp(Number(ctx&&ctx.dt)||0,0,.05);state.elapsed=s.match.elapsed;if(state.elapsed>=state.nextWave){spawnBoth();state.nextWave+=CFG.waveEvery;}for(const u of state.units)updateUnit(u,dt);for(let i=state.units.length-1;i>=0;i--)if(state.units[i].hp<=0&&state.units[i]._ai.deadFor>=CFG.deathLinger)state.units.splice(i,1);updateSigil(dt);}
function drawMinion(ctx,u){const hp=clamp(u.hp/u.maxHp,0,1);ctx.save();ctx.translate(u.x,u.y);ctx.fillStyle=u.team==='alpha'?'rgba(92,159,255,.85)':'rgba(242,96,113,.85)';ctx.strokeStyle=u.empowered?'#ffe59a':'rgba(255,255,255,.55)';ctx.lineWidth=u.empowered?2.5:1.2;ctx.beginPath();ctx.arc(0,0,u.empowered?11:9,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(-12,-18,24,3);ctx.fillStyle=u.team==='alpha'?'#74b5ff':'#ff8894';ctx.fillRect(-12,-18,24*hp,3);ctx.restore();}
function draw(ctx){if(!state.active||!ctx)return;ctx.save();if(state.sigil.active){const p=clamp(state.sigil.progress/CFG.sigilCaptureSeconds,0,1);ctx.fillStyle='rgba(231,197,106,.08)';ctx.strokeStyle='#e7c56a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(WORLD.cx,WORLD.cy,CFG.sigilRadius,0,Math.PI*2);ctx.fill();ctx.stroke();if(p>0){ctx.strokeStyle=state.sigil.team==='beta'?'#ff8894':'#74b5ff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(WORLD.cx,WORLD.cy,CFG.sigilRadius+7,-Math.PI/2,-Math.PI/2+Math.PI*2*p);ctx.stroke();}}for(const u of state.units)if(u.hp>0)drawMinion(ctx,u);ctx.restore();}
function snapshot(){return Object.freeze({version:VERSION,active:state.active,matchId:state.matchId,nextWaveIn:Math.max(0,state.nextWave-state.elapsed),units:Object.freeze(state.units.filter(u=>u.hp>0).map(u=>Object.freeze({id:u.id,team:u.team,hp:u.hp,maxHp:u.maxHp,empowered:u.empowered}))),sigil:Object.freeze({active:state.sigil.active,nextIn:Math.max(0,state.sigil.nextAt-state.elapsed),progress:state.sigil.progress,team:state.sigil.team}),empoweredTeam:state.empoweredTeam,lastEvent:state.lastEvent});}
root.KeloSimulation.after('arena:lane-pressure',tick,73);
const wrapped=Object.freeze(Object.assign({},BASE_ARENA,{getHostileActors(viewer){return BASE_ARENA.getHostileActors(viewer).concat(hostileMinions(viewer));},getActorById(id){return getUnitById(id)||BASE_ARENA.getActorById(id);},drawWorld(ctx){const out=BASE_ARENA.drawWorld(ctx);draw(ctx);return out;}}));
root.KeloArena=wrapped;
root.KeloArenaLanePressure=Object.freeze({version:VERSION,snapshot,clear});
root.KELO_ARENA_LANE_AUDIT=Object.freeze({version:VERSION,owner:'KeloArenaLanePressure',arenaSupport:true,minionsUseCombatEngine:true,waves:true,warSigil:true,empoweredWave:true,secondLoop:false,onlineAuthority:'pending-server'});
syncMatch();
})(typeof globalThis!=='undefined'?globalThis:window);
