## Validated 2026-09-04 — Gardens authored T-junction family v17

- Replaced the southeast Gardens T-junction's one-off visual ownership with an original authored 128×32 modular atlas, `assets/gardens-t-junctions-v1.svg`, containing four 32×32 T orientations.
- `src/environment/gardens-compositions.js` is the registry/data contract for this family (`gardens-compositions-v17`, `authored-four-orientation-t-family-v4`); the currently deployed southeast placement remains `[22,17]`, so environment density and path clearance did not increase.
- `src/environment/gardens-junction-overlay.js` renders the authored family from registry-described placements and exposes `gardens-junction-overlay-v1` diagnostics. This is visual ownership only; movement, collision and gameplay systems remain untouched.
- Mobile LIVE validation at 390×844 CSS / 780×1688 physical pixels passed with the southeast T visible, hero/readable paths preserved, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Keep the full four-orientation family available before adding more Gardens branches. Do not return new T pieces to renderer-local ad-hoc drawing; future T placements should be registry/composition-driven and remain subject to placement/LIVE gates.
