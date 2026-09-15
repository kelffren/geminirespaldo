# Kelo World — Visual Direction Memory

## Purpose
This file is persistent project memory for the visual direction of Kelo World. Every visual/environment research, implementation, refactor, debug pass, and live audit must read this file first and update it only when a finding is validated or a design decision is intentionally changed.

## North Star
Kelo World should feel like a bright, polished, cozy top-down pixel-art MMO with the readability, color discipline, density of detail, and environmental consistency associated with high-quality browser pixel MMOs such as Pixadom, while remaining visually original and not copying Pixadom assets, layouts, characters, or proprietary art.

## Current Exterior Direction
- Daytime, optimistic, colorful world.
- Vivid grass: saturated, fresh, lively green closer to classic Pokémon readability than muted realistic grass.
- White/ivory Roman marble as an accent and navigation material, not as the entire ground plane.
- Gold used as a premium accent, not repeated on every tile.
- Roman garden/plaza language: fountains, columns, statues, planters, benches, rugs/tapestries where appropriate, trimmed gardens, flowers, water, stone borders.
- Water should be bright cyan/blue and visually animated where possible.
- Vegetation should feel lush and layered.
- Avoid giant repeated marble blocks, wallpaper-like diamonds, flat placeholder circles, and overly geometric empty layouts.

## Quality Bar
The environment must visually hold up next to the hero sprite. Placeholder-looking trees, fountains, props, or procedural primitives are not acceptable as final art.

Quality should come from:
- coherent palette;
- strong silhouettes;
- readable tile edges;
- controlled pixel clusters;
- useful shadows;
- varied but coherent ground tiles;
- multiple transition tiles;
- layered props;
- focal points;
- asymmetry and controlled irregularity;
- enough small detail to avoid emptiness without creating noise.

## Technical Tile Rules
- Logical world tile remains 32x32 unless a deliberate migration is approved.
- Environment art may use multi-tile prefabs such as 2x2, 2x3, 3x3, etc.
- Do not stretch a whole atlas as a floor texture.
- Atlas dimensions must be exact multiples of 32.
- Prefer scalable atlas architecture (1024x1024 or multiple atlases) over a hard-coded single 512x512 sheet.
- Pixel rendering should preserve crisp edges; no unintended smoothing.
- Tile IDs must be data-driven and named through a registry rather than scattered numeric magic values.

## Target Architecture
Environment rendering should evolve toward:

atlas/assets
→ TileRegistry
→ biome/environment definitions
→ Map/Zone Generator
→ render layers
→ collisions/interaction metadata
→ live renderer

Preferred render order:
1. ground
2. ground variation
3. transitions
4. paths/floors
5. decals/details
6. props_back
7. actors/NPCs
8. props_front
9. VFX/weather/lighting
10. UI

## Asset Families
The system should support multiple modular families rather than one monolithic sheet:
- ground_grass
- ground_marble
- transitions
- paths
- water
- plaza_props
- nature_props
- architecture
- interiors
- furniture
- decals
- shadows
- vfx

## Minimum Exterior Variety Target
Before calling an exterior kit premium, aim for at least:
- 8–12 grass variants;
- 6–10 marble/floor variants;
- complete straight/inner/outer grass↔marble transitions;
- path straights, turns, T-junctions, crossings, ends;
- 2+ tree families;
- several bushes/flowerbeds/planters;
- columns and statues;
- benches/lamps;
- a real multi-tile fountain;
- reusable shadow tiles;
- several small ground details/decal tiles.

## Composition Rules
- Grass should dominate outdoor scenes unless the zone intentionally calls for stone.
- Marble should guide movement and define plazas, courtyards, and important architecture.
- Premium gold accents should be sparse enough to feel special.
- Do not repeat the same ornament every 1–2 tiles.
- Important spaces need a clear focal point.
- Build scenes, not just tiled carpets.
- Use controlled clusters of props and negative space.
- Prefer irregular garden edges and small asymmetries over perfect procedural symmetry everywhere.

## Pixadom Research Principle
Use Pixadom and other strong pixel MMOs as references for:
- visual density;
- readability;
- scene layering;
- palette discipline;
- prop variety;
- mobile legibility;
- environment consistency.

Never copy exact assets, maps, distinctive proprietary characters, or layouts.

## Mobile Standard
Visual decisions must be tested at a real mobile viewport. A change is not considered visually complete until a LIVE GitHub Pages screenshot is captured and inspected.

## Mandatory Live Audit Loop
For every meaningful visual implementation:
1. inspect current repo and this memory;
2. research if needed;
3. implement the smallest meaningful improvement;
4. run syntax/tests/CI;
5. commit and push to the Pages branch;
6. wait for deployment;
7. run the mobile live screenshot audit;
8. inspect screenshot and console errors;
9. if visually or technically wrong, fix and repeat before claiming success;
10. update this memory only with validated discoveries/decisions.

## Current Priority
Kelo World is no longer allowed to remain a single polished plaza floating in a dark test grid. The world renderer must support connected districts and chunk-based expansion while preserving the plaza quality bar. After the first world scaffold is validated, the next priority is authored district identity: modular nature/architecture props, stronger landmarks, irregular path edges and controlled environmental density outside the plaza.

## Validated Architecture State — 2026-09-01
- `src/environment/tile-registry.js` is now the live source of atlas metadata, named tile IDs, reusable tile families, and transition-style metadata for the plaza renderer.
- `engine-l.js` consumes `KELO_TILE_REGISTRY` instead of owning scattered tile IDs and hard-coded atlas dimensions.
- The renderer remains on the current 512x512 production atlas for visual compatibility, but atlas width/height/columns/source are registry data, so a future 1024x1024 or modular-atlas migration no longer requires rewriting the plaza selection logic.
- LIVE mobile audit V5.43 validated the registry-driven architecture at 390x844 CSS / 780x1688 backing canvas.
- LIVE mobile audit V5.44 validated a dedicated `transitionLayer` between ground and props, with registry-driven grass↔marble edge styling, `registryVersion=1.1.0`, `sourceMode=layered-registry-v2`, `assetLoaded=true`, and `fallbackActive=false`.
- Registry `1.2.0` weighted the cleaner marble variants and separated `marbleAccent` from the broad base material pool.
- Registry `1.3.1` introduced `assets/tileset-vclean.png` with four low-noise ivory marble base tiles at IDs 80–83.
- Visual QA rule validated: asset readiness flags are necessary but not sufficient; manual LIVE screenshot inspection remains mandatory.
- Deployment rule validated: when changing atlas content or registry definitions, bump the authored asset and registry cache keys together.

## Validated Visual State — V5.45 / Registry 1.4.0
- The renderer consumes a second modular atlas, `assets/plaza-transitions-v1.png`, independently from the 512x512 ground/prop atlas.
- `plaza-transitions-v1.png` is an original 128x128 transparent overlay atlas made from sixteen 32x32 cells. The registry maps all 4-neighbour top/right/bottom/left boundary masks to authored edge/corner/multi-edge tiles.
- `engine-l.js` selects authored grass↔marble transition overlays from neighbour topology rather than procedural fill strips.
- Automatic high-contrast gold/green decorative squares were removed from the broad marble floor composition.
- LIVE mobile audit validated V5.45, registry 1.4.0, authored transitions, both atlases loaded and mobile 390x844 CSS / 780x1688 backing canvas.

## Validated Visual State — V5.46 / Registry 1.4.1
- Added `src/environment/plaza-depth.js` as a dedicated front-occlusion pass.
- Registry `1.4.1` exposes `styles.propDepth` with `mode='y-occlusion-overlay-v1'` and identifies fountain, columns, trees and lamps as front-occluding prop families.
- The pass re-renders an occluding prop above the local actor only when the actor overlaps the footprint and is behind its base-Y.
- LIVE mobile audit validated V5.46, registry 1.4.1, `depthOcclusion=true`, `depthOccluderCount=11`, authored transitions active, and mobile 390x844 CSS / 780x1688 backing canvas.

## Validated World State — V5.47 / World Renderer v1
- Added `src/environment/world-map.js` as the first expandable world-ground layer driven by the existing TileRegistry atlas families.
- The previous dark test grid outside the plaza has been replaced by atlas-authored vivid grass and ivory marble navigation surfaces across the full existing 3600x3200 world bounds.
- The world is rendered in cached 512x512 chunks, with only camera-adjacent chunks built/drawn and a 24-chunk cache cap. This establishes the first scalable map architecture without changing movement, combat, economy, networking, chat or inventory.
- Five named districts are now represented in the world scaffold: Plaza Central, Distrito Rural, Distrito Arena, Distrito Comercio and Jardines del Sur, connected by four primary marble road corridors plus district pads.
- `engine-c.js`, the documented LIVE owner of the base world/plaza rendering, now delegates the world ground to `KELO_WORLD_RENDERER` before drawing the existing farm, plot, arena, particles and actors. This preserves gameplay systems while replacing only the old dark background/grid.
- LIVE audit V5.47 validated `world-v1`, `chunkSize=512`, `districtCount=5`, `roadCount=4`, `worldWidth=3600`, `worldHeight=3200`, `assetLoaded=true`, plaza registry 1.4.1, authored transitions and depth occlusion.
- Manual inspection of the 390x844 LIVE screenshot confirms that the player is now surrounded by continuous vivid terrain and connected ivory paths rather than a plaza floating in darkness. Plaza composition remains intact.
- The audit now records failed request URLs separately from console text. In the validated run there were no `requestfailed` entries, but the pre-existing generic 404 console messages and unrelated `appendChild` page error remain.
- Research validation: current Pixadom material continues to show dense but readable environments where connected spaces, clear paths, large props and landmarks make the world feel continuous. Kelo World should use that principle without copying maps or assets.
- Next largest bottleneck: district identity. The world scaffold is intentionally simple outside the plaza; Distrito Rural, Arena, Comercio and Jardines need authored landmark/prop kits and more irregular path edges so they stop reading as the same grass field with marble corridors.

## Validated District Ground Identity — 2026-09-02 / Registry 1.5.0 / World v1.1
- `TileRegistry` now owns `styles.districtGround` with five named ground profiles plus a default profile; the world renderer no longer owns district-specific density constants as scattered rendering policy.
- `world-map.js` applies deterministic, cache-stable ground rhythms per district while preserving the same atlas families and 512x512 chunk architecture: Rural and Gardens use clustered flower details; Arena and Commerce use sparser grass details and restrained marble accents; Central remains quieter.
- This is intentionally a low-risk identity layer rather than a new art pack. It gives districts different visual rhythm without changing movement, collisions, economy, combat, networking, chat or inventory.
- LIVE audit validated registry `1.5.0`, `world-v1.1`, `districtStyleMode='district-profile-v1'`, five styled districts, all visual assets loaded, no fallback, and the existing 3600x3200 / 512-chunk world contract.
- QA finding validated: moving the audit player/camera and waiting before taking a screenshot can allow the live game loop to re-center the camera, producing a technically green but visually wrong capture. The audit now renders and serializes the off-plaza canvas immediately after positioning the camera.
- Manual inspection of the corrected 390x844 Distrito Rural capture confirms that flower details appear in controlled small clusters and the ivory route remains highly legible against vivid grass on mobile.
- The same capture exposes the next larger bottleneck: the farm/field rectangles are still large flat brown blocks and read as placeholder geometry beside the hero sprite. The next safe visual pass should replace that geometry with authored soil/crop-edge tiles or a modular rural ground/prop atlas before adding more generic grass noise.
- The known page-level `appendChild` error and a small number of generic 404 console messages persist; the validated audit recorded zero `requestfailed` entries and no Kelo world/atlas/depth errors.

## Validated Rural Soil — V5.48 / Registry 1.6.0 / Rural v1
- Added the original modular atlas `assets/rural-soil-v1.png`: 128x128, sixteen 32x32 pixel-art cells, deterministic and reproducible through `scripts/generate_rural_soil.py`.
- `TileRegistry 1.6.0` owns the rural atlas metadata, named rural tile IDs and the `authored-nine-slice-v1` plot contract instead of leaving soil colors and geometry scattered in `renderFarm()`.
- Added `src/environment/rural-ground.js`. Each former 90x90 flat brown placeholder is now a 96x96 3x3 composition with authored grass lips, corner/edge tiles, continuous furrows, sparse soil variation and pixel-art crop rows.
- Farming state and interactions remain unchanged: the same four crop records, planting timers, harvesting and rewards are used; this pass only replaces visual rendering and keeps the legacy renderer as an asset-loading fallback.
- CI validates environment JavaScript plus the rural PNG signature and exact 128x128 / 4x4 / 32px contract.
- LIVE audit validated V5.48, registry 1.6.0, `rural-v1`, `renderingMode='authored-nine-slice-v1'`, `plotSize=96`, atlas loaded, fallback disabled, existing world v1.1 and plaza transitions/depth preserved.
- Manual inspection of the corrected 390x844 Distrito Rural capture confirms that the fields now read as cultivable modular soil rather than large flat rectangles. The hero remains legible over the darker plots and the road/grass contrast is intact.
- Known unrelated state is unchanged: generic 404 console messages and the pre-existing `appendChild` page error remain; `failedRequests` is still zero and no Kelo rural/world/atlas error appeared.
- Next largest rural bottleneck: the field art now works, but the surrounding district lacks spatial storytelling. The next safe pass should add a modular fence/gate perimeter, a barn or silo landmark, a dirt approach path and sparse rural vegetation before expanding other districts.

## Validated Error Cleanup — V5.49 / 2026-09-02
- Root cause of the repeated HTTP 404 console noise was legacy `engine-h.js` probing three removed plaza JPG paths even though the live plaza is atlas-owned by `engine-l.js`. Those probes were removed while retaining the procedural fallback and HiDPI wrapper.
- The remaining static missing path was a lowercase `assets/hero.png` retry while the production file is `assets/hero.PNG`; the nonexistent retry was removed and CI now rejects reintroducing it.
- The page-level `appendChild` crash came from `showToast()` targeting a nonexistent `#toast-container`, commonly triggered when timed farm/animal rewards matured during audit. `index.html` now owns the styled live region and `showToast()` also creates it defensively if absent.
- Added a data-URI favicon so browsers no longer request a missing `/favicon.ico`.
- The LIVE audit now performs a clean final reload after deployment convergence, records exact HTTP status URLs, failed request URLs and full page-error stacks, and fails on any entry in those buckets rather than tolerating generic errors.
- LIVE V5.49 validation passed with `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`; CI and Pages deployment also succeeded. The V5.48 rural rendering, registry 1.6.0, world v1.1 and plaza transition/depth contracts remain intact.
- Quality gate: no future visual round is complete if the clean final LIVE diagnostic report contains any console, page, failed-request or HTTP error.

## Validated Rural Boundary & Road Clearance — Registry 1.7.1 / Rural v2.1 / 2026-09-02
- Added original `assets/rural-props-v1.png`, a 128x128 modular 32px atlas for wooden fence segments, corners, open/closed gates, field sign, damaged fence, dirt-path cells and sparse rural details. `TileRegistry` owns the atlas and named IDs rather than scattering prop coordinates through the renderer.
- `rural-ground.js` now draws a modular fence perimeter around the existing farm without altering farm state, planting, harvesting, movement or collisions. The final gate faces north with a one-tile dirt threshold toward the navigation route.
- Manual inspection of the first LIVE fence capture found a composition defect that readiness flags did not catch: the original 128px horizontal marble corridor crossed directly beneath the farm and the south dirt approach formed an oversized rigid T. That version was not accepted as final.
- `world-map.js` now uses `ruralRoadMode='farm-bypass-v1'`: the rural ivory branch runs above the farm and turns around its east edge before rejoining the main corridor. This changes visual ground geometry only; gameplay coordinates remain unchanged.
- The corrected LIVE 390x844 capture shows the four modular plots fully on grass, a legible wooden perimeter, a north-facing entrance adjacent to the ivory road and no marble running underneath crop beds.
- LIVE pixel evidence recorded 15,165 wood-colored pixels and 25,345 dirt-colored pixels in the rural frame, proving the new prop family is actually rendered on mobile rather than merely loaded.
- Registry `1.7.1`, rural `v2.1`, `world-v1.1`, 512px chunks, five districts, authored plaza transitions and depth occlusion all remained active. Final diagnostics again passed with `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Validated composition rule: roads and district props must be checked against existing gameplay footprints before approval; visual ground should route around established interactive areas rather than visually slicing through them.
- Next rural bottleneck: the district now has a readable field boundary but still lacks a strong vertical landmark and layered edge density. A compact barn/silo cluster plus a restrained tree/hedge family is the next safe improvement; avoid adding generic noise to the central field.

## Validated World Road Transitions — World v1.2 / Registry 1.10.0 / 2026-09-02
- `src/environment/world-map.js` now reuses the existing authored `assets/plaza-transitions-v1.png` atlas and `TileRegistry.transitionMasks` for world-road edges instead of ending marble roads as hard binary rectangles against grass.
- Each road tile computes the same top/right/bottom/left neighbour mask used by the plaza and draws the authored transition overlay after the base marble tile. The mask queries global world coordinates, so edge decisions remain coherent across cached 512px chunk boundaries.
- The change is visual-only: road rectangles, district coordinates, movement, collisions, farm state, combat, economy, networking, chat and inventory were not changed.
- The visual commit `8aa7d10828c8c4480f1f46129a774dfac9f701a9` passed Kelo CI. The audit infrastructure was then aligned with the current world contract in `c6c300dd233052597a73fd1e71e8d8471d6b89cb` because the previous LIVE gate still waited for the obsolete `V5.56`/depth contract.
- GitHub Pages deployment for the aligned audit commit succeeded. LIVE mobile validation passed at 390x844 CSS / 780x1688 backing canvas with `world-v1.2`, `transitionAssetLoaded=true`, `roadTransitionMode='authored-road-edge-overlay-v1'`, five districts, 512px chunks and registry `1.10.0`.
- Final LIVE diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Manual inspection of `live-road.png` confirms that horizontal and vertical ivory routes now have an authored grass↔marble pixel edge rather than a perfectly hard rectangular boundary. Intersections remain easy to read, the hero silhouette remains clear, and no visible chunk seam appears in the inspected frame.
- The same screenshot exposes the next largest environment bottleneck: several legacy district buildings still read as large flat wall rectangles with simple polygon roofs/windows and labels, substantially below the hero and ground quality bar. The next safe pass should replace one high-visibility legacy building family with an authored modular architecture atlas/prefab and proper back/front depth layers rather than adding more grass noise.

## Validated Authored Architecture Depth — V5.65 / Registry 1.10.1 / 2026-09-02
- `TileRegistry` now owns an `architectureAssets` family and the `styles.architecture` contract. The existing authored Kelo Luxe boutique raster is registered as architecture rather than being hard-coded only inside its renderer.
- `src/environment/luxe-kiosk-atlas.js` keeps the same authored artwork, world footprint, interaction and collision, but adds actor-specific front occlusion with `depthMode='building-base-y-occlusion-v1'`. Only the actor-sized clipped region is repainted above actors that are physically behind the building, so foreground actors are not accidentally hidden.
- The change is visual/render-layer only: movement, collision geometry, farming, combat, economy, networking, chat and inventory were not modified.
- Commit `47e048f604bd036edc9ec7ff7037878852543cca` passed Kelo CI and GitHub Pages deployment.
- LIVE mobile validation passed at 390x844 CSS / 780x1688 backing canvas with `world-v1.2`, registry `1.10.1`, architecture mode `authored-layered-raster-v1`, `depthWrapped=true`, `depthOcclusion=true` and `architectureOccluding=true` in the dedicated behind-building capture.
- Final LIVE diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Manual inspection of `live-architecture.png` confirms that the player's body is correctly hidden by the boutique volume while the authored facade remains crisp and intact. The name label remains visible, which preserves multiplayer identification without flattening the building depth cue.
- The same capture makes the next largest bottleneck unambiguous: the adjacent legacy brown building still reads as a flat placeholder rectangle with a simple window and roof, far below the authored boutique, hero and ground quality. The next safe pass should replace one legacy architecture family with an authored modular facade/prefab through the new architecture registry contract, rather than adding more ground decoration.

## Validated Authored Market Pavilion — V5.67 / 2026-09-02
- Added original `assets/market-pavilion-v1.png`, a 224x160 authored pixel-art architecture asset using an ivory-stone facade, dark green roof, restrained gold trim, teal glazing, striped awnings and small planters. It replaces one high-visibility flat south-plaza obstacle visually without copying any external reference art or layout.
- The existing gameplay collider remains exactly `{x:1300,y:1870,w:200,h:80}`. The integration only marks overlapping legacy obstacle visuals `noDraw`; it does not resize, remove or relocate collision geometry and does not alter movement or other gameplay systems.
- `src/environment/luxe-kiosk-atlas.js` renders the pavilion through the existing world architecture layer and applies `building-base-y-occlusion-v1` using actor-sized clipped repaint, matching the already validated boutique depth pattern.
- The first dedicated LIVE check found a brittle certification bug: the pavilion was visible and occluding, but `legacyHidden` required an exact obstacle match and remained false. The integration was hardened to suppress any visible legacy obstacle overlapping the preserved pavilion collider while leaving its geometry untouched.
- Deployment QA finding: changing a visual JS module without bumping its query key can make a long-lived mobile audit context observe an old cached script even after Pages updates. `index.html` now loads the hardened pavilion module with a new cache key; future visual module changes should bump their deployed query key deliberately.
- Final Kelo CI for V5.67 succeeded, GitHub Pages deployment succeeded, and the dedicated LIVE mobile audit succeeded at 390x844 CSS / 780x1688 backing canvas.
- LIVE runtime contract validated `authored-market-pavilion-v1.1`, `ready=true`, `rendererWrapped=true`, `depthWrapped=true`, `legacyHidden=true`, `failed=false`, and `depthMode='building-base-y-occlusion-v1'`.
- Exact-color screenshot evidence recorded 28,040 stone pixels, 23,320 roof pixels, 10,695 gold pixels and 14,477 glass pixels, proving that the authored pavilion is actually rendered on mobile rather than only loaded.
- Final diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Manual inspection of `live-market-pavilion.png` confirms a readable building silhouette on mobile, a clear entrance aligned to the ivory route, no visible flat legacy bar over the facade, and correct character/building depth with the actor partially obscured by the roof when behind it.
- Next bottleneck: architecture is still split between one TileRegistry-owned boutique and a second authored pavilion whose asset metadata remains local to its renderer. The next safe technical/visual pass should formalize a reusable `architectureAssets` family in TileRegistry for multiple prefab types, then migrate another remaining flat legacy obstacle through that data-driven path instead of adding more one-off wrappers.

## Validated Architecture Prefab Registry — V5.68 / Registry 1.10.2 / 2026-09-02
- `TileRegistry` now owns both the market pavilion asset metadata and its placement/collision metadata through `architectureAssets.marketPavilion` and `architecturePrefabs.marketPavilion`.
- The architecture contract is now explicit as `registry-asset-placement-collision-v1`; the pavilion renderer consumes its asset path, world position, dimensions, base-Y and preserved gameplay collider from the registry instead of duplicating those values locally.
- The visible building and gameplay footprint were intentionally unchanged. The preserved collider remains `{x:1300,y:1870,w:200,h:80}` and the authored raster remains 224x160 at world position `(1288,1790)`.
- Kelo CI and GitHub Pages both passed for commit `7d6897443017933b5841e68a6c829ebb86d91655`.
- LIVE mobile audit passed at 390x844 CSS / 780x1688 backing canvas with registry `1.10.2`, `world-v1.2`, architecture prefab contract active, pavilion source `tile-registry-architecture-prefab`, `prefabId='market-pavilion-south'`, `occluding=true`, `legacyHidden=true`, and no runtime geometry divergence from the registry.
- Screenshot evidence remained identical in authored material coverage: 28,040 stone pixels, 23,320 roof pixels, 10,695 gold pixels and 14,477 glass pixels. Manual inspection confirms the pavilion remains crisp, centered on the ivory route and correctly occludes the actor behind its roofline.
- Final diagnostics remained clean: `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Validated technical direction: future authored buildings should be represented as TileRegistry asset + prefab placement/collision metadata rather than each renderer owning duplicated hard-coded geometry.
- Next bottleneck: the Luxe boutique asset is registry-owned but its placement/collision/interact geometry is still local to `luxe-kiosk-atlas.js`. The next safe refactor is to migrate that boutique into the same prefab contract, then extract a generic architecture renderer/list so future legacy-building replacements do not each add another wrapper.

