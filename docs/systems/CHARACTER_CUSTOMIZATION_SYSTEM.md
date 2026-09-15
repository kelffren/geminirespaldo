# Character Customization System

## Status

**Foundation active — Character Creator V2.** Validated on merged `main` revision `035af63e3a5f7b72283659cf02454bb048ade350`: deterministic Character Customization CI passed, GitHub Pages deployed successfully, and the post-deploy mobile LIVE audit passed in portrait 390×844 and landscape 844×390 with no character missing-assets, page errors, console errors, viewport overflow or leaked `character-customizer` input lock.

## Owner and responsibility

- **Domain owner:** `KeloCharacterCustomization`
- **Slot/order contract:** `KeloCharacterSlotSchema`
- **Declarative descriptor factories:** `KeloCharacterVisualPresets`
- **Content registry:** `KeloCharacterContentPacks`
- **Pure ordered resolver:** `KeloCharacterVisualStack`
- **Avatar composition owner:** `KeloAvatar`
- **Editor UI:** `KeloCharacterCustomizer` — presentation only
- **Editor preview:** `KeloCharacterCustomizerPreview` — presentation only
- **Input lock owner:** `KeloInputLocks`

Character customization owns **visual identity only**. It does not own HP, damage, cooldowns, inventory, item ownership, combat authority, movement or PvP rules.

## Runtime flow

```text
KeloCharacterSlotSchema
        ↓
KeloCharacterCustomization
        ↓
KeloCharacterContentPacks + KeloCharacterVisualPresets
        ↓
KeloCharacterVisualStack
        ↓
KeloAvatar middleware: character-customization:modular-layers (priority 250)
        ↓
existing character/hero renderer
```

The editor calls the owner API. It never writes the state object directly. The game renderer and the editor preview both consume `KeloCharacterVisualStack` so a piece is not positioned by one implementation in the editor and another implementation in the game.

## State contract

Current normalized visual state is version 2:

```js
{
  version: 2,
  mode: 'modular',
  baseAppearanceId: 'player_hero_v1',
  outfitId: 'outfit_default',
  slots: {
    body, skinTone, face, eyes, eyebrows, nose, mouth, hair, facialHair,
    torso, legs, feet, gloves,
    head, faceAccessory, armor, back,
    weaponMain, weaponSecondary, accessory1, accessory2,
    aura, weaponSkin, characterFX
  },
  palettes: {
    // same slot keys; value is a palette ID or null
  },
  revision: 1
}
```

Old V1 state that has no `eyebrows`, `nose`, `mouth` or `palettes` is normalized without requiring a destructive migration.

## Slots and groups

### Appearance

`body`, `skinTone`, `face`, `eyes`, `eyebrows`, `nose`, `mouth`, `hair`, `facialHair`

### Clothing

`torso`, `legs`, `feet`, `gloves`

### Equipment

`head`, `faceAccessory`, `armor`, `back`, `weaponMain`, `weaponSecondary`, `accessory1`, `accessory2`

### Cosmetics

`aura`, `weaponSkin`, `characterFX`

`KeloCharacterSlotSchema` is the single source of truth for slot existence, groups, direction order and gameplay-equipment → visual-slot mapping.

## Character Asset Contract V1

Source: `KeloCharacterVisualPresets.assetContract`.

Canonical modular actor sheet:

- Canvas: **512 × 768**
- Grid: **4 columns × 4 rows**
- Frame: **128 × 192**
- Frame aspect: **2:3**
- Row 0: `down`
- Row 1: `left`
- Row 2: `right`
- Row 3: `up`
- Column 0: idle
- Columns 1–3: walk frames / compatible animation frames
- Normalized sheet anchor: `{ x: 0.5, y: 1 }`
- Foot/root alignment must remain stable between every layer in the same frame.
- Alpha must be **real transparency**. Do not depend on a white background being removed at runtime.
- Sampling: `image-rendering: pixelated` / Canvas smoothing disabled.
- Naming: `<slot>-<family>-<variant>.svg|png`
- Cache busting: `?v=<content-version>`

The contract is about grid, ratio, anchors and alignment. A future higher-resolution sheet may be supported only by extending the shared descriptor contract, not by creating a second renderer.

## Front/back and UP behavior

`KeloCharacterSlotSchema.faceOrder` defines the ordered slot stack for every face. `KeloCharacterVisualStack` resolves a piece into `back` or `front`.

When facing `up`, back/weapon rules are resolved in the shared stack. Do not duplicate UP occlusion policy inside an asset pack or UI.

## Visual descriptor API

`KeloCharacterVisualPresets` supplies:

- `source(base, file, version)`
- `sheet(source, options)`
- `socket(source, socketName, options)`
- `weapon(source, options)`
- `palette(id, name, mapping, slots, options)`

Use `sheet` for full actor-grid layers. Use `socket` for independent anchored visuals. Use `weapon` for the shared weapon socket defaults.

## Palette swapping

Palette swapping is a capability of `KeloCharacterCustomization`; there is no separate skin/hair engine.

A palette contains exact source-color → target-color mappings and optional allowed slots. Example:

```js
V.palette(
  'hair_brown',
  'Castaño',
  {
    '#263341':'#72513f',
    '#17212c':'#4a3229',
    '#0b1017':'#281c19'
  },
  ['hair'],
  { swatch:'#4a3229' }
)
```

Rules:

1. Keep highlight/base/shadow colors separate; do not use a flat tint.
2. Source images are never permanently modified.
3. Recolored canvases are cached by `source + paletteId + visual variant`.
4. Until a variant is ready, rendering safely falls back to the original source.
5. Assets with no palette remain unchanged.

