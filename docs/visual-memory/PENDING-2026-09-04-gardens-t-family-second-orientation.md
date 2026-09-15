## Validated Gardens T-family second orientation — 2026-09-04

- Gardens compositions v18 proves a second authored T-junction orientation in the real world using the existing `gardens-t-junctions-v1` 128x32 four-orientation atlas.
- The previously validated southeast T remains at local anchor `[22,17]` using orientation `NWS`; the new southwest T is at `[5,17]` using orientation `NES`.
- The change is density-neutral: total declared Gardens cells remains `41`; fixed placements are reduced to `7` while the new T reuses cells inside the west hedge run.
- `scripts/validate-gardens-placements.mjs` remained part of the dedicated Gardens gate, and the dedicated LIVE mobile audit completed successfully after the v18 contract update.
- LIVE mobile evidence at `390x844` CSS / `780x1688` physical pixels showed the southwest T as a continuous vertical-to-horizontal hedge connection, with no visible path obstruction, no obvious seam at gameplay scale, and the player/path silhouette remaining readable.
- LIVE diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`; the authored T atlas also produced direct color evidence in the screenshot (`junctionGreen=970`, `junctionGold=38`).
- Validated direction rule: a modular atlas family is not considered world-proven merely because all variants exist in the atlas. Reuse at least more than one real orientation in composition and certify the placement on the mobile LIVE view before expanding density.
- Next technical bottleneck: T-junction ownership is still conceptually split between the old virtual `HEDGE_T_NWS` metadata in `gardens-joins.js`/world handling and the authored four-orientation overlay. Prefer consolidating T ownership into the registry/overlay path before adding more junction density.