## Validated Luxe Architecture Prefab — V5.69 / Registry 1.10.3 / 2026-09-02
- `TileRegistry` now owns Kelo Luxe placement, preserved collider, interaction anchor/radius and occlusion thresholds through `architecturePrefabs.luxeBoutique`, using the same `registry-asset-placement-collision-v1` architecture contract as the market pavilion.
- `src/environment/luxe-kiosk-atlas.js` consumes the prefab instead of duplicating boutique world coordinates, collision geometry and interaction geometry locally. The authored asset, world position `(1248,1050)`, collider `{x:1272,y:1362,w:336,h:132}`, interaction anchor `(1440,1532)` / radius `220`, and existing depth behavior were intentionally preserved.
- Kelo CI passed for the deployed migration. GitHub Pages deployment for the aligned final audit commit `42f175fa63f72d71daf07181528c56517a38b90c` also passed.
- The first LIVE run correctly reached V5.69 / registry 1.10.3 with clean runtime diagnostics but failed because `scripts/live-world-audit.mjs` still required the obsolete boutique source string `tile-registry-architecture-asset`. The runtime was healthy; the certification contract was stale. The audit was corrected to require `tile-registry-architecture-prefab` and `prefabId='luxe-boutique-central'`, then rerun.
- Final LIVE mobile validation passed at 390x844 CSS / 780x1688 backing canvas. Both world and dedicated architecture-prefab audit steps passed with registry `1.10.3`, `world-v1.2`, `source='tile-registry-architecture-prefab'`, `prefabId='luxe-boutique-central'`, `ready=true`, `rendererWrapped=true`, `depthWrapped=true`, and boutique `occluding=true`.
- The dedicated audit additionally verifies that boutique runtime asset, position, collider and interaction geometry are identical to `TileRegistry` values; the market pavilion prefab remains valid in the same run.
- Final diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Manual inspection of `live-luxe-prefab.png` confirms no visual regression: the large Kelo Luxe silhouette remains crisp and centered on the ivory route, the doorway/detail remains readable on mobile, and the player/depth relationship remains intact. The adjacent flat brown legacy building is still visibly below the authored architecture quality bar.
- Current architecture bottleneck: boutique and market pavilion now share registry-owned prefab metadata, but rendering/depth installation is still duplicated as separate wrappers in `luxe-kiosk-atlas.js`. The next safe technical pass should extract a generic authored-architecture prefab renderer/list while preserving per-prefab interaction hooks; after that, migrate another visible legacy building through the common path.

## Validated Generic Architecture Prefab Renderer — V5.70 / Registry 1.10.4 / 2026-09-02
- `src/environment/luxe-kiosk-atlas.js` now renders all registered authored architecture prefabs through one list-driven world wrapper and one shared depth wrapper instead of nesting one wrapper per building.
- `TileRegistry 1.10.4` owns the remaining per-prefab occlusion and actor-clip thresholds for both Kelo Luxe and the Market Pavilion; `styles.architecture.rendererMode='generic-prefab-list-v1'` makes the shared path explicit.
- `window.KELO_ARCHITECTURE_RENDERER` validated `mode='generic-prefab-list-v1'`, `prefabCount=2`, `ready=true`, `rendererWrapped=true` and `depthWrapped=true`. Existing boutique interaction/collision hooks and both authored asset placements were preserved.
- Implementation commit `c7b67bb892895ea35bfd77e038c0c912f1bebdfa` passed Kelo CI. The first LIVE run failed only because `.github/workflows/live-audit.yml` still forced `EXPECTED_REGISTRY=1.10.3`; runtime had already reached `V5.70 / 1.10.4` cleanly. Commit `573ae012925fc8acbc1bf8fb4d8b4af9b739f8f0` aligned that certification contract.
- The corrected Kelo CI, GitHub Pages deployment and LIVE mobile audit all passed. LIVE validated `world-v1.2`, registry `1.10.4`, two active authored prefabs, boutique occlusion and market occlusion, plus `legacyHidden=true` for the pavilion.
- Final diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]` at 390x844 CSS / 780x1688 backing canvas.
- Manual inspection of `live-architecture.png` confirms Kelo Luxe remains crisp with its existing depth behavior. Manual inspection of `live-market-pavilion.png` confirms the market silhouette/entrance remain intact and the actor is correctly hidden behind the roof volume with only the upper head visible at the boundary; no legacy rectangle reappeared.
- Validated technical direction: future authored architecture should be added primarily as `architectureAssets + architecturePrefabs` data, with interaction hooks only where needed, rather than installing new world/depth wrappers.
- Next largest visual bottleneck: the flat brown legacy building still visible beside Kelo Luxe is now the clearest quality mismatch. The next safe pass should replace that one building/family with an original authored modular architecture prefab through the shared renderer, preserving its current gameplay footprint rather than adding more ground noise.


## Validated Architecture Depth Regression Guard — V5.76 / Registry 1.10.10 / 2026-09-02
- The LIVE workflow now derives `EXPECTED_REGISTRY` directly from `src/environment/tile-registry.js` instead of carrying a hard-coded registry version. This prevents certification drift when TileRegistry advances.
- The stricter gate immediately exposed a real Kelo Luxe regression introduced during the native-resolution PNG migration: the boutique prefab still advertised depth support, but its `occlusion` metadata had become `null`, so the shared architecture renderer loaded cleanly while `architectureOccluding=false`.
- Restored scale-adjusted TileRegistry occlusion metadata for the current native 192x222 Kelo Luxe asset: `sideInset=9`, `topInset=40`, `bottomPadding=4`, with actor clip padding `7/24/7`. Placement, interaction and gameplay collider were not changed.
- Registry advanced to `1.10.10` and the TileRegistry script cache key was bumped so GitHub Pages/mobile clients cannot retain the stale no-occlusion contract.
- Final deployed runtime commit `97c347b9321bb56828c202afa6a6bcda8ce88aac` passed Kelo CI, GitHub Pages and the complete LIVE mobile audit at 390x844 CSS / 780x1688 backing canvas. The audit validated `architectureOccluding=true`, `marketOccluding=true`, three registry-driven architecture prefabs, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of the LIVE architecture and Luxe captures confirms that the player is again partially hidden by the boutique volume when physically behind it while the authored PNG remains crisp and readable.
- QA rule validated: audit expectations should come from the deployed source contract where possible, because a stale expected-version constant can hide newer runtime regressions instead of certifying them.
- Next largest visual bottleneck remains the flat brown legacy Mercado building directly beside/behind Kelo Luxe. It should be replaced through the existing `architectureAssets + architecturePrefabs` generic renderer while preserving its gameplay footprint.


## Validated Legacy Facade Ownership + LIVE Deployment Gate — V5.78 / 2026-09-02
- Manual inspection of the genuinely deployed V5.77 architecture capture proved that `legacyBrownPlaceholdersRemoved=true` was insufficient: a brown `Mercado` facade was still visibly drawn behind Kelo Luxe even though the matching obstacle rectangles had been removed.
- Repository-wide source inspection located the true visual owner in `engine-y.js`; it draws four late legacy facades (`Mercado`, `Banco`, `Atelier`, `Café Oro`) after the world renderer. Collision removal in `luxe-kiosk-atlas.js` therefore cannot remove these visuals.
- V5.78 adds a visual-only authored-overlap rule in `engine-y.js`: legacy facades are suppressed only when at least 35% of their area is covered by the current Kelo Luxe prefab bounds from TileRegistry. This suppresses `Mercado` and `Atelier` while leaving `Banco` and `Café Oro` visible. Gameplay collision, movement, interaction and unrelated systems are unchanged.
- The LIVE audit now explicitly certifies `KELO_LEGACY_HOUSE_RENDERER`, requiring `Mercado` and `Atelier` in `suppressedTitles` and absent from `visibleTitles`. The final V5.78 audit passed at 390x844 CSS / 780x1688 backing canvas with registry `1.10.10`, architecture renderer `v1.3`, boutique and market depth occlusion active, and zero console, failed-request or HTTP errors.
- Manual inspection of `live-architecture.png` confirms the prior brown Mercado/Atelier geometry and labels are gone from behind Kelo Luxe; the authored boutique is now visually isolated and readable against grass/marble.
- A separate QA defect was also validated and fixed: a LIVE run had previously passed while GitHub Pages still served V5.76 / architecture renderer v1.2. Both LIVE auditors now derive and require the source build title plus architecture renderer version/mode, in addition to TileRegistry, so stale Pages deployments cannot certify a newer visual change.
- Current next architecture bottleneck: `Banco` and `Café Oro` remain late procedural/legacy facades. Replace one with a registry-driven authored prefab using the generic architecture renderer rather than broadening the suppression rule.


## Validated Banco Authored Prefab + Registry-Driven Legacy Suppression — V5.80 / Registry 1.10.11 / 2026-09-02
- Current Pixadom research reinforces replacing old placeholder spaces with authored destinations before adding indiscriminate environmental noise: its 2026 roadmap prioritizes environmental design/furnishing, decorative-object variety and mobile camera improvements, and its June 27, 2026 update explicitly replaces one of its oldest placeholder interiors with a complete authored shop. Use this as a density/readability/consistency reference only; do not copy assets or layouts.
- Added original static authored architecture asset `assets/banco-hall-v1.svg`, a crisp 160x128 pixel-style bank hall using ivory stone, dark green/teal roof massing, cool glass and restrained gold accents. It is data-driven through `architectureAssets.bancoHall` + `architecturePrefabs.bancoHall`.
- TileRegistry advanced to `1.10.11`. `banco-hall-central` preserves the exact prior Banco gameplay collider `{x:1664,y:1376,w:128,h:96}` and uses the existing generic architecture renderer/depth contract; movement and unrelated gameplay systems were not changed.
- `engine-y.js` legacy-facade suppression is now driven by all `legacyVisualReplacement` architecture prefabs instead of Kelo Luxe alone. The old public audit version/mode strings remain temporarily for backward certification compatibility, while `coverageSource='registry-prefabs-v1'` records the generalized source.
- Final deployment commit `39518f648805554e06ddeb923805c54465d3b112` passed Kelo CI and GitHub Pages. LIVE mobile audit also passed at 390x844 CSS / 780x1688 backing canvas with title `Kelo World — V5.80`, `world-v1.2`, registry `1.10.11`, architecture renderer `architecture-prefab-renderer-v1.3`, `prefabCount=4`, `ready=true`, and both render/depth wrappers active.
- LIVE runtime reported `suppressedTitles=['Mercado','Banco','Atelier','Café Oro']` and `visibleTitles=[]`. This is valid rather than accidental blanking: the generalized overlap check suppresses each late procedural facade only where a registry-authored replacement covers at least 35% of it; Kelo Luxe, Banco Hall and Commerce Arcade provide the corresponding authored coverage.
- Final diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`; boutique and market depth captures remained occluding.
- Manual inspection of `live-mobile.png` confirms Banco is visibly present near the bottom of the 390px mobile viewport as a readable ivory/green landmark with windows, central doorway and gold detail; paths and hero sprites remain legible. Manual inspection of `live-architecture.png` confirms Kelo Luxe remains intact with no legacy brown facade reappearing.
- Error corrected during integration: generalizing the legacy facade renderer initially changed its audit-facing version/mode identifiers and would have failed the existing LIVE contract despite healthy rendering. The generalized implementation now preserves those historical identifiers while exposing `coverageSource='registry-prefabs-v1'`, and the final CI/Pages/LIVE sequence passed.
- Next visual bottleneck: architecture now covers the visible late legacy facades, so the next pass should stop replacing placeholders blindly and improve authored-building quality/variety itself—especially roof volume, corner modules and facade modularity for Commerce Arcade/Banco—while keeping the common TileRegistry prefab renderer and mobile readability.


## Validated Banco Hall Silhouette — V5.81 / Registry 1.10.12 / 2026-09-02
- `assets/banco-hall-v1.svg` keeps the existing 160x128 authored asset footprint and unchanged gameplay collider `{x:1664,y:1376,w:128,h:96}`, but now uses a stepped hip roof, central pediment, corner caps, deeper eaves and asymmetric window highlights to reduce the previous flat-box silhouette on mobile.
- `TileRegistry 1.10.12` cache-busts Banco Hall as `assets/banco-hall-v1.svg?v=2`; architecture remains registry-driven through the generic prefab renderer and no movement, collision, economy, combat, networking, chat or inventory behavior changed.
- LIVE V5.81 validation passed at 390x844 CSS / 780x1688 backing canvas with `world-v1.2`, four architecture prefabs, architecture renderer `architecture-prefab-renderer-v1.3`, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of `live-mobile.png` confirms Banco Hall is visible at the bottom of the mobile frame and the roof now has a stronger tiered silhouette and central crown while the entrance remains aligned and readable.
- QA gap fixed: `.github/workflows/live-audit.yml` now watches `assets/banco-hall-v1.svg` directly, so future Banco art-only edits cannot bypass the mobile LIVE audit.
- Next largest bottleneck: Commerce Arcade remains a tall, long rectangular mass; the next safe visual pass should add modular roof/end-cap variation or split its facade rhythm without changing the existing gameplay footprint.


## Validated Commerce Arcade Silhouette — V5.82 / Registry 1.10.13 / 2026-09-02
- Current Pixadom reference still supports the same useful rule for Kelo World: dense authored social spaces remain readable because landmarks, paths, vegetation clusters and facade modules have distinct silhouettes rather than relying on uniform surface noise. Eldria's current 2026 presentation similarly emphasizes recognizable regions/landmarks in a top-down pixel world. These are density/readability references only; no art or layout was copied.
- `assets/commerce-arcade-v1.svg` was refined in place without changing its 160x432 asset bounds, world placement, 120x400 gameplay collider, interaction systems or renderer architecture.
- The arcade now uses stepped roof masses, wider terminal caps, inset roof planes, alternating facade projections/shop-bay widths, structural piers and sparse west-edge garden pockets. This breaks the former single long slab rhythm while preserving the existing registry-driven prefab contract.
- `TileRegistry` advanced to `1.10.13` and cache-busts the arcade asset as `assets/commerce-arcade-v1.svg?v=2`; the page build advanced to V5.82 and the registry script cache key was bumped with it.
- Kelo CI, GitHub Pages and the LIVE mobile screenshot audit all passed for commit `5931aced856be08b45482f52b750237879c0a5d0`.
- LIVE 390x844 CSS / 780x1688 canvas validation confirmed `world-v1.2`, architecture renderer `architecture-prefab-renderer-v1.3`, four prefabs, active arcade occlusion, registry/runtime geometry agreement, and zero console, failed-request or HTTP errors.
- Manual inspection of `live-commerce-arcade.png` confirms the new stepped end caps and alternating facade bays are legible on mobile and the arcade no longer reads as one completely uniform vertical rectangle. The large central roof mass is still visually heavy, so further improvement should come from modular courtyards/recesses or stronger side-volume segmentation rather than adding generic grass noise.
- Next visual bottleneck: the Commerce Arcade still occupies a very large continuous roof area compared with Kelo Luxe and Banco. A safe next pass should test one or two registry-driven roof/courtyard modules or facade recesses that preserve the exact collider and renderer contract, then re-audit mobile composition.


## Validated Commerce Arcade Courtyard — V5.83 / Registry 1.10.14 / 2026-09-02
- Commerce Arcade keeps the exact 160x432 authored asset footprint and the existing registry prefab placement/collision contract `{x:1530,y:1400,w:120,h:400}`; no gameplay coordinates, movement, networking, combat, economy, chat or inventory systems changed.
- Added a west-side stone-framed garden courtyard/recess in the central run, with restrained planting and a small water/fountain cue. The goal is to break the long continuous roof mass with one readable authored sub-space rather than add generic surface noise or another renderer special case.
- The asset is served as `assets/commerce-arcade-v1.svg?v=3`; TileRegistry is `1.10.14`; the live page contract is V5.83 and continues to use `architecture-prefab-renderer-v1.3` / `authored-prefab-no-legacy-buildings-v1`.
- LIVE mobile validation passed at 390x844 CSS / 780x1688 canvas. Commerce Arcade was ready, legacy replacement remained active, architecture and market occlusion remained active, and the final diagnostic report contained `consoleErrors=[]`, `failedRequests=[]`, and `httpErrors=[]`.
- Manual inspection of `live-commerce-arcade.png` confirms that the central green/ivory courtyard reads clearly at mobile scale and creates a strong pause in the formerly continuous dark-green mass while the ivory/glass shop frontage stays legible. It currently reads more like an inset roof garden than true negative-space architecture, so further carving should be incremental rather than enlarging it blindly.
- Research validation: Pixadom's current 2026 roadmap continues to prioritize environmental design/furnishing, decorative layout variety and mobile-facing improvements, while its June 27, 2026 update describes replacing an old placeholder interior with a fully authored destination. The transferable principle for Kelo World is to use small authored sub-spaces and clear landmarks to create density without noise, never copying Pixadom art or layouts.
- Next bottleneck: the east ivory/glass frontage of Commerce Arcade still repeats five vertically similar shop bays and reads more mechanically than the new west-side courtyard. The next safe pass should vary 1–2 frontage modules or add a small entrance canopy/signage hierarchy through the existing asset/registry contract, without changing the collider or generic architecture renderer.

