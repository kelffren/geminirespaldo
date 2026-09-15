const { test, expect } = require('@playwright/test');
const data = require('../src/abilities/abilityData.js');
const stones = require('../src/abilities/stone-system.js');

test.describe('Kelo Stone System V3', () => {
  test('catalog keeps unique scalable abilities', () => {
    expect(data.ABILITIES.length).toBeGreaterThan(0);
    const keys = new Set(data.ABILITIES.map((ability) => ability.key));
    const ids = new Set(data.ABILITIES.map((ability) => ability.id));
    const recipes = new Set(data.ABILITIES.map((ability) => [...ability.recipe].sort().join('|')));
    expect(keys.size).toBe(data.ABILITIES.length);
    expect(ids.size).toBe(data.ABILITIES.length);
    expect(recipes.size).toBe(data.ABILITIES.length);
  });

  test('legacy stones migrate without a second source of truth', () => {
    const state = {
      inventory: [
        { uid: 'old_1', typeId: 'fireball', tier: 'Rare' },
        { uid: 'old_2', typeId: 'dash', tier: 'Common' },
      ],
      equipped: [
        { uid: 'old_3', typeId: 'shield', tier: 'Epic' },
        { uid: 'old_4', typeId: 'frostnova', tier: 'Common' },
        { uid: 'old_5', typeId: 'meteor', tier: 'Rare' },
      ],
      marketListings: [],
    };

    const report = stones.migrateState(state);
    expect(report.quarantined).toBe(0);
    expect(state.inventory[0].abilityKey).toBe('fireball');
    expect(state.equipped[0].abilityKey).toBe('stone_shield');
    expect(state.equipped[1].abilityKey).toBe('ice_nova');
    expect(state.equipped[2].abilityKey).toBe('fire_tornado');
    expect(state.stoneSchemaVersion).toBe(stones.SCHEMA_VERSION);
  });

  test('a stone owns the ability and its rolls', () => {
    const stone = stones.createAbilityStone('fireball', 'Legendary', {
      uid: 'stone_fixed',
      affixes: [
        { id: 'damage', value: 0.10 },
        { id: 'cooldown', value: 0.08 },
      ],
    });

    const resolved = stones.resolveAbility(stone);
    const damage = resolved.effects.find((effect) => effect.type === 'damage').amount;
    expect(stone.abilityKey).toBe('fireball');
    expect(stone.recipe).toEqual(['fire', 'projectile']);
    expect(damage).toBeCloseTo(38.5, 3);
    expect(resolved.cooldown).toBeCloseTo(3.68, 3);
  });

  test('PvP loadout snapshot is stable and verifiable', () => {
    const state = { inventory: [], equipped: stones.createStarterSet(), marketListings: [] };
    stones.migrateState(state);
    const snapshot = stones.exportLoadout(state);
    expect(snapshot.slots).toHaveLength(5);
    expect(snapshot.slots.filter(Boolean)).toHaveLength(5);
    expect(snapshot.slots[4].abilityKey).toBe('fire_tornado');
    expect(snapshot.slots.slice(0, 4).every((slot) => stones.abilityByKey(slot.abilityKey).slotType === 'normal')).toBe(true);
    expect(stones.validateLoadoutSnapshot(snapshot, state).valid).toBe(true);

    snapshot.slots[0].abilityKey = 'shadow_step';
    expect(stones.validateLoadoutSnapshot(snapshot, state)).toMatchObject({ valid: false, reason: 'SNAPSHOT_TAMPERED' });
  });

  test('fusion only accepts three copies of the same ability and tier', () => {
    const good = [1, 2, 3].map(() => stones.createAbilityStone('fireball', 'Rare'));
    const badAbility = good.slice(0, 2).concat(stones.createAbilityStone('ice_nova', 'Rare'));
    const badTier = good.slice(0, 2).concat(stones.createAbilityStone('fireball', 'Epic'));

    expect(stones.canFuse(good)).toMatchObject({ valid: true, nextTier: 'Epic' });
    expect(stones.canFuse(badAbility)).toMatchObject({ valid: false, reason: 'ABILITY_MISMATCH' });
    expect(stones.canFuse(badTier)).toMatchObject({ valid: false, reason: 'TIER_MISMATCH' });
  });

  test('100 stone instances remain unique without mutating ability definitions', () => {
    const before = JSON.stringify(data.ABILITIES);
    const ids = new Set();

    for (let i = 0; i < 100; i++) {
      const ability = data.ABILITIES[i % data.ABILITIES.length];
      ids.add(stones.createAbilityStone(ability.key, 'Epic').uid);
    }

    expect(ids.size).toBe(100);
    expect(JSON.stringify(data.ABILITIES)).toBe(before);
  });
});
