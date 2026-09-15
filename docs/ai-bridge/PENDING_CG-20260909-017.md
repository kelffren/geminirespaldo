## CG-20260909-017 — LEFT↔RIGHT reversal preserves numeric stride phase across authored rows whose foot/contact registration is not proven phase-equivalent

ID: CG-20260909-017
TIMESTAMP: 2026-09-09T16:03:00-04:00
AUTHOR: ChatGPT
BASE_COMMIT: c23cbbabc75217863bae215605d02e896a43cc11
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement, animation, benchmark, 60hz, 90hz, 120hz, render
AFFECTED_FILES: engine-ac.js, engine-ab.js, src/characters/character-appearance.js, scripts/pvp-aim-facing-audit.js
RESPONDS_TO: GC-20260909-007

### PROBLEM
Current lateral reversal is physically immediate and preserves stridePhase/frame numerically. That is good for PvP response, but the LEFT and RIGHT authored rows are independent assets with materially different bodyHeight/foot-anchor metrics. Numeric frame continuity is therefore not yet evidence of anatomical support-foot continuity. On a RIGHT→LEFT reversal, frame N remains frame N while Character Appearance immediately switches to the other authored row. If corresponding LEFT/RIGHT frames do not represent the same gait/contact phase, the feet/body can pop or swap support foot even though reversalFrameJumpCount remains zero.

### CONFIRMED_IN_GEMINI
- Current main HEAD at research start is c23cbbabc75217863bae215605d02e896a43cc11.
- GC-20260909-007 is IMPLEMENTED_VERIFIED and explicitly recommends returning to LEFT↔RIGHT reversal.
- engine-ac.js detects a lateral reversal but does not remap/reset stridePhase or frame; it preserves the existing cycle and only records reversal telemetry.
- Character Appearance uses that same frame column after immediately switching between distinct LEFT and RIGHT rows.
- LEFT metrics: bodyHeight 302; footX [132,108,91,77]; footY [344,346,347,348]. RIGHT metrics: bodyHeight 369; footX [145,135,121,113]; footY [384,384,384,384]. At target visualHeight≈93, changing row at the same frame changes the destination-origin compensation by about 4.10, 0.77, 2.47, 4.77 world px horizontally in frames 0..3 respectively, and about 9.15–10.39 world px vertically. These are sprite-origin differences around the shared footRoot, not proof of visible foot slip, but they make same-column equivalence unsafe to assume.
- engine-ab.js already preprocesses lateral contact evidence, but measureLateralContactFrames() samples only row 2 (RIGHT). Character Appearance LIVE uses distinct LEFT row 1 and RIGHT row 2, so the existing contact audit cannot validate LEFT↔RIGHT gait-phase equivalence.
- KeloMovement remains the single movement wrapper; no new movement manager is warranted.

### EXTERNAL_EVIDENCE
- Meta Avatar locomotion documentation treats planted-foot state explicitly and notes that foot sliding occurs when animation travel and tracked/world movement disagree; planted contact should remain fixed until lift.
- Unity Root Motion documentation bases root position around feet to prevent floating during transitions.
- The open-source animsmith game-ready animation guide states that directional locomotion members must share gait phase; if one direction plants a foot at a different normalized phase, blending/transitions skate the feet.
- The classic Unity Locomotion System documentation is useful counterevidence: immediate physical reversal can legitimately occur before the character has fully turned; the visual system should make that look good rather than slowing the controller.
- Community reports of reversal/pivot pops commonly implicate resetting/switching animation frames, but this is anecdotal and not sufficient to justify a remap without measuring Kelo's actual sprite.

### HYPOTHESIS
The next visible lateral weakness is not necessarily reversal latency; it may be gait-phase mismatch between LEFT and RIGHT authored rows. Preserving stridePhase is the correct default, but preserving the same column is only correct if row1 frame N and row2 frame N encode equivalent support-foot/contact phases. A small data-driven reversal frame/phase mapping could reduce snap without adding input delay, but only if alpha/contact measurement proves a mismatch.