## Validated Commerce Arcade Entrance Hierarchy — V5.84 / Registry 1.10.15 / 2026-09-02
- Current public Pixadom material still supports a browser/mobile-first readability rule: environmental density works best when important destinations and modules are easy to distinguish at a glance; its roadmap continues to emphasize environmental design/furnishing and mobile camera usability. Eldria's current top-down presentation similarly leans on recognizable region/landmark silhouettes. These are reference principles only; no external art or layout was copied.
- `assets/commerce-arcade-v1.svg` keeps its exact 160x432 asset bounds, world placement and preserved gameplay collider `{x:1530,y:1400,w:120,h:400}`. The existing generic architecture renderer and all unrelated gameplay systems remain unchanged.
- The previously equivalent central storefront was replaced by a taller double-door entrance with a dark-green canopy, ivory crown and restrained gold threshold/signage. The purpose is to establish one obvious primary entrance at mobile scale without increasing facade noise or creating another renderer special case.
- TileRegistry advanced to `1.10.15` and cache-busts Commerce Arcade as `assets/commerce-arcade-v1.svg?v=4`; the deployed page contract advanced to V5.84.
- Kelo CI passed all key-file, server-syntax and environment/visual-contract checks. The LIVE mobile workflow then waited for Pages convergence and passed both the world audit and dedicated authored-architecture audit.
- LIVE validation at 390x844 CSS / 780x1688 backing canvas confirmed `world-v1.2`, registry `1.10.15`, architecture renderer `architecture-prefab-renderer-v1.3`, four prefabs, arcade `ready=true`, arcade occlusion active, asset source `assets/commerce-arcade-v1.svg?v=4`, and unchanged runtime prefab/collider geometry.
- Final diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Manual inspection of `live-commerce-arcade.png` confirms the central frontage now has stronger entry hierarchy: the double doors/canopy read as a distinct destination while the courtyard and stepped roof still provide the larger massing breaks. The building remains visually dense but readable on the 390px mobile frame.
- Next bottleneck: the Arcade's lower and upper shop modules still share very similar glass proportions and gold strips. The next safe improvement should vary one secondary bay family or introduce a small corner/end-cap facade module, preserving the current collider and common registry-driven renderer.


## Validated Commerce Arcade Secondary Bay Family — V5.87 / Registry 1.10.16 / 2026-09-02
- Current public Pixadom material continues to support a browser/mobile-first environment rule: finish authored environmental design/furnishing and use decorative/layout variety to distinguish destinations rather than adding uniform noise. Its current roadmap also keeps mobile usability in scope. These are reference principles only; no external art or layout was copied.
- `assets/commerce-arcade-v1.svg` keeps its exact 160x432 asset bounds, world placement and preserved gameplay collider `{x:1530,y:1400,w:120,h:400}`. No movement, economy, combat, networking, chat, inventory or renderer behavior changed.
- The Arcade frontage now has two secondary shop-bay families: broad teal vitrines at the terminal bays and inset intermediate storefronts with ivory canopies plus restrained green/gold valances. The existing central primary entrance remains the strongest hierarchy point.
- TileRegistry advanced to `1.10.16`, serving the Arcade as `assets/commerce-arcade-v1.svg?v=5`; the deployed page contract is V5.87.
- The first V5.87 Kelo CI failed because its UI certification still required obsolete `luxe-shell-v2.0` / `forest-ivory-gold` strings after concurrent shell work had already moved to v3. The runtime visual change was healthy. The CI contract was minimally aligned to `kelo-luxe-v3-style` and `--lx-forest:#173f36`; the corrected Kelo CI and GitHub Pages build both passed.
- LIVE mobile validation passed at 390x844 CSS / 780x1688 backing canvas with `world-v1.2`, registry `1.10.16`, architecture renderer `architecture-prefab-renderer-v1.3`, four prefabs, Arcade asset `?v=5`, intact collider geometry and active occlusion.
- Final diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Manual inspection of `live-commerce-arcade.png` confirms the intermediate canopy/inset modules are distinguishable from the wider terminal vitrines on mobile while the courtyard and primary entrance remain readable. No missing asset, seam or depth regression was visible.
- Next bottleneck: Commerce Arcade now has better storefront rhythm, but its top/bottom terminations still read as the same long vertical family. The next safe pass should make one end-cap/corner module more distinctive or add modest side-volume segmentation without changing collider, asset bounds or the common prefab renderer.


## Validated Commerce Arcade North Corner End-Cap — V5.89 / Registry 1.10.17 / 2026-09-02
- `assets/commerce-arcade-v1.svg` keeps its exact 160x432 authored bounds, world placement and preserved gameplay collider `{x:1530,y:1400,w:120,h:400}`. The common architecture renderer, movement and unrelated gameplay systems remain unchanged.
- The north termination is now intentionally asymmetric: a compact chamfered pavilion with an ivory frame, brighter teal glazing, stepped dark-green roof and restrained gold threshold replaces the former broad cap that visually repeated the south end.
- TileRegistry advanced to `1.10.17`, serves the Arcade as `assets/commerce-arcade-v1.svg?v=6`, and records `variant='north-corner-endcap-v1'` plus the authored module list. CI and the LIVE audit explicitly require that module, preventing a cached or older symmetrical asset from certifying the pass.
- The visual implementation commit `1a0d2ac2fcf54aef006d5c8efa361495f01397c7` passed Kelo CI. Compatible concurrent interface work then advanced the final deployed page to V5.89 at `574dac50cc3739ed7573d014ff52397daf9f4fb3`; its Kelo CI, GitHub Pages deployment and complete LIVE mobile audit all passed with the end-cap intact.
- LIVE validation at 390x844 CSS / 780x1688 backing canvas confirmed registry `1.10.17`, architecture renderer `architecture-prefab-renderer-v1.3`, four prefabs, Arcade asset `?v=6`, intact runtime geometry, active actor/building occlusion and 2,232 exact pixels from the new end-cap glass marker.
- Final diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Manual inspection of `live-commerce-arcade.png` confirms the north pavilion reads as a separate corner destination at mobile scale. The top and bottom now have visibly different silhouettes, while the courtyard, primary entrance and secondary shop families remain readable and no seam or depth regression appeared.
- Direction after validation: Commerce Arcade now has enough hierarchy to stop spending passes on small internal decoration. The next visual pass should compare the surrounding scene and improve the weakest neighboring landmark or route-to-entrance relationship, rather than adding indiscriminate detail to this building.


## Validated Authored Grass Variation — V5.91 / Registry 1.10.19 / World v1.3 / 2026-09-02
- Current repo state is intentionally Luxe-only after the Market/Arcade/Banco authored prefabs were removed by the player. The previous CI and LIVE gates still required those deleted assets/prefabs, so certification was stale rather than representative of the current world. The gates now validate the actual Luxe-only renderer (`architecture-prefab-renderer-v1.4`, `mode='luxe-only-v1'`, one prefab) and keep the removed market disabled.
- Added original modular raster `assets/grass-variation-v1.png`, 128x64 with eight 32x32 grass variants. The variants use a consistent vivid-green base with sparse authored light/dark grass clusters and very restrained flower pixels, replacing the more uniformly noisy world-grass rhythm without changing roads, district geometry, movement, collisions or unrelated gameplay systems.
- TileRegistry advanced to `1.10.19`, owns `atlases.grassVariation`, exposes eight `grassAuthored` variants, and records `grassMode='authored-eight-variant-atlas-v1'`. `world-map.js` advanced to `world-v1.3` and renders non-road world tiles from that atlas while preserving the existing authored marble/transition path system and 512px chunk cache.
- Final deployed audit commit `590c218f81646b780444524a5e77bb21950159cf` passed Kelo CI, GitHub Pages and the complete LIVE mobile audit at 390x844 CSS / 780x1688 backing canvas.
- LIVE runtime validated `grassVariationAssetLoaded=true`, `grassVariationCount=8`, registry `1.10.19`, world `v1.3`, Luxe-only architecture ready and Kelo Luxe depth occlusion active. Exact screenshot evidence found 1,028,856 base-green pixels, 7,003 light grass pixels, 4,549 dark grass pixels, 396 pink flower pixels and 387 blue flower pixels in the dedicated grass frame.
- Final diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of `live-grass.png` confirms the field now reads as a calmer continuous lawn with small clustered blades/flowers instead of every tile carrying the same confetti-like detail. Manual inspection of `live-mobile.png` confirms paths and hero silhouettes remain highly legible; no chunk seam or road regression appeared.
- Next bottleneck: after simplifying the grass, the remaining simple environmental props (especially the small round tree/sign family visible around Plaza Central) now stand out more strongly against the high-quality hero and Kelo Luxe art. The next safe visual pass should replace one of those prop families with authored transparent pixel-art assets through TileRegistry/prop layers rather than adding more ground noise.


## Validated Plaza Nature Prop Family — V5.92 / Registry 1.10.20 / 2026-09-02
- Current Pixadom/top-down research reinforces a useful Kelo World rule: dense social spaces remain readable when environmental detail is concentrated in authored prop clusters with distinct silhouettes and calm negative space, rather than by increasing uniform ground noise. This is a density/readability/consistency reference only; no external art or layout was copied.
- Added original transparent `assets/plaza-nature-v1.svg`, a 192x96 authored atlas containing two 96x96 plaza tree variants. TileRegistry `1.10.20` owns the atlas, four visual-only Plaza Central placements and the explicit `actor-base-y-v1` depth contract; collision and movement are unchanged.
- Added `src/environment/plaza-nature.js` as a dedicated prop render/depth layer. The tree family renders after the base world and re-renders only overlapping actors whose base-Y is in front, preserving the expected behind/in-front relationship without changing gameplay footprints.
- Page contract advanced to `Kelo World — V5.92`; the authored asset is loaded with exact 192x96 dimension validation and exposes `KELO_PLAZA_NATURE_AUDIT` rather than silently falling back.
- Implementation commits `76452fd2a8010a169439f84d902f1097880230a6`, `4d1c38e4324deb4656d4b444986ed8df29ca4943`, `1a658f52d3fb60a8e62c03703194c8c2c49ce175` and `31eb947f84b6c1fda9f1293c8155fd5c8b3eaa9f` reached main. Final validation/audit guard commit `537ac28f4a32aeb2128a81f5e9a6c5f6940de7ec` passed Kelo CI and the LIVE mobile workflow.
- The first green LIVE capture did not actually frame a new tree, so it was not accepted as sufficient visual evidence. `scripts/live-world-audit.mjs` was hardened to require `plaza-nature-v1`, `assetLoaded=true`, four registry props and `depthMode='actor-base-y-v1'`, and now emits a dedicated `live-plaza-tree.png` frame.
- Corrected LIVE validation passed at 390x844 CSS / 780x1688 backing canvas with `ready=true`, `assetLoaded=true`, `failed=false`, `propCount=4`, registry `1.10.20`, world `v1.3`, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of `live-plaza-tree.png` confirms the new authored block-cluster tree renders crisply on grass and remains legible beside the high-detail hero/Kelo Luxe art. The same frame also proves the next bottleneck: a legacy small round tree and simple sign remain visible nearby and now look substantially weaker than the new family.
- Next safe visual pass: remove/replace the remaining legacy round-tree/sign prop family through the same TileRegistry/prop-layer contract, or connect the approved authored plaza-ground asset as the next major floor upgrade. Do not add more uniform grass noise.


## Validated Active District Label Density — world-v1.5 — 2026-09-02

- Public Pixadom references reinforced a useful composition rule for mobile top-down scenes: dense props and focal points read best when circulation space stays visually quiet; persistent global labels compete with that hierarchy instead of helping it.
- `src/environment/world-map.js` now renders only the district label for the district containing the camera, rather than drawing all five labels continuously. The active label uses a compact 13px mono treatment with a restrained dark backing, thin gold accent, and ivory text.
- The change is visual-only: district geometry, roads, movement, collisions, economy, combat, networking, chat, and inventory are unchanged.
- `KELO_WORLD_AUDIT` is now `world-v1.5` and exposes `districtLabelMode: active-district-only-v1` plus `activeDistrictLabel` for LIVE verification.
- First LIVE run correctly failed because GitHub Pages/browser cache still served `world-v1.4`; `index.html` had not advanced the `world-map.js` cache key. Bumping the script URL from `?v=174` to `?v=175` fixed deployment freshness. This validates a general rule: every renderer behavior/version change must advance its HTML script cache key, not only internal atlas query keys.
- Final validation: Kelo CI passed, Pages passed, mobile LIVE audit passed at 390x844 CSS / 780x1688 canvas, `world-v1.5` was active, and console errors, failed requests, and HTTP errors were all empty.
- Next visual bottleneck visible in the validated Plaza capture: legacy round trees / debug-like world markers and NPC labels still contrast sharply with the authored plaza ground, Luxe boutique, and authored plaza-nature family. Replace or suppress these incrementally without touching gameplay semantics.


## Validated World Placard Cleanup — World v1.6 / 2026-09-02
- Current public Pixadom/browser MMO references reinforce a mobile readability rule: authored environment landmarks and focal props should carry place identity; persistent prototype-style labels drawn directly into the world compete with scenery at small viewports. This is a readability/density reference only; no external art or layout was copied.
- `src/environment/world-map.js` no longer paints the active district's dark rectangular name placard into the world canvas. District detection remains intact for audit/navigation state; only the decorative world overlay was removed.
- World audit advanced to `world-v1.6` with `districtLabelMode='world-placards-removed-v1'`; `index.html` cache-busts the renderer as `world-map.js?v=176`.
- Final deployed visual commit `b8b0628b5373bb8d6df9c1cd2687abd4b21e65fd` passed Kelo CI, GitHub Pages and the LIVE mobile audit at 390x844 CSS / 780x1688 backing canvas.
- LIVE runtime validated registry `1.10.21`, authored plaza ground loaded with no fallback, four plaza-nature props, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of `live-plaza.png` confirms the district placard is gone with no regression to plaza/road readability. The next largest visual bottleneck is now clearer: legacy flat circular environment/NPC markers and primitive tree/dummy visuals still read as placeholders beside the authored plaza, nature and architecture. The next safe pass should replace or suppress one high-visibility placeholder family through data-driven props/layers rather than adding more ground noise.


## Validated Plaza Fountain Focal Point — V5.97 / Fountain v1.3 / 2026-09-03
- Current Pixadom reference reinforces replacing visibly weak placeholder/focal spaces with authored destinations before adding uniform environmental noise; this is used only as a density/readability/consistency principle, not as copied art or layout.
- The pre-existing V5.96 LIVE fountain gate exposed a real visual defect: the layered fountain compositor reported ready and depth-correct, but the mobile ROI contained only 30/29 qualifying water pixels behind/in front, so the central plaza focal point was effectively absent despite healthy runtime state.
- Added original transparent authored layer assets `assets/plaza-fountain-back-v2.svg` and `assets/plaza-fountain-front-v2.svg`, each 200x140 with crisp pixel-style ivory stone, restrained gold trim and high-contrast cyan water/jets. `src/environment/plaza-depth.js` advanced to `plaza-fountain-v1.3` / `authored-svg-layer-pair-v2` while preserving the exact existing world bounds `(1340,1450,200,140)`, `baseY=1555`, collider `{x:1390,y:1492,w:100,h:60}` and `final-composite-back-actor-front-v2` depth logic.
- The LIVE workflow now derives the expected fountain version from source and watches the v2 fountain SVGs directly; the dedicated fountain audit keeps its strict visual pixel gate instead of accepting asset-ready state alone.
- Final deployed commit `6e0b616ad8b1238d2de0eb5a3fce476b92d0db6f` passed Kelo CI, GitHub Pages and the complete LIVE mobile audit at 390x844 CSS / 780x1688 backing canvas.
- Corrected LIVE evidence measured 12,702 water / 14,881 gold pixels in the behind frame and 12,134 water / 14,438 gold pixels in the front frame, with `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`. Manual inspection confirms the fountain now reads immediately as the Plaza Central focal point and preserves actor front/behind depth.
- QA rule validated: for focal props, readiness flags and draw counters are insufficient; the LIVE gate should verify visible authored material in the exact prop ROI and the screenshot must still be manually inspected.
- Next visual bottleneck visible in the validated fountain capture is no longer the focal point: the procedural circular NPC markers/labels (`Portero`, `Maestro`) and the `DUMMY` training block/sign now read as the clearest prototype elements beside the authored plaza, fountain and hero sprites. Improve one of those presentation families without changing NPC/training gameplay semantics.


## Validated Authored Plaza Training Dummy — V5.98 / Registry 1.10.22 / 2026-09-03
- Current Pixadom roadmap continues to reinforce a useful Kelo World rule: finish authored environmental design/furnishing and improve decorative/layout variety while keeping mobile usability in scope. Applied here only as a density/readability/consistency principle; no external art or layout was copied.
- Replaced the Plaza Central training dummy's generic circular-avatar presentation and persistent `DUMMY` ground label with original `assets/training-dummy-v1.svg`, a 96x96 crisp pixel-style wooden/straw target prop using Kelo ivory/gold/forest accents.
- TileRegistry advanced to `1.10.22` and now owns `atlases.trainingDummy`, `trainingDummyProp`, and `styles.trainingDummy` with `mode='registry-authored-training-prop-v1'`.
- Gameplay semantics were intentionally preserved: the training target remains exactly at anchor `(1580,1680)` with radius `22`, 80 HP, the same hit/respawn logic and the same Maestro timed-trial integration. `engine-o.js` validates this anchor against TileRegistry before enabling the authored asset and retains a primitive fallback only for load failure.
- Final deployed commit `451373b03c1d987ee60a443d7b62084eca98df24` passed Kelo CI and GitHub Pages. The complete LIVE mobile workflow passed at 390x844 CSS / 780x1688 backing canvas with registry `1.10.22`, authored plaza/fountain/nature architecture intact and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of the LIVE plaza frame confirms the authored wooden target is visible at the training area and the old `DUMMY` text is gone. The nearby `Maestro` circular NPC marker remains visually dominant and now reads as the clearest remaining prototype element in that corner.
- QA finding reinforced: changing a legacy engine visual requires bumping its script query key in `index.html`; V5.98 loads `engine-o.js?v=95` and `tile-registry.js?v=231` so Pages cannot certify stale visual code.
- Next visual bottleneck: replace or restyle the procedural circular NPC marker/label family (`Portero`, `Maestro`) without changing NPC interaction/dialogue semantics. Prefer a registry-driven authored NPC marker/body treatment and keep mobile label density restrained.

## Validated Authored Plaza NPC Family — V5.99 / Registry 1.10.23 / 2026-09-03
- Current Pixadom, Eldria and Thundoria references reinforce a transferable mobile top-down rule: dense social spaces stay readable when destinations and characters have distinct authored silhouettes and labels are restrained instead of permanently competing with scenery. These are density/readability/consistency references only; no external art or layout was copied.
- Added original transparent `assets/plaza-npcs-v1.svg`, a 288x96 atlas with three 96x96 Plaza NPC visual identities: blue/ivory Portero, forest/gold Joyero and burgundy/ivory Maestro. TileRegistry `1.10.23` owns the atlas, sprite mapping and `styles.plazaNpcs` contract with `mode='registry-authored-npc-visual-v1'` and `labelMode='proximity-name-v1'`.
- `engine-p.js` now consumes that registry family instead of presenting Plaza NPCs as white-stroked Canvas circles. Existing NPC coordinates, dialogue, Jeweler timing minigame, Maestro trial hookup and reward behavior remain unchanged; the previous circular renderer exists only as an asset-load fallback.
- Persistent NPC world labels were removed. A name now appears only when the local player is close to or actively talking to that NPC, reducing mobile text competition without changing interaction semantics.
- Page contract advanced to `Kelo World — V5.99`, with `tile-registry.js?v=232` and `engine-p.js?v=95` to prevent stale Pages certification.
- Kelo CI and GitHub Pages passed for final validation commit `2a9cc5f33d07574e0ef58e1b0bc2a7594a1a9275`. The complete LIVE mobile workflow also passed at 390x844 CSS / 780x1688 backing canvas: world, NPC, Luxe architecture and layered-fountain audits all succeeded.
- The first dedicated NPC audit correctly failed because one training-area frame contained Joyero/Maestro but did not actually frame Portero, despite healthy runtime state. The audit was corrected to capture a second Portero-specific frame rather than weakening its pixel gate.
- Final visible evidence measured 1,016 exact forest NPC pixels and 2,186 burgundy pixels in `live-plaza-npcs.png`, plus 1,501 exact blue Portero pixels in `live-plaza-portero.png`; `fallbackActive=false`, three NPCs were present, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection confirms the three NPCs now read as authored character/role silhouettes rather than debug circles. The same training-area frame exposes the next large mismatch: the brown `Café Oro`/legacy-looking volume and remaining world/player label clutter on the east side now compete more strongly with the refined plaza. The next safe pass should identify the actual renderer/ownership of that visible brown volume or further reduce nonessential label clutter, changing only presentation and preserving gameplay semantics.


