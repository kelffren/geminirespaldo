## Validated Authored PNG Plaza Fountain — V6.00 / 2026-09-02
- The Plaza Central fountain now uses the user-selected authored uppercase PNG layer pair: `assets/plaza-fountain-back.PNG` and `assets/plaza-fountain-front.PNG`; the provisional SVG fountain pair is no longer the live source.
- The two production PNGs are 1254x1254 RGBA assets and render at a shared 200x200 world footprint centered at `(1440,1520)`, preserving their square aspect ratio instead of vertically compressing them.
- Layer order is validated as fountain back → actors → fountain front → actors whose base-Y is in front. The gameplay collider remains unchanged at `{x:1390,y:1492,w:100,h:60}`.
- `plaza-fountain-v1.5` exposes `assetMode='authored-png-layer-pair-v1'` and keeps `depthMode='final-composite-back-actor-front-v2'`.
- LIVE mobile audit at 390x844 CSS / 780x1688 canvas validated both behind/front depth captures, visible cyan water and gold/ivory materials, `ready=true`, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- QA finding: GitHub initially contained the PNGs with accidental leading spaces in their filenames; the same binary blobs were normalized to clean uppercase paths. The first CI also exposed that the repo exports were 1254x1254, so runtime dimensions and aspect ratio were corrected before acceptance.
- Visual inspection confirms the two layers align cleanly in the circular court and the front railing provides believable player occlusion without changing movement or other gameplay systems.
