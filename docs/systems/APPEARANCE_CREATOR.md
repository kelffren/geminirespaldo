# Appearance Creator

## Status

**Creator V1 candidate.** One lazy Kelo Creators workspace authors appearance items for both Character and Mount targets.

## Purpose

Provide a shared visual authoring surface instead of separate Character Outfit and Mount Outfit editors. Designers choose target/profile/slot, edit asset bundle/layer/transform metadata and drag the visual piece to author X/Y anchors.

## Owner and files

- Workspace manifest: `src/creators/workspaces/appearance-workspace.mjs`
- UI: `src/creators/ui/appearance-creator.mjs`
- Shared definition session: `src/creators/core/definition-workspace-session.mjs`
- Shared shell/importer: `definition-creator-shell.mjs`, `tabular-definition-importer.mjs`
- Runtime contract consumed: `KeloAppearance`
- Character schema adapter consumed: `KeloCharacterAppearanceAdapter`

The editor owns draft visual definitions only. It does not own gameplay stats, item ownership, character runtime state or mount runtime state.

## Flow

```text
Kelo Creators
→ Appearance workspace lazy import
→ Character | Mount target
→ compatible AppearanceProfile
→ slot + asset + transform/layer data
→ drag visual proxy for X/Y
→ KeloAppearance validator
→ shared history/checkpoint
→ export JSON
```

## V1 functions

- one target toggle: Character / Mount;
- virtualized definition list;
- NEW / DUPLICATE;
- profile and slot compatibility selectors;
- assetBundleId, rarity, tags;
- X/Y/scale/rotation/depth editing;
- direct pointer drag to change X/Y;
- CSV/XLSX import;
- undo/redo;
- local checkpoint save;
- JSON export.

## Character reuse

Before editing Character content, the workspace asks `KeloCharacterAppearanceAdapter` to register a shared Character profile from the real `KeloCharacterSlotSchema`. Character Customization remains the owner of its existing visual state and renderer.

## Spreadsheet columns

V1 understands fields including:

`id`, `displayName`, `targetType`, `slotId`, `compatibleProfiles`/`profileId`, `assetBundleId`, `x`, `y`, `scaleX`, `scaleY`, `rotation`, `depth`, `tags`, `rarity`.

Multiple compatible profile IDs can be separated by `;` or `|`.

## Preview contract

The V1 stage previews transform/anchor placement even when a declared art bundle has not yet been registered. It must not claim pixel-perfect approval from the proxy. Once real art exists, the preview service should consume the same runtime asset descriptors rather than inventing editor-only rendering rules.

## Appearance vs stats

The Creator has no stat controls. `KeloAppearance` normalization has no gameplay stat contract. Any gameplay equipment that visually references an outfit remains a separate equipment definition resolved by `KeloStats`.

## Local vs online authority

Draft/save/export are local authoring operations. Production cosmetic ownership, review and publish are pending online repository/authority concerns. Stable IDs allow that backend to be added without rewriting the editor.

## Persistence

Uses shared Studio history/checkpoint storage. It does not persist runtime player selection.

## Invariants

- one editor for Character + Mount;
- no gameplay stats in appearance items;
- compatible profile/slot required;
- heavy spreadsheet dependency remains lazy;
- large libraries use virtualized rendering;
- editing drafts never directly changes runtime state.

## Anti-patterns

- building separate CharacterOutfitEditor and MountOutfitEditor;
- hardcoding per-mount offsets in JavaScript;
- letting cosmetic drag mutate player position;
- editor-only layer ordering incompatible with runtime;
- rendering 20,000 list rows simultaneously.

## Tests / CI

`npm run audit:mount-creator` protects workspace registration, lazy boot, virtual lists and anchor drag authoring markers. `npm run audit:appearance` protects the runtime appearance schema/resolver and 20k definitions.

## Observability

Validation state is shown in the inspector. Definition session revision/history can be inspected during audits.

## Known limitations

Real mount outfit art is not yet available. Multi-direction/multi-motion pixel preview against actual atlases remains follow-up work before the editor can be called final for art production.

## Checklist for extending Appearance Creator

1. add capability to shared profile/item contracts first;
2. use runtime descriptors for preview;
3. keep changes undoable in one history operation;
4. validate before draft commit;
5. remain gameplay-stat free;
6. test Character and Mount targets plus mobile pointer interaction.
