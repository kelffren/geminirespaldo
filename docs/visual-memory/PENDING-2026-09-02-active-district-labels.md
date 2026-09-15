## Validated Active District Label Density — world-v1.5 — 2026-09-02

- Public Pixadom references reinforced a useful composition rule for mobile top-down scenes: dense props and focal points read best when circulation space stays visually quiet; persistent global labels compete with that hierarchy instead of helping it.
- `src/environment/world-map.js` now renders only the district label for the district containing the camera, rather than drawing all five labels continuously. The active label uses a compact 13px mono treatment with a restrained dark backing, thin gold accent, and ivory text.
- The change is visual-only: district geometry, roads, movement, collisions, economy, combat, networking, chat, and inventory are unchanged.
- `KELO_WORLD_AUDIT` is now `world-v1.5` and exposes `districtLabelMode: active-district-only-v1` plus `activeDistrictLabel` for LIVE verification.
- First LIVE run correctly failed because GitHub Pages/browser cache still served `world-v1.4`; `index.html` had not advanced the `world-map.js` cache key. Bumping the script URL from `?v=174` to `?v=175` fixed deployment freshness. This validates a general rule: every renderer behavior/version change must advance its HTML script cache key, not only internal atlas query keys.
- Final validation: Kelo CI passed, Pages passed, mobile LIVE audit passed at 390x844 CSS / 780x1688 canvas, `world-v1.5` was active, and console errors, failed requests, and HTTP errors were all empty.
- Next visual bottleneck visible in the validated Plaza capture: legacy round trees / debug-like world markers and NPC labels still contrast sharply with the authored plaza ground, Luxe boutique, and authored plaza-nature family. Replace or suppress these incrementally without touching gameplay semantics.
