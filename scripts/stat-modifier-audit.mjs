import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const Stats=require('../src/stats/stat-modifier-system.js');
assert.equal(Stats.version,'stat-modifier-v1.0.0');
assert.equal(Stats.validateModifier({id:'x',target:'player',stat:'defense',operation:'percentAdd',value:.04,scope:'whileMounted'}).ok,true);
assert.equal(Stats.validateModifier({id:'bad',target:'player',stat:'defense',operation:'wat',value:1}).ok,false);
const unsub=Stats.registerSource('audit-war-saddle',()=>[
 {id:'audit.player.def',target:'player',stat:'defense',operation:'percentAdd',value:.04,scope:'whileMounted',sourceId:'war-saddle'},
 {id:'audit.player.hp',target:'player',stat:'hp',operation:'percentAdd',value:.05,scope:'whileMounted',sourceId:'war-saddle'},
 {id:'audit.mount.accel',target:'mount',targetId:'mount.audit',stat:'acceleration',operation:'percentAdd',value:.08,scope:'whileEquipped',sourceId:'war-saddle'}
]);
const before=Stats.resolve('player',{defense:100,hp:100},{mounted:false,mountId:'mount.audit'}).stats;
assert.deepEqual(before,{defense:100,hp:100});
const mounted=Stats.resolve('player',{defense:100,hp:100},{mounted:true,mountId:'mount.audit'}).stats;
assert.equal(mounted.defense,104);assert.equal(mounted.hp,105);
const mount=Stats.resolve('mount',{acceleration:760},{mounted:false,mountId:'mount.audit'},'mount.audit').stats;
assert.ok(Math.abs(mount.acceleration-820.8)<1e-9);
const again=Stats.resolve('player',{defense:100,hp:100},{mounted:true,mountId:'mount.audit'}).stats;
assert.deepEqual(again,mounted,'same revision/context must be deterministic');
unsub();
const reverted=Stats.resolve('player',{defense:100,hp:100},{mounted:true,mountId:'mount.audit'}).stats;
assert.deepEqual(reverted,{defense:100,hp:100},'removing source must reverse exactly');
console.log(JSON.stringify({ok:true,version:Stats.version,deterministic:true,scopeWhileMounted:true,mountTarget:true,exactReversion:true},null,2));
