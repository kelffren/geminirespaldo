## Validated 2026-09-04 — Kelo Luxe formal depth layers

- Kelo Luxe is now rendered through `environment-layer-stack-v2` instead of owning global renderer wrappers: `luxe-architecture-back` runs in `props_back/pre_actor` and `luxe-architecture-front` runs in `props_front/post_actor`.
- The authored boutique asset, placement, collision rectangle, interaction point/radius, and occlusion geometry remain unchanged; the migration is render-ownership only.
- LIVE mobile certification at 390×844 CSS / 780×1688 physical confirmed `architecture-prefab-renderer-v1.6`, `authored-raster-v1.9`, both formal Luxe layers ready, `rendererWrapped=false`, `depthWrapped=false`, and `postActorContractPreserved=true` with clean console/network/HTTP diagnostics.
- Deployment lesson: a LIVE workflow started before GitHub Pages finished can retain the previous architecture script in one browser context even after Pages becomes current. Do not treat that as an art/runtime regression; rerun the audit after Pages completion and require the expected runtime version before certification.
