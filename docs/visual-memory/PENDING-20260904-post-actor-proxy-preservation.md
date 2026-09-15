## Validated 2026-09-04 — World renderer proxies preserve the formal post-actor environment contract

- The formal environment layer stack remains the owner of `drawPostActors()` and `props_front` execution.
- `engine-l.js` plaza-ground wrapping must preserve an existing `drawPostActors()` method plus `environmentLayerStack` / `postActorLayerStack` flags instead of reducing `KELO_WORLD_RENDERER` to only `draw`, `districts`, `chunkSize`, and `ready`.
- `src/environment/luxe-kiosk-atlas.js` architecture wrapping must preserve the same post-actor contract. Runtime architecture contract is `architecture-prefab-renderer-v1.5`.
- LIVE validation at 390x844 CSS / 780x1688 physical confirmed `KELO_PLAZA_AUDIT.postActorContractPreserved=true`, `KELO_ARCHITECTURE_RENDERER.postActorContractPreserved=true`, fountain `postActorBridgeAvailable=true`, and fountain `postActorBridgeRestored=false`.
- The fountain formal back/front passes continued executing after the proxy fix, with the post-actor front pass redrawing front-side actors, and the LIVE audit reported no console errors, failed requests, or HTTP errors.
- Architectural rule: any future `KELO_WORLD_RENDERER` proxy/wrapper must explicitly forward the post-actor hook and layer-stack capability flags. Do not rely on a later landmark module to repair a renderer contract that an earlier proxy discarded.
- Visual review of the certified mobile fountain and Luxe screenshots showed no new seam, ordering regression, or loss of hero readability from this architectural fix.
