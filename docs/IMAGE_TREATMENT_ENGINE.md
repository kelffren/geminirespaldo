# Kelo World — Image Treatment / Asset Compilation Engine

**Actualizado:** 2026-09-14

## Scope

Este engine transforma imágenes crudas/sheets en metadata utilizable por el juego. No genera gameplay, no posee el catálogo runtime y no renderiza el mundo.

## Owners

- `sprite-foreground-analysis.mjs` — foreground/background y connected components.
- `asset-sheet-compiler.mjs` — agrupación de piezas heterogéneas y manifest.
- `sprite-world-asset-compiler.mjs` — anchor, footprint, scale, placement profile.
- `kelo-creator-asset-bridge.mjs` — revisión semántica file-based.

## Pipeline

1. detectar transparencia o fondo dominante;
2. limpiar fondo conectado a bordes;
3. conservar outlines internos;
4. detectar componentes;
5. eliminar ruido configurable;
6. agrupar decoraciones cercanas con su asset principal;
7. ordenar y asignar IDs deterministas;
8. producir sourceRects irregulares;
9. proponer categorías/familias/anchors/footprints;
10. permitir revisión semántica sin alterar geometría.

## Forest Plaza proof

El pipeline procesó `forest-plaza-tileset-v2.png` de 1448×1086 en 146 frames irregulares. Luego el catálogo preservó IDs legacy y añadió nombres/categorías humanas.

Este caso demuestra el flujo completo compiler → manifest → atlas → catalog → Studio.

## Lo que NO hace

- no redibuja automáticamente sprites;
- no convierte heurísticas de collider en verdad gameplay;
- no publica assets por sí solo;
- no llama APIs de generación desde el browser;
- no crea un renderer adicional.

## Salida de producción

Un asset está listo cuando sourceRect, identidad, categoría, layer, escala, preview y política de collider son coherentes y la pieza puede colocarse/reabrirse desde Studio sin romper el atlas.