## Validated Authored PNG Plaza Fountain — V6.00 / 2026-09-02
- The Plaza Central fountain now uses the user-selected authored uppercase PNG layer pair: `assets/plaza-fountain-back.PNG` and `assets/plaza-fountain-front.PNG`; the provisional SVG fountain pair is no longer the live source.
- The two production PNGs are 1254x1254 RGBA assets and render at a shared 200x200 world footprint centered at `(1440,1520)`, preserving their square aspect ratio instead of vertically compressing them.
- Layer order is validated as fountain back → actors → fountain front → actors whose base-Y is in front. The gameplay collider remains unchanged at `{x:1390,y:1492,w:100,h:60}`.
- `plaza-fountain-v1.5` exposes `assetMode='authored-png-layer-pair-v1'` and keeps `depthMode='final-composite-back-actor-front-v2'`.
- LIVE mobile audit at 390x844 CSS / 780x1688 canvas validated both behind/front depth captures, visible cyan water and gold/ivory materials, `ready=true`, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- QA finding: GitHub initially contained the PNGs with accidental leading spaces in their filenames; the same binary blobs were normalized to clean uppercase paths. The first CI also exposed that the repo exports were 1254x1254, so runtime dimensions and aspect ratio were corrected before acceptance.
- Visual inspection confirms the two layers align cleanly in the circular court and the front railing provides believable player occlusion without changing movement or other gameplay systems.


## Validated Plaza Fountain Alignment — V6.05 / Fountain v1.6 / 2026-09-03
- The authored fountain remains exactly the existing `assets/plaza-fountain-back.PNG` and `assets/plaza-fountain-front.PNG`; neither source image was regenerated or replaced.
- Manual review of the previous LIVE composition found the root visual defect: drawing the front PNG at the same 200x200 placement as the already-complete back fountain made the front rim cut across the center instead of reading as the lower foreground edge.
- Validated placement keeps the back at world `{x:1340,y:1420,w:200,h:200}` and renders the front layer centered and reduced to 74% at `{x:1366,y:1508,w:148,h:148}`. Depth crossover is `baseY=1592`; gameplay collision remains unchanged at `{x:1390,y:1492,w:100,h:60}`.
- LIVE mobile inspection confirms the two authored PNGs now read as one coherent circular fountain: the lower rim and planters align with the back structure instead of slicing across the basin, while actors correctly pass behind the front layer and redraw in front after crossing its base-Y.
- Focused mobile LIVE audit validated `plaza-fountain-v1.6`, `alignmentMode='scaled-centered-lower-rim-v1'`, both 1254x1254 PNG sources loaded, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- QA decision: fountain-specific validation must be runnable independently of unrelated district audits so an unrelated failure cannot prevent inspection of a changed focal asset. The full global zero-error gate remains unchanged and separate.


## Validated Rural Edge Density + Luxe Renderer Integration — V6.05 / 2026-09-03
- Fresh public reference review of Pixadom, Eldria and Thundoria reinforced a consistent top-down MMO composition rule for Kelo World: concentrate authored props at borders and district edges while keeping central circulation readable, and give regions their own prop/silhouette vocabulary instead of increasing uniform ground noise. These references were used only for density/readability/consistency; no external art or layouts were copied.
- `src/environment/rural-landmarks.js` now uses the existing TileRegistry-owned `ruralNature` atlas to place 17 low-profile authored hedge, flower, grass, stump and stone cells around the west/south/east farm edges. The farm center remains clear and the north gate/road approach is deliberately unobstructed. No collision, movement, farming state or unrelated gameplay system changed.
- LIVE validation exposed a pre-existing integration blocker that readiness flags did not reveal: `src/ui/luxe-shell.js` explicitly replaced `window.renderFarm` with an empty function to hide the old prototype farm overlay. That obsolete visual suppression was removed now that the modular rural soil/fence/nature renderer is production-ready; Luxe shell v3.2 records `hideFarmOverlay=false` and leaves the active environment hook intact.
- `engine-c.js` now invokes the active `window.renderFarm` hook at composition time, so modular environment wrappers are not bypassed by a stale lexical renderer binding. Script cache keys for both `engine-c.js` and `luxe-shell.js` were advanced during deployment verification.
- A dedicated 390x844 CSS / 780x1688 mobile rural audit now centers the real `STATE.farm`, requires the rural ground and edge atlases to be ready, checks 17 edge placements with `centerClear=true` and `northRoadClear=true`, verifies visible rural-material pixels, and fails on console/page/request/HTTP errors.
- Final Kelo CI for commit `c78dbcf4604bf9f371c2a91bf471cf641e948be5` passed. The complete LIVE mobile workflow also passed every world/rural/NPC/Luxe/fountain/Nobility step with `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Final rural screenshot evidence measured 130,767 qualifying rural-material pixels in the normal frame (up from ~4,322 while the Luxe suppression was active). Manual inspection confirms all four authored soil plots, the wooden perimeter/gate, sparse edge vegetation and clear north road are visible and legible beside the hero on mobile.
- QA rule validated: a module can report its atlas as loaded and still be fully suppressed by a later render/UI wrapper. Dedicated LIVE evidence must prove that the final composed frame—not only the module-local contract—contains the intended authored material.
- Next rural bottleneck: the farm now reads as a real authored destination, but the surrounding district still lacks a strong large-scale rural landmark. The next safe pass should add or restore one registry-driven barn/silo landmark with proper back/front depth while preserving open circulation, rather than adding more small grass decoration.


## Validated District Microdecals & Camera Culling — V6.07 / Registry 1.11.1 / 2026-09-02
- Current Pixadom and comparable top-down pixel MMO references reinforce a composition rule already useful for Kelo World: environmental density reads best when small details support the function and identity of a place instead of being distributed as uniform decorative noise. This pass uses that principle without copying external art or layouts.
- Added the original transparent modular atlas `assets/district-decals-v1.svg` (256x32, eight 32x32 cells) with separate microdetail families for Rural, Arena, Commerce and Gardens. Thirteen authored placements live in the registry extension and render in the intended `decals/details` layer above world ground and below gameplay props/actors; Central deliberately remains quiet.
- The first LIVE Gardens audit exposed a real camera/culling bug: `world-map.js` and the new decal layer consulted `window.camera`, while the game camera existed as a top-level lexical `const camera`. Off-plaza audit movement therefore did not drive chunk/decal culling and produced a large dark void even though asset readiness flags were green.
- The validated integration now exposes the existing camera reference to environment renderers without changing movement behavior. LIVE confirms `cameraBridge=true`, active district `gardens`, authored decal visibility, continuous terrain and no large dark void.
- Final 390x844 mobile LIVE diagnostics are clean: the district decal audit and the full world/rural/NPC/architecture/fountain suite passed with no console errors, failed requests or HTTP errors.
- Manual screenshot inspection shows the decals are appropriately subtle and preserve hero/path readability, but also confirms that surface microdetail is no longer the main Gardens bottleneck. The next safe high-value pass should add an authored multi-tile Gardens landmark/prop family (planters, hedges/flowerbeds, garden structure or water focal point) and less rectangular spatial composition before increasing generic ground noise.


## Validated Gardens Promenade Kit — V6.09 / World v1.7 / 2026-09-03
- Fresh public review of Pixadom, Eldria and comparable current top-down pixel MMO presentation reinforces a transferable composition rule for Kelo World: use clear circulation paths, clustered authored vegetation/props and recognizable sub-spaces instead of filling a district with uniform decorative noise. These references were used only for density, legibility and consistency; no external art or layout was copied.
- Added original modular `src/environment/gardens-atlas.js`, a 128x64 transparent pixel-art overlay atlas with eight 32x32 garden cells: horizontal/vertical hedges, flowerbed, water, hedge corner, stone plinth, stepping stones and flower tuft.
- `src/environment/world-map.js` advanced to `world-v1.7`. Jardines del Sur no longer depends on the previous single 704x352 marble pad; it now uses a forked promenade of smaller ivory path/court rectangles plus deterministic authored garden overlays on grass. The 512px chunk cache, world bounds, movement, collisions, economy, combat, networking, chat and inventory were not changed.
- Kelo CI passed for the deployed change. The first global LIVE audit correctly failed on an unrelated newly introduced equipment-system recursion (`ensure → recalculate → equippedItems → ensure`). The blocker was fixed minimally in `equipment-v1.0.1`, with a cache-key bump, without changing the visual feature or broader gameplay behavior.
- The corrected complete LIVE mobile audit passed at 390x844 CSS / 780x1688 backing canvas. Runtime validated `world-v1.7`, `gardensAssetLoaded=true`, `gardensMode='authored-garden-overlay-atlas-v1'`, `gardensPathMode='forked-promenade-v1'`, active district `gardens`, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of `live-district-decals.png` confirms the Gardens frame now has a readable cross/promenade hierarchy, repeated authored hedge rows, clustered flower beds, small stone/plinth details and open grass around the hero. The scene remains crisp on mobile and no dark culling void returned.
- Next Gardens bottleneck: the new path/hedge kit fixes the large rectangular-floor problem, but the district still lacks a strong multi-tile focal landmark and true vertical prop depth. The next safe pass should add one authored garden landmark such as a compact pond/fountain/pergola with back/front layers, rather than increasing generic grass noise.


## Validated Gardens Layered Fountain Landmark — V6.10 / Gardens v1.1 / 2026-09-03
- Current Pixadom/Eldria/top-down reference review reinforces using clear path axes, focal destinations and layered props with negative space rather than adding uniform ground noise; external references remain density/readability/consistency guides only and no external art or layout was copied.
- Added `src/environment/gardens-landmark.js` with an original embedded 320x128 modular 32px prefab atlas. The east fountain uses a 160x128 back composition plus a separate foreground-rim region in the same atlas and is rendered through `final-composite-back-actor-front-v1`.
- The landmark is visual-only: no collision, movement, economy, combat, networking, chat or inventory behavior was changed.
- Dedicated LIVE Playwright audit at 390x844 CSS / 780x1688 backing canvas validated `gardens-landmark-v1.1`, `assetLoaded=true`, `atlasMode='layered-prefab-atlas-v1'`, `prefabCount=1`, `frontOcclusionActive=true`, `world-v1.7`, `gardensAssetLoaded=true` and active district `gardens`.
- LIVE pixel evidence recorded 12,364 cyan pixels, 280,106 ivory pixels, 1,514 gold pixels and 968,237 green pixels; final diagnostics were `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection confirms the fountain reads as an immediate focal point from the forked promenade, the hero remains legible, and the foreground rim correctly occludes the actor when behind it.
- Validated direction: Jardines should now improve garden composition around this landmark (intentional hedge/flowerbed framing and cleaner transition from promenade to fountain) before adding another large prop. The largest remaining cross-district bottleneck is lower-quality legacy/procedural architecture elsewhere in the world.


## Validated Gardens Fountain Approach + Deployment-Aware Audit — World v1.8 / 2026-09-03
- Fresh public reference review reinforces a useful top-down pixel-world rule: high-density scenes stay readable when paths terminate deliberately at destinations and authored focal props sit inside clear negative space. Pixadom remains a reference for browser/mobile density and readability only; no external art or layout was copied. A current 32x32 top-down tileset reference also reinforces complete transition/autotile families and layered terrain over ad-hoc edge drawing.
- `src/environment/world-map.js` advanced to `world-v1.8`. The east Gardens fountain now has a one-tile-wide, two-tile-high ivory approach spur that closes the previous 32px grass gap between the forked promenade and the landmark. The fountain footprint is explicitly excluded from deterministic garden overlays so hedge/flower cells are not authored underneath the layered landmark.
- The change is visual-only: district bounds, chunk size, movement, collisions, economy, combat, networking, chat and inventory remain unchanged. Runtime exposes `gardensPathMode='fountain-connected-promenade-v2'` and `gardensLandmarkClearance='east-fountain-footprint-v1'`.
- The first Gardens LIVE workflow returned green while GitHub Pages was still serving `world-v1.7`. The resulting screenshot was valid for the old build but could not certify the new promenade connection. `scripts/live-gardens-audit.mjs` was hardened to wait for and require the exact world revision/path mode/landmark-clearance contract before accepting a final capture.
- Final Kelo CI passed for both the environment change and the audit hardening. The corrected dedicated Gardens LIVE audit passed at 390x844 CSS / 780x1688 backing canvas with `world-v1.8`, `gardens-landmark-v1.1`, `frontOcclusionActive=true`, 13 world road/path segments, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of the corrected LIVE capture confirms that the fountain now reads as connected to the ivory circulation network instead of sitting one grass tile beyond it; the hero, cyan water, ivory stone and surrounding grass remain highly legible on mobile.
- QA rule validated: district-specific LIVE audits must certify the exact deployed renderer revision they intend to test, not only generic readiness/title flags, or a stale Pages build can produce a false-green result.
- Next Gardens bottleneck: the landmark connection is now coherent, but hedge rows and flower framing still read somewhat mechanically around the lower/east garden. The next safe pass should improve intentional asymmetry and framing around the fountain using the existing garden atlas/ground layers before adding another large landmark.


## Validated Gardens asymmetric framing and LIVE cache discipline — 2026-09-03

- `world-v1.9` replaces the rigid rectangular Gardens hedge frame with authored asymmetric hedge segments, corner pieces, and deliberately uneven flowerbed clusters using the existing modular Gardens atlas; the east fountain footprint remains reserved and gameplay systems are unchanged.
- Mobile LIVE at 390×844 CSS / 780×1688 canvas validated `gardensFramingMode: asymmetric-garden-framing-v1`, `fountain-connected-promenade-v2`, the layered fountain contract, and clean console/network results.
- The LIVE capture confirms that reducing repeated hedge lines and slightly lowering random flower-tuft density improves negative space and makes the fountain sector read less mechanically without requiring a new landmark.
- Audit retry loops must cache-bust the renderer subresource itself, not only the HTML URL; otherwise a single Playwright context can keep an older `world-map.js` while GitHub Pages has already deployed the new revision.
- The next visual bottleneck exposed by the mobile capture is the hard, staircase-like grass↔marble/path silhouette around Gardens. Prefer a small authored transition/edge treatment through the existing transition/TileRegistry architecture before adding more props or another landmark.


## Validated Gardens Path Topology — World v1.10 / 2026-09-03
- `world-map.js` now keeps the existing 32px TileRegistry-driven marble/grass materials and authored transition atlas, but changes the two small southern garden landing pads from full rectangles to authored chamfered footprints by cutting only their four 32x32 corner cells.
- The road classifier owns the cutouts through `gardenPath()`, so the existing 4-neighbour transition mask automatically follows the new topology; no gameplay collision, movement, combat, economy, networking, chat or inventory behavior changed.
- LIVE mobile audit validated `world-v1.10`, `fountain-connected-promenade-v3`, `authored-chamfered-path-topology-v1`, 390x844 CSS / 780x1688 backing canvas, the existing layered fountain contract, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection confirms the small garden landings no longer read as perfect rectangular slabs; the route remains highly legible and the fountain stays the focal point.
- Research validation: Pixadom continues to show dense scenes with strong path hierarchy and negative space around focal landmarks; current modular top-down terrain references also emphasize transparent/overlay transition families and complete corner/edge coverage rather than relying on a single hard boundary tile.
- Next bottleneck exposed by the LIVE capture: the current grass↔marble transition artwork itself still produces a regular green tooth/checker fringe along long straight marble edges. The next safe visual pass should improve the transition atlas edge silhouette toward irregular grass tufts/encroachment while preserving the existing TileRegistry bitmask contract and mobile readability.


## Validated 2026-09-03 — organic grass↔marble fringe v3

- LIVE mobile evidence at 390×844 validated replacing the overly regular grass↔marble edge with a thinner continuous grass lip plus sparse authored tufts; the marble remains clearly readable while the previous checker/teeth rhythm is materially reduced.
- Keep the existing 16-mask TRBL TileRegistry contract and renderer neighbour logic. For this class of visual defect, prefer improving the modular transition atlas silhouette before changing topology or gameplay-adjacent systems.
- Validated asset/registry contract: `assets/plaza-transitions-v3.png?art=142`, TileRegistry `1.10.25`, style `authored-organic-fringe-overlay-v3`.
- First LIVE inspection of v2 was technically clean but still visually too tooth-like; visual screenshot review remains a required gate even when CI, console, requests and HTTP checks are green.
- Next visual bottleneck: the long upper promenade is still a very broad uninterrupted ivory field; improve its internal marble variation / edge cadence without reducing path legibility or adding prop clutter.


## Validated 2026-09-03 — Gardens modular marble variation v1

