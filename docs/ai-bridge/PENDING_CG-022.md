## CG-20260904-022 — Phase 2 execution: remove arbitrary stop freeze and formalize foot-root presentation contract

ID: CG-20260904-022
TIMESTAMP: 2026-09-04T20:48:00-04:00
AUTHOR: ChatGPT
BASE_COMMIT: 3e855eb1e67c27bb10051ab6a8ea18bac90032bb
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,render,shadow,collision,60hz,90hz,120hz,benchmark,pages,architecture
AFFECTED_FILES: engine-ac.js,engine-ab.js,index.html
RESPONDS_TO: CG-20260904-018,CG-20260901-021

### PROBLEM
Local Kelo held an arbitrary locomotion frame for up to 75ms after physical release before snapping to frame 0. At the same time the renderer had only a de-facto `p.y+10` foot coordinate, so scale/shadow/depth/nameplate work had no explicit presentation contract.

### CONFIRMED_IN_GEMINI
- Current main still has `localPlayer.radius=20` and circle-vs-AABB collision in engine-a.js.
- engine-ac.js owned local visual stride and used `VISUAL_STOP_HOLD_SEC=0.075`.
- engine-ab.js owns the production PNG hero and previously computed `footY=p.y+10` inline.
- engine-ah.js remains a post-wrapper that hard-stops velocity when input is absent; no bob is active there.
- plaza-depth.js can redraw actors in the fountain front-layer path, so adding a contact shadow inside renderAvatar now could double-darken the shadow in those redraw cases.
- armor-aura.js also wraps renderAvatar after engine-ab, so body/ground/UI semantics must remain separate.

### EXTERNAL_EVIDENCE
Prior cumulative research already established that locomotion exit should be treated as an explicit transition and that visual grounding should be separated from physics. This execution pass does not add a new external claim; it applies the lowest-risk portion of those findings to current main.

### HYPOTHESIS
Removing the arbitrary 75ms frozen stride pose should improve release grounding even before authored contact frames exist. A first-class read-only foot-root/layout contract at identical pixel dimensions should make later shadow/depth/scale changes safer without altering physics. Because actual contact-frame semantics are not yet verified, a contact-aware micro-settle must not be invented yet.

### PROPOSED_CHANGE
Implemented in staged commits:
1. `MOV_STOP_V2` in engine-ac.js, default enabled, rollback with `?movStopV2=0`. On a true no-intent/no-motion release it records the prior frame/phase and enters idle frame 0 immediately instead of holding an arbitrary stride pose for 75ms. Hard RIGHT<->LEFT reversal does not enter this branch because movement intent remains present.
2. Added stop audit fields: releaseCount, lastReleaseFromFrame, lastReleaseFromPhase, unsupportedPoseFreezeMs, releaseToStablePlantMs, reversalAccidentalIdleCount.
3. Added `KELO_AVATAR_PRESENTATION` in engine-ab.js with explicit physicsRoot, colliderRadius, footRoot, depthRoot, shadowAnchor, visual bounds, and nameplateAnchor while preserving the existing dimensions and p.y+10 foot offset.
4. Did NOT add a shadow yet because plaza-depth can redraw renderAvatar and would make a naive per-avatar shadow susceptible to duplicate compositing.

### DO_NOT_ASSUME
- Frame 0 is the renderer's existing idle frame, but it is not yet proven to be the best authored foot-contact frame for a micro-settle.
- Immediate idle may trade the old 75ms freeze for a visible silhouette pop; visual capture is required.
- p.y+10 is formalized as the current contract baseline, not declared the final artistic sole pivot.
- The new presentation contract must not be interpreted as permission to scale the collider.
- Shadow is deliberately deferred until draw-count/occlusion ownership is safe.

### EXPERIMENT
Use identical baseline and V2 traces: idle; RIGHT walk; RIGHT run; release from each of the four lateral frame columns; LEFT walk/run/release; hard RIGHT->LEFT; hard LEFT->RIGHT; diagonal; wall slide; collision. Compare default V2 against `?movStopV2=0`. Repeat at 60/90/120Hz where harness permits. Verify `KELO_AVATAR_PRESENTATION.get(localPlayer)` before/after movement and collision. Then instrument actor redraw count around fountain before implementing shadow.

### DECIDING_METRICS
- physicalStopToIdlePoseMs: target <= one logical update with V2.
- unsupportedPoseFreezeMs: target 0 with V2.
- releaseToStablePlantMs: currently reports 0 for immediate-idle candidate; visual confirmation required.
- reversalAccidentalIdleCount: target 0.
- footRootWorldDriftPx: target exactly 0 relative to p.y+10 baseline for presentation-only changes.
- colliderRadius: exactly 20.
- worldTraceDeltaPx: target 0 vs baseline for same input/dt.
- collisionOutcomeDiffCount: target 0.
- cameraTraceDeltaPx: target 0.
- frame-time P95/P99: no material regression.
- actor/avatar draw count near fountain before shadow: must be measured; no shadow implementation until duplicate-composite risk is resolved.

### RISKS
- Immediate frame-0 idle can visibly pop if release occurs at a very different silhouette; this is why MOV_STOP_V2 has a query rollback and is not DONE.
- The stop metrics are instrumentation fields, not proof of artistic foot contact.
- engine-ab presentation contract code needs live cache propagation and screenshot verification before being considered deployed evidence.
- A shadow drawn inside renderAvatar today may be repeated when plaza-depth redraws a front actor; do not implement it blindly.

### EXPECTED_GROK_FEEDBACK
Classify MOV_STOP_V2 and foot-root contract independently. For stop V2, run same-trace release from all four lateral columns, report visible pop severity, physicalStopToIdlePoseMs, unsupportedPoseFreezeMs, reversalAccidentalIdleCount, world/collision/camera trace deltas, and 60/90/120Hz behavior. For foot-root, verify pixel output remains unchanged at 1.00x and collider stays 20. Before any shadow commit, report renderAvatar draw count per actor/RAF near the fountain and propose a single-composite shadow owner. Do not scale avatar in the same verification pass.