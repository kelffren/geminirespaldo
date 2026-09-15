# Appearance System

## Status

**Foundation candidate.** `KeloAppearance` is a shared declarative appearance contract for mounts and, through an adapter, characters. Existing Character Customization remains its own state/render owner during migration.

## Purpose

Provide one reusable contract for outfit slots, compatibility profiles, anchors, directional depth and transforms without coupling cosmetics to gameplay stats. This avoids separate Character Outfit and Mount Outfit engines.

## Owner and files

- **Shared definition/resolution owner:** `KeloAppearance` — `src/appearance/appearance-system.js`
- **Character compatibility adapter:** `src/appearance/character-appearance-adapter.js`
- **Existing character state owner retained:** `KeloCharacterCustomization`
- **Existing character slot/order owner retained:** `KeloCharacterSlotSchema`
- **Mount appearance content:** `src/mounts/mount-appearance-content.js`
- **Authoring UI:** Appearance Creator workspace

KeloAppearance does not own gameplay stats, equipment ownership, inventory, character save profiles, pixels/canvas rendering or network authority.

## AppearanceProfile

Profiles describe anatomy/visual compatibility:

```js
{
  schemaVersion: 1,
  id,
  targetType: 'character' | 'mount',
  slots: [],
  anchors: {},
  depthRules: {},
  directionRules: {},
  animationRules: {},
  tags: []
}
```

Many entities can share one profile. A special anatomy may use a specialized profile without creating a new engine.

## Appearance item

```js
{
  schemaVersion: 1,
  id,
  displayName,
  targetType,
  slotId,
  compatibleProfiles: [],
  assetBundleId,
  transforms: {},
  layerRules: {},
  animationMapping: {},
  tags: [],
  rarity
}
```

Unknown fields such as gameplay `stats` are not part of the normalized item contract.

## Resolver flow

```text
AppearanceProfile + selected item IDs + direction + motion
        ↓
KeloAppearance.resolveLoadout()
        ↓
ordered layer descriptors
        ↓
existing/future render owner
```

The resolver returns data; it does not draw. Layer order is determined by profile/item rules and stable slot order.

## Public API

- `registerProfile`, `getProfile`, `listProfiles`
- `registerItem`, `getItem`, `listItems`
- `registerMany`
- `validateProfile`, `validateItem`
- `compatible(item,profile)`
- `resolveLoadout({profileId,slots,direction,motion})`
- `migrate(raw)`

## Character adapter

`KeloCharacterAppearanceAdapter.install()` builds `appearance.character.human.standard` from the actual `KeloCharacterSlotSchema.slots` and `orderFor(face)` owner. It does not duplicate a separate list of 24 slots or replace `KeloCharacterCustomization`. This is a gradual adapter boundary for shared Creator tooling and future convergence.

## Mount profiles

V1 content includes reusable horse and wolf profiles with anchors including `rider`, `head`, `back`, `effectOrigin` and `shadow`, plus direction/motion rules. Mount-specific offsets belong in profile/item data, never `if (mountId)` rendering branches.

## Equipment vs appearance

Appearance is cosmetic. Gameplay equipment may reference a visual item, but the visual item does not become the source of gameplay stats. This supports future transmog/skins and prevents changing an outfit from silently changing balance.

## Local vs online authority

Appearance state uses stable IDs. Production authority validates ownership/unlocks before accepting cosmetic changes. Network snapshots should transmit IDs/revision, not image bytes or generated canvases.

## Persistence

KeloAppearance persists nothing itself. Character and Mount owners persist selected IDs. Creator drafts use Studio storage separately.

## Invariants

1. cosmetics do not own gameplay stats;
2. profiles/slots are data-driven;
3. Character V2 is adapted, not replaced;
4. renderer consumes resolved descriptors; editor does not create a competing runtime format;
5. 20,000 item definitions do not mean 20,000 loaded textures.

## Extension points

Add target types (`pet`, `npc`, `vehicle`), slots, profiles, anchors or generic layer/animation rules through shared contracts. Do not create a new appearance engine per target.

## Correct use

```js
KeloAppearance.registerItem(item);
const layers = KeloAppearance.resolveLoadout({
  profileId:'appearance.mount.horse.standard',
  slots:{head:item.id},
  direction:'down',
  motion:'idle'
});
```

## Anti-patterns

- separate MountOutfitEngine and CharacterOutfitEngine;
- gameplay stat mutations in appearance definitions;
- per-mount hardcoded X/Y offsets;
- editor-only data format incompatible with runtime;
- loading all cosmetic textures at startup.

## Tests / CI

`npm run audit:appearance` validates compatibility, resolver output, gameplay-stat-free definitions and 20,000 registered outfit definitions.

## Observability

`profileCount` and `itemCount` expose registry size for audits. Validators return explicit errors rather than allowing bad definitions to break rendering.

## Known limitations

Real mount cosmetic art bundles are not yet in the repo. V1 Creator can author and preview transforms/anchors, but final pixel-perfect visual approval requires real transparent assets and LIVE directional animation review.

## Checklist for a new outfit/profile

- stable ID and schema version;
- correct target type and compatible profile;
- valid slot;
- lazy asset bundle ID;
- directional/layer rules only where needed;
- no gameplay stats;
- validator green;
- verify all required directions/motions on real art before release.
