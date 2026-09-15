/* KELO-INDEX
 * area: QA / PROGRESSION / TITLES
 * keys: TITLES STATS SERVER AUTHORITY TEST AUDIT TITLE BOOK PLACEHOLDERS
 * hace: valida catálogo, placeholders, Libro de títulos, reglas de kill, unlock/equip server y guardas Foundation estáticas
 * online: comprueba que no exista protocolo cliente titles:unlock ni progreso por visual DEATH
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const catalog = require('../src/systems/title-catalog.js');
const { createMemoryAdapter, createTitleService, validOpenWorldKill } = require('../server/title-store.js');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const validContext = (overrides = {}) => ({
  confirmed: true, worldPvP: true, mode: 'open-world-pvp', combatType: 'open-world-pvp', victimType: 'player',
  arena: false, training: false, dummy: false, npc: false, zone: 'open-world', timestamp: Date.now(), ...overrides
});

(async function run() {
  assert.strictEqual(catalog.version, 'title-catalog-v1.1');
  assert.strictEqual(catalog.get('pvp_assassin').name, 'Asesino');
  assert.strictEqual(catalog.get('missing'), null);
  assert.deepStrictEqual(catalog.byStat('openWorldPlayerKills').map((x) => x.requirement.value), [10, 50, 200, 500, 1000]);
  assert.ok(catalog.list().length >= 10, 'el Libro debe tener varios títulos');
  assert.strictEqual(catalog.get('placeholder_gatherer_01').placeholder, true, 'recolección queda como placeholder DATA');
  assert.strictEqual(catalog.get('placeholder_gatherer_01').requirement.stat, 'resourcesGathered');
  assert.strictEqual(catalog.get('placeholder_forgemaster_01').requirement.stat, 'itemsForged');
  assert.ok(catalog.get('placeholder_forgemaster_01').description.includes('forjas'), 'placeholder explica cómo conseguirse');

  const adapter = createMemoryAdapter();
  const titles = createTitleService({ adapter });
  const killer = uuid(1), victim = uuid(2);
  await titles.ensurePlayer(killer);
  await adapter._provision(killer, { progress: { openWorldPlayerKills: 199 }, unlocked: [] });
  let snap = await titles.snapshot(killer);
  assert.strictEqual(snap.progress.openWorldPlayerKills, 199);
  assert.strictEqual(snap.unlocked.includes('pvp_assassin'), false, '199 no desbloquea Asesino');

  let result = await titles.recordConfirmedKill(killer, victim, validContext());
  assert.strictEqual(result.counted, true);
  assert.strictEqual(result.snapshot.progress.openWorldPlayerKills, 200);
  assert.strictEqual(result.snapshot.unlocked.includes('pvp_assassin'), true, 'kill 200 desbloquea Asesino');
  assert.strictEqual(result.snapshot.unlocked.filter((id) => id === 'pvp_assassin').length, 1, 'no duplica unlock');

  result = await titles.recordConfirmedKill(killer, uuid(3), validContext());
  assert.strictEqual(result.snapshot.unlocked.filter((id) => id === 'pvp_assassin').length, 1, 'unlock permanece único');

  const invalidCases = [
    [killer, killer, validContext(), 'self'],
    [killer, uuid(4), validContext({ victimType: 'npc', npc: true }), 'npc'],
    [killer, uuid(5), validContext({ dummy: true }), 'dummy'],
    [killer, uuid(6), validContext({ training: true }), 'training'],
    [killer, uuid(7), validContext({ arena: true, mode: 'arena-1v1', combatType: 'arena' }), 'arena'],
    [killer, uuid(8), validContext({ confirmed: false }), 'unconfirmed']
  ];
  const beforeInvalid = (await titles.snapshot(killer)).progress.openWorldPlayerKills;
  for (const [k, v, c, label] of invalidCases) {
    assert.strictEqual(validOpenWorldKill(k, v, c), false, `${label} debe ser inválido`);
    const invalid = await titles.recordConfirmedKill(k, v, c);
    assert.strictEqual(invalid.counted, false, `${label} no debe contar`);
  }
  assert.strictEqual((await titles.snapshot(killer)).progress.openWorldPlayerKills, beforeInvalid, 'kills inválidas no alteran stat');

  const fresh = uuid(9);
  await titles.ensurePlayer(fresh);
  await assert.rejects(() => titles.equip(fresh, 'pvp_assassin'), /TITLE_LOCKED/);
  await assert.rejects(() => titles.equip(fresh, 'not_real'), /UNKNOWN_TITLE/);
  snap = await titles.equip(killer, 'pvp_assassin');
  assert.strictEqual(snap.equippedTitleId, 'pvp_assassin');
  assert.strictEqual((await titles.snapshot(killer)).equippedTitleId, 'pvp_assassin', 'estado equipado persiste en adapter');
  snap = await titles.unequip(killer);
  assert.strictEqual(snap.equippedTitleId, null);

  const engineC = read('engine-c.js');
  const avatarOwner = read('src/core/avatar-render-system.js');
  const nameplate = read('src/ui/player-nameplate.js');
  const titleSystem = read('src/systems/title-system.js');
  const luxe = read('src/ui/luxe-shell.js');
  const net = read('engine-net.js');
  const server = read('server/index.js');
  const index = read('index.html');
  assert.strictEqual(engineC.includes("localPlayer.title = 'Caballero'"), false, 'legacy Caballero debe retirarse');
  assert.strictEqual(/renderAvatar\s*=\s*function/.test(nameplate), false, 'nameplate no envuelve renderAvatar');
  assert.strictEqual(nameplate.includes("KeloAvatar.use('actor-nameplate'"), true, 'nameplate usa KeloAvatar');
  assert.strictEqual(avatarOwner.includes('FOUNDATION-ALLOW'), true, 'owner Avatar conserva wrapper autorizado');
  assert.strictEqual(titleSystem.includes('openBook: openBook'), true, 'KeloTitles expone Libro de títulos');
  assert.strictEqual(titleSystem.includes('CÓMO CONSEGUIRLO'), true, 'Libro muestra requisito del título seleccionado');
  assert.strictEqual(titleSystem.includes("KeloInputLocks.acquire('titles-book'"), true, 'Libro usa KeloInputLocks');
  assert.strictEqual(luxe.includes("id:'titles',label:'Libro de títulos'"), true, 'menú contiene Libro de títulos');
  assert.strictEqual(luxe.includes("window.KeloTitles?.openBook"), true, 'launcher reutiliza KeloTitles');
  assert.strictEqual(net.includes('equippedTitleId'), true, 'peer snapshot replica equippedTitleId');
  assert.strictEqual(net.includes("request('titles:equip'"), true, 'cliente solo solicita equip');
  assert.strictEqual(server.includes("msg.t === 'titles:unlock'"), false, 'server no expone titles:unlock');
  assert.strictEqual(server.includes('recordConfirmedKill'), true, 'server tiene hook interno de kill confirmada');
  assert.strictEqual(/msg\.t\s*===\s*['"]visual:event['"]/.test(server), true, 'visual relay existe pero separado');
  assert.ok(index.indexOf('src/systems/player-stats.js') < index.indexOf('src/systems/title-system.js'), 'Stats carga antes de Titles');
  assert.ok(index.indexOf('src/systems/title-system.js') < index.indexOf('src/systems/nobility.js'), 'Titles carga antes de panel Nobleza');
  assert.ok(index.indexOf('src/ui/player-nameplate.js') > index.indexOf('src/systems/nobility-authority.js'), 'nameplate resuelve catálogo/rangos tras owners');

  console.log('✅ Kelo Titles audit: catalog/data/placeholders, Title Book, 199→200 unlock, invalid kills, equip/unequip, persistence, net + Foundation guards OK');
})().catch((err) => { console.error('❌ Kelo Titles audit failed:', err); process.exitCode = 1; });
