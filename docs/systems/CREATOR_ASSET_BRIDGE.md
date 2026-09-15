# Creator Asset Bridge V1.1 — Asset Sheet to Runtime Catalog

## Status

- owner: `Kelo Creator Asset Bridge`
- compiler: `src/creators/assets/asset-sheet-compiler.mjs`
- foreground: `src/creators/sprite-compiler/sprite-foreground-analysis.mjs`
- world profile: `src/creators/sprite-compiler/sprite-world-asset-compiler.mjs`
- semantic bridge: `src/creators/assets/kelo-creator-asset-bridge.mjs`
- runtime consumers: `KELO_ATLAS_CONTRACT` + `KELO_PROPERTY_CATALOG`
- byte transport: `CHATGPT_ASSET_UPLOAD_BRIDGE.md`
- playerVisible: false
- status: creator-local-file-bridge-v1.1-active

## Contract

El bridge toma una sheet cruda con piezas heterogéneas y produce metadata de atlas irregular. No posee bytes persistentes, renderer, World mutations ni publicación final.

Flujo:

`RAW SHEET → ANALYZE → COMPONENTS/GROUPS → REVIEW → MANIFEST → ATLAS/CATALOG → STUDIO`

## Ownership

- foreground/background: `sprite-foreground-analysis.mjs`;
- heterogeneous grouping + sourceRects: `asset-sheet-compiler.mjs`;
- anchor/footprint/scale profile: `sprite-world-asset-compiler.mjs`;
- semantic review: file bridge;
- atlas runtime: Atlas Contract;
- templates: Property Catalog;
- map placement: Studio/World/Map Forge owners.

## Semantic review rule

Names, family, category, layer, confidence and notes may change. Stable sourceRects/identity must not be silently re-cut by a semantic review.

## Forest Plaza production proof

`assets/world/plaza/forest-plaza-tileset-v2.png` is the current large real-world proof:

- image dimensions: 1448×1086;
- 146 irregular frames registered;
- stable legacy IDs `asset-001..asset-146`;
- semantic `fp_*` names;
- 7 creator categories;
- runtime manifest loaded from `src/environment/generated/forest-plaza-tileset-v2-manifest.js`;
- templates registered by `src/property/forest-plaza-asset-catalog.js`;
- Studio Asset Palette can filter the resulting templates by visual folders.

This validates the entire bridge from generated/imported bytes to placeable catalog entries without a parallel renderer.

## Categories in reference set

`plaza_core`, `architecture`, `garden_decor`, `water_features`, `terrain_paths`, `market_props`, `nature_trees_rocks`.

## Failure policy

- no foreground → zero assets / block publish;
- ambiguous semantics → review required;
- invalid review JSON → apply nothing;
- collider heuristic → review-required, never production by default;
- unsupported/oversized source → reject before decode;
- duplicate ID → preserve canonical existing identity and report conflict.

## Online boundary

Local analysis and Studio preview are drafts. Durable publication crosses existing repo/content authority. No hidden model API or browser-only publication state.

## Tests / CI

Keep `audit:asset-sheet`, documentation audit, compiler CI and runtime/catalog checks green. For mobile World integration, add real-device QA because headless success does not prove Safari memory stability.
