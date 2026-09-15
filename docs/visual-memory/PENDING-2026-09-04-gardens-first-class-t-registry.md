## Validated 2026-09-04 — Gardens T-junction atlas promoted to first-class TileRegistry ownership

- `assets/gardens-t-junctions-v1.svg` is now registered through `src/environment/gardens-t-junction-registry.js` as `KELO_TILE_REGISTRY.atlases.gardensTJunctions` (`gardens-t-junctions-v1`), a 128×32 atlas containing four 32×32 T-junction orientations.
- `gardens-compositions-v20` consumes the TileRegistry-owned atlas rather than duplicating atlas metadata locally, and `gardens-junction-overlay-v3` is the active visual owner for the authored T pieces.
- The existing Gardens density contract is unchanged: 41 declared cells and 2 T-junction placements. No movement, collision, economy, combat, networking, chat, inventory, or other gameplay system was changed.
- Validation passed on mobile at 390×844 CSS / 780×1688 physical pixels. The LIVE report recorded no console errors, failed requests, or HTTP errors, and visual inspection showed the hedge junction near the hero remaining continuous and readable without an obvious seam.
- A stale browser-cache risk was found after the overlay contract changed from v2 to v3. The `index.html` script query was bumped to `gardens-junction-overlay.js?v=3`, then the LIVE audit was repeated successfully.
- Next safe bottleneck: remove the now-dead `JT.HEDGE_T_NWS` special-case branch from `world-map.js` after proving no legacy caller still depends on it, so Gardens junction authority remains exclusively registry/composition/overlay driven.
