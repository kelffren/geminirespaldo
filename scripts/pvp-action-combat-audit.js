'use strict';
/* KELO-INDEX
 * area: TEST / PVP
 * keys: PVP ACTION AIM HIT GEOMETRY MELEE PHASE TELEGRAPH MULTITOUCH AUTHORITY
 * hace: prueba contratos deterministas del rework action-combat sin navegador
 * online: valida que el cliente emita intent boundary y no vuelva a target-lock
 */
const fs=require('fs'),vm=require('vm');
function read(p){return fs.readFileSync(p,'utf8');}
function assert(ok,msg){if(!ok){console.error('FAIL:',msg);process.exitCode=1;}else console.log('PASS:',msg);}
const P={hit:'src/systems/combat/hit-resolver.js',schema:'src/systems/combat/combat-schema.js',damage:'src/systems/combat/damage-resolver.js',combat:'src/systems/combat/combat-engine.js',meleeSchema:'src/systems/melee/melee-schema.js',profiles:'src/systems/melee/melee-weapon-profiles.js',melee:'src/systems/melee/melee-engine.js',pvp:'src/systems/pvp-world.js'};
Object.values(P).forEach(p=>assert(fs.existsSync(p),p+' exists'));
const pvp=read(P.pvp),hitSrc=read(P.hit),profileSrc=read(P.profiles);
assert(!pvp.includes('SELECT_TARGET'),'PvP basic path contains no SELECT_TARGET');
assert(pvp.includes('targetLock:false')&&pvp.includes('aim360:true'),'PvP audit declares free 360 aim and no target lock');
assert(pvp.includes("KeloMovement.before('pvp-world:movement-scale'")&&!pvp.includes('updateMovement=function'),'movementScale reuses KeloMovement owner');
assert(pvp.includes("addEventListener('pointerdown'")&&pvp.includes('setPointerCapture'),'PvP uses Pointer Events + capture for mobile aim');
assert(pvp.includes('drawTelegraph')&&pvp.includes('telegraphsPresentationOnly:true'),'telegraphs exist and are presentation-only by contract');
assert(pvp.includes("phase:'windup'")&&pvp.includes("a.phase='active'")&&pvp.includes("a.phase='recovery'"),'basic attack has windup/active/recovery phases');
assert(hitSrc.includes('withinSector')&&hitSrc.includes('withinCapsule')&&hitSrc.includes('withinOrientedRect')&&hitSrc.includes('sweptCircle'),'HitResolver exposes required action geometry');
assert(profileSrc.includes("hitShape:'sector'")&&profileSrc.includes('movementScale:{windup:'),'sword profile is directional and phase movement-scaled');
const sandbox={console,Map,Set,Math,Date,Object,Array,String,Number,Boolean,JSON,performance:{now:()=>1000}};sandbox.globalThis=sandbox;sandbox.window=sandbox;vm.createContext(sandbox);
[P.hit,P.schema,P.damage,P.combat,P.meleeSchema,P.profiles,P.melee].forEach(p=>vm.runInContext(read(p),sandbox,{filename:p}));
const attacker={id:'a',x:0,y:0,hp:100,radius:20};
const front={id:'front',x:105,y:0,hp:100,maxHp:100,radius:20};
const diagonal={id:'diag',x:90,y:70,hp:100,maxHp:100,radius:20};
const behind={id:'behind',x:-90,y:0,hp:100,maxHp:100,radius:20};
const profile=sandbox.KeloMeleeEngine.getProfile('sword_light_basic');
assert(profile.windup>0&&profile.active>0&&profile.recovery>0,'profile phases are positive');
assert(sandbox.KeloMeleeEngine.movementScaleFor(profile,'windup')===.86&&sandbox.KeloMeleeEngine.movementScaleFor(profile,'active')===.52&&sandbox.KeloMeleeEngine.movementScaleFor(profile,'recovery')===1,'basic phase movement contract matches tested winner');
assert(sandbox.KeloHitResolver.resolveMelee(attacker,front,{x:1,y:0},profile).hit===true,'target in front is inside sword arc');
assert(sandbox.KeloHitResolver.resolveMelee(attacker,behind,{x:1,y:0},profile).hit===false,'target behind is outside sword arc');
const hpBehind=behind.hp;
const begun=sandbox.KeloMeleeEngine.beginAttack({attacker,direction:{x:1,y:0},profileId:profile.id,attackId:'phase_audit'});
assert(begun.ok===true&&begun.payload.phase==='windup','beginAttack starts semantic windup without damage');
assert(front.hp===100&&behind.hp===hpBehind,'windup mutates no target HP');
const resolved=sandbox.KeloMeleeEngine.attackSweep({attacker,targets:[front,diagonal,behind],direction:{x:1,y:0},profileId:profile.id,attackId:'phase_audit',skipStart:true});
assert(resolved.ok===true&&resolved.hitCount>=1&&front.hp===82,'active sweep damages valid arc target exactly once');
assert(behind.hp===hpBehind,'active sweep cannot damage target behind attacker');
const swept=sandbox.KeloHitResolver.sweptCircle({x:0,y:0},{x:300,y:0},8,{x:150,y:0,radius:18});
assert(swept.hit===true&&swept.t>=0&&swept.t<=1,'swept circle catches a fast projectile crossing target');
const sweptMiss=sandbox.KeloHitResolver.sweptCircle({x:0,y:0},{x:300,y:0},8,{x:150,y:100,radius:18});
assert(sweptMiss.hit===false,'swept circle rejects non-intersecting target');
if(process.exitCode){console.error('\nPvP action-combat audit FAILED');process.exit(process.exitCode);}else console.log('\nPvP action-combat audit OK');