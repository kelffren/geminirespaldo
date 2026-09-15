# Mount System

## Status

**Foundation candidate on `feature/mount-appearance-foundation-v1`.** Runtime/domain code exists, but this document must not be interpreted as proof of merged LIVE visual validation. Real mount art bundles are not yet present in the repository.

## Purpose

Mounts are data-driven gameplay content. A mount can be equipped independently from being mounted, changes traversal, exposes exactly three exclusive abilities while mounted, accepts mount equipment, and accepts cosmetic appearance items. The system must scale to 20,000+ definitions without one class, switch branch, runtime actor, DOM row or texture per definition.

## Owner and files

- **Runtime/state owner:** `KeloMounts` — `src/mounts/mount-system.js`
- **Definition/profile owner:** `KeloMountCatalog` — `src/mounts/mount-catalog.js`
- **Exclusive ability content:** `src/mounts/mount-ability-data.js`
- **Mount equipment content:** `KeloMountEquipmentCatalog` — `src/mounts/mount-equipment-catalog.js`
- **Ability adapter:** `KeloMountAbilityChannel` — `src/mounts/mount-ability-channel.js`
- **Movement hook owner consumed:** `KeloMovement`
- **Ability runtime owner consumed:** `KeloAbilities`
- **Stats owner consumed:** `KeloStats`
- **Appearance owner consumed:** `KeloAppearance`
- **UI consumers:** `src/ui/mount-panel.js`, `src/ui/mount-action-bar.js`

## State ownership

`KeloMounts` owns only `STATE.mounts`:

```js
{
  schemaVersion: 1,
  equippedMountId,
  mounted,
  owned,
  equipmentByMountId,
  appearanceByMountId,
  equipmentInventory,
  revision
}
```

It does **not** own `STATE.equipped` (Stone loadout), player equipment slots, KeloAbilities effects, base movement physics, character customization or rendering.

## Definition contract

A mount definition declares stable IDs:

```js
{
  schemaVersion: 1,
  id,
  displayName,
  speciesId,
  rarity,
  movementProfileId,
  abilityIds: [m1, m2, m3],
  appearanceProfileId,
  equipmentSlotProfileId,
  assetBundleId,
  animationSetId,
  riderAnchorProfileId,
  unlockRuleId,
  tags,
  baseStats
}
```

Exactly three mount ability IDs are required. Definitions are lightweight metadata. Registering a definition does not instantiate an actor or load an image.

## Runtime flow

```text
MountDefinition
   ↓
KeloMountCatalog
   ↓
KeloMounts equipMount()
   ↓
mount() / dismount()
   ├─ KeloMovement before/after → temporary movement profile
   ├─ KeloStats → mount/player stat modifiers
   ├─ KeloMountAbilityChannel → M1/M2/M3
   │      ↓
   │   KeloAbilities existing delivery/effect runtime
   └─ KeloAppearance → outfit layer descriptors
```

The five Stone slots remain owned by `KeloStones`. They are never converted to eight slots and mount abilities are never stored as fake Stones.

## Public API

`KeloMounts` exposes:

- `equipMount(id)`, `unequipMount()`
- `mount()`, `dismount()`, `isMounted()`
- `getEquippedMountId()`, `getEquippedMount()`
- `getAbilityLoadout()`
- `getMountStats(id)`
- `equipItem(mountId,itemId)`, `unequipItem(mountId,slotId)`
- `setOutfitItem(mountId,itemId)`
- `getAppearance(mountId,direction,motion)`
- `snapshot()`, `migrateState()`
- `setAuthority(adapter)`

`KeloMountCatalog` exposes registration, lookup, query, validation, migration, MovementProfile and EquipmentSlotProfile registries.

## Ability contract

While dismounted, mount channel has zero active abilities. While mounted it has exactly M1/M2/M3. `KeloMountAbilityChannel` is an adapter; it does not duplicate delivery handlers. Current V1 uses a synchronous compatibility bridge into `KeloAbilities.engine.cast`, restoring the original Stone hotbar object immediately after the cast.

