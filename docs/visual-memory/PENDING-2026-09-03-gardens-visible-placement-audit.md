## Validated 2026-09-03 — Gardens authored placement visibility audit

- LIVE validation confirmed that authored garden metadata can be syntactically valid yet visually dead when `world-map.js` road/landmark masks suppress the overlay at render time. Treat `declared -> actually visible` as a required QA check before adding new garden props or junction art.
- `gardens-compositions-v7` relocates the complete NW flowerbed from road-conflicting cells to the confirmed grass pocket anchored at local `[8,8]`, preserving its 2-cell footprint, total authored density, paths, landmark clearance, and all gameplay systems.
- The composition audit now exposes `declaredCellCount: 41`, `navigationConflictFixCount: 5`, and `relocatedFlowerbedNWAnchor: [8,8]`; mobile LIVE passed at 390x844 CSS / 780x1688 canvas with no console, failed-request, or HTTP errors after GitHub Pages finished deploying.
- Continue the visibility audit one confirmed dead cluster at a time before increasing decorative density. Remaining candidates should be rechecked against the current road/landmark masks rather than assumed from registry presence alone.
