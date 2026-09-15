'use strict';
const fs=require('fs');
const vm=require('vm');
function read(p){return fs.readFileSync(p,'utf8');}
function assert(ok,msg){if(!ok){console.error('FAIL:',msg);process.exitCode=1;}else console.log('PASS:',msg);}

const paths={
  bus:'src/core/events/event-bus.js',schema:'src/systems/combat/combat-schema.js',hit:'src/systems/combat/hit-resolver.js',damage:'src/systems/combat/damage-resolver.js',
  effectSchema:'src/systems/effects/effect-schema.js',effect:'src/systems/effects/effect-engine.js',combat:'src/systems/combat/combat-engine.js',
  meleeSchema:'src/systems/melee/melee-schema.js',profiles:'src/systems/melee/melee-weapon-profiles.js',melee:'src/systems/melee/melee-engine.js',
  bridge:'src/visuals/combat-presentation-bridge.js',pvp:'src/systems/pvp-world.js',bootstrap:'src/core/kelo-runtime-bootstrap.js',meleeVisuals:'src/visuals/melee-combat-visuals.js'
};
Object.values(paths).forEach(p=>assert(fs.existsSync(p),p+' exists'));
const src=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,read(p)]));

assert(!/document\.|querySelector|drawImage|\bctx\b|new Audio|assets\//.test(src.combat),'CombatEngine is DOM/render/asset free');
assert(!/document\.|querySelector|drawImage|\bctx\b|new Audio|assets\//.test(src.melee),'MeleeEngine is presentation free');
assert(!/\.hp\s*=/.test(src.melee),'MeleeEngine never mutates HP directly');
assert(!/MELEE_ATTACK_STARTED|MELEE_HIT_CONFIRMED/.test(src.combat),'CombatEngine does not know visual melee event names');
assert(src.bridge.includes("visualEmit('MELEE_ATTACK_STARTED'")&&src.bridge.includes("visualEmit('MELEE_HIT_CONFIRMED'"),'presentation bridge owns combat -> melee visual translation');
assert(!/\.hp\s*=|keloShield\s*=/.test(src.bridge),'presentation bridge cannot mutate gameplay health/shield');
assert(!src.pvp.includes('emitVisual(')&&!src.pvp.includes('meleeVisualPayload'),'PvP no longer calls melee visual bus directly');
assert(src.pvp.includes('KeloMeleeEngine.beginAttack'),'PvP starts melee through MeleeEngine');
assert(src.pvp.includes('KeloCombatEngine.attackSweep'),'PvP resolves active melee through shared CombatEngine sweep authority');
assert(!src.pvp.includes("t.hp=Math.max(0,(t.hp==null?100:t.hp)-18)"),'legacy direct PvP damage mutation removed');
assert(src.profiles.includes("id:'sword_light_basic'")&&src.profiles.includes('damage:18')&&src.profiles.includes('range:150')&&src.profiles.includes('cooldown:.12'),'current basic melee values preserved as data profile 18/150/.12');
assert(src.effect.includes('function register(')&&src.effect.includes('handlers=new Map()'),'EffectEngine is handler-registry based');
assert(!/amaterasu|fireball|ice_nova|swap_sword/.test(src.effect),'EffectEngine contains no ability-specific logic');
assert(src.bootstrap.indexOf('event-bus.js')<src.bootstrap.indexOf('combat-engine.js')&&src.bootstrap.indexOf('combat-engine.js')<src.bootstrap.indexOf('melee-engine.js')&&src.bootstrap.indexOf('melee-engine.js')<src.bootstrap.indexOf('combat-presentation-bridge.js'),'runtime bootstrap follows schema/core/runtime/presentation dependency order');
assert(src.meleeVisuals.includes("bus.on('MELEE_ATTACK_STARTED'")&&src.meleeVisuals.includes("bus.on('MELEE_HIT_CONFIRMED'"),'melee presentation remains event-driven');
assert(src.meleeVisuals.includes('direction8FromDirection'),'melee presentation supports independent 8-way visual direction');

const sandbox={console,Map,Set,Math,Date,Object,Array,String,Number,Boolean,JSON,performance:{now:()=>1000},setTimeout,clearTimeout,setInterval,clearInterval};
sandbox.globalThis=sandbox;sandbox.window=sandbox;
vm.createContext(sandbox);
[paths.bus,paths.schema,paths.hit,paths.damage,paths.effectSchema,paths.effect,paths.combat,paths.meleeSchema,paths.profiles,paths.melee].forEach(p=>vm.runInContext(read(p),sandbox,{filename:p}));
const E=sandbox.KeloCombatSchema.events;
const seen=[];
[E.ATTACK_STARTED,E.HIT_CONFIRMED,E.DAMAGE_APPLIED,E.ENTITY_KILLED,E.ATTACK_RESOLVED].forEach(name=>sandbox.KeloEvents.on(name,p=>seen.push({name,p})));
const attacker={id:'a',x:0,y:0,hp:100};
const target={id:'b',x:100,y:0,hp:100,maxHp:100};
const hit=sandbox.KeloMeleeEngine.attack({attacker,target,profileId:'sword_light_basic',cooldownRemaining:0,attackId:'audit_hit',startedAt:1000});
assert(hit.ok===true&&hit.amount===18&&target.hp===82&&hit.cooldown===.12,'engine hit applies exactly 18 damage and returns .12 cooldown');
assert(seen.map(x=>x.name).join('|')===[E.ATTACK_STARTED,E.HIT_CONFIRMED,E.DAMAGE_APPLIED,E.ATTACK_RESOLVED].join('|'),'hit semantic event order is stable');
assert(seen[0].p.gameplay.range===150&&seen[0].p.gameplay.cooldown===.12&&seen[0].p.confirmedHit===true,'attack payload carries current profile values and confirmed hit result');

seen.length=0;target.hp=100;target.x=200;
const miss=sandbox.KeloMeleeEngine.attack({attacker,target,profileId:'sword_light_basic',cooldownRemaining:0,attackId:'audit_miss',startedAt:1000});
assert(miss.ok===false&&miss.reason==='OUT_OF_RANGE'&&target.hp===100,'out-of-range melee does not mutate HP');
assert(seen.map(x=>x.name).join('|')===[E.ATTACK_STARTED,E.ATTACK_RESOLVED].join('|'),'miss emits attack started/resolved but no hit/damage event');
assert(seen[0].p.confirmedHit===false,'miss presentation context is explicitly non-hit');

seen.length=0;target.x=100;target.hp=100;
const cd=sandbox.KeloMeleeEngine.attack({attacker,target,profileId:'sword_light_basic',cooldownRemaining:0.2,attackId:'audit_cd'});
assert(cd.ok===false&&cd.reason==='COOLDOWN'&&target.hp===100,'cooldown blocks attack without damage');
assert(seen.length===0,'cooldown rejection emits no subscribed attack presentation event');

const shielded={id:'s',x:100,y:0,hp:100,maxHp:100,keloShield:5};
const shieldHit=sandbox.KeloMeleeEngine.attack({attacker,target:shielded,profileId:'sword_light_basic',cooldownRemaining:0,attackId:'audit_shield'});
assert(shieldHit.requested===18&&shieldHit.absorbed===5&&shieldHit.amount===13&&shielded.hp===87&&shielded.keloShield===0,'DamageResolver preserves shield absorption semantics');

const healTarget={hp:50,maxHp:100};
const healed=sandbox.KeloEffectEngine.apply({type:'heal',amount:20},{target:healTarget});
assert(healed.ok===true&&healTarget.hp===70,'EffectEngine reusable heal handler works');
assert(sandbox.KeloEffectEngine.has('burn'),'status-like handlers are registered generically');
const burnWithoutStatusRuntime=sandbox.KeloEffectEngine.apply({type:'burn',amount:2},{target:healTarget});
assert(burnWithoutStatusRuntime.ok===false&&burnWithoutStatusRuntime.reason==='STATUS_ENGINE_UNAVAILABLE','registered status effect fails explicitly when StatusEngine is absent from the isolated sandbox');

if(process.exitCode){console.error('\nCombat architecture audit FAILED');process.exit(process.exitCode);}else console.log('\nCombat architecture audit OK');
