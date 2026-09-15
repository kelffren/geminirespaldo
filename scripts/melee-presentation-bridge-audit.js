/* KELO-INDEX
 * area: QA / VISUAL
 * owner: melee-presentation-bridge-audit
 * keys: MELEE PRESENTATION BRIDGE BASIC SPECIAL SEMANTIC FAMILY HIT CONFIRMED
 * purpose: prueba que perfiles melee registrados atraviesan la frontera combat -> presentation sin mutar gameplay
 * online: valida el mismo payload semántico que puede reconstruirse desde autoridad servidor
 */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');

const handlers=new Map();
const visual=[];
const sandbox={
  console,
  setInterval:(fn)=>{fn();return 1;},
  clearInterval:()=>{},
  KeloCombatSchema:{events:{ATTACK_STARTED:'ATTACK_STARTED',HIT_CONFIRMED:'HIT_CONFIRMED'}},
  KeloEvents:{
    on(name,fn){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn);return()=>{};},
    emit(name,payload){for(const fn of handlers.get(name)||[])fn(payload);}
  },
  KeloVisualEventBus:{emit(name,payload){visual.push({name,payload});}},
  KeloMeleeProfiles:{get(id){return ['sword_light_basic','sword_light_follow','sword_light_finisher'].includes(String(id))?{id}:null;}}
};
sandbox.window=sandbox;sandbox.globalThis=sandbox;
vm.createContext(sandbox);
const source=fs.readFileSync(path.resolve(__dirname,'../src/visuals/combat-presentation-bridge.js'),'utf8');
vm.runInContext(source,sandbox,{filename:'combat-presentation-bridge.js'});

assert.strictEqual(sandbox.KeloCombatPresentationBridge.bound,true,'bridge must bind');
const basicHit={kind:'basic',profileId:'sword_light_follow',attackId:'a2',damage:20};
const specialHit={kind:'special',profileId:'sword_light_finisher',attackId:'a3',damage:28};
const nonMelee={kind:'ability',profileId:'fireball',attackId:'r1'};
sandbox.KeloEvents.emit('HIT_CONFIRMED',basicHit);
sandbox.KeloEvents.emit('HIT_CONFIRMED',specialHit);
sandbox.KeloEvents.emit('HIT_CONFIRMED',nonMelee);

assert.strictEqual(visual.length,2,'registered melee profiles must route basic/special hit presentation only');
assert.strictEqual(visual[0].name,'MELEE_HIT_CONFIRMED');
assert.strictEqual(visual[0].payload,basicHit,'bridge must forward original semantic payload without gameplay mutation');
assert.strictEqual(visual[1].payload,specialHit);
assert.strictEqual(sandbox.KELO_COMBAT_PRESENTATION_BRIDGE_AUDIT.hitEvents,2);
assert(sandbox.KELO_COMBAT_PRESENTATION_BRIDGE_AUDIT.meleeProfileEvents>=2,'profile-family routing audit missing');
console.log('PASS melee presentation semantic-family bridge audit');