**Known debt:** the internal KeloAbilities cast event is still Stone-shaped and can emit `stoneUid:null` for a bridged mount cast. `MOUNT_ABILITY_CAST` carries the correct semantic source (`sourceType:'mount'`, `sourceId`, `mountSlot`). A future KeloAbilities internal refactor should make AbilitySource native without changing public mount IDs or creating a second engine.

## Movement

Mount movement uses `KeloMovement.before/after`. During the existing legacy movement tick it temporarily applies resolved mount speed/acceleration/braking values, then restores `CONFIG`. No second movement loop or wrapper is allowed.

## Equipment and stats

Equipment slots come from `EquipmentSlotProfile`; species need not share the same slots. Mount equipment is separate from `STATE.equipmentSlots`. Item modifiers are resolved by `KeloStats` and may target `player` or a specific `mount`.

## Appearance

Mount outfits use `KeloAppearance` profiles and items. Cosmetics do not carry gameplay stats. Anchors such as `rider`, `head`, `back`, `effectOrigin` and `shadow` live in appearance profiles/data, not `if (mountId)` code.

## Local vs online authority

Every mutation goes through the replaceable `KeloMounts.setAuthority({request})` boundary. V1 uses a local fallback for prototype play. Production authority must validate ownership, equipped mount, mount equipment, cooldowns and accepted gameplay modifiers server-side. Network payloads should transmit stable IDs/state, not full definitions or images.

## Persistence

Prototype state persists through the existing `saveState()` owner. `schemaVersion` and `revision` are present so migrations can replace this storage without changing content IDs.

## Invariants

1. Stone loadout size remains five.
2. Mount active ability count is three.
3. Equipment and appearance are separate.
4. New mount content does not require Mount Core branches.
5. No definition implies an active actor or loaded asset.
6. Gameplay mutation does not originate in UI.
7. Movement uses `KeloMovement`; abilities use `KeloAbilities`; stats use `KeloStats`.

## Extension points

Add new content by registering definitions/profiles. New cross-cutting behavior belongs in the appropriate owner (new KeloAbilities delivery primitive, KeloStats scope, KeloAppearance capability), not in a mount-ID branch.

## Correct use

```js
KeloMountCatalog.register(definition);
await KeloMounts.equipMount(definition.id);
await KeloMounts.mount();
KeloMountAbilityChannel.cast({slotIndex:0,direction:{x:1,y:0}});
```

## Anti-patterns

- `class Horse`, `class Wolf`, one class per mount.
- `if (mountId === ...)` in core.
- pushing mount abilities into `STATE.equipped`.
- adding a `MountAbilityEngine` or second movement loop.
- loading every mount asset at startup.
- changing player stats from UI/outfit code.

## Tests / CI

- `npm run audit:mounts` — definitions, 20k scale, exact 3-slot channel, Stone restoration.
- `npm run audit:stats`
- `npm run audit:appearance`
- existing Foundation/Stone/Studio audits remain required.

## Observability

`KELO_MOUNT_AUDIT` and `KELO_MOUNT_ABILITY_AUDIT` expose foundation facts. Runtime domain changes emit `KELO_MOUNT_CHANGED`, `KELO_MOUNTED`, `KELO_DISMOUNTED` and semantic mount ability events.

## Known limitations

- Real horse/wolf art bundles are not yet present, so visual mount rendering is not claimed complete.
- Server authority adapter is a boundary, not a deployed production service.
- Native generic AbilitySource inside `KeloAbilities` remains follow-up debt; V1 bridge is intentionally isolated and tested.

## Checklist for a new mount

- stable unique ID;
- existing or new reusable MovementProfile;
- exactly 3 valid mount abilities;
- valid AppearanceProfile and EquipmentSlotProfile;
- asset/animation bundle registered lazily;
- no Mount Core edits for mount-specific behavior;
- validator/audits green;
- real mobile/LIVE preview before production release.
