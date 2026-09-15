'use strict';

const assert = require('assert');
const { createMemoryAdapter, createNobilityService, rankFor } = require('../server/nobility-store');

(async () => {
  const adapter = createMemoryAdapter();
  const service = createNobilityService({ adapter });
  const ids = [];
  for (let i = 0; i < 60; i++) {
    const id = `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    ids.push(id);
    await service.ensurePlayer(id, `Player${String(i + 1).padStart(2, '0')}`);
    const donation = i < 3 ? [3200000000, 2940000000, 2715000000][i] : i < 15 ? 2300000000 - ((i - 3) * 95000000) : i < 50 ? 1120000000 - ((i - 15) * 22000000) : 345000000 - ((i - 50) * 11500000);
    await adapter._provision(id, { gold: 6000000000, kc: 10000, donation });
  }

  const me = '11111111-1111-4111-8111-111111111111';
  await service.ensurePlayer(me, 'KeloAudit');
  await adapter._provision(me, { gold: 9000000000, kc: 10000, donation: 0 });

  assert.strictEqual((await service.snapshot(me, 'KeloAudit')).rank.id, 'none');
  await service.donate(me, 'KeloAudit', 'gold', 30000000);
  assert.strictEqual((await service.snapshot(me, 'KeloAudit')).rank.id, 'knight');
  await service.donate(me, 'KeloAudit', 'gold', 70000000);
  assert.strictEqual((await service.snapshot(me, 'KeloAudit')).rank.id, 'baron');
  await service.donate(me, 'KeloAudit', 'gold', 100000000);
  assert.strictEqual((await service.snapshot(me, 'KeloAudit')).rank.id, 'earl');

  let snap = await service.snapshot(me, 'KeloAudit');
  assert.ok(snap.position > 50);
  await service.donate(me, 'KeloAudit', 'gold', snap.next.amount);
  snap = await service.snapshot(me, 'KeloAudit');
  assert.ok(snap.position <= 50);
  assert.strictEqual(snap.rank.id, 'duke');
  assert.strictEqual(snap.rank.power, 7);

  await service.donate(me, 'KeloAudit', 'gold', snap.next.amount);
  snap = await service.snapshot(me, 'KeloAudit');
  assert.ok(snap.position <= 15);
  assert.strictEqual(snap.rank.id, 'prince');
  assert.strictEqual(snap.rank.power, 9);

  await service.donate(me, 'KeloAudit', 'gold', snap.next.amount);
  snap = await service.snapshot(me, 'KeloAudit');
  assert.ok(snap.position <= 3);
  assert.strictEqual(snap.rank.id, 'king');
  assert.strictEqual(snap.rank.power, 12);
  assert.strictEqual(snap.damageMultiplier, 1.12);

  const hit = await service.resolveDamage(me, 'KeloAudit', 100);
  assert.strictEqual(hit.damage, 112);
  assert.strictEqual(hit.rank.id, 'king');

  assert.strictEqual(rankFor(0, 1).id, 'none', 'Top 3 cannot bypass fixed donation qualification');
  assert.strictEqual(rankFor(200000000, 50).id, 'duke');

  console.log(JSON.stringify({ ok: true, source: service.source, final: { donation: snap.donation, position: snap.position, rank: snap.rank, damageMultiplier: snap.damageMultiplier }, resolvedHit: hit }, null, 2));
})().catch(err => { console.error(err); process.exit(1); });
