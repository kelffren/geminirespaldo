## Validated Gardens asymmetric framing and LIVE cache discipline — 2026-09-03

- `world-v1.9` replaces the rigid rectangular Gardens hedge frame with authored asymmetric hedge segments, corner pieces, and deliberately uneven flowerbed clusters using the existing modular Gardens atlas; the east fountain footprint remains reserved and gameplay systems are unchanged.
- Mobile LIVE at 390×844 CSS / 780×1688 canvas validated `gardensFramingMode: asymmetric-garden-framing-v1`, `fountain-connected-promenade-v2`, the layered fountain contract, and clean console/network results.
- The LIVE capture confirms that reducing repeated hedge lines and slightly lowering random flower-tuft density improves negative space and makes the fountain sector read less mechanically without requiring a new landmark.
- Audit retry loops must cache-bust the renderer subresource itself, not only the HTML URL; otherwise a single Playwright context can keep an older `world-map.js` while GitHub Pages has already deployed the new revision.
- The next visual bottleneck exposed by the mobile capture is the hard, staircase-like grass↔marble/path silhouette around Gardens. Prefer a small authored transition/edge treatment through the existing transition/TileRegistry architecture before adding more props or another landmark.