## Public CharacterCustomization operations

Catalog/content:

- `registerItem`, `getItem`, `listItems`
- `registerOutfit`, `listOutfits`, `applyOutfit`
- `registerPreset`, `getPreset`, `listPresets`, `applyPreset`
- `registerPalette`, `getPalette`, `listPalettes`, `setPalette`, `clearPalette`

State operations:

- `getState`
- `select`, `clear`
- `reset`
- `applySnapshot`
- `undo`, `redo`, `canUndo`, `canRedo`
- `randomize`

Save/share:

- `listSavedProfiles`
- `saveProfile`, `loadProfile`, `deleteProfile`
- `exportCode`, `decodeCode`, `importCode`

Online bridge:

- `networkSnapshot`
- `applyRemote`
- `stateForActor`

Integration:

- `syncGameplayEquipment`
- `installRenderer`
- `previewSource`

## Presets vs outfits

A **character preset** is a sparse starting point for appearance and palette IDs. It never locks the player into that face. After applying it, every slot can still be edited normally.

An **outfit** is a sparse preset for clothing/equipment visuals. Equipping an independent helmet or weapon does not silently destroy an unrelated clothing outfit.

Both are declarative data in a ContentPack.

## Smart randomizer

`randomize()` accepts a group or groups plus `lockedSlots`. It chooses only registered, visible and unlocked content. Slot locks are UI state; they prevent the randomizer from changing that slot but do not become gameplay state or online payload.

A randomize operation commits once, so undo returns to the exact pre-randomized appearance rather than walking through every internal slot change.

## Undo / redo

CharacterCustomization keeps a bounded visual history (40 states). Mutating owner operations commit through one history boundary. History is editor/runtime fallback state, not gameplay authority and not transmitted in the network snapshot.

## Five saved characters

The local prototype supports 5 visual save slots. A save stores only:

- visual version/mode
- base appearance ID
- outfit ID
- visual slot IDs
- palette IDs

It never stores HP, stats, inventory or combat state.

Current persistence is localStorage fallback. The API boundary is intentionally separate so a future persistence adapter can store the same versioned visual record in Supabase/server storage without rebuilding the editor.

## Share/import code

Export format:

```text
KW2.<base64url visual JSON>.<checksum>
```

Import validates:

- prefix/version
- checksum
- known item IDs and matching slots
- known palettes and allowed slots

Unknown visual IDs are not executed or trusted. They produce warnings and fall back to the current known state. Share codes contain no inventory, stats or sensitive account data.

## Online-first boundary

Current network schema: `kelo-character-visual-v2`.

Payload contains only:

- schema/version
- mode
- base appearance ID
- outfit ID
- slot IDs
- palette IDs
- revision

It does **not** send images, canvases, blobs or gameplay stats.

Today the local prototype can request its own visual changes. Before production multiplayer/economy launch, the server authority must validate whether the player owns/has unlocked premium outfits, cosmetics, skins and equipment before broadcasting the accepted snapshot. The client renderer does not need to change for that migration.

## Input/modal rule

`KeloCharacterCustomizer` must acquire a token from `KeloInputLocks` when it opens and release that exact token when it closes. It must never assign `KELO_MODAL_INPUT_LOCK` directly and must not use a watchdog/interval to repair lost input.

## How to add `hair_27` without touching the engine

1. Create the asset under `src/characters/customization-assets/`.
2. Respect the Character Asset Contract: 512×768, 4×4, 128×192 frames, row directions, normalized foot/root alignment and real transparency.
3. If recolorable, draw it with stable highlight/base/shadow source colors already documented for that hair family.
4. In a content-pack file, register an item:

```js
{
  id:'hair_27',
  slot:'hair',
  name:'Nombre visible',
  group:'appearance',
  visual:V.sheet(asset('hair-27.svg'), { paletteRole:'hair' })
}
```

5. Reuse existing palette IDs or add new palettes through `V.palette(...)`.
6. Do **not** edit `KeloCharacterCustomization`, the UI, VisualStack or KeloAvatar just because a new hairstyle exists.
7. Run:

```bash
npm run audit:character
node scripts/character-customization-kit-audit.js
npm run audit:docs
```

8. For player-visible changes, wait for Pages and run/inspect the Live Character Customization Audit before calling the content validated.

## Anti-patterns

Do not create:

- `CharacterCreator2`
- `FaceEngine`
- `HairEngine`
- `SkinEngine`
- a second slot schema
- a second layer resolver
- a second avatar renderer
- UI-owned copies of visual state
- direct `renderAvatar` wrappers
- direct `KELO_MODAL_INPUT_LOCK` writes
- ContentPack polling loops

If a new feature needs a capability the owner lacks, extend the smallest existing owner API and update this document plus its audits in the same pass.

## Deterministic validation

Static/CI validation covers:

- 24 shared slots and all directional orders
- V1 state compatibility
- facial slots
- palette descriptors/fallback/cache contract
- visual-stack palette/order/UP behavior
- presets and outfits
- randomizer locks
- undo/redo
- save slots
- share/import validation
- v2 remote snapshot + legacy v1 acceptance
- Foundation-safe KeloAvatar middleware
- token input locks
- no gameplay-stat mutation
- no duplicate polling/loaders

The LIVE audit validates the mobile UI, portrait/landscape preview, real asset HTTP loading, palette rendering, close behavior and release of input control. The activation run verified 20/20 starter assets with HTTP 200, 19 palettes, 4 presets, 12 palette builds, no missing character assets, and a clean input-lock snapshot after closing the editor.
