# Mount Creator

## Status

**Creator V1 candidate.** Lazy Kelo Creators workspace for MountDefinition authoring. It does not publish directly to production runtime.

## Purpose

Allow designers to create/edit/duplicate/import/validate/save/export mount definitions without writing gameplay JavaScript and without creating a separate editor application.

## Owner and files

- Workspace manifest: `src/creators/workspaces/mount-workspace.mjs`
- UI: `src/creators/ui/mount-creator.mjs`
- Shared session: `src/creators/core/definition-workspace-session.mjs`
- Shared UI shell: `src/creators/ui/definition-creator-shell.mjs`
- Shared tabular importer: `src/creators/importers/tabular-definition-importer.mjs`
- Runtime schema/validator consumed read-only: `KeloMountCatalog`
- History/store reused: Studio `createHistoryManager`, `createStudioStore`
- Large list math reused: Studio `virtualRange`

The Creator owns only draft authoring state. It does not own runtime mounts, player inventory, authority or gameplay.

## Flow

```text
Kelo Creators
→ Mount workspace (lazy import)
→ snapshot lightweight runtime definitions into draft session
→ edit / duplicate / import
→ KeloMountCatalog validator
→ Studio history/checkpoint
→ export authoring JSON
```

Editing does not mutate the runtime catalog. This prevents a half-valid draft from changing LIVE gameplay.

## Functions

V1 supports:

- NEW
- DUPLICATE
- field editing
- M1/M2/M3 selection
- MovementProfile / AppearanceProfile / EquipmentSlotProfile selection
- CSV/XLSX import
- import validation summary/errors
- undo/redo
- local checkpoint save
- JSON export
- definition preview card
- virtualized left list

## Spreadsheet contract

Recommended columns:

`id`, `displayName`, `speciesId`, `rarity`, `movementProfileId`, `ability1Id`, `ability2Id`, `ability3Id`, `appearanceProfileId`, `equipmentSlotProfileId`, `assetBundleId`, `animationSetId`, `riderAnchorProfileId`, `unlockRuleId`, `tags`.

CSV is parsed locally. XLSX loads SheetJS only after the user chooses an XLS/XLSX file. The normal game boot does not load SheetJS or Creator UI.

## Import safety

Spreadsheet cells are read as values; they are not executed. Imported rows pass through normalization/validation before the draft session accepts them. Invalid rows are reported by source row and definition errors. A batch with errors is not silently committed.

## Online / publish boundary

V1 saves local draft checkpoints and exports JSON. Canonical online project repository/review/publish authority is pending. Do not turn local save into production authority.

## Persistence

Uses existing Studio checkpoint/journal storage. This is crash/recovery authoring state, not canonical gameplay state.

## Invariants

- Creator stays absent from normal `index.html` boot;
- XLSX stays lazy;
- runtime catalog is read-only source/validator while editing;
- 20k rows use virtualized rendering;
- no mount-specific JavaScript class generation;
- published data must later pass authority/review boundary.

## Anti-patterns

- standalone Mount Studio app with separate undo/storage;
- changing `KeloMountCatalog` directly on every form keypress;
- one DOM row per definition for 20k content;
- putting XLSX library in normal game startup;
- accepting unknown ability/profile IDs silently.

## Tests / CI

`npm run audit:mount-creator` checks virtualized 20k range, CSV parsing/mapping, shared undo/redo session, workspace registration and lazy Creator/XLSX boot contracts.

## Observability

Import reports expose total/valid/error counts. Draft session has revision, selected ID and history state.

## Known limitations

The visual card cannot render a premium mount sprite until a real registered mount asset bundle exists. Publish/review service is pending.

## Checklist for extending the editor

1. reuse definition session/history/store;
2. add generic fields/preview capabilities, not mount-ID conditions;
3. keep runtime mutations out of draft editing;
4. keep heavy dependencies lazy;
5. update validator/tests/docs with any schema change.