- LIVE mobile evidence at 390×844 validates a dedicated 128×64 transparent marble-variation atlas with eight 32×32 low-contrast variants layered only over Gardens roads. The long ivory promenade now has restrained internal material cadence without sacrificing path readability or adding prop clutter.
- Preserve the render order `marble base → subtle marble variation overlay → grass↔marble transition`; this keeps the existing ivory palette and 16-mask transition contract intact while letting surface detail evolve independently.
- Validated contract: `assets/marble-variation-v1.png?art=143`, base TileRegistry `1.10.26` (runtime extended registry `1.11.1`), `world-v1.11`, style `authored-eight-variant-overlay-v1`, eight deterministic overlay cells, Gardens-only scope.
- Dedicated LIVE validation must probe layered fountain depth separately from a promenade screenshot: moving the actor away from the fountain correctly makes `frontOcclusionActive=false`, so oclusion and material framing are distinct audit conditions.
- Final LIVE report: 390×844 CSS / 780×1688 canvas, `marbleVariationAssetLoaded=true`, `marbleVariationCount=8`, layered fountain probe `frontOcclusionActive=true`, `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Next visual bottleneck: Gardens now has better ground material cadence, but its large green fields still read flatter and more synthetic than the authored marble corridor; the next safe pass should improve medium-scale vegetation grouping/grass-to-prop rhythm without filling navigation space or adding another landmark.


## Validated Gardens Meadow Rhythm — World v1.12 / 2026-09-03
- The existing eight authored 32x32 grass variants are now composed at two scales in Jardines del Sur instead of being selected uniformly tile-by-tile.
- `world-map.js` uses the existing TileRegistry district profile contract (`detailCluster=true`) to form sparse deterministic 3x3-tile meadow patches. Most garden ground draws the quieter first four grass variants; roughly one in seven macro cells draws from the more detailed upper four variants.
- This is visual-only and preserves roads, path topology, chunks, movement, collisions, economy, combat, networking, chat and inventory.
- LIVE mobile audit validated `world-v1.12` with `gardensGrassRhythmMode='registry-profile-meadow-clusters-v1'`, registry `1.11.1`, all environment assets ready, 390x844 CSS / 780x1688 canvas, and zero console, page, failed-request or HTTP errors.
- Manual screenshot inspection confirms the grass remains highly readable against ivory marble while large green fields gain a subtle medium-scale rhythm without additional prop clutter.
- Next bottleneck exposed by the same capture: the repeated single-tile hedge/flower props now look noticeably more blocky and low-detail than the hero and ground materials. Prefer a small authored multi-tile shrub/flowerbed family with stronger silhouettes and depth before increasing vegetation density.


## Validated Gardens Organic Props — gardens-kit-v2 / 2026-09-03
- `src/environment/gardens-atlas.js` keeps the existing 128x64 / eight 32x32 tile contract and the same named tile IDs, but `gardens-kit-v2` redraws hedges, flowerbeds, flower tufts and supporting garden cells with more irregular silhouettes, clustered highlights and grounded shadows. This improves the small-prop quality bar without changing world geometry or gameplay systems.
- LIVE mobile validation at 390x844 CSS / 780x1688 backing canvas confirmed `gardensMode='authored-organic-garden-overlay-atlas-v2'`, `world-v1.12`, registry runtime `1.11.1`, all required visual assets loaded, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- QA finding: the first audit falsely passed while GitHub Pages/browser cache still served `authored-garden-overlay-atlas-v1`. `scripts/live-gardens-audit.mjs` now cache-busts `gardens-atlas.js` and asserts the exact Gardens atlas mode before accepting convergence or the final capture.
- Manual inspection confirms better flowerbed volume/color and less rigid hedge silhouettes while preserving mobile readability and negative space around the promenade.
- Next bottleneck: placement rhythm. Individual garden tiles are improved, but authored framing still relies heavily on isolated 1x1 stamps. The next safe pass should introduce a small modular 2x1/3x1 hedge/flowerbed composition family or registry-authored prefab groupings, keeping road clearance and overall density stable.


## Validated Gardens Modular Framing — World v1.13 / 2026-09-03
- Fresh public reference review reinforces a transferable Kelo World rule: Pixadom's browser/mobile presentation keeps dense authored scenery readable through clear circulation and clustered environmental modules, while current 32x32 top-down tileset packs increasingly expose modular terrain/prop families and data/manifest metadata instead of relying on isolated one-off stamps. These references were used only for density, legibility and consistency; no external art or layout was copied.
- Added `src/environment/gardens-compositions.js`, a small TileRegistry extension that declares eleven authored Gardens composition groups using the existing `gardens-kit-v2` tiles. The groups form contiguous horizontal/vertical hedge runs plus 2x1/3x1 flowerbeds, so the renderer can compose larger readable shapes without adding another atlas or increasing global prop density.
- `src/environment/world-map.js` advanced to `world-v1.13` and consumes the registry-authored composition cells through `gardensCompositionMode='registry-authored-garden-compositions-v1'` and `gardensFramingMode='registry-authored-modular-framing-v2'`. Existing fountain clearance, promenade geometry, 512px chunk architecture, movement, collision, economy, combat, networking, chat and inventory remain unchanged.
- Final Kelo CI run `33754475426` passed. GitHub Pages run `33754473909` deployed the same `61de998f2f393e4a9696b98ca9e99500927f0556` head successfully, and the complete LIVE mobile screenshot audit `33754475376` passed.
- LIVE Gardens evidence at 390x844 CSS / 780x1688 canvas validated runtime registry `1.11.1`, `world-v1.13`, eleven composition groups, layered fountain depth, `consoleErrors=[]`, `failedRequests=[]`, and `httpErrors=[]`.
- Manual inspection of `live-gardens-marble.png` confirms the grouped hedge rows and multi-cell flowerbeds now read as intentional garden framing rather than mostly isolated 1x1 stamps. The ivory promenade remains unobstructed and the hero silhouette stays clear on mobile.
- Next Gardens bottleneck exposed by the validated screenshot: the larger hedge/flower groupings improve rhythm, but they still have perfectly tile-aligned straight seams and identical repeated middle cells. The next safe pass should introduce one or two authored hedge/flower end-cap or join variants through the existing modular atlas/registry path, preserving the current composition footprints and density rather than adding more props.


## Validated Gardens Mid-Run Variants — Gardens joins v2 / Compositions v3 / 2026-09-03
- Current public Pixadom material continues to support dense but readable top-down scenes with clear circulation on browser/mobile; recent 32x32 top-down tileset references also reinforce modular variant families and metadata-driven composition rather than more one-off prop stamps. These references informed principles only; no external art or layout was copied.
- `src/environment/gardens-joins.js` now exposes `gardens-joins-v2`, extending the authored modular join atlas from 192x32 / 6 cells to 256x32 / 8 cells while preserving end-cap IDs 0–5. New named cells `HEDGE_MID_ALT` and `FLOWER_MID_ALT` provide controlled interior variation without changing composition footprints or density.
- `src/environment/gardens-compositions.js` now exposes `gardens-compositions-v3` / `registry-authored-garden-compositions-v3` with `centerVariationMode='authored-mid-variant-selection-v1'`. The existing 11 authored compositions keep the same coordinates, path clearance and landmark clearance; only selected center cells use the alternate authored variants.
- The renderer required no new special-case drawing path: `world-map.js` already resolves named composition cells against the modular base/join atlases, validating the intended data-driven architecture.
- Commit `ae30d43f3e975841f23931b5651a45d35597cec1` passed Kelo CI run `33766614168`; GitHub Pages run `33766612757` completed successfully.
- Dedicated LIVE mobile audit run `33766614180` passed at 390x844 CSS / 780x1688 backing canvas, validating `gardens-joins-v2`, 256x32 / 8 cells, both alternate center tile IDs, `gardens-compositions-v3`, world `world-v1.14`, the layered fountain landmark and clean diagnostics: `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of the LIVE capture confirms the long horizontal hedge and the three-cell flowerbed now have a less mechanical center cadence while their silhouettes, route clearance and overall density remain unchanged. No visible atlas seam or broken edge was introduced.
- Next bottleneck: the remaining vertical hedge runs still reuse one center vocabulary and the authored garden framing remains strongly axis-aligned. The next safe pass should add restrained vertical/join or corner variation through the same modular registry/composition path before increasing prop density or adding another landmark.


## Validated Gardens Vertical Hedge Rhythm — joins v3 / compositions v4 — 2026-09-03

- Fresh reference review kept Pixadom as a density/readability benchmark only and reinforced the value of preserving obvious circulation while adding environmental richness. Current 32×32 top-down tileset practice also favors small modular variant families plus explicit metadata/contracts over extra prop density.
- `gardens-joins-v3` expands the modular join atlas from 256×32 / 8 cells to 288×32 / 9 cells while preserving IDs 0–7 and appending `HEDGE_V_ALT:8`, a restrained mirrored vertical mid variant derived from the authored hedge vocabulary.
- `gardens-compositions-v4` keeps the same 11 composition footprints, coordinates, path clearance, landmark clearance, and density. The east upper/lower vertical hedge runs now use `HEDGE_V_ALT`; the west vertical run retains the original `HEDGE_V`, creating controlled left/right rhythm variation.
- No gameplay systems or world geometry changed. `world-map.js` remains `world-v1.14` because the renderer already resolves named join-atlas cells generically through the registry-backed composition contract.
- Validation: Kelo CI and GitHub Pages passed. The focused LIVE mobile audit passed at 390×844 CSS / 780×1688 canvas with `gardens-joins-v3`, `registry-authored-garden-compositions-v4`, `verticalAltUsageCount=2`, `consoleErrors=[]`, `failedRequests=[]`, and `httpErrors=[]`.
- Manual inspection of the LIVE screenshot confirms the east-side vertical hedge run has a less mechanically repeated center silhouette with no broken seams; promenade, fountain clearance, hero readability, and overall density remain intact.
- QA decision: focused evidence should frame the changed region, so the Gardens variant capture now centers farther east instead of relying only on contract assertions.
- Next bottleneck: corner/junction vocabulary remains mostly a single `HEDGE_CORNER` stamp and the overall garden framing is still strongly orthogonal. The next safe pass is 1–2 modular corner/junction variants using the same footprints and density before adding props or another landmark.


## Validated Gardens Corner Orientation — World v1.15 / 2026-09-03
- Current reference review keeps Pixadom useful as a density/readability benchmark: dense top-down social spaces remain legible when paths stay clear and edge modules read as intentional structures rather than repeated noise. Wardmarch (published 10 August 2026) reinforces shipping complete modular terrain families with explicit masks/metadata; Emberfen (updated 26 August 2026) reinforces seam validation and reproducible modular tiles. These are structural references only; no art or layouts were copied.
- `world-map.js` now renders the existing authored `HEDGE_CORNER` tile in four explicit 90-degree orientations at the four Gardens corner placements through `drawGardenRotated()`. The tile footprint, 32x32 grid, path geometry, composition count, prop density and all gameplay systems are unchanged.
- World audit advanced to `world-v1.15` with `gardensFramingMode='registry-authored-modular-framing-v4'`, `gardensCornerMode='oriented-authored-corner-v1'` and `gardensCornerOrientationCount=4`. Pixel smoothing remains disabled, so quarter-turn transforms preserve crisp raster edges.
- Kelo CI run `33778146225` passed on the final implementation head. Gardens mobile LIVE audit run `33778146264` also passed after deployment convergence.
- Final LIVE evidence validated 390x844 CSS / 780x1688 backing canvas, `world-v1.15`, Gardens join/composition contracts intact, `consoleErrors=[]`, `failedRequests=[]`, and `httpErrors=[]`.
- Manual inspection of `live-gardens-variants.png` confirms the visible hedge corner/end structures no longer all share one global orientation while the ivory route and hero remain highly legible.
- Next Gardens bottleneck: the modular hedge pieces are visually improved, but several runs still read as isolated ornaments rather than one spatially connected garden boundary. The next safe pass should test authored L/T junction composition or a small junction atlas extension that connects selected runs without changing routes, clearances or overall density.


## Validated Gardens Navigation-Safe Prop Placement — 2026-09-03 / Gardens Compositions v6
- Repository inspection found a real authored-placement conflict: `east-upper-hedge-run` was registered at local cells x=22, y=6..8, but those cells fall inside the existing broad marble navigation corridor. Because `world-map.js` intentionally renders garden overlays only on non-road cells, the three registered hedge tiles were silently masked and never contributed to the scene.
- The safe fix preserves all navigation geometry and gameplay: the same three-tile authored vertical hedge run was relocated to local cells x=24, y=13..15, immediately outside both the road mask and the east fountain landmark-clearance rectangle. No economy, combat, movement, networking, chat, inventory, collision or path system changed.
- `gardens-compositions-v6` now records `navigationSafeRelocationMode='authored-road-clear-east-run-v1'`, `navigationConflictFixCount=3`, and the relocated anchor `[24,13]` so the placement decision is explicit and auditable rather than implied.
- The dedicated mobile LIVE audit was repositioned to frame the corrected east-side area and validates the v6 composition contract at 390x844 CSS / 780x1688 backing canvas, with clean console/page/request/HTTP diagnostics.
- Research direction remains consistent with Pixadom's dense-but-readable browser MMO scenes and with current 32x32 modular packs such as Wardmarch: authored detail should occupy deliberate negative space around navigation instead of competing with traversable paths; metadata should make these placement constraints inspectable.
- Next technical bottleneck discovered: several older Gardens flowerbed/fixed-accent records also appear to sit under navigation or landmark-clearance masks. Before adding L/T hedge junctions, the next pass should audit declared-vs-visible authored placements and relocate or remove only confirmed dead cells. Junction art should not bridge intentional path openings.


## Validated 2026-09-03 — Gardens authored placement visibility audit

- LIVE validation confirmed that authored garden metadata can be syntactically valid yet visually dead when `world-map.js` road/landmark masks suppress the overlay at render time. Treat `declared -> actually visible` as a required QA check before adding new garden props or junction art.
- `gardens-compositions-v7` relocates the complete NW flowerbed from road-conflicting cells to the confirmed grass pocket anchored at local `[8,8]`, preserving its 2-cell footprint, total authored density, paths, landmark clearance, and all gameplay systems.
- The composition audit now exposes `declaredCellCount: 41`, `navigationConflictFixCount: 5`, and `relocatedFlowerbedNWAnchor: [8,8]`; mobile LIVE passed at 390x844 CSS / 780x1688 canvas with no console, failed-request, or HTTP errors after GitHub Pages finished deploying.
- Continue the visibility audit one confirmed dead cluster at a time before increasing decorative density. Remaining candidates should be rechecked against the current road/landmark masks rather than assumed from registry presence alone.


## Validated Gardens NE Flowerbed Visibility — V6.17 / Compositions v8 / 2026-09-03
- A deterministic declared-vs-renderable audit of the 41 authored Gardens cells against the live `road()` and east-fountain clearance masks identified eight currently masked cells before this pass. The complete two-cell `flowerbed-ne` was confirmed to sit on marble navigation cells at local `[18,7]` and `[19,7]`, so it was registered but visually dead.
- `gardens-compositions-v8` relocates only that confirmed two-cell flowerbed to the road-clear grass pocket anchored at local `[19,13]`, preserving its exact two-cell footprint, total authored density, navigation geometry, fountain clearance and all gameplay systems. `navigationConflictFixCount` advances from 5 to 7 and `navigationSafeRelocationMode` to `authored-road-clear-placements-v3`.
- Page build advanced to `Kelo World — V6.17` and the Gardens composition script cache key advanced to `v=4`, preventing normal clients from retaining the prior placement contract.
- Kelo CI passed on final head `c491a1142194ba202086ba29e485e7a731d3bd06`; GitHub Pages build and deploy both passed. The dedicated Gardens LIVE audit passed at 390x844 CSS / 780x1688 backing canvas with compositions v8, 41 declared cells, the relocated NE anchor `[19,13]`, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of `live-gardens-variants.png`, framed around the corrected east/central Gardens area, confirms the flowerbed is now visibly composed on grass below the promenade/fountain instead of disappearing under marble. Path readability, fountain clearance and hero readability remain intact.
- Research remains aligned with Pixadom's current browser/mobile direction and with recent 32x32 modular packs such as Wardmarch/Emberfen: authored density should be data-driven, seam/placement constraints should be explicitly validated, and detail should support rather than compete with circulation. No external art or layout was copied.
- The same static audit leaves six additional masked authored cells as candidates (one SW flowerbed cell and five fixed accents). Continue one confirmed cluster at a time; do not move them wholesale until each candidate is inspected in LIVE context.
- Next Gardens bottleneck: finish the declared-to-visible cleanup for the remaining confirmed mask conflicts before spending visual budget on new L/T junction art or more decorative density.


## Validated Gardens SW Flowerbed Visibility — Compositions v9 / 2026-09-03
- Fresh reference review kept Pixadom as a density/readability benchmark only: its browser/mobile presentation supports dense authored decoration when circulation remains obvious. Wardmarch (published 10 August 2026) and Emberfen (updated 26 August 2026) reinforce 32x32 modular families, explicit metadata and seam/placement validation rather than adding unverified decorative density. No external art or layout was copied.
- Repository inspection continued the declared-to-visible audit and confirmed that `flowerbed-sw` was only half-renderable: local cell `[10,14]` resolves to a world cell inside the broad vertical marble road, so `world-map.js` suppresses it while `[9,14]` remains on grass.
- `gardens-compositions-v9` relocates the two-cell SW flowerbed one cell west to local `[8,14]` + `[9,14]`, preserving the exact two-cell footprint, total authored density, navigation geometry, fountain clearance and all gameplay systems. `navigationConflictFixCount` advances to 8 and `navigationSafeRelocationMode` to `authored-road-clear-placements-v4`.
- The dedicated Gardens audit now explicitly requires the v9 contract and `relocatedFlowerbedSWAnchor=[8,14]`, and its mobile evidence is centered on the southwest/central region so the corrected cluster is actually visible in the captured frame.
- Validation passed: Kelo CI run `33807088183`, GitHub Pages run `33807087619`, and Gardens mobile LIVE audit run `33807088219` all completed successfully. LIVE evidence at 390x844 CSS / 780x1688 canvas reported 41 declared cells, 11 compositions, 10 fixed placements, `consoleErrors=[]`, `failedRequests=[]`, and `httpErrors=[]`.
- Manual inspection of `live-gardens-variants.png` confirms the southwest flowerbed now renders as a complete two-cell pair on grass beside the ivory route. The relocation does not introduce seams, obstruct the route, increase visual density, or reduce hero readability.
- Remaining declared-to-visible candidates are fixed accents: two WATER cells, the west PLINTH, one STEPPING_STONES cell conflict with road masks, and the east PLINTH is additionally suppressed by the fountain-clearance rectangle. Continue one fixed-accent cluster at a time before adding new L/T junction art.


## Validated Gardens Water Accent Recovery — Gardens compositions v10 / 2026-09-03
- Fresh public reference review of Pixadom plus current 32x32 top-down packs such as Wardmarch and Emberfen reinforced the same transferable rule: authored environmental density should support readable circulation, while metadata/placement validity must be verified against the final renderer rather than assumed from registry declarations. References were used only for density, legibility and consistency; no external art or layout was copied.
- The two registry-owned Gardens `WATER` accents at local cells `[12,11]` and `[17,11]` were valid declarations but fully invisible in the composed world. `world-map.js` deliberately renders garden overlays only on non-road cells; the first water cell overlapped the central ivory corridor and the second overlapped the Gardens promenade.
- `gardens-compositions-v10` relocates those exact two WATER cells to `[9,11]` and `[19,11]`, both grass-valid positions outside the fountain exclusion. Footprint and authored density remain two cells; no movement, collision, economy, combat, networking, chat, inventory or other gameplay semantics changed.
- The composition contract now reports `navigationSafeRelocationMode='authored-road-clear-placements-v5'`, `navigationConflictFixCount=10`, and explicit `relocatedWaterAnchors=[[9,11],[19,11]]`. The LIVE audit frames the affected promenade area and requires cyan pixel evidence in addition to the existing grass/ivory checks.
- Kelo CI run `33812255211` and GitHub Pages run `33812253693` passed for final QA head `04b55da482596292264a63f81cdbd9b5867cf4eb`. Gardens mobile LIVE audit `33812255145` also passed at 390x844 CSS / 780x1688 backing canvas with 2,854 qualifying cyan pixels and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of the LIVE screenshot confirms both small cyan water accents now appear on grass flanking readable ivory circulation, without seams, path obstruction or loss of hero legibility.
- Next Gardens bottleneck: three older fixed accents remain candidates for declared-but-nonrenderable placement: the west plinth conflicts with road geometry, the east plinth intersects the fountain-clearance policy, and one stepping-stone placement conflicts with navigation. Continue correcting one confirmed group per pass before adding new decorative density.


## Validated Gardens West Plinth Visibility — 2026-09-03 / Compositions v11
- Runtime inspection confirmed that authored fixed accents can be valid in registry metadata yet never reach the frame: `world-map.js` draws garden overlays only on non-road cells and separately suppresses the east-fountain clearance footprint.
- The west `PLINTH` at local garden cell `[7,11]` landed on the vertical ivory garden path, so it was fully masked in runtime. It is now relocated to grass at `[5,11]`, preserving one authored tile, the 10 fixed-placement count, the 41 declared-cell count, existing routes, fountain clearance, density and all gameplay systems.
- `gardens-compositions-v11` uses `registry-authored-garden-compositions-v11`, `authored-road-clear-placements-v6`, `navigationConflictFixCount=11`, and exposes `relocatedWestPlinthAnchor=[5,11]` for regression auditing.
- LIVE mobile validation passed at 390x844 CSS / 780x1688 backing canvas. The captured frame shows the pale plinth clearly on the west grass pocket beside the ivory circulation without blocking the route; `consoleErrors=[]`, `failedRequests=[]`, and `httpErrors=[]`.
- QA lesson: the first audit retry incorrectly enabled setup-node npm caching even though this repository has no dependency lockfile; that runner failure was corrected. The Gardens audit now uses a no-lock, no-package-lock Playwright install and completed successfully.
- Next confirmed placement bottlenecks: the east `PLINTH` remains inside the fountain-clearance suppression region and `STEPPING_STONES` at `[11,16]` remains on the main vertical road. Correct one confirmed dead placement per pass before adding new decoration.


