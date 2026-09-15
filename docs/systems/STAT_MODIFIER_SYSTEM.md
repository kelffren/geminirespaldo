# Stat Modifier System

## Status

**Foundation candidate.** `KeloStats` provides the shared deterministic stat resolver used by player equipment and mount equipment.

## Purpose

Prevent every equipment/buff/mount system from inventing its own stat math. Sources publish declarative modifiers; one owner resolves them in a deterministic order and caches results until a source changes.

## Owner and files

- **Owner:** `KeloStats`
- **Source:** `src/stats/stat-modifier-system.js`
- **Legacy adapter:** `src/systems/equipment-system.js`
- **Mount source:** `src/mounts/mount-system.js`

`KeloStats` does not own inventory, equipment slots, mounts, buffs, player persistence or UI.

## Modifier contract

```js
{
  id,
  target: 'player' | 'mount' | futureTarget,
  targetId: null | stableId,
  stat,
  operation,
  value,
  scope,
  sourceId,
  priority
}
```

Supported V1 operations:

- `flatAdd`
- `flatSubtract`
- `percentAdd`
- `percentMultiply`
- `override`
- `clampMin`
- `clampMax`

Supported V1 scopes:

- `always`
- `whileEquipped`
- `whileMounted`
- `whileDismounted`
- `inCombat`
- `outOfCombat`

## Resolution order

For a stat:

```text
base
→ flatAdd / flatSubtract
→ summed percentAdd
→ percentMultiply chain
→ override
→ clampMin / clampMax
→ final
```

Modifiers are sorted by explicit priority then stable modifier ID so result does not depend on object iteration order.

## Public API

- `registerSource(id, provider)`
- `unregisterSource(id)`
- `markDirty()`
- `validateModifier(raw)`
- `normalizeModifier(raw)`
- `resolve(target, baseStats, context, targetId)`

## Flow

```text
Equipment / Mount / future Buff owner
        ↓ provider()
      modifiers
        ↓
     KeloStats
        ↓
  deterministic resolve
        ↓
    final stats
```

`registerSource` is the extension point. A source owns its own state; it only returns modifiers to KeloStats.

## Caching

`KeloStats` has a global revision and result cache. Register/unregister/`markDirty()` increments revision and clears cache. Gameplay owners must call `markDirty()` only when their stat-producing state changes. Do not recalculate entire inventories each render frame.

## Player equipment adapter

`KeloEquipment` keeps its historical public API and `player.equipmentStats`. It additionally registers a `player-equipment` source and exposes `player.finalStats` / `getFinalStats()`. This is an adapter migration, not a destructive rewrite.

## Mount equipment

`KeloMounts` registers a `mount-equipment` source. A saddle can simultaneously publish a player modifier and a mount modifier. `whileMounted` controls player bonuses that disappear on dismount; `whileEquipped` can remain active on the mount definition itself.

## Local vs online authority

The resolver is deterministic presentation/domain math. Production authority must decide which sources/items are valid and owned. The client must not be allowed to invent trusted modifiers. Server and client can share IDs/rules or the server can return accepted state; the UI should not become authority.

## Persistence

KeloStats itself persists nothing. Source owners persist their own IDs/state. This prevents cached derived numbers from becoming a second source of truth.

## Invariants

- one modifier format for every source;
- one deterministic resolution order;
- source state remains outside KeloStats;
- UI never registers arbitrary trusted modifiers;
- removing a source/equipment item reverses its effect exactly;
- appearance/cosmetics never enter this pipeline unless a separate gameplay equipment item explicitly provides a modifier.

## Correct use

```js
const stop = KeloStats.registerSource('example', () => [
  { id:'example.def', target:'player', stat:'defense', operation:'percentAdd', value:.04, scope:'whileMounted' }
]);
KeloStats.markDirty();
const result = KeloStats.resolve('player', { defense:100 }, { mounted:true });
```

## Anti-patterns

- calculating mount bonus directly in UI;
- `if (itemId === ...) player.defense += ...`;
- persisting `finalStats` as canonical inventory state;
- running full aggregation every animation frame;
- creating separate PlayerStatsEngine and MountStatsEngine with different math.

## Tests / CI

`npm run audit:stats` verifies scope activation, player + mount targets, deterministic repeat result and exact reversion after source removal.

## Observability

Public `revision` and `sourceCount` are available for audits/debug. Source provider errors are isolated and logged with source ID.

## Known limitations

V1 scopes are intentionally small. Future scopes must be added to this owner with tests rather than encoded as item-specific condition functions.

## Checklist for a new stat-producing system

1. keep canonical state in its own owner;
2. publish stable modifier IDs;
3. use an existing operation/scope when possible;
4. add a new generic operation/scope here only when genuinely reusable;
5. call `markDirty()` on state changes, not every frame;
6. add exact-before/after/reversion tests.