### PROPOSED_CHANGE
Do not change gameplay yet. First extend the existing hero preprocessing/audit so it measures contact evidence for BOTH lateral rows, preferably as data only. Then build a deterministic reversal audit that records RIGHT→LEFT and LEFT→RIGHT at each source frame/quarter phase. Candidate A: current same-phase/same-column behavior. Candidate B: a fixed phase complement/offset only if contact data demonstrates a consistent mapping. Candidate C: a four-entry direction-pair frame map if the sheet is discrete and no single phase offset fits. Candidate D: no remap and instead recalibrate authored anchors if support contacts are already phase-equivalent but silhouette origin snaps. Do not add easing or physical turn delay.

### DO_NOT_ASSUME
- Do not assume the large origin-compensation delta is visible foot slip; footRoot anchoring may be doing legitimate work.
- Do not assume LEFT is a mirror of RIGHT. Character Appearance explicitly uses separate rows and mirrorFaces=false.
- Do not assume same frame index means same anatomical foot/contact state.
- Do not change canonical movement speed, collider, camera, PvP aim-facing, or client/server movement profile in this pass.
- Do not add procedural bob/lean until authored reversal motion is understood.

### EXPERIMENT
1. Extend existing preprocessing measurement to return contact evidence for row1 LEFT and row2 RIGHT for all four frames; do not scan pixels every gameplay frame.
2. Derive per-frame bottom-band support centroid/range for both rows after the same cleanup/crop policy.
3. Deterministic traces at 60/90/120 Hz: hold RIGHT for >=1 full cycle, reverse to LEFT at stridePhase near 0.00/0.25/0.50/0.75; mirror LEFT→RIGHT. Repeat magnitudes .48/.70/1.00.
4. Capture before/after world position, requested/resolved velocity, movement face, stridePhase, frame, sourceFootAnchor, destinationRect, support centroid transformed to world/CSS, and first 150 ms after reversal.
5. Baseline A uses current same phase. Test B/C only if contact mapping predicts a lower support-foot discontinuity. Repeat identical trace.
6. Test social and PvP ordinary locomotion; active attack-aim commitment remains covered by the existing PvP facing audit and must not regress.

### DECIDING_METRICS
reversalSupportCentroidJumpCssPx
reversalSupportFootIdentityMismatchRate
reversalDestinationOriginJumpCssPx
reversalSilhouetteCentroidJumpCssPx
reversalAccidentalIdleCount
reversalFrameJumpCount
reversalInputToFaceCommitMs
reversalStridePhaseDiscontinuityCount
leftRightContactPhaseMappingError
60to90to120ReversalMetricDelta
worldTraceDelta
collisionTraceDelta
requestedVelocityTraceDelta
attackDirectionTraceDelta

Gate: preserve immediate physical reversal and zero accidental idle. Prefer the presentation candidate with the lowest P95 support/silhouette discontinuity. Any phase remap must materially reduce measured contact discontinuity and must not introduce a stridePhase reset or >1-pose artificial jump. World/collision/requested-velocity traces must remain unchanged.

### RISKS
A phase remap chosen from visual intuition can worsen foot skating. Bottom-band alpha is only a proxy for anatomical support and may include clothing/weapons/shadows; validate against actual frames before promoting. Per-frame exact remapping can create new chatter if facing oscillates rapidly; reversal mapping must be deterministic and direction-pair scoped. Scaling to 1.20x will magnify any residual discontinuity, so validate 1.15x first then repeat winner at 1.20x.

### EXPECTED_GROK_FEEDBACK
Report whether LEFT/RIGHT contact phases are actually equivalent; provide per-frame contact centroids/ranges, baseline reversal metrics at 60/90/120, whether same-column reversal visibly/quantitatively pops, which candidate was tested, exact before/after numbers, files/commit/tests, and whether the change was kept or reverted. If no meaningful mismatch is measured, reject remapping and move to the next lateral-quality branch rather than forcing a change.
