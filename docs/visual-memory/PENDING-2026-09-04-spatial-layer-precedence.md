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
