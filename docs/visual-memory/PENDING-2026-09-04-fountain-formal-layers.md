## Validated fountain formal layer ownership v1.8 — 2026-09-04

- Central Plaza fountain now uses the authored PNG back/front pair through the formal environment layer stack: `plaza-fountain-back -> props_back/pre_actor` and `plaza-fountain-front -> props_front/post_actor`; the fountain no longer owns a global `render()` wrapper.
- LIVE validation exposed a renderer integration defect: the `engine-l.js` renderer proxy had dropped `drawPostActors()`, silently preventing formal `props_front` layers from executing. A minimal environment bridge was restored in fountain integration for this pass; post-actor execution is now proven LIVE (`frontDrawCount > 0`) and must remain a renderer invariant.
- Cache-bust the runtime script whenever a fountain contract version changes; stale Pages JS otherwise can invalidate a correct deploy audit.
- Fountain LIVE audit must use deterministic geometry around `baseY`, authored-asset pixel evidence, formal layer metadata, execution counters, and clean console/network checks. Do not gate on mutable per-frame `lastLocalDepth` telemetry while the animation loop is active.
- Certified at 390x844 CSS / 780x1688 physical mobile viewport with Kelo CI, GitHub Pages, focused Fountain LIVE and full mobile LIVE all SUCCESS; no console, failed-request or HTTP errors.
- Next architectural cleanup: preserve `drawPostActors()` generically inside any renderer proxy/wrapper (especially `engine-l.js`) so individual environment modules never need to repair the bridge themselves.