## Validated Gardens East Plinth Visibility — Compositions v12 / 2026-09-03
- Fresh public reference review kept Pixadom as a density/readability benchmark only. Wardmarch (published 10 August 2026) and Emberfen (updated 26 August 2026) reinforce 32x32 modular families, explicit placement metadata, anchors and seam/placement validation rather than assuming registered decoration reaches the final frame. No external art or layout was copied.
- Repository inspection confirmed the east `PLINTH` fixed accent at local garden cell `[21,11]` was syntactically valid but guaranteed invisible because `world-map.js` suppresses all garden overlays inside the east-fountain landmark-clearance rectangle `lx=20..24, ly=9..12` before looking up authored placements.
- `gardens-compositions-v12` relocates only that one-tile plinth to local `[25,11]`, immediately outside the landmark exclusion and on non-road grass. The total authored density remains 41 declared cells and 10 fixed placements; navigation, fountain geometry/clearance, movement, collisions, economy, combat, networking, chat and inventory are unchanged.
- The composition contract advances to `registry-authored-garden-compositions-v12`, `authored-road-clear-placements-v7`, `navigationConflictFixCount=12`, and exposes `relocatedEastPlinthAnchor=[25,11]` for regression auditing.
- Kelo CI run `33821002417`, GitHub Pages run `33820999081`, and Gardens mobile LIVE audit run `33821002452` all passed on final QA head `a1c885ff9af78aeaedc98554bfe06ab746cc437a`.
- LIVE validation at 390x844 CSS / 780x1688 backing canvas reported world v1.16, compositions v12, 41 declared cells, 10 fixed placements, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`. The audit camera was moved east so the changed placement is present in the evidence rather than merely contract-checked off-screen.
- Manual inspection of `live-gardens-variants.png` confirms the pale east plinth is now visibly rendered on grass to the right of the fountain, without entering the ivory promenade, creating a seam, or reducing hero/path readability.
- Next confirmed declared-to-visible bottleneck is `STEPPING_STONES` at local `[11,16]`, which still conflicts with the main vertical navigation road. Correct that single dead placement before adding new L/T junction art or increasing decorative density.


## Validated Gardens stepping-stone recovery v13 — 2026-09-03

- `STEPPING_STONES` at Gardens local `[11,16]` was confirmed declared-but-invisible because that cell resolves inside the main vertical ivory road and `world-map.js` intentionally suppresses Gardens overlays on road cells.
- The authored accent was relocated to local `[9,16]`, immediately west on valid grass, while preserving the second stepping-stone placement, the 10 fixed placements, 41 declared cells, all navigation geometry, landmark clearance, collision, movement and gameplay.
- `gardens-compositions` is now `v13`, mode `registry-authored-garden-compositions-v13`, with `navigationConflictFixCount=13` and `relocatedSteppingStoneAnchor=[9,16]`.
- LIVE QA exposed stale audit assumptions rather than a renderer regression: the old Gardens audit expected the historical joins atlas mode/width while runtime correctly uses `gardens-joins-v3`, `authored-garden-endcaps-mid-variants-v3`, 288×32 with 9 columns. The audit now derives join/composition contracts from source and validates atlas geometry structurally instead of pinning obsolete dimensions.
- Validation passed on mobile LIVE at 390×844 CSS / 780×1688 canvas. `Live mobile screenshot audit` run `33825667304` passed Gardens plus world, district decals, Rural, Plaza NPCs, Luxe architecture, fountain and Nobility checks. Gardens report recorded `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- GitHub Pages run `33825666086` and Kelo CI run `33825667258` both completed successfully for the validated gate.
- Visual inspection of `live-gardens-marble.png` confirmed the recovered pale stepping-stone accent is readable on grass beside the ivory circulation without creating a seam, obstruction or competing focal point.
- Next visual bottleneck: the authored-placement visibility audit should be generalized into a registry-level `declared -> renderable` validator for all Gardens placements, rather than discovering road/landmark conflicts one placement at a time.


## Validated Gardens Dual South L Boundaries — Compositions v15 / 2026-09-04
- Fresh reference review kept Pixadom as a density/readability/consistency benchmark only. Its current 2026 roadmap continues to emphasize environmental design/furnishing, decorative layout variety and mobile usability. Wardmarch (published 10 August 2026) and Emberfen (updated 26 August 2026) reinforce complete modular 32x32 families plus explicit seam/placement validation. No external art or layout was copied.
- `gardens-compositions-v15` preserves exactly 41 declared Gardens cells, 11 compositions and 10 fixed placements, but reconnects the southwest hedge vocabulary into a second real L boundary: vertical run local `[5,14..16]` -> oriented corner `[5,17]` -> horizontal run `[6..8,17]`. The already validated southeast L remains intact. No prop density, road geometry, collision, movement, economy, combat, networking, chat or inventory behavior changed.
- Runtime contract is `registry-authored-garden-compositions-v15`, `junctionMode='connected-south-boundaries-v2'`, `connectedJunctionCount=2`, with explicit southwest anchors for regression auditing. The composition script cache key was advanced in `index.html`.
- Deterministic Gardens placement validation passed with all 41 declarations renderable and no road/landmark-clearance conflict or duplicate. Kelo CI run `33836645407` passed. GitHub Pages run `33836644542` passed on final gate head `df68ec168d5697ed576fb04fe85585b3a5188c69`.
- Dedicated Gardens mobile LIVE audit run `33836645414` passed at 390x844 CSS / 780x1688 backing canvas. Runtime reported `gardens-compositions-v15`, `auditRevision='southwest-l-v1'`, two connected junctions and clean diagnostics: `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of `live-gardens-variants.png` confirms the southwest vertical and horizontal hedge runs now read as one continuous L-shaped garden boundary beside the hero, while the ivory circulation remains clear and the scene remains crisp at mobile scale.
- QA defect corrected: the first dedicated Gardens LIVE workflow still hard-coded v14 / one connected L and failed in its source `grep` stage before Playwright. The workflow was aligned to v15/two Ls and rerun without weakening any visual or diagnostic gate.
- Next Gardens bottleneck: L-boundary vocabulary is now proven on both south corners, but there is still no true authored T-junction tile/module. The next safe art pass should add one registry-addressable T-junction variant to the modular join atlas and use it in a road-clear composition, keeping the 41-cell density budget or explicitly swapping existing cells rather than simply adding clutter.


## Validated 2026-09-04 — Gardens authored T-junction family v17

- Replaced the southeast Gardens T-junction's one-off visual ownership with an original authored 128×32 modular atlas, `assets/gardens-t-junctions-v1.svg`, containing four 32×32 T orientations.
- `src/environment/gardens-compositions.js` is the registry/data contract for this family (`gardens-compositions-v17`, `authored-four-orientation-t-family-v4`); the currently deployed southeast placement remains `[22,17]`, so environment density and path clearance did not increase.
- `src/environment/gardens-junction-overlay.js` renders the authored family from registry-described placements and exposes `gardens-junction-overlay-v1` diagnostics. This is visual ownership only; movement, collision and gameplay systems remain untouched.
- Mobile LIVE validation at 390×844 CSS / 780×1688 physical pixels passed with the southeast T visible, hero/readable paths preserved, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Keep the full four-orientation family available before adding more Gardens branches. Do not return new T pieces to renderer-local ad-hoc drawing; future T placements should be registry/composition-driven and remain subject to placement/LIVE gates.


## Validated Gardens T-family second orientation — 2026-09-04

- Gardens compositions v18 proves a second authored T-junction orientation in the real world using the existing `gardens-t-junctions-v1` 128x32 four-orientation atlas.
- The previously validated southeast T remains at local anchor `[22,17]` using orientation `NWS`; the new southwest T is at `[5,17]` using orientation `NES`.
- The change is density-neutral: total declared Gardens cells remains `41`; fixed placements are reduced to `7` while the new T reuses cells inside the west hedge run.
- `scripts/validate-gardens-placements.mjs` remained part of the dedicated Gardens gate, and the dedicated LIVE mobile audit completed successfully after the v18 contract update.
- LIVE mobile evidence at `390x844` CSS / `780x1688` physical pixels showed the southwest T as a continuous vertical-to-horizontal hedge connection, with no visible path obstruction, no obvious seam at gameplay scale, and the player/path silhouette remaining readable.
- LIVE diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`; the authored T atlas also produced direct color evidence in the screenshot (`junctionGreen=970`, `junctionGold=38`).
- Validated direction rule: a modular atlas family is not considered world-proven merely because all variants exist in the atlas. Reuse at least more than one real orientation in composition and certify the placement on the mobile LIVE view before expanding density.
- Next technical bottleneck: T-junction ownership is still conceptually split between the old virtual `HEDGE_T_NWS` metadata in `gardens-joins.js`/world handling and the authored four-orientation overlay. Prefer consolidating T ownership into the registry/overlay path before adding more junction density.


## Validated Gardens Exclusive T-Junction Ownership — Compositions v19 / Overlay v2 / 2026-09-04
- Fresh reference review of current 32x32 top-down pixel-art packs reinforces keeping modular families explicit and machine-verifiable: Wardmarch uses complete mask families plus seam validation, while Emberfen/CRYPTSTONE emphasize consistent tile metadata, palette/light direction and nearest-neighbour presentation. Pixadom remains Kelo World's density/readability/consistency benchmark only; no external art or layout was copied.
- Removed the obsolete virtual `HEDGE_T_NWS` ownership from `gardens-joins`: `gardens-joins-v5` now contains only real endcap/mid tiles, exposes an empty `virtualTiles` contract, and declares T-junction ownership as overlay-only.
- `gardens-compositions-v19` keeps the same two authored T placements and exactly 41 declared Gardens cells, but now declares `tJunctionOwnership='registry-overlay-exclusive-v1'` and `legacyVirtualTJunctions=false`; no density, navigation, collision, movement or gameplay semantics changed.
- `gardens-junction-overlay-v2` is now the exclusive active visual owner of authored T-junctions, drawing the existing four-orientation `gardens-t-junctions-v1` atlas and reporting two authored placements with no legacy virtual ownership.
- Deterministic placement validation passed with all 41 declarations renderable and no road/landmark conflicts or duplicates. Kelo CI and GitHub Pages both completed successfully on head `e6fdd2ae30760e0dba10b95c6eef6ed987354b95`.
- Dedicated mobile LIVE validation passed at 390x844 CSS / 780x1688 physical pixels with `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`; authored T evidence measured `junctionGreen=970` and `junctionGold=38`.
- Manual inspection confirms the southwest T remains a crisp continuous hedge junction beside the hero after legacy ownership removal, with the ivory circulation unobstructed and no visible seam/regression at gameplay scale.
- QA rule validated: removing duplicate visual ownership must be certified both structurally (legacy registry path absent) and in the final LIVE frame; a dead renderer branch alone is harmless only while its registry entry is unreachable.
- Next technical bottleneck: `world-map.js` still contains an unreachable legacy `JT.HEDGE_T_NWS` special-case. Remove that dead branch in a dedicated low-risk cleanup, then consider promoting the T atlas from a compositions-local contract to a first-class TileRegistry atlas before adding more junction density.


## Validated 2026-09-04 — Gardens T-junction atlas promoted to first-class TileRegistry ownership

- `assets/gardens-t-junctions-v1.svg` is now registered through `src/environment/gardens-t-junction-registry.js` as `KELO_TILE_REGISTRY.atlases.gardensTJunctions` (`gardens-t-junctions-v1`), a 128×32 atlas containing four 32×32 T-junction orientations.
- `gardens-compositions-v20` consumes the TileRegistry-owned atlas rather than duplicating atlas metadata locally, and `gardens-junction-overlay-v3` is the active visual owner for the authored T pieces.
- The existing Gardens density contract is unchanged: 41 declared cells and 2 T-junction placements. No movement, collision, economy, combat, networking, chat, inventory, or other gameplay system was changed.
- Validation passed on mobile at 390×844 CSS / 780×1688 physical pixels. The LIVE report recorded no console errors, failed requests, or HTTP errors, and visual inspection showed the hedge junction near the hero remaining continuous and readable without an obvious seam.
- A stale browser-cache risk was found after the overlay contract changed from v2 to v3. The `index.html` script query was bumped to `gardens-junction-overlay.js?v=3`, then the LIVE audit was repeated successfully.
- Next safe bottleneck: remove the now-dead `JT.HEDGE_T_NWS` special-case branch from `world-map.js` after proving no legacy caller still depends on it, so Gardens junction authority remains exclusively registry/composition/overlay driven.


## Validated 2026-09-04 — Gardens T-junction renderer ownership cleanup

- Public-reference takeaway: modern 32x32 top-down packs reinforce complete modular families, consistent palettes, explicit autotile metadata, and automated seam/placement validation. Pixadom remains a density/legibility/cross-device reference only; no art or layout is copied.
- `src/environment/world-map.js` is now `world-v1.18` and no longer contains the dead `HEDGE_T_NWS` special-case. T-junction visuals remain exclusively owned by the first-class `gardensTJunctions` TileRegistry atlas plus `gardens-junction-overlay-v3`.
- `KELO_WORLD_AUDIT.legacyTJunctionSpecialCase === false` is part of the runtime contract, and Gardens placement CI now fails if `HEDGE_T_NWS` returns to `world-map.js`.
- Declared Gardens placement validation remains 41/41 renderable with 0 conflicts and 0 duplicates.
- Mobile LIVE at 390x844 CSS / 780x1688 physical passed after reframing the evidence capture: `junctionGreen=962`, `junctionGold=35`, `dark=2464`, with no console, failed-request, or HTTP errors. The inspected capture keeps the T-junction visibly connected, preserves marble circulation, and avoids the large outside-world void found during QA.
- A cleanup regression in the first edit (`bounds().maxY` accidentally using `camera.x`) was caught and corrected before certification. Two intermediate LIVE framings were also rejected because they either hid the T-junction or exposed insufficient visual evidence.
- Next bottleneck: the authored T family is registry-owned, but it still renders through a late dedicated overlay wrapper. The next safe architectural improvement is to promote these authored junctions into the normal environment layer ordering so props/joins share one explicit render-layer contract rather than adding more density.


## Validated 2026-09-04 — Formal environment layer stack for Gardens T-junctions

- Runtime validated on GitHub Pages at commit `a77303f0e8296c791cd5f57d3a5e4b47d194e583` with Kelo CI, Pages deployment, and Gardens mobile LIVE audit all green.
- Introduced `src/environment/environment-layer-stack.js` as `environment-layer-stack-v1`, defining formal environment phases: `ground`, `ground_variation`, `transitions`, `paths_floors`, `decals_details`, `props_back`, `props_front`, and `vfx_weather_lighting`.
- Gardens authored T-junctions are no longer drawn by a bespoke late renderer wrapper. `gardens-junction-layer-v4` registers `gardens-t-junctions` into the formal `props_back` phase while preserving TileRegistry as atlas authority.
- Mobile LIVE validation at 390×844 CSS / 780×1688 physical pixels showed the T-junctions, hero and marble paths clearly with `consoleErrors=[]`, `failedRequests=[]`, and `httpErrors=[]`.
- Keep future environment overlays moving toward this shared layer contract instead of adding new independent renderer wrappers. The next safe candidate is the district decal/details pass.


## Validated 2026-09-04 — Deterministic PNG runtime atlas for district microdecals

- Runtime and audit contract validated on GitHub Pages at commit `09d3cd4a7e130b2b6f540829588357580c589c1b` with Kelo CI, Pages deployment, and the complete mobile LIVE screenshot audit green.
- `district-decals` keeps TileRegistry and the formal `decals_details` environment layer as its only runtime authority, but its 256×32 authored runtime atlas now loads from `assets/district-decals-v1.png?art=241` instead of SVG. The same eight 32×32 authored cells and 13 placements are preserved; no gameplay systems or layout were changed.
- The registry audit now exposes `runtimeFormat:'png'`. The dedicated LIVE microdecals gate confirmed `district-decals-registry-v1.2`, `district-decals-v2`, 13 placements, formal layer ownership, and `runtimeFormat:'png'` with no failed asset requests.
- Mobile LIVE at 390×844 CSS / 780×1688 physical pixels showed crisp readable petals/leaves and district microdetail around the hero and marble paths. The captured state reported `consoleErrors=[]`, `failedRequests=[]`, and `httpErrors=[]`.
- Audit drift discovered during validation was corrected: `live-gardens-audit.mjs` still hard-coded V6.22 / world-v1.17 / compositions-v18. It now consumes the workflow-resolved current contract and verifies the formal `props_back` T-junction layer instead of stale historical versions.
- Keep editable source assets when useful, but prefer deterministic raster PNG for shipped 32×32 pixel-art atlases when exact sampling and mobile consistency matter. Next bottleneck: only two environment families currently use the formal layer stack; the next safe migration should move another specialized visual pass into its declared phase before increasing environmental density.


## Validated Plaza Nature Formal Back Layer + Clipped Front Occlusion — Plaza Nature v2 / 2026-09-04
- Fresh public reference review keeps Pixadom as a density/readability/mobile-consistency benchmark only; its current roadmap continues to prioritize environmental design, furnishing and decorative layout variety. Recent 32x32 top-down packs such as Wardmarch and Emberfen reinforce explicit modular families, deterministic asset contracts and automated seam/arrangement validation. No external art or layout was copied.
- `src/environment/plaza-nature.js` now exposes `plaza-nature-v2` and registers the full Plaza Nature prop family as `plaza-nature-back` in the formal `props_back` environment phase instead of redrawing every tree/bush after all actors.
- Actor/prop depth now uses a clipped per-actor front-occlusion repaint only when an actor overlaps a prop and is behind its `baseY`. The old full-actor redraw path is removed (`fullActorRedraw=false`), reducing the risk that one behind actor forces another foreground actor behind the same prop.
- Existing TileRegistry atlas metadata, Plaza Nature placements and visual asset dimensions are unchanged. Movement, collision, economy, combat, networking, chat and inventory were not modified.
- Implementation commit `fd7378b98e2024b23deb132e040ae385f5abc195` passed Kelo CI run `33883122245`, GitHub Pages run `33883121133`, and complete mobile LIVE audit run `33883122277` on the same head.
- LIVE mobile evidence at 390x844 CSS / 780x1688 physical pixels remained crisp and visually stable in the Plaza and tree captures. All emitted audit reports finished with `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Validated architectural finding: the formal environment stack currently executes inside the world renderer before actors, so its declared `props_front` phase is not yet a truly generic post-actor phase. The next safe renderer improvement is an explicit post-actor/front environment hook so future occluding families can leave global `render` wrappers entirely.


## Validated Formal Post-Actor Environment Phase — 2026-09-04
- Current 32x32 top-down references such as Wardmarch and Emberfen reinforce registry/manifest-driven modular families, seam validation, nearest-neighbour sampling and deterministic authored assets. Pixadom remains a density/readability/consistency reference only; no external art or layout was copied.
- `environment-layer-stack-v2` formally separates pre-actor and post-actor timing. `props_front` and `vfx_weather_lighting` now execute through `drawPostActors()` after avatar rendering instead of inside the pre-actor world pass.
- `plaza-nature-v3` registers `plaza-nature-back` in `props_back` and `plaza-nature-front` in `props_front`, removing its global `render()` wrapper while preserving clipped actor-relative occlusion, four visual-only registry props and unchanged gameplay.
- `engine-c.js` adds one renderer-only integration call to `KELO_WORLD_RENDERER.drawPostActors(ctx)` after actors and before restoring the world transform.
- Runtime/audit head `166b92050a74b14b277e8aedc57d509756e99644` passed Kelo CI, GitHub Pages and the complete mobile LIVE audit. LIVE confirmed `environment-layer-stack-v2`, `postActorLayerCount=1`, `plaza-nature-v3`, `rendererWrapper=false`, and clean console/request/HTTP diagnostics.
- Manual inspection of the dedicated mobile Plaza Nature frame found no visible seam, blur or depth regression: the authored tree remains crisp, the hero/route hierarchy remains readable and the environment stays continuous.
- Next bottleneck: `plaza-depth.js` fountain and Luxe architecture still own specialized post-actor/depth wrappers. Migrate one visual-only front layer at a time into the formal stack, starting with the already split fountain back/front assets, without changing gameplay footprints or collisions.


## Validated fountain formal layer ownership v1.8 — 2026-09-04

- Central Plaza fountain now uses the authored PNG back/front pair through the formal environment layer stack: `plaza-fountain-back -> props_back/pre_actor` and `plaza-fountain-front -> props_front/post_actor`; the fountain no longer owns a global `render()` wrapper.
- LIVE validation exposed a renderer integration defect: the `engine-l.js` renderer proxy had dropped `drawPostActors()`, silently preventing formal `props_front` layers from executing. A minimal environment bridge was restored in fountain integration for this pass; post-actor execution is now proven LIVE (`frontDrawCount > 0`) and must remain a renderer invariant.
- Cache-bust the runtime script whenever a fountain contract version changes; stale Pages JS otherwise can invalidate a correct deploy audit.
- Fountain LIVE audit must use deterministic geometry around `baseY`, authored-asset pixel evidence, formal layer metadata, execution counters, and clean console/network checks. Do not gate on mutable per-frame `lastLocalDepth` telemetry while the animation loop is active.
- Certified at 390x844 CSS / 780x1688 physical mobile viewport with Kelo CI, GitHub Pages, focused Fountain LIVE and full mobile LIVE all SUCCESS; no console, failed-request or HTTP errors.
- Next architectural cleanup: preserve `drawPostActors()` generically inside any renderer proxy/wrapper (especially `engine-l.js`) so individual environment modules never need to repair the bridge themselves.


## Validated 2026-09-04 — World renderer proxies preserve the formal post-actor environment contract

- The formal environment layer stack remains the owner of `drawPostActors()` and `props_front` execution.
- `engine-l.js` plaza-ground wrapping must preserve an existing `drawPostActors()` method plus `environmentLayerStack` / `postActorLayerStack` flags instead of reducing `KELO_WORLD_RENDERER` to only `draw`, `districts`, `chunkSize`, and `ready`.
- `src/environment/luxe-kiosk-atlas.js` architecture wrapping must preserve the same post-actor contract. Runtime architecture contract is `architecture-prefab-renderer-v1.5`.
- LIVE validation at 390x844 CSS / 780x1688 physical confirmed `KELO_PLAZA_AUDIT.postActorContractPreserved=true`, `KELO_ARCHITECTURE_RENDERER.postActorContractPreserved=true`, fountain `postActorBridgeAvailable=true`, and fountain `postActorBridgeRestored=false`.
- The fountain formal back/front passes continued executing after the proxy fix, with the post-actor front pass redrawing front-side actors, and the LIVE audit reported no console errors, failed requests, or HTTP errors.
- Architectural rule: any future `KELO_WORLD_RENDERER` proxy/wrapper must explicitly forward the post-actor hook and layer-stack capability flags. Do not rely on a later landmark module to repair a renderer contract that an earlier proxy discarded.
- Visual review of the certified mobile fountain and Luxe screenshots showed no new seam, ordering regression, or loss of hero readability from this architectural fix.


## Validated Fountain Upstream Post-Actor Contract — Fountain v1.8 / 2026-09-04
- Current reference review continues to support explicit modular topology and readable environment layering: Wardmarch exposes 32x32 autotile families with machine-readable corner-mask metadata, while current top-down pixel-art packs document reusable floor variants, connections and shadow tiles. Pixadom remains a density/readability/consistency reference only; no art or layout is copied.
- Removed the local `KELO_WORLD_RENDERER` repair fallback from `src/environment/plaza-depth.js`. The fountain now requires the upstream renderer to provide `drawPostActors()` and refuses to initialize the formal front layer if that contract is missing, instead of silently wrapping/repairing the renderer locally.
- The fountain audit contract remains `plaza-fountain-v1.8` and adds `bridgePolicy: upstream-contract-required-v1`, with `postActorBridgeAvailable=true` and permanently expected `postActorBridgeRestored=false`. The focused LIVE gate now fails if any future proxy regression forces local bridge restoration or breaks `props_front/post_actor` execution.
- The initial validation exposed two QA/deployment issues and both were corrected before certification: CI still intentionally pinned the stable fountain v1.8 contract, so an unnecessary v1.9 bump was reverted; then the focused LIVE audit kept seeing cached `plaza-depth.js?v=215`, so the production cache key was advanced to `?v=216` and the audit was repeated.
- Final deployed runtime commit `e61949c8ae5971798eba35276139329d84260d1e` passed Kelo CI, GitHub Pages, the complete mobile LIVE audit and the focused fountain LIVE audit.
- Focused LIVE evidence at 390x844 CSS / 780x1688 backing canvas confirmed `environment-layer-stack-v2`, fountain back in `props_back/pre_actor`, fountain front in `props_front/post_actor`, `postActorBridgeRestored=false`, `bridgePolicy=upstream-contract-required-v1`, and actual execution counts of 183 back / 183 front draws in final state. The report contained `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of both deployed behind/front screenshots confirms the central marble/fountain composition remains visually continuous and the hero changes depth relative to the front rim correctly; no new seam or mobile readability regression was introduced by removing the fallback.
- Architectural rule validated: renderer capability preservation must be an upstream invariant. Environment features must not repair missing post-actor capabilities locally because that can hide regressions introduced by later renderer proxies.
- Next architectural bottleneck: Kelo Luxe still owns depth through a global renderer/render wrapper even though it now preserves the post-actor contract. The next safe migration is to move one Luxe visual depth component into formal `props_back` / `props_front` layers without changing placement, collision, store interaction or gameplay semantics.


