(function (root, factory) {
  let data = root && root.KELO_ABILITY_DATA;
  if (!data && typeof module === 'object' && module.exports) {
    data = require('./abilityData.js');
  }

  const api = factory(data);

  if (root) root.KeloStones = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (data) {
  'use strict';

  if (!data || !Array.isArray(data.ABILITIES)) {
    throw new Error('KeloStones requires KELO_ABILITY_DATA');
  }

  const SCHEMA_VERSION = 3;
  const LOADOUT_SIZE = 5;
  const TIER_NAMES = Object.freeze(Object.keys(data.TIERS));
  const ABILITY_BY_ID = new Map(data.ABILITIES.map((def) => [def.id, def]));
  const ABILITY_BY_KEY = new Map(data.ABILITIES.map((def) => [def.key, def]));

  const LEGACY_ABILITY_MAP = Object.freeze({
    dash: 'wind_dash',
    shield: 'stone_shield',
    fireball: 'fireball',
    frostnova: 'ice_nova',
    meteor: 'fire_tornado',
  });

  const AFFIXES = Object.freeze({
    damage: Object.freeze({ id: 'damage', label: 'Poder', suffix: '% daño' }),
    cooldown: Object.freeze({ id: 'cooldown', label: 'Celeridad', suffix: '% recarga' }),
    range: Object.freeze({ id: 'range', label: 'Alcance', suffix: '% alcance' }),
    speed: Object.freeze({ id: 'speed', label: 'Impulso', suffix: '% velocidad' }),
    area: Object.freeze({ id: 'area', label: 'Dominio', suffix: '% área' }),
    shield: Object.freeze({ id: 'shield', label: 'Bastión', suffix: '% escudo' }),
    heal: Object.freeze({ id: 'heal', label: 'Gracia', suffix: '% curación' }),
  });

  function deepClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function nowMs() {
    return Date.now();
  }

  function randomId(prefix) {
    const p = prefix || 'stone';
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') {
      const buf = new Uint32Array(3);
      crypto.getRandomValues(buf);
      return p + '_' + Array.from(buf).map((n) => n.toString(36)).join('');
    }
    return p + '_' + Math.random().toString(36).slice(2, 11) + Math.random().toString(36).slice(2, 7);
  }

  function abilityById(id) {
    return ABILITY_BY_ID.get(Number(id)) || null;
  }

  function abilityByKey(key) {
    return ABILITY_BY_KEY.get(String(key || '')) || null;
  }

  function normalizeAbilityKey(raw) {
    if (!raw) return null;
    if (Number.isFinite(Number(raw)) && abilityById(Number(raw))) return abilityById(Number(raw)).key;
    const key = String(raw);
    const mapped = LEGACY_ABILITY_MAP[key] || key;
    return abilityByKey(mapped) ? mapped : null;
  }

  function normalizeTier(tier) {
    const name = String(tier || 'Common');
    return data.TIERS[name] ? name : 'Common';
  }

  function tierRank(tier) {
    return data.TIERS[normalizeTier(tier)].rank;
  }

  function nextTier(tier) {
    const current = normalizeTier(tier);
    const idx = TIER_NAMES.indexOf(current);
    return idx >= 0 && idx < TIER_NAMES.length - 1 ? TIER_NAMES[idx + 1] : null;
  }

  function hasEffect(def, type) {
    return (def.effects || []).some((fx) => fx.type === type);
  }

  function hasRadius(def) {
    const d = def.delivery || {};
    return Number.isFinite(d.radius) || Number.isFinite(d.activationRadius);
  }

  function compatibleAffixes(def) {
    const ids = ['cooldown'];
    if (hasEffect(def, 'damage')) ids.push('damage');
    if (hasEffect(def, 'shield')) ids.push('shield');
    if (hasEffect(def, 'heal')) ids.push('heal');
    if ((def.targeting && Number.isFinite(def.targeting.range)) || Number.isFinite((def.delivery || {}).maxDistance)) ids.push('range');
    if (Number.isFinite((def.delivery || {}).speed) || Number.isFinite((def.delivery || {}).distance)) ids.push('speed');
    if (hasRadius(def)) ids.push('area');
    return ids;
  }

  function rollAffixes(def, tier, randomFn) {
    const rng = typeof randomFn === 'function' ? randomFn : Math.random;
    const cfg = data.TIERS[normalizeTier(tier)];
    const pool = compatibleAffixes(def).slice();
    const out = [];
    const count = Math.min(cfg.affixes, pool.length);

    for (let i = 0; i < count; i++) {
      const pick = Math.floor(clamp(rng(), 0, 0.999999) * pool.length);
      const id = pool.splice(pick, 1)[0];
      const value = cfg.minRoll + (cfg.maxRoll - cfg.minRoll) * clamp(rng(), 0, 1);
      out.push({ id, value: Number(value.toFixed(4)) });
    }
    return out;
  }

  function normalizeAffixes(def, tier, rawAffixes) {
    if (!Array.isArray(rawAffixes)) return rollAffixes(def, tier);
    const allowed = new Set(compatibleAffixes(def));
    const used = new Set();
    const out = [];
    for (const raw of rawAffixes) {
      if (!raw || !allowed.has(raw.id) || used.has(raw.id)) continue;
      const n = Number(raw.value);
      if (!Number.isFinite(n) || n <= 0) continue;
      used.add(raw.id);
      out.push({ id: raw.id, value: Number(clamp(n, 0.001, 0.5).toFixed(4)) });
    }
    return out;
  }

  function compatibilityFields(stone, def) {
    const firstDamage = (def.effects || []).find((fx) => fx.type === 'damage' && !fx.perTick);
    return Object.assign(stone, {
      typeId: def.key,
      name: def.name,
      icon: def.icon || ((data.STONES[def.recipe[0]] || {}).icon || '◆'),
      color: (def.visuals && def.visuals.color) || '#e7c56a',
      isUlt: def.slotType === 'ultimate',
      baseCd: def.cooldown,
      dmg: firstDamage ? firstDamage.amount : 0,
      currentCd: Number.isFinite(stone.currentCd) ? stone.currentCd : 0,
    });
  }

  function createAbilityStone(abilityKey, tier, options) {
    const opts = options || {};
    const key = normalizeAbilityKey(abilityKey);
    const def = key ? abilityByKey(key) : null;
    if (!def) throw new Error('Unknown ability: ' + abilityKey);
    const safeTier = normalizeTier(tier);
    const stone = {
      schemaVersion: SCHEMA_VERSION,
      uid: opts.uid || randomId('stone'),
      kind: 'ability',
      abilityId: def.id,
      abilityKey: def.key,
      recipe: def.recipe.slice(),
      tier: safeTier,
      level: Math.max(1, Math.floor(Number(opts.level) || 1)),
      xp: Math.max(0, Math.floor(Number(opts.xp) || 0)),
      affixes: normalizeAffixes(def, safeTier, opts.affixes),
      locked: opts.locked === true,
      bound: opts.bound === true,
      source: String(opts.source || 'world'),
      createdAt: Number.isFinite(Number(opts.createdAt)) ? Number(opts.createdAt) : nowMs(),
      currentCd: 0,
    };
    return compatibilityFields(stone, def);
  }

  function createFromLegacy(typeId, tier, options) {
    const key = normalizeAbilityKey(typeId);
    if (!key) throw new Error('Unknown legacy stone type: ' + typeId);
    return createAbilityStone(key, tier, options);
  }

  function normalizeStone(raw, options) {
    const opts = options || {};
    if (!raw || typeof raw !== 'object') return null;

    const key = normalizeAbilityKey(raw.abilityKey || raw.typeId || raw.abilityId);
    const def = key ? abilityByKey(key) : null;
    if (!def) return null;

    const tier = normalizeTier(raw.tier);
    const normalized = createAbilityStone(key, tier, {
      uid: raw.uid || opts.uid,
      level: raw.level,
      xp: raw.xp,
      affixes: Array.isArray(raw.affixes) ? raw.affixes : undefined,
      locked: raw.locked,
      bound: raw.bound,
      source: raw.source || (raw.schemaVersion ? 'world' : 'legacy-migration'),
      createdAt: raw.createdAt,
    });

    if (Number.isFinite(raw.currentCd)) normalized.currentCd = Math.max(0, raw.currentCd);
    return normalized;
  }

  function rekeyIfDuplicate(stone, seen) {
    if (!stone) return null;
    if (!seen.has(stone.uid)) {
      seen.add(stone.uid);
      return stone;
    }
    stone.uid = randomId('stone');
    seen.add(stone.uid);
    return stone;
  }

  function migrateCollection(list, report, seen, quarantine) {
    const out = [];
    for (const raw of Array.isArray(list) ? list : []) {
      const normalized = normalizeStone(raw);
      if (!normalized) {
        report.quarantined++;
        quarantine.push({ reason: 'UNKNOWN_STONE', raw: deepClone(raw) });
        continue;
      }
      if (!raw.schemaVersion || raw.schemaVersion !== SCHEMA_VERSION || raw.abilityKey !== normalized.abilityKey) {
        report.migrated++;
      }
      const before = normalized.uid;
      rekeyIfDuplicate(normalized, seen);
      if (before !== normalized.uid) report.rekeyed++;
      out.push(normalized);
    }
    return out;
  }

  function migrateState(state) {
    if (!state || typeof state !== 'object') throw new Error('migrateState requires STATE');
    const report = { migrated: 0, quarantined: 0, rekeyed: 0, overflow: 0 };
    const seen = new Set();
    const quarantine = Array.isArray(state.stoneQuarantine) ? state.stoneQuarantine : [];

    state.inventory = migrateCollection(state.inventory, report, seen, quarantine);
    state.equipped = migrateCollection(state.equipped, report, seen, quarantine);

    const kept = [];
    const overflow = [];
    let normalCount = 0;
    let ultimateCount = 0;
    state.equipped.forEach((stone) => {
      const def = abilityByKey(stone.abilityKey);
      const isUltimate = def && def.slotType === 'ultimate';
      if (isUltimate) {
        if (ultimateCount < 1) {
          kept.push(stone);
          ultimateCount++;
        } else {
          overflow.push(stone);
        }
      } else if (normalCount < LOADOUT_SIZE - 1) {
        kept.push(stone);
        normalCount++;
      } else {
        overflow.push(stone);
      }
    });
    state.equipped = kept;
    if (overflow.length) {
      report.overflow += overflow.length;
      state.inventory.push.apply(state.inventory, overflow);
    }

    if (Array.isArray(state.marketListings)) {
      state.marketListings.forEach((listing) => {
        if (!listing || listing.type !== 'stone' || !listing.item) return;
        const normalized = normalizeStone(listing.item);
        if (!normalized) {
          report.quarantined++;
          quarantine.push({ reason: 'UNKNOWN_MARKET_STONE', raw: deepClone(listing.item) });
          listing.invalidStone = true;
          return;
        }
        rekeyIfDuplicate(normalized, seen);
        listing.item = normalized;
      });
    }

    state.stoneSchemaVersion = SCHEMA_VERSION;
    state.stoneQuarantine = quarantine.slice(-25);
    return report;
  }

  function getAffix(stone, id) {
    const found = (stone.affixes || []).find((a) => a.id === id);
    return found ? Number(found.value) || 0 : 0;
  }

  function scaleEffectAmount(effect, stone) {
    let mul = 1;
    if (effect.type === 'damage') mul += getAffix(stone, 'damage');
    if (effect.type === 'shield') mul += getAffix(stone, 'shield');
    if (effect.type === 'heal') mul += getAffix(stone, 'heal');
    if (Number.isFinite(effect.amount)) effect.amount = Number((effect.amount * mul).toFixed(3));
  }

  function resolveAbility(stone) {
    const normalized = normalizeStone(stone);
    if (!normalized) return null;
    const base = abilityByKey(normalized.abilityKey);
    const def = deepClone(base);

    const cd = getAffix(normalized, 'cooldown');
    const range = getAffix(normalized, 'range');
    const speed = getAffix(normalized, 'speed');
    const area = getAffix(normalized, 'area');

    if (cd > 0) def.cooldown = Number((def.cooldown * (1 - clamp(cd, 0, 0.45))).toFixed(3));
    if (def.targeting && Number.isFinite(def.targeting.range) && range > 0) {
      def.targeting.range = Number((def.targeting.range * (1 + range)).toFixed(3));
    }
    if (def.delivery) {
      if (Number.isFinite(def.delivery.maxDistance) && range > 0) def.delivery.maxDistance = Number((def.delivery.maxDistance * (1 + range)).toFixed(3));
      if (Number.isFinite(def.delivery.speed) && speed > 0) def.delivery.speed = Number((def.delivery.speed * (1 + speed)).toFixed(3));
      if (Number.isFinite(def.delivery.distance) && speed > 0) def.delivery.distance = Number((def.delivery.distance * (1 + speed)).toFixed(3));
      if (Number.isFinite(def.delivery.radius) && area > 0) def.delivery.radius = Number((def.delivery.radius * (1 + area)).toFixed(3));
      if (Number.isFinite(def.delivery.activationRadius) && area > 0) def.delivery.activationRadius = Number((def.delivery.activationRadius * (1 + area)).toFixed(3));
    }
    (def.effects || []).forEach((effect) => scaleEffectAmount(effect, normalized));

    def.stone = {
      uid: normalized.uid,
      tier: normalized.tier,
      level: normalized.level,
      affixes: deepClone(normalized.affixes),
    };
    return def;
  }

  function affixLabel(affix) {
    if (!affix || !AFFIXES[affix.id]) return '';
    const meta = AFFIXES[affix.id];
    const pct = Math.round((Number(affix.value) || 0) * 100);
    if (affix.id === 'cooldown') return meta.label + ' −' + pct + meta.suffix;
    return meta.label + ' +' + pct + meta.suffix;
  }

  function recipeLabel(stone) {
    const normalized = normalizeStone(stone);
    if (!normalized) return '';
    return normalized.recipe.map((id) => {
      const component = data.STONES[id];
      return component ? component.icon + ' ' + component.name : id;
    }).join(' + ');
  }

  function stoneSummary(stone) {
    const normalized = normalizeStone(stone);
    if (!normalized) return null;
    const def = abilityByKey(normalized.abilityKey);
    return {
      uid: normalized.uid,
      name: def.name,
      icon: def.icon,
      tier: normalized.tier,
      abilityKey: normalized.abilityKey,
      recipe: recipeLabel(normalized),
      affixes: normalized.affixes.map(affixLabel),
      slotType: def.slotType,
    };
  }

  function hashString(input) {
    let hash = 2166136261;
    const text = String(input || '');
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function snapshotStone(stone, slot) {
    const normalized = normalizeStone(stone);
    if (!normalized) return null;
    return {
      slot,
      stoneUid: normalized.uid,
      abilityId: normalized.abilityId,
      abilityKey: normalized.abilityKey,
      recipe: normalized.recipe.slice(),
      tier: normalized.tier,
      level: normalized.level,
      affixes: deepClone(normalized.affixes),
    };
  }

  function projectLoadout(state) {
    const equipped = state && Array.isArray(state.equipped) ? state.equipped : [];
    const slots = Array(LOADOUT_SIZE).fill(null);
    let normalSlot = 0;

    equipped.forEach((stone) => {
      const normalized = normalizeStone(stone);
      if (!normalized) return;
      const def = abilityByKey(normalized.abilityKey);
      if (!def) return;
      if (def.slotType === 'ultimate') {
        if (!slots[LOADOUT_SIZE - 1]) slots[LOADOUT_SIZE - 1] = normalized;
        return;
      }
      while (normalSlot < LOADOUT_SIZE - 1 && slots[normalSlot]) normalSlot++;
      if (normalSlot < LOADOUT_SIZE - 1) {
        slots[normalSlot] = normalized;
        normalSlot++;
      }
    });

    return slots;
  }

  function fingerprintPayload(payload) {
    return hashString(JSON.stringify({
      schemaVersion: payload.schemaVersion,
      size: payload.size,
      slots: payload.slots,
    }));
  }

  function exportLoadout(state) {
    const projected = projectLoadout(state);
    const slots = projected.map((stone, slot) => snapshotStone(stone, slot));
    const payload = { schemaVersion: SCHEMA_VERSION, size: LOADOUT_SIZE, slots };
    payload.fingerprint = fingerprintPayload(payload);
    return payload;
  }

  function validateLoadoutSnapshot(snapshot, state) {
    if (
      !snapshot ||
      snapshot.schemaVersion !== SCHEMA_VERSION ||
      snapshot.size !== LOADOUT_SIZE ||
      !Array.isArray(snapshot.slots) ||
      snapshot.slots.length !== LOADOUT_SIZE
    ) {
      return { valid: false, reason: 'INVALID_SCHEMA' };
    }

    const candidateFingerprint = fingerprintPayload(snapshot);
    if (candidateFingerprint !== snapshot.fingerprint) {
      return { valid: false, reason: 'SNAPSHOT_TAMPERED' };
    }

    const authoritative = exportLoadout(state);
    if (candidateFingerprint !== authoritative.fingerprint) {
      return { valid: false, reason: 'LOADOUT_MISMATCH', authoritative };
    }
    return { valid: true, authoritative };
  }

  function canFuse(stones) {
    if (!Array.isArray(stones) || stones.length !== 3) return { valid: false, reason: 'NEED_THREE' };
    const normalized = stones.map(normalizeStone);
    if (normalized.some((s) => !s)) return { valid: false, reason: 'INVALID_STONE' };
    const first = normalized[0];
    if (!normalized.every((s) => s.abilityKey === first.abilityKey)) return { valid: false, reason: 'ABILITY_MISMATCH' };
    if (!normalized.every((s) => s.tier === first.tier)) return { valid: false, reason: 'TIER_MISMATCH' };
    const upgradedTier = nextTier(first.tier);
    if (!upgradedTier) return { valid: false, reason: 'MAX_TIER' };
    return { valid: true, stones: normalized, abilityKey: first.abilityKey, tier: first.tier, nextTier: upgradedTier };
  }

  function createStarterSet() {
    return [
      createAbilityStone('wind_dash', 'Common', { source: 'starter' }),
      createAbilityStone('stone_shield', 'Common', { source: 'starter' }),
      createAbilityStone('fireball', 'Common', { source: 'starter' }),
      createAbilityStone('ice_nova', 'Common', { source: 'starter' }),
      createAbilityStone('fire_tornado', 'Rare', { source: 'starter' }),
    ];
  }

  return Object.freeze({
    SCHEMA_VERSION,
    LOADOUT_SIZE,
    TIER_NAMES,
    LEGACY_ABILITY_MAP,
    AFFIXES,
    abilityById,
    abilityByKey,
    normalizeAbilityKey,
    normalizeTier,
    tierRank,
    nextTier,
    createAbilityStone,
    createFromLegacy,
    normalizeStone,
    migrateState,
    resolveAbility,
    affixLabel,
    recipeLabel,
    stoneSummary,
    projectLoadout,
    exportLoadout,
    validateLoadoutSnapshot,
    canFuse,
    createStarterSet,
    hashString,
  });
});
