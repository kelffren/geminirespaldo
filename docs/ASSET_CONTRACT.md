# Kelo World — Asset Contract

**Actualizado:** 2026-09-14

## Objetivo

Un asset debe poder viajar desde una imagen fuente hasta un objeto placeable sin crear renderers, catálogos o persistence paralelos.

## Pipeline oficial

`SOURCE FILE → BYTE BRIDGE/LOCAL FILE → FOREGROUND ANALYSIS → ASSET SHEET COMPILER → MANIFEST → ATLAS CONTRACT → PROPERTY CATALOG → STUDIO → WORLD PLACEMENT`

## Owners

- bytes externos hacia repo: `CHATGPT_ASSET_UPLOAD_BRIDGE.md` / workflows existentes;
- foreground/components: `sprite-foreground-analysis.mjs`;
- sheet grouping/manifest: `asset-sheet-compiler.mjs`;
- world profile: `sprite-world-asset-compiler.mjs`;
- atlas runtime: `KELO_ATLAS_CONTRACT`;
- placeable templates: `KELO_PROPERTY_CATALOG`;
- world mutation: Studio/`KELO_WORLD_EDIT`;
- render: environment/render owners existentes.

## Manifest irregular

Cada frame debe tener al menos:

- `assetId`/`frameId` estable;
- `sourceRect {x,y,w,h}`;
- familia/categoría;
- visual bounds;
- escala objetivo;
- layer sugerido;
- collider/footprint con authority explícita.

Los sourceRects son geometría fuente y no se cambian durante una revisión semántica casual.

## Identidad

No renombrar IDs persistentes de forma que rompa placements. Para Forest Plaza se conservaron `asset-001..asset-146` como identidad legacy estable y se añadieron nombres semánticos `fp_*` como metadata/catalog sourceId.

## Forest Plaza reference implementation

Atlas: `assets/world/plaza/forest-plaza-tileset-v2.png`

Clasificación actual:

- `plaza_core`
- `architecture`
- `garden_decor`
- `water_features`
- `terrain_paths`
- `market_props`
- `nature_trees_rocks`

El catálogo convierte cada frame en template placeable y Studio expone esas categorías como carpetas visuales.

## Colisión

Un frame detectado NO se vuelve automáticamente sólido. La geometría de compiler puede ser `review-required`. Props decorativos pueden ser visual-only; arquitectura gameplay debe pasar revisión explícita antes de publicar collider sólido.

## Rendering

El catálogo describe `parts` con `assetKey`, source rect, offset, size y phase. No se permiten draw paths especiales por asset salvo que el render contract lo requiera de forma generalizable.

## Publicación

Preview local/Studio no equivale a publicación durable. La publicación debe cruzar el boundary online/repo ya existente y quedar versionable.

## Anti-patrones

- segundo atlas registry;
- segundo property catalog;
- base64 gigante embebido como solución permanente;
- sourceRects recalculados sin revision;
- collider inventado por heurística y marcado como production;
- nombres `asset-###` mostrados al creador cuando existe metadata semántica;
- un PNG completo usado como “mapa” cuando en realidad se necesitan piezas reutilizables.
