'use strict';
const assert=require('assert');
const {createForgeService,calcChance,auraRank,CONFIG}=require('../server/forge-store');
(async()=>{
  [ [329,0],[330,1],[475,2],[750,3],[950,4],[1350,5],[1720,6],[2225,7],[3860,8],[5250,9] ].forEach(([s,r])=>assert.strictEqual(auraRank(s),r));
  assert.strictEqual(calcChance(1,1,[]),100);
  assert.strictEqual(calcChance(8,4,Array(25).fill(4)),100);
  assert.throws(()=>calcChance(3,1,Array(26).fill(1)),/TOO_MANY_CRYSTALS/);
  assert.strictEqual(CONFIG.SLOTS.length,9);
  assert.ok(CONFIG.SLOTS.length*CONFIG.GRADE_ARMOR_POINTS[9]>=5250,'Aura 9 must be reachable by equipped gear');

  const svc=createForgeService({});
  const id='audit_player';
  let snap=await svc.ensurePlayer(id);
  assert.strictEqual(snap.armorScore,0);
  const p=svc._debugPlayer(id);
  p.inventory.sapphire_1=10;p.inventory.emerald_1=10;p.inventory.ruby_1=10;p.inventory.forge_crystal_1=30;p.gold=999999;

  const q=await svc.attempt(id,{itemId:'eq_weapon',forgeType:'quality',materialLevel:1,crystals:[]});
  assert.strictEqual(q.success,true);assert.strictEqual(q.item.quality,2);assert.strictEqual(q.inventory.sapphire_1,9);
  const g=await svc.attempt(id,{itemId:'eq_weapon',forgeType:'grade',materialLevel:1,crystals:[]});
  assert.strictEqual(g.success,true);assert.strictEqual(g.item.grade,2);assert.strictEqual(g.armorScore,20);
  const l=await svc.attempt(id,{itemId:'eq_weapon',forgeType:'level',materialLevel:1,crystals:[]});
  assert.strictEqual(l.success,true);assert.strictEqual(l.item.itemLevel,2);

  let rejected=false;try{await svc.attempt(id,{itemId:'eq_weapon',forgeType:'grade',materialLevel:1,crystals:Array(26).fill(1)});}catch(e){rejected=/TOO_MANY_CRYSTALS/.test(e.message);}assert.ok(rejected);
  p.inventory.sapphire_1=6;const combined=await svc.combine(id,'sapphire_1');assert.strictEqual(combined.inventory.sapphire_1,0);assert.strictEqual(combined.inventory.sapphire_2,1);
  rejected=false;try{await svc.combine(id,'sapphire_4');}catch(e){rejected=/MAX_MATERIAL_LEVEL/.test(e.message);}assert.ok(rejected);

  Object.values(p.equipment).forEach(x=>x.grade=9);
  snap=await svc.snapshot(id);assert.strictEqual(snap.armorScore,5850);assert.strictEqual(snap.auraRank,9);
  console.log(JSON.stringify({ok:true,version:'forge-server-audit-v1',armorScore:snap.armorScore,auraRank:snap.auraRank,slots:CONFIG.SLOTS.length}));
})().catch(e=>{console.error(e);process.exit(1);});