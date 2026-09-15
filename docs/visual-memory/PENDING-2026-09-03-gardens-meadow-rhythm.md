## Validated Gardens Meadow Rhythm — World v1.12 / 2026-09-03
- The existing eight authored 32x32 grass variants are now composed at two scales in Jardines del Sur instead of being selected uniformly tile-by-tile.
- `world-map.js` uses the existing TileRegistry district profile contract (`detailCluster=true`) to form sparse deterministic 3x3-tile meadow patches. Most garden ground draws the quieter first four grass variants; roughly one in seven macro cells draws from the more detailed upper four variants.
- This is visual-only and preserves roads, path topology, chunks, movement, collisions, economy, combat, networking, chat and inventory.
- LIVE mobile audit validated `world-v1.12` with `gardensGrassRhythmMode='registry-profile-meadow-clusters-v1'`, registry `1.11.1`, all environment assets ready, 390x844 CSS / 780x1688 canvas, and zero console, page, failed-request or HTTP errors.
- Manual screenshot inspection confirms the grass remains highly readable against ivory marble while large green fields gain a subtle medium-scale rhythm without additional prop clutter.
- Next bottleneck exposed by the same capture: the repeated single-tile hedge/flower props now look noticeably more blocky and low-detail than the hero and ground materials. Prefer a small authored multi-tile shrub/flowerbed family with stronger silhouettes and depth before increasing vegetation density.
