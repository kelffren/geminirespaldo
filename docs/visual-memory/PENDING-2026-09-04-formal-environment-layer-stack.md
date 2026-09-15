## Validated 2026-09-04 — Formal environment layer stack for Gardens T-junctions

- Runtime validated on GitHub Pages at commit `a77303f0e8296c791cd5f57d3a5e4b47d194e583` with Kelo CI, Pages deployment, and Gardens mobile LIVE audit all green.
- Introduced `src/environment/environment-layer-stack.js` as `environment-layer-stack-v1`, defining formal environment phases: `ground`, `ground_variation`, `transitions`, `paths_floors`, `decals_details`, `props_back`, `props_front`, and `vfx_weather_lighting`.
- Gardens authored T-junctions are no longer drawn by a bespoke late renderer wrapper. `gardens-junction-layer-v4` registers `gardens-t-junctions` into the formal `props_back` phase while preserving TileRegistry as atlas authority.
- Mobile LIVE validation at 390×844 CSS / 780×1688 physical pixels showed the T-junctions, hero and marble paths clearly with `consoleErrors=[]`, `failedRequests=[]`, and `httpErrors=[]`.
- Keep future environment overlays moving toward this shared layer contract instead of adding new independent renderer wrappers. The next safe candidate is the district decal/details pass.