## Validated 2026-09-04 — Kelo Luxe formal depth layers

- Kelo Luxe is now rendered through `environment-layer-stack-v2` instead of owning global renderer wrappers: `luxe-architecture-back` runs in `props_back/pre_actor` and `luxe-architecture-front` runs in `props_front/post_actor`.
- The authored boutique asset, placement, collision rectangle, interaction point/radius, and occlusion geometry remain unchanged; the migration is render-ownership only.
- LIVE mobile certification at 390×844 CSS / 780×1688 physical confirmed `architecture-prefab-renderer-v1.6`, `authored-raster-v1.9`, both formal Luxe layers ready, `rendererWrapped=false`, `depthWrapped=false`, and `postActorContractPreserved=true` with clean console/network/HTTP diagnostics.
- Deployment lesson: a LIVE workflow started before GitHub Pages finished can retain the previous architecture script in one browser context even after Pages becomes current. Do not treat that as an art/runtime regression; rerun the audit after Pages completion and require the expected runtime version before certification.


## Validated 2026-09-04 — Deterministic environment layer ordering

- `environment-layer-stack-v2` now exposes an explicit ordering contract, `phase-priority-id-v1`: environment layers are resolved by formal phase, then numeric priority, then lexical layer id. This preserves the previously observed draw order while making it machine-verifiable instead of implicit.
- The runtime audit now exposes `orderingPolicy`, `priorityTieCount`, `priorityTies`, `orderIndex` and `orderKey` for every registered layer. LIVE currently reports two same-priority groups: `props_back:20` contains `gardens-t-junctions`, `luxe-architecture-back` and `plaza-nature-back`; `props_front:20` contains `luxe-architecture-front` and `plaza-nature-front`.
- These ties are deterministic and the certified screenshots show no current visual regression, so priorities were intentionally not renumbered. Future priority changes should be driven by a demonstrated spatial-overlap/depth conflict rather than by forcing globally unique numbers.
- Runtime commit `a064deae4ab4a677bb968518647e183549034ec0` introduced the ordering contract. Final QA head `706b858d91d7839e7350ee2b33cca99f41266540` hardened the Gardens workflow and LIVE auditor to require the new contract.
- Kelo CI, GitHub Pages and the stricter Gardens mobile LIVE audit all passed. A full mobile LIVE rerun after Pages completion also passed at 390x844 CSS / 780x1688 physical with `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Validation exposed two stale QA assumptions and one deployment false-positive: the Gardens workflow and Gardens runtime validator still expected the old v1 layer stack, and the first full LIVE run completed before Pages served the new runtime. All three were rejected/corrected before certification; the accepted audits explicitly require `phase-priority-id-v1` and per-layer order metadata.
- Next ordering bottleneck: the stack can now reveal ambiguous same-priority families, but it does not yet distinguish harmless district-separated ties from props that can actually overlap spatially. The next safe pass should audit spatial overlap/ownership for the `Luxe` + `Plaza Nature` pair before introducing semantic priority sub-bands.


## Validated spatial layer precedence — 2026-09-04

- `environment-layer-stack-v2.2` now supports explicit spatial ownership and AABB bounds for environment layers, while preserving the deterministic `phase-priority-id-v1` ordering contract.
- LIVE spatial audit identified a real overlap between `plaza-tree-nw` and `luxe-boutique-central` in both `props_back` and `props_front`: intersection `(1120, 1318, 96, 80)`.
- The previous equal priority (`20`) made this real overlap depend on lexical id order and caused the NW tree to render over the Kelo Luxe roof in the first LIVE screenshot.
- Validated resolution: `plaza-nature-back/front` use priority `10`; `luxe-architecture-back/front` remain priority `20`. Policy: `nature-before-architecture-on-overlap-v1`. Assets, placements, collision and interactions are unchanged.
- `same-phase-aabb-priority-resolution-v1` reports all physical same-phase overlaps separately from unresolved equal-priority spatial ties. Certified LIVE state: `spatialOverlapCount=2`, `spatialTieCount=0`, both overlaps `resolvedBy=priority`.
- `scripts/live-layer-spatial-audit.mjs` is now part of the full mobile LIVE workflow and requires the resolved ownership/priority contract. `scripts/live-world-audit.mjs` also requires `plaza-nature-v3.1`, `environment-layer-stack-v2.2`, priority `10`, and zero unresolved spatial ties.
- Final certified runtime/QA head: `6dad2cce9d9a320464e1720706def53057ee61c8`. Kelo CI, GitHub Pages and the complete 390×844 CSS / 780×1688 physical mobile LIVE suite passed; spatial report had `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Visual inspection of the final overlap frame confirmed the NW tree is behind Kelo Luxe rather than painted over its roof, while the tree remains visible beside/behind the building and the plaza remains readable.
- Durable rule: do not renumber equal layer priorities just because they tie. First declare bounds/ownership, prove a real spatial overlap, then add the smallest semantic priority rule needed to resolve that overlap. Extend spatial bounds to remaining prop layers before adding more dense scenery.


## Validated Spatial Ownership Coverage — Fountain + Gardens T-junctions / 2026-09-04
- Extended the existing `environment-layer-stack-v2.2` spatial contract to two previously unowned formal prop families without changing their visuals, placement or gameplay semantics.
- Plaza fountain formal layers now declare `ownership='plaza-fountain-v1'` with one exact AABB for `plaza-fountain-back` and one exact AABB for `plaza-fountain-front`; the existing authored PNG pair, placement, base-Y and collider are unchanged.
- Gardens authored T-junctions now declare `ownership='gardens-t-junctions-v1'` and one 32x32 AABB per registry/composition placement. The validated LIVE state contains two T placements and therefore two spatial bounds; atlas, orientations, positions, density and navigation are unchanged.
- `scripts/live-layer-spatial-audit.mjs` now cache-busts and explicitly gates these ownership/bounds contracts so a future same-phase overlap involving fountain or Gardens junctions becomes observable instead of remaining `ownership='unspecified'` / `boundsCount=0`.
- Certified runtime head `11f32af9a05fd64dbaab3b11818b272f8b0ed834` passed Kelo CI, GitHub Pages and the complete mobile LIVE audit at 390x844 CSS / 780x1688 physical pixels.
- LIVE spatial diagnostics remained stable: `spatialOverlapCount=2`, `spatialTieCount=0`; the only physical overlaps are the already-known Plaza Nature ↔ Kelo Luxe pair, both resolved by priority. Fountain and Gardens T-junction bounds introduced no new spatial conflict. Final report had `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of the LIVE overlap frame confirmed no new seam, clipping or ordering regression; Kelo Luxe, Plaza Nature, marble paths, hero and nearby environment remain readable on mobile.
- Durable next step: `district-decals` is now the clearest formal environment layer still reporting `ownership='unspecified'` and `boundsCount=0`. Before increasing decorative density, give its 13 registry-authored placements spatial ownership/bounds so the same overlap gate can reason about decals versus future detail/prop families.


## Validated 2026-09-04 — District decal spatial ownership

- `district-decals` remains a registry-owned authored microdecal family with the same 13 placements, 32×32 tile size, PNG atlas, render phase `decals_details`, coordinates, visual density and gameplay behavior.
- The family now declares `ownership: registry-authored-district-decals-v1`; its formal environment layer exposes one conservative 32×32 AABB for each authored placement (`boundsCount: 13`). This makes the decals visible to the same spatial observability used by Plaza Nature, Luxe, the fountain and Gardens T-junctions without changing art or placement.
- LIVE certification requires the registry audit, district-decal audit and formal layer audit to agree on that ownership and on all 13 bounds. A LIVE run that still serves stale modules with `ownership: unspecified` / `boundsCount: 0` is not considered valid even if the visual screenshot otherwise renders.
- The initial LIVE run exposed exactly that cache false-green. The district decal module cache keys were advanced and the dedicated LIVE gate was tightened before accepting the result. CI also contained stale literal cache-key assertions and was updated to the validated keys plus static checks for the new spatial contract.
- Certified mobile evidence at 390×844 CSS / 780×1688 physical pixels showed `visiblePlacementCount: 2` in the Gardens capture, `spatialTieCount: 0`, no new spatial overlaps caused by the decals, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`. Visual inspection confirmed the microdecals remain subtle, pixel-crisp and subordinate to the hero/path hierarchy.
- Architecture consequence: every layer currently registered in `environment-layer-stack-v2.2` now exposes explicit ownership and at least one bound. The next structural gap is lower terrain ownership: the formal stack defines `ground`, `ground_variation`, `transitions` and `paths_floors`, but the LIVE layer list currently begins at `decals_details`; terrain/grass/path passes are therefore the next candidates for incremental formalization rather than adding more decorative density.


## Validated Commerce Marble Variation — World v1.19 / 2026-09-05
- Distrito Comercio now opts into the existing authored eight-variant marble overlay through `TileRegistry` district profile metadata (`marbleVariation:true`) and the marble variation scope is explicitly `gardens-commerce-roads`.
- `world-map.js` no longer hard-codes authored marble variation to Gardens; it follows each district profile's `marbleVariation` flag. This makes future district opt-ins data-driven without another renderer-specific condition.
- No gameplay coordinates, collision, movement, economy, combat, networking, chat or inventory behavior changed. The pass only changes visual ground rendering policy and cache keys.
- Validation caught a false implementation before certification: adding the Commerce flag to TileRegistry alone did not alter LIVE rendering because the renderer still required `d.id==='gardens'`. The hard-coded district check was removed before acceptance.
- Validation also caught stale Gardens workflow assertions for old environment layer/junction cache keys; those QA checks were aligned to the already-live v2/v5 contracts rather than changing runtime behavior to satisfy stale tests.
- GitHub Pages, Kelo CI and the complete mobile LIVE audit all passed on head `eb4489574c8f774d59a82428efdb57f9f778afe2`. The dedicated Commerce evidence rendered at 390x844 CSS / 780x1688 backing canvas with `activeDistrictLabel='commerce'`, `commerceMarbleVariation=true`, eight marble variants loaded, and no console, failed-request or HTTP errors.
- Manual inspection of `live-commerce-marble.png` confirms the ivory Commerce approach now has restrained authored cracks/speckle variation instead of reading as a completely uniform white carpet; the effect remains subtle enough that the player and parcel/architecture footprint remain dominant on mobile.
- Next bottleneck: Arena still has broad uniform ivory navigation/pad surfaces, but it should not automatically inherit Commerce's treatment. The next pass should evaluate a district-specific Arena floor rhythm (wear/cracks or a restrained stone family) while preserving material identity and mobile readability.


## Validated Plaza NPC Silhouette Refinement — 2026-09-05

- Public reference pass: Pixadom remains useful for browser/mobile MMO density, readability and coherent NPC presence without copying art or layouts. Recent 32x32 top-down character/tileset work also reinforces compact footprints with clearer silhouettes, controlled palette families and role-readable details rather than enlarging gameplay footprints.
- The highest visible mismatch in the Plaza was the service-NPC family: Portero, Joyero and Maestro were already routed through `TileRegistry` and a modular 3-cell `plaza-npcs-v1.svg` atlas, but the authored figures still read as large rectangular placeholders beside the detailed hero and plaza environment.
- `assets/plaza-npcs-v1.svg` was refined in place without changing its 288x96 atlas contract, 96x96 cells, TileRegistry mapping, gameplay positions, dialogue, movement, networking or minigame behavior. Portero now has a stepped blue uniform/cap/staff silhouette, Joyero a forest/gold jeweler silhouette with tray/gem/loupe cues, and Maestro a burgundy layered mantle/hat/staff silhouette.
- Implementation commit: `d7095259742e69cc2f8b7a1e29769feeeccf7320` (`art: refine Plaza NPC silhouettes`). Local raster validation preserved the audit colors above threshold before push.
- Validation: Kelo CI run `33941490874` passed; Asset Contract CI `33941490900` passed; Pages deployment `33941490231` passed; LIVE mobile audit `33941490791` passed after Pages. NPC LIVE state reported `ready=true`, `assetLoaded=true`, `failed=false`, `fallbackActive=false`, `gameplayAnchorsPreserved=true`, `npcCount=3`, canvas 390x844 CSS / 780x1688 physical, with `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of `live-plaza-npcs.png` and `live-plaza-portero.png` confirms the new role silhouettes are visible in production and improve immediate NPC differentiation. It also shows the next bottleneck clearly: the Plaza service-NPC atlas still uses a coarse geometric body language compared with the hero sprite family. The next safe pass should improve character anatomy/proportions and pixel-cluster shaping (or migrate this family to a richer raster authored atlas) while preserving the same registry cells and gameplay anchors.


## Validated Plaza NPC Anatomy Refinement — 2026-09-05

- Public reference pass reconfirmed the direction without copying assets or layouts: Pixadom remains a useful browser/mobile benchmark for dense but readable environments and coherent NPC presence; current top-down asset work also emphasizes consistent palettes, modular atlases and crisp nearest-neighbour presentation.
- The remaining Plaza NPC mismatch was not role identity but body construction: Portero, Joyero and Maestro still read as wide stacked rectangles beside the substantially richer hero art.
- `assets/plaza-npcs-v1.svg` was refined in place while preserving the existing 288x96 atlas, three 96x96 cells, TileRegistry mapping and gameplay anchors. The new construction narrows heads and torsos, uses stepped shoulder/arm/leg silhouettes and keeps each role accessory outside the body mass for faster mobile recognition.
- Implementation commit `fa2ab25bc6886d480d60cb4a976ea708e48a9564` (`art: refine Plaza NPC anatomy`) passed Kelo CI, Asset Contract CI, GitHub Pages and the complete mobile LIVE audit.
- LIVE audit run `33944107182` passed at 390x844 CSS / 780x1688 backing canvas. `npc-report.json` confirmed `ready=true`, `assetLoaded=true`, `fallbackActive=false`, `npcCount=3`, `gameplayAnchorsPreserved=true`, with `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Manual inspection of `live-plaza-npcs.png` and `live-plaza-portero.png` confirms the silhouettes are less block-like and remain readable against the authored plaza. The service NPCs are still intentionally much simpler than the hero, so the next safe bottleneck is moving this family from geometric SVG construction toward a genuinely authored pixel-character raster atlas or equivalent higher-fidelity character pipeline, without changing the 96x96 cells or gameplay anchors.


## Validated Phase 5 — Building / Prefab Contract v2 (2026-09-05)

- **Status:** CLOSED for the current authored architecture path after exact LIVE validation.
- **Contract:** `src/environment/prefab-contract.js` v1.1.0 (`data-driven-building-prefabs-v2`). Prefabs can declare render parts by asset/frame, `props_back` / `props_front`, offsets, world size, opacity, collider, footprint, interaction/entrance, doors, shadows, overlays, animation metadata, occlusion, district compatibility and ownership without teaching the generic renderer a building type.
- **Renderer:** `src/environment/generic-prefabs.js` v1.2 consumes the normalized render plan; the renderer does not branch on boutique/castle/building identity. A synthetic split-prefab test proved base/front parts can use separate assets/frames without renderer changes.
- **Depth defect discovered and fixed:** `engine-l.js` wrapped `KELO_WORLD_RENDERER` while preserving `drawPostActors` but silently dropped `drawPreActors`, so a valid prefab back part never reached `props_back`. The wrapper now preserves both pre-actor and post-actor contracts and their capability flags.
- **QA hardening:** `scripts/live-prefab-audit.mjs` now waits for `KELO_PLAZA_AUDIT.preActorContractPreserved === true` and verifies a real back draw plus front occlusion. `.github/workflows/live-prefab.yml` now triggers when `engine-l.js` or the formal environment layer stack changes, preventing this regression from escaping again.
- **Validated LIVE evidence:** Generic Prefab LIVE audit run `33963503184` passed on commit `1e5fd7a35f8f39ccb20a178e74400d6610d976be`; mobile canvas was 390x844 CSS / 780x1688 backing, `backDrawCount=1`, `frontOcclusionDrawCount=1`, one live collider, pre/post actor contracts preserved, and console/page/request/HTTP error lists empty. The screenshot was manually inspected and the boutique, player occlusion, plaza/fountain edge and surrounding props remained visually coherent.
- **CI / deployment:** Kelo CI run `33963503192` passed and Pages run `33963502209` deployed the exact same commit successfully.
- **Future rule:** Any wrapper around `KELO_WORLD_RENDERER` must preserve the complete base/pre-actor/post-actor contract, not only `draw()` or `drawPostActors()`.
- **Next structural bottleneck:** Phase 6 — District Visual Profiles. Move district identity, bounds, terrain/profile mapping, visual families, density/variation and landmark/architecture declarations out of renderer-specific constants, then prove two materially different districts consume the same data-driven contract.


## Validated Atlas Architecture Phase 7 Closure — 2026-09-05

- **Status:** Phase 7 Atlas Architecture is closed for the current art pipeline contract.
- **Ownership:** `kelo-atlas-contract-v1` is now `1.2.0` and is the sole image-creation owner for managed environment atlases. Consumers acquire by registry key and must not rewrite asset URLs.
- **World renderer:** `world-map.js` is `world-v1.24` and no longer creates terrain/Gardens `Image()` instances or appends a private `?world=` cache token. Terrain atlases plus `gardensBase`/`gardensJoins` are acquired through `KELO_ATLAS_CONTRACT`.
- **Generic consumers:** Generic Props and Generic Prefabs remain on `atlas-contract-managed-v1`; world terrain/Gardens now use the same ownership model.
- **Static gates:** Atlas Contract CI rejects direct world image loading, private world cache rewriting, missing managed-world ownership tokens, or a regression away from Atlas Contract 1.2. Kelo CI also rejects direct image loading in world/props/prefabs.
- **Validated CI:** Atlas Contract CI run `33971722955` passed. Kelo CI run `33971827995` passed after replacing stale checks for Atlas Contract 1.1.1 / `?v=1` with the current 1.2 contract; gates were strengthened rather than weakened. Pages run `33971827325` passed.
- **Validated LIVE:** Live Atlas Contract Audit run `33971953342` passed at 390×844 CSS / 780×1688 backing. Runtime reported `world-v1.24`, `atlasConsumerMode=atlas-contract-managed-v1`, `worldOwnsImageLoader=false`, Atlas Contract `1.2.0`, 17 managed records, zero contract violations, terrain atlases ready, Gardens base/join loaded, and `consoleErrors=[]`, `pageErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- **Visual inspection:** Mobile Plaza and Gardens captures were inspected after LIVE validation. Plaza fountain/depth, roads, terrain, character readability and Gardens paths/vegetation remained coherent; no missing textures or obvious structural regression was observed.
- **Boundary for Phase 8:** role-aware residency, true district-time lazy loading/eviction, decoded-image memory budgets, chunk-cache budgets, DPR/backing-canvas limits and performance telemetry belong to the Mobile Performance Contract rather than reopening Atlas Architecture ownership.


## Validated Commerce Arcade Family — 2026-09-05
- Distrito Comercio now has a prefinal authored public-architecture family derived from the existing original `commerce-arcade-v1.svg` source and rasterized into production PNGs: `assets/commerce-arcade-west-v1.png` and `assets/commerce-arcade-east-v1.png`, each 160x432 RGBA with transparent background and nearest-neighbor sampling.
- Both assets are registered in the production asset manifest and TileRegistry as `commerce-architecture` and consumed through the generic Prefab Contract; no Commerce-specific renderer branch was added.
- Mobile QA rejected the first 144x384 world-pixel placement as too dominant. The accepted composition renders each arcade at an exact 50% scale, 80x216 world pixels: west at x=1936,y=1736 and east at x=2692,y=1736, with 64x20 base footprint/collider strips, priority 24, district `commerce`, and ownership `commerce-authored-arcade-v1`.
- The arcades frame the outer Commerce edges instead of filling the center. The player-owned parcel remains gameplay-owned and untouched; the central pedestrian/readability area stays open.
- LIVE 390x844 current-world audit validated the two PNG resources at HTTP 200, five architecture prefabs loaded consistently, Generic Props/Rural/Plaza authored contracts ready, and zero console, failed-request or HTTP errors. Manual screenshot inspection accepted the tuned west/east/center composition as prefinal.
- Registry extensions must preserve the base `TileRegistry.version`. `district-decals-registry.js` and `gardens-t-junction-registry.js` were corrected after LIVE audits exposed hard-coded historical version rewinds.
- Do not revisit the arcade scale unless a later LIVE screenshot demonstrates a real composition problem. Commerce remains incomplete: next visual priority is public-realm density around these anchors—pavement edges, awnings/signage, lamps/planters and broader façade rhythm—while preserving clear routes and the player parcel.

## Non-goals During Visual Passes
Do not casually alter unrelated systems such as:
- core movement feel;
- combat/abilities;
- economy;
- login/networking;
- chat;
- inventory logic;
- PvP logic;
unless a minimal integration change is strictly required.

## Definition of Visual Success
A visual pass is successful only when:
- it improves the live screenshot, not just the source code;
- the scene reads clearly on mobile;
- environment quality approaches the hero sprite quality;
- there are no new console errors;
- no unrelated gameplay system regresses;
- the result remains original to Kelo World.
## Validated Gardens Registry-Owned Fixed Accents — World v1.16 / Compositions v5 / 2026-09-03
- Repository inspection found a remaining architecture leak in Jardines: ten authored fixed accents (four oriented hedge corners, two water cells, two plinths and two stepping-stone cells) were still owned by a renderer-local hard-coded placement object even though the surrounding hedge/flower compositions had already moved into the registry extension.
- `gardens-compositions-v5` now owns those ten placements through `fixedPlacements` with `fixedPlacementMode=registry-authored-fixed-accents-v1`. `world-map.js` builds one garden-cell map from authored compositions plus fixed placements and advanced to `world-v1.16`; exact coordinates, four corner rotations, footprints, fountain/path clearances and density are preserved.
- This is a visual-architecture refactor with intentionally unchanged composed appearance. No movement, collision, economy, combat, networking, chat or inventory behavior changed.
- Kelo CI and the dedicated Gardens mobile LIVE audit passed on the implementation head. LIVE validated 390x844 CSS / 780x1688 backing canvas, eleven compositions, ten registry-owned fixed placements, the existing layered fountain and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of the LIVE frame confirmed no seam, placement, route-clearance or density regression. The value of this pass is that future hedge L/T junction work can now stay in the composition/registry vocabulary instead of adding another renderer-local placement table.
- Current Gardens bottleneck: several hedge runs still read as isolated ornaments rather than connected garden boundaries. The next safe pass should add one real modular L/T junction through the existing join atlas + registry composition data, keeping current path and landmark clearances unchanged.


## Validated Gardens Declared→Renderable Gate — 2026-09-03
- Current public 32x32 environment references reinforce an engineering rule that applies directly to Kelo World: authored terrain/prop kits should validate masks, seams and anchors automatically rather than assuming registered metadata will render. Wardmarch exposes complete mask families plus anchor metadata and compatibility testing; Emberfen publishes a reproducible seam/arrangement validator. Kelo uses these as architecture references only, while Pixadom remains a density/readability/consistency benchmark; no external art or layouts were copied.
- Added `scripts/validate-gardens-placements.mjs`, mode `declared-renderable-mask-validator-v1`. It reads the actual `ROADS`, `PADS`, `GARDEN_PATHS`, path cuts and Gardens v13 declarations, then checks every authored cell against the same road suppression and east-fountain clearance that can make overlays invisible. It also rejects duplicate authored coordinates.
- Deterministic validation passed with `declaredCellCount=41`, `renderableCellCount=41`, `conflictCount=0`, `duplicateCount=0`. `Gardens placement CI` run `33829168492` passed; Kelo CI for the hardened LIVE pass also passed.
- The recognized Gardens LIVE workflow was updated from stale v12 expectations to the current `registry-authored-garden-compositions-v13`, `authored-road-clear-placements-v8`, `navigationConflictFixCount=13` and `relocatedSteppingStoneAnchor=[9,16]`, and now runs the declared→renderable validator before Playwright.
- Final runtime commit certified: `172b751d4300d1c5c85a13ddc4daf4b2c0653914`. Gardens mobile LIVE run `33829377189` passed after GitHub Pages deployment. Evidence used 390x844 CSS / 780x1688 backing canvas; report ended with `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`, and strong palette evidence (`green=717621`, `ivory=539302`, `cyan=3304`). Manual screenshot inspection confirmed crisp mobile rendering, readable hero silhouette and clean green/ivory navigation contrast.
- Debug lesson validated: the first runtime-validator attempt accidentally altered the `drawMarbleVariation()` draw signature. That runtime change was fully reverted before acceptance (`3675692da15b93c0abe148ac5d1c410ecc00523b`), and the final solution was intentionally moved into deterministic CI/LIVE validation rather than adding renderer risk. A second audit defect was found: `scripts/live-gardens-variants-audit.mjs` still expected Gardens v12; it was corrected to v13 before the accepted LIVE run.
- Next visual bottleneck: Gardens no longer needs more one-off relocation fixes first. The visible scene is still strongly orthogonal/modular, especially where hedge runs and path framing meet. The next safe art pass should add authored L/T hedge or framing junction variants through the existing joins/composition registry, preserve road/landmark clearances, and keep the new declared→renderable gate mandatory before LIVE acceptance.

## Validated PNG Asset Contract Coverage — 2026-09-05
- The existing `kelo-art-asset-contract-v1` manifest now covers all production PNG paths currently referenced directly by `TileRegistry`, including `assets/tileset-vclean.png`, `assets/plaza-ground-v1.png` and `assets/kelo-luxe-boutique.png`; the manifest currently validates 11 authored PNG assets.
- `scripts/validate-art-assets.mjs` now enforces TileRegistry PNG -> manifest parity, so a production registry PNG cannot silently bypass the central dimensions/grid/transparency gate. SVG families remain outside this PNG-specific parity rule until their final raster replacements arrive.
- PNG transparency validation now accepts both direct alpha color types and valid indexed/truecolor transparency declared through a PNG `tRNS` chunk. This was required by the existing indexed `kelo-luxe-boutique.png`; the contract was corrected rather than weakened.
- The first Asset Contract CI run correctly exposed that indexed-transparency assumption. After the validator fix, Asset Contract CI and Kelo CI passed, and GitHub Pages deployed successfully.
- The first full LIVE mobile audit exposed a separate stale QA assertion: the auditor still hard-coded `gardens-commerce-roads` while the source TileRegistry and LIVE renderer use `gardens-commerce-arena-roads`. `scripts/live-world-audit.mjs` now derives the expected marble scope from TileRegistry source, preventing that contract string from drifting independently again.
- Final complete mobile LIVE audit run `33939094752` passed all world, layer-spatial, Gardens, district-decals, rural, Plaza NPC, Luxe, fountain and nobility gates. The final 390x844 CSS / 780x1688 backing-canvas report recorded `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`; manual inspection found no visual regression to plaza/path/grass readability from this pipeline-only change.
- Manual LIVE inspection also exposed the next larger visual bottleneck: several Plaza NPC/service figures still read as square procedural placeholders beside the high-detail hero and authored plaza. Do not spend the next round polishing grass/marble noise first; replace or route those placeholder figures through the existing registry-driven authored NPC visual family while preserving their gameplay anchors and mobile legibility.

## Validated Asset Contract v2 — 2026-09-05
- Phase 1 asset-level contract is now closed as `kelo-art-asset-contract-v2`. All 11 production PNG entries declare machine-readable family, semantic version, dimensions/alpha/sampling, padding/spacing, frames, anchor, visual bounds, footprint, collider, ownership, formal render layers, priority, occlusion, district compatibility, cache policy and fallback policy. Concrete world coordinates remain owned by TileRegistry/profile/prefab data rather than duplicated into the manifest.
- `scripts/validate-art-assets.mjs` now validates the production metadata above, exact frame/grid coverage including padding/spacing, fallback references, formal `environment-layer-stack.js` phase parity, district compatibility and TileRegistry PNG parity. For the 9 PNGs loaded directly by TileRegistry it additionally verifies the manifest cache key/value against the actual runtime query string, preventing stale-art cache metadata from drifting silently.
- `scripts/live-asset-contract-audit.mjs` now requires the complete v2 manifest from published GitHub Pages and verifies LIVE environment-layer phase parity before accepting the mobile audit.
- Validation for implementation commit `4ac80378165c06f1b13c0b2fa12c791f1fbcdebf`: Asset Contract CI run `33947288794` PASS; Kelo CI run `33947288806` PASS; GitHub Pages run `33947288353` PASS; Live Asset Contract Audit run `33947288953` PASS; general Live mobile screenshot audit run `33947288813` PASS.
- LIVE Asset Contract report exposed `kelo-art-asset-contract-v2`, 11/11 assets with complete production metadata, 9 query-cache assets, 2 runtime-owner assets, TileRegistry `1.11.1`, world `world-v1.19`, layer stack `environment-layer-stack-v2.2`, 390x844 CSS / 780x1688 backing canvas, `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`. Manual screenshot inspection found no visual regression from this metadata/validation-only migration.
- Do not spend the next pipeline round on provisional art. The next structural bottleneck is Phase 2 Terrain Contract: the current authored transition system still exposes a fixed 4-neighbour `transitionMasks` table and Plaza-specific topology ownership. Generalize terrain connectivity into data so a new terrain pair can be registered without a district/terrain branch in the renderer; compare bitmask/Wang/hybrid topology only as needed to make that concrete decision.

## Validated Terrain Contract — Phase 2 / 2026-09-05
- Phase 2 is closed for the current world-ground vocabulary through `src/environment/terrain-contract.js` v1.2.0. Terrain semantics are explicit data: material definitions, district terrain profiles, transition pairs, side bits and authored mask-to-frame mappings. Current production materials are `grass` and `marble`; the current pair is `marble_to_grass` using `edge-bitmask-4-v1` with all sixteen top/right/bottom/left masks.
- `src/environment/world-map.js` is `world-v1.21` / `contract-driven-materials-v2`. It resolves material families and profiles from the Terrain Contract, enumerates transition sets generically, and discovers/loads required terrain atlases from contract metadata. The active world renderer no longer binds the four production terrain atlases directly, no longer owns a marble-specific `roadMask()`, and no longer consumes `TileRegistry.transitionMasks` for world-road transitions.
- `scripts/validate-terrain-contract.mjs` plus `Terrain Contract CI` validate material/family/atlas references, profile references, all 16 transition masks and atlas bounds, dynamic atlas discovery and renderer-source invariants. A synthetic `stone` + `stone_to_grass` extension proves that a future terrain/transition atlas dependency is discovered through data without adding a new renderer branch.
- Topology decision: keep the existing four-neighbour edge-bitmask model for the current authored 16-cell overlay because it exactly matches the shipped terrain-transition vocabulary. Do not preemptively add Wang/diagonal complexity; extend the contract only when future authored inner-corner/diagonal terrain art requires information the 4-neighbour topology cannot represent.
- Validation caught one stale certification assertion after the renderer moved from contract-driven v1 to v2; the runtime was healthy and the test was corrected rather than weakening the gate. Final Kelo CI and Terrain Contract CI passed.
- LIVE mobile audit run `33950034709` validated 390x844 CSS / 780x1688 backing canvas with `terrainContractVersion=1.2.0`, `terrainRendererMode=contract-driven-materials-v2`, 2 materials, 1 transition set and 4 terrain atlases discovered from metadata. Final diagnostics were `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`. Manual Plaza and Gardens screenshot inspection found no missing terrain, path seam or transition regression.
- Next structural bottleneck is Phase 3 Generic Prop System: prop instance semantics and drawing are still split across specialized environment modules. Consolidate asset/frame/position/anchor/bounds/footprint/collider/layer/priority/district/occlusion metadata into one generic prop path before adding more decorative art.

## Validated Generic Prop Pipeline — Phase 3 foundation / 2026-09-05
- Added `src/environment/prop-contract.js` v1.1.0 and `src/environment/generic-props.js` as the first reusable, data-driven prop renderer. Prop definitions now carry asset/frame, position/size, anchor, visual bounds, footprint, collider mode, district, occlusion, priority and layer-group metadata instead of requiring a dedicated draw implementation.
- The four existing Plaza nature props were migrated off their specialized `drawProp`/`drawBack`/`drawFrontOcclusion` renderer. `src/environment/plaza-nature.js` is now only a compatibility/bootstrap surface; the actual drawing path is generic.
- Generic prop layer registration is metadata-driven by `layerGroups`: layer id, ownership, priority and back/front phase are contract data. This preserves the validated `plaza-nature-back` / `plaza-nature-front` spatial contract while allowing future prop families to declare different groups without adding renderer branches.
- `Generic Prop Contract CI` rejects missing core metadata and prop-specific branches in the generic renderer. Kelo CI and Generic Prop CI both passed on commit `fba0c78ba7e665a8e63352ef8044c32cfe5a800b`.
- GitHub Pages deployed that exact commit successfully. LIVE mobile audit then passed at 390x844 CSS / 780x1688 backing canvas with `genericPropContract=true`, prop contract `1.1.0`, `rendererMode='data-driven-props-v1'`, four Plaza nature props, stable back/front layer IDs and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- A deployment-race false positive was detected during the first audit attempt because the artifact still showed the pre-migration nature renderer. It was not accepted; validation was repeated after Pages deployment. This reinforces the rule that artifact state, not workflow green alone, must prove the new contract is LIVE.
- Phase 3 is NOT globally closed yet: only Plaza nature is migrated. Next priority is to migrate at least one materially different prop family through the same contract and prove that no new renderer branch is required before declaring Generic Prop System complete.

## Phase 3 — Generic Prop System closed (2026-09-05)
- Validated `KELO_PROP_CONTRACT` v1.2.0 / `generic-props-v1.2` with two materially different real families: Plaza nature (96x96 authored sprites using layer-stack back/front actor clipping) and Rural farm boundary (32x32 modular fence/gate/sign/weed/stone frames built dynamically from contract metadata).
- `rural-ground.js` no longer loads or frame-renders `rural-props-v1.png` itself; the generic renderer owns asset loading and frame drawing. No family- or asset-specific branch was added to the generic renderer.
- The contract currently supports `renderMode: layer-stack | immediate`. `immediate` is a compatibility timing adapter because the existing `renderFarm()` hook runs after `props_back`; normalizing that timing belongs to Phase 4 rather than reintroducing a rural renderer.
- LIVE validation at 390x844 CSS / 780x1688 backing confirmed contract v1.2.0, generic renderer v1.2, Rural boundary source `ruralFarmBoundary`, no fallback, and no console/request/HTTP errors.
- Next bottleneck: Phase 4 must normalize dynamic visual instances into the formal `props_back -> actors -> props_front` ordering and retire the immediate timing adapter where safe, without touching farm gameplay.



## 2026-09-05 — Production art pipeline Phase 9 + Phase 10 closure (VALIDATED)

- **Phase 9 — PNG Validation Pipeline: CLOSED.** PNG changes are covered by binary/integrity, manifest/inventory/runtime-reference CI and automatic mobile LIVE auditing. Current production validation completed cleanly at 390x844 CSS / 780x1688 backing with `consoleErrors=[]`, `failedRequests=[]`, and `httpErrors=[]`.
- **Phase 10 — real A→B asset substitution: CLOSED.** `assets/grass-variation-v1.png` was replaced with a materially different compatible 128x64 / 8-tile PNG while the terrain renderer and gameplay remained untouched. The B asset rendered successfully through TileRegistry → Atlas Contract → Terrain Contract → world renderer.
- The substitution test exposed two hidden future-work traps and both are now part of the permanent contract: (1) replacing bytes alone is not sufficient when a cache token can keep serving an older artifact; cache/version metadata must change with a final PNG replacement, and (2) LIVE gates must not encode the exact colors/palette of the outgoing placeholder.
- `scripts/live-world-audit.mjs` now validates the active grass PNG generically by comparing the exact SHA-256 of the checked-out PNG against the bytes served by LIVE (`cache: no-store`), while still requiring correct registry identity, 8 authored variants, visible/nonblank rendering, screenshot evidence, current world/terrain/depth/prop/prefab contracts, and zero console/request/HTTP errors. This makes the gate substitution-safe without weakening it.
- During the A→B proof, LIVE served the exact B SHA-256 `3688494b455b26186a30b396eabf5372f9a9f86c4e0458314ac3ee4b53e25f5b`; CI and mobile LIVE were green and the screenshot was personally inspected. The test PNG B was only a probe, not final art.
- After proof, the authored grass A and its original TileRegistry URL were restored in commit `7be6c4de7b556e0da4c66ff4b488eb0d5f04e028`. Kelo CI, Asset Contract, Terrain Contract, Atlas Contract, Prefab Contract, Pages, and mobile LIVE all passed. Final LIVE served exactly the restored A SHA-256 `62be338a574e2ad163ac9387a7d4e37ba85a90cf4e6a1ba1b33eba31d10ff3e9`; the 390x844 capture was personally inspected and showed Plaza/fountain/grass/actors/depth intact.
- **Global structural result:** Phases 1–10 of the production art pipeline are now closed. Supported final terrains, transitions, props, vegetation, fountains, buildings and landmarks should enter primarily as **PNG + metadata/cache version + TileRegistry + district profiles/prefabs**, with Atlas/Terrain/Prop/Prefab contracts consuming them. A supported asset replacement must not require renderer or gameplay edits.
- This closes the *pipeline architecture*, not the authoring of every final Kelo World art asset. The next work is content production/population through the contract rather than further renderer-specific infrastructure.
