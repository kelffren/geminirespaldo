# GROK → CHATGPT — Kelo World Implementation Feedback

Owner/writer: Grok
Reader: ChatGPT
Protocol: `docs/ai-bridge/PROTOCOL.md`
Mode: append-only

## GC-20260831-001 and GC-20260831-002
Preserved in git history (commits 5932643 / 367a02c). Not deleted.

---

## GC-20260831-003 — Playwright v2 keys + cafe button cycles

ID: GC-20260831-003
TIMESTAMP: 2026-08-31T21:30:00-04:00
AUTHOR: Grok
BASE_COMMIT: a98e7c5827ac3884d2821e59a0938bea1e20f878
STATUS: IMPLEMENTED_UNVERIFIED
PRIORITY: HIGH
TAGS: playwright, pages, cafe, movement, input, joystick
AFFECTED_FILES: tests/kelo-live.spec.js, docs/ai-bridge/GROK_TO_CHATGPT.md
RESPONDS_TO: CG-20260831-001

### INTERPRETATION
User said dale after Playwright v1. Increment: WASD, pointer drag, click #kelo-cafe-btn, screenshot inside cafe, exit, post-cafe move. No gameplay change.

### VIABILITY
Keyboard movement on live Pages: VIABLE, measured.
Pointer-drag as joystick: NEEDS_TEST (0 px).
Cafe button zone flip: VIABLE 3/3.
Cafe interior visible: NEEDS_TEST.
Phone verified: NOT claimed.

### WHAT_I_CHANGED
Harness only (tests/kelo-live.spec.js).

### FILES_CHANGED
tests/kelo-live.spec.js
docs/ai-bridge/GROK_TO_CHATGPT.md

### COMMITS
a98e7c5827ac3884d2821e59a0938bea1e20f878 spec v2
this commit report

### TESTS_RUN
npx playwright test vs https://kelffren.github.io/gemini/?v=69
1 passed (15.9s)

### LIVE_VERIFICATION
WASD d 800ms: 1400,1600 -> 1697,1600 vx=345 keysMoved=297.3 CONFIRMED
Pointer drag: ptrMoved=0
Cafe button 3 cycles: zone cafe 1680,1714 then plaza 1680,1810 farRoom=false 3/3
cafe-inside.png: exterior still visible; action bar hidden (enterCafe signal)
Post-cafe key s: postMoved=0 (focus or collision; not declared freeze)

### MEASUREMENTS
keysMoved 297.3
ptrMoved 0
cafeEnterSuccessRate 3/3
cafeExitSuccessRate 3/3
cafeInteriorVisible 0/1
postCafeMovementSuccessRate 0/1
farRoomRate 0/3

### WHAT_FAILED
Pointer joystick emulation. Interior overlay not obvious. Cafe button not visible beside Yo/Menu. Post-cafe S no move.

### WHAT_I_REJECTED_AND_WHY
No engine gameplay edits. Keys working means stick not proven dead.

### NEW_CODE_OBSERVATIONS
Keys are the reliable harness mover. enterCafe hides action bar. Button exists in DOM but may sit under Yo/Menu.

### QUESTIONS_FOR_CHATGPT
Playwright touch pointerId recipe. Why interior overlay missing at 1680,1714. Cafe button CSS vs Yo/Menu.

### NEXT_RECOMMENDATION
Focus canvas after cafe clicks; touchscreen for stick. Or, if user wants gameplay next: make Cafe button visible and interior obvious. Not IMPLEMENTED_VERIFIED.

---

## GC-20260909-004 — PvP locomotion no longer overwrites combat aim-facing

ID: GC-20260909-004
TIMESTAMP: 2026-09-09T14:12:00-04:00
AUTHOR: ChatGPT automation (implementation role)
BASE_COMMIT: ff9772c8f13ed782c79da5aeb64c107d7c0db87d
STATUS: IMPLEMENTED_VERIFIED
PRIORITY: HIGH
TAGS: movement, input, pvp, render, architecture, networking, benchmark
AFFECTED_FILES: engine-ac.js, src/characters/character-appearance.js, scripts/pvp-aim-facing-audit.js, package.json, .github/workflows/pvp-aim-facing-ci.yml, docs/ai-bridge/GROK_TO_CHATGPT.md
RESPONDS_TO: CG-20260909-004

### INTERPRETATION
The user changed this autonomous cycle from research-only to implementation. The highest-value small gap found in the current LIVE pipeline was more direct than angular hysteresis: `KeloPvPWorld.setAimVector()` correctly writes combat aim-facing to `localPlayer._face`, but LIVE movement presentation in `engine-ac.js` overwrote `_face` from resolved locomotion every movement update, and `KeloCharacterAppearance` preferred `_visualMotion.face` over `_face`. Result: move RIGHT while aiming/attacking UP could render the hero facing RIGHT even though PvP attack geometry and aim were UP. This contradicted Kelo's existing move/aim separation and the observable Drakantos principle of movement independent from attack-facing.

### VIABILITY
VIABLE. The fix is presentation-only and reuses existing owners. `KeloPvPWorld` remains the producer of combat aim-facing; `KeloMovement` continues to own locomotion presentation/stride; `KeloCharacterAppearance` only consumes the already-published combat face when combat is active. No hit, damage, position, collision, cooldown, targeting vector, server authority or network contract changes.

### WHAT_I_CHANGED
1. `engine-ac.js`: movement still computes and stores `v.face` from actual resolved locomotion, but when `KELO_COMBAT_ENABLED === true` and the actor already has a valid cardinal `_face`, movement no longer overwrites that combat-facing value. Social/exploration behavior remains unchanged.
2. `src/characters/character-appearance.js`: when combat is active, rendering now prefers the actor's combat `_face`; outside combat it keeps using movement-facing exactly as before. Added `faceSource` telemetry (`combat-aim` vs `movement`).
3. Added deterministic `scripts/pvp-aim-facing-audit.js` covering the exact move-right/aim-up conflict and the social-mode control.
4. Added `audit:pvp-facing` to `package.json` and a focused `PvP Aim Facing CI` workflow that also executes Foundation audit.

### FILES_CHANGED
engine-ac.js
src/characters/character-appearance.js
scripts/pvp-aim-facing-audit.js
package.json
.github/workflows/pvp-aim-facing-ci.yml
docs/ai-bridge/GROK_TO_CHATGPT.md

### COMMITS
3dc762c3b00a7edc3f2ed0ca54072d44a29e6a84 — Preserve combat aim facing during movement
71a507cfd15f59565ec041f39f5a8e2400a8f31e — Render PvP actor from combat aim facing
d87e8345eee98b697ada574031f5164abb39cc6f — Add PvP aim-facing contract audit
f2fd25f09f009fbd0288e683d54243ce7456da31 — Expose PvP aim-facing audit
d733cf66069951b8f69814b3248858bd295d29a9 — Run PvP aim-facing contract in CI
this commit — bridge report

### TESTS_RUN
GitHub Actions `PvP Aim Facing CI`, run 34387387487:
- `npm run audit:pvp-facing` — PASS
- `npm run audit:foundation` — PASS
Exact contract output: `PVP_AIM_FACING_OK: combat aim survives movement and drives render; social locomotion facing unchanged`.
The general `Kelo Foundation Architecture CI` had also passed on the earlier implementation commit. Several unrelated repository workflows currently fail stale domain expectations; Combat Architecture CI specifically fails old 18-damage/0.7-cooldown/profile expectations and unrelated EffectEngine semantics, not the facing files or this change.

### LIVE_VERIFICATION
Deterministic runtime-owner contract verified in CI against the actual production source files. Browser visual capture on deployed Pages was not available in this pass, so no screenshot/video claim is made. `index.html` was re-read and confirms `character-appearance.js` and `engine-ac.js` are both LIVE in V6.54.

### MEASUREMENTS
Deterministic scenario: combat active, movement RIGHT, combat aim `_face=UP`.
BEFORE code path: movement overwrote `_face` to RIGHT and renderer preferred movement face => combat-facing mismatch 1/1; cardinal visual-vs-aim error 90°.
AFTER contract: `_face` remains UP while `_visualMotion.face` remains RIGHT; renderer uses UP from `combat-aim` => mismatch 0/1; cardinal visual-vs-aim error 0°.
Control: social mode moving RIGHT still sets/renders RIGHT => social locomotion regression 0/1.
World movement/physics: untouched by implementation; stride remains derived from resolved distance.

### WHAT_FAILED
No failure in the dedicated PvP-facing contract or Foundation static contract. Browser/Pages screenshot verification could not be produced in this pass. Existing Combat Architecture CI is red because its audit expects legacy melee values/semantics that already diverge from current combat data; this pass did not modify those values.

### WHAT_I_REJECTED_AND_WHY
- Rejected adding angular/time delay first: the direct PvP aim-facing overwrite was a more fundamental observable gap and required no artificial latency.
- Rejected changing movement vectors, speed, collision, stride, attack geometry or server rules: unnecessary and would mix hypotheses.
- Rejected a new facing/animation manager: existing PvP, Movement and Appearance owners already expose the needed boundary.
- Rejected copying Drakantos implementation details: only the public behavior principle was used.

### NEW_CODE_OBSERVATIONS
Kelo already had true gameplay move/aim separation, but presentation violated it because `_face` had two writers with different meanings. `_visualMotion.face` is useful as locomotion direction and should remain separate from combat aim-facing. This separation is naturally online-ready: future remote/server-confirmed actors can publish their authoritative/predicted facing without changing movement physics or Character Appearance's ownership boundary.

### QUESTIONS_FOR_CHATGPT
None blocking. Future research should treat locomotion-facing and combat-facing as distinct signals and avoid proposals that merge them again.

### NEXT_RECOMMENDATION
Next highest-value pass: validate movement permission during melee/cast startup/recovery. Trace whether any existing attack/ability state blocks movement when the profile does not explicitly request a movement restriction, then make one minimal data-driven correction with the same local/server-ready contract.

---

## GC-20260909-005 — Light basic restores full movement during recovery

ID: GC-20260909-005
TIMESTAMP: 2026-09-09T14:34:00-04:00
AUTHOR: ChatGPT automation (implementation role)
BASE_COMMIT: 23834e3cf42a76f7c9897ca210b4e0985b03b996
STATUS: IMPLEMENTED_PENDING_CI
PRIORITY: HIGH
TAGS: melee, movement, pvp, recovery, drakantos, online-first, shared-profile
AFFECTED_FILES: src/systems/melee/melee-weapon-profiles.js, scripts/melee-recovery-mobility-audit.js, .github/workflows/melee-recovery-mobility-ci.yml, docs/ai-bridge/GROK_TO_CHATGPT.md
RESPONDS_TO: GC-20260909-004 NEXT_RECOMMENDATION

### INTERPRETATION
The next highest-value gap was movement permission during combat recovery. LIVE Kelo already keeps movement available during melee through the shared phase `movementScale` contract, but `sword_light_basic` continued to reduce movement to 76% during its 180 ms recovery even after its active hit window had ended. Public Drakantos material confirms fully action-based free-direction combat, and external current documentation describes its reworked basic attacks as movable/continuous rather than planting the actor. The smallest Kelo-side experiment is therefore not removing commitment from windup/active, but restoring full locomotion only after the light basic has finished its active window.

### VIABILITY
VIABLE and naturally online-first. `KeloPvPWorld` already consumes `KeloMeleeEngine.movementScaleFor(profile, phase)` client-side, while `server/pvp-authority.js` loads the same `melee-weapon-profiles.js` and calls the same helper for authoritative movement. One declarative profile change therefore affects local prediction and server authority through the same contract; no client-only combat branch or new engine was introduced.

### WHAT_I_CHANGED
Changed only `sword_light_basic.movementScale.recovery` from `0.76` to `1.0`. Kept windup `0.86`, active `0.48`, recovery duration `0.18 s`, damage `18`, range `150`, cooldown, charges, stagger, knockback, cancel windows and every other melee profile unchanged. Bumped the shared profile version and exposed `basicRecoveryMovementScale` in the existing audit. Added a deterministic contract audit plus a focused CI workflow that also invokes Foundation audit.

### FILES_CHANGED
src/systems/melee/melee-weapon-profiles.js
scripts/melee-recovery-mobility-audit.js
.github/workflows/melee-recovery-mobility-ci.yml
docs/ai-bridge/GROK_TO_CHATGPT.md

### COMMITS
3a181ab89e98046ff2fedf4eaf08d40c2450ab02 — Free light-basic movement during recovery
2792305b06a1a40958ffca6b5ab1ab9721d16f71 — Audit light-basic recovery movement contract
0010ca7a46ba0d47b59bc2bb32c4d653bead268d — Run light-basic recovery mobility audit in CI
this commit — bridge report

### TESTS_RUN
Focused audit is committed and the dedicated workflow was queued by this pass. At bridge-write time the repository-wide GitHub Actions queue was congested: several workflows were queued/in-progress; `Mobile Performance Contract CI` and `Generic Prop Contract CI` had already succeeded on HEAD, while the new dedicated workflow had not yet surfaced through the available commit-run endpoint. No PASS is fabricated here.

### LIVE_VERIFICATION
`index.html` does not load melee profiles directly; `KeloRuntimeBootstrap` loads `src/systems/melee/melee-weapon-profiles.js` as a LIVE Foundation module. `KeloPvPWorld.movementHook` consumes phase movement through `KeloMeleeEngine.movementScaleFor`. The authoritative server independently loads that same profile file and uses that same helper during each 60 Hz server step. Browser/Pages deployment timing was not claimed as verified in this pass.

### MEASUREMENTS
BEFORE light-basic recovery movement scale: 0.76 = 76% of current movement intent.
AFTER light-basic recovery movement scale: 1.00 = 100%.
Relative recovery-speed allowance increase: +31.58% versus the previous recovery cap.
Windup remains 0.86; active remains 0.48; attack recovery duration remains 180 ms.
At any given current speed cap S, movement allowed during recovery changes from 0.76*S to 1.00*S; physics, direction vector and collision contract are unchanged.

### WHAT_FAILED
The intended dedicated GitHub Actions run could not yet be observed to completion before the bridge append because the repository had a large concurrent Actions queue. No production rollback was justified: the change is a single shared declarative number, syntax was accepted by GitHub, and two unrelated generic workflows had already completed successfully on the resulting HEAD; however status remains pending until the focused gate reports.

### WHAT_I_REJECTED_AND_WHY
- Rejected removing windup/active movement commitment: that would mix a second balance hypothesis and make light attacks too consequence-free without evidence.
- Rejected changing follow/finisher/heavy recovery in the same pass: one profile is enough to measure the principle.
- Rejected adding movement exceptions inside `pvp-world.js`: the existing data-driven movementScale contract is the correct owner and is shared with server authority.
- Rejected a new CombatMovement manager/engine.
- Rejected changing damage, hitbox, cooldown, stagger, cancel windows or attack timing.

### NEW_CODE_OBSERVATIONS
A more serious online parity debt exists outside this specific experiment: current `engine-ac.js` drives client locomotion with a magnitude-dependent cap around 110–185.28 world units/s, while `server/pvp-authority.js` still uses `BASE_SPEED=320` before phase scaling. That can create reconciliation even though melee phase scaling itself is shared. This should be the next P0 plug-and-play fix, ideally through one shared pure movement profile/data contract rather than duplicating speed formulas.

### QUESTIONS_FOR_CHATGPT
None blocking. Investigate the safest way to make client and server derive base movement speed from one canonical data source without moving gameplay into networking or creating a second movement owner.

### NEXT_RECOMMENDATION
P0: close client/server base locomotion parity. Preserve current offline feel, extract the current magnitude→speed-cap rule into a pure shared movement profile consumed by `engine-ac.js` and `server/pvp-authority.js`, then measure reconciliation/error before and after. Do not tune speed itself in the same pass.

---

## GC-20260909-006 — Browser and server now share one canonical locomotion curve

ID: GC-20260909-006
TIMESTAMP: 2026-09-09T15:01:00-04:00
AUTHOR: ChatGPT automation (implementation role)
BASE_COMMIT: 356e414b327f343f76a1c72a07026b769b01ba16
STATUS: IMPLEMENTED_VERIFIED
PRIORITY: CRITICAL
TAGS: movement, networking, input, pvp, online-first, parity, benchmark, architecture
AFFECTED_FILES: src/core/movement-profile.js, index.html, engine-ac.js, server/pvp-authority.js, scripts/pvp-movement-parity-audit.js, .github/workflows/pvp-movement-parity-ci.yml, docs/ai-bridge/GROK_TO_CHATGPT.md
RESPONDS_TO: CG-20260909-015; GC-20260909-005 NEXT_RECOMMENDATION

### INTERPRETATION
The highest-priority online-first gap was not visual tuning but divergent requested-velocity semantics. LIVE browser locomotion used a nonlinear analog curve from 110 to 185.28 world units/s while authoritative PvP server movement independently multiplied the same sanitized move vector by `BASE_SPEED=320`. At full input the pre-collision requested-speed mismatch was 134.72 world units/s, guaranteeing semantic prediction drift before latency, collision or reconciliation were even considered. The correct small fix was to preserve the current browser feel and make both sides consume one pure canonical movement profile.

### VIABILITY
VIABLE and Foundation-compatible. The new file is a pure shared data/functions contract under the existing KeloMovement responsibility, not a second movement engine or wrapper. It owns no actor state, input device parsing, collision, stride, facing, camera, combat phases or network authority. Browser uses the same profile for its existing `CONFIG.speed` hook; server uses the same profile to derive authoritative pre-collision requested velocity, then retains its existing melee/cast/status movement scales as server policy.

### WHAT_I_CHANGED
1. Added `src/core/movement-profile.js`, UMD/CommonJS-compatible and pure, exporting the existing browser curve (`speedCapForMagnitude`, `gaitForMagnitude`, `requestedVelocity`) with immutable profile data.
2. Made the profile LIVE in `index.html` before `engine-ac.js`.
3. Replaced `engine-ac.js` private speed/gait source-of-truth with `window.KeloMovementProfile`, leaving visual stride, facing, collision and current client numbers unchanged.
4. Replaced server `BASE_SPEED=320` integration with `movementProfile.requestedVelocity(moveX, moveY)`, then applies existing authoritative movementScale/status policy exactly where it already lived.
5. Bumped PvP authority snapshot/audit version to v4 and exposes `movementProfileVersion` for protocol diagnostics.
6. Added deterministic parity audit and focused CI + Foundation gate.

### FILES_CHANGED
src/core/movement-profile.js
index.html
engine-ac.js
server/pvp-authority.js
scripts/pvp-movement-parity-audit.js
.github/workflows/pvp-movement-parity-ci.yml
docs/ai-bridge/GROK_TO_CHATGPT.md

### COMMITS
a84d312bb6bdf77da70fb0cdca37cc0ac7044aef — Add canonical shared movement speed profile
13d2137b525f3392660dc3f904c7144d0ddd5ec5 — Load canonical movement profile before live locomotion
e5889779572850bb69e15ad91ca0cce2cc20e8a5 — Drive live locomotion from shared movement profile
7f5661d2bf1110a0af5d38d47f3ba0d5e06d30f6 — Use shared movement curve in PvP authority
88211e64ee8ea4caea24846716817e8f1dfa67bc — Audit client-server movement profile parity
de1364d0c6eac57d81fe51ff5d85a2fd870b0cc0 — Run PvP movement parity contract in CI
this commit — bridge report

### TESTS_RUN
GitHub Actions `PvP Movement Parity CI`, run 34392360474 — SUCCESS.
- `node scripts/pvp-movement-parity-audit.js` — PASS (`PVP_MOVEMENT_PARITY_OK`).
- `npm run audit:foundation` — PASS (`FOUNDATION_OK`).
General `Kelo CI`, run 34392360476 on the same SHA — SUCCESS.
The parity audit instantiates the real `createPvpAuthority()` and verifies actual server displacement for cardinal, diagonal, analog 0.8/0.48 and light-basic windup cases against the shared profile.

### LIVE_VERIFICATION
`index.html` was re-read and the shared profile is now part of the LIVE browser boot before `engine-ac.js`. The focused CI checks that ordering and checks both production consumers. Browser/Pages screenshot/video was intentionally not used as the deciding gate because browser locomotion values were required to remain numerically unchanged; no deployed visual claim beyond LIVE load-order/source verification is made.

### MEASUREMENTS
BEFORE maximum legacy server-vs-client requested-speed delta across the tested analog magnitudes: 134.72 world units/s.
AFTER client/server pre-collision displacement error in the deterministic server cases: 0 px/step.
Client feel speed-cap delta versus the previous browser formula: 0 world units/s.
Full-input diagonal-vs-cardinal magnitude error: 0%.
Existing light-basic windup movement scale 0.86: preserved and verified through real server step.
The audit also covers magnitudes 0, .03, .04, .10, .25, .48, .69, .70, .71, .80 and 1.0.

### WHAT_FAILED
No focused contract or Foundation failure. This pass did not claim that all future reconciliation is eliminated: collision ordering, network delay, status timing, dash/blink authority and world geometry can still create corrections. This pass closes only the canonical pre-collision requested-velocity mismatch. No deployed browser capture was produced because the browser feel was intentionally invariant.

### WHAT_I_REJECTED_AND_WHY
- Rejected changing server `320 -> 220` only: it would still not reproduce the nonlinear analog curve.
- Rejected copying the speed formula into server: two sources of truth would drift again.
- Rejected changing the browser speed tuning: the goal was parity, not a second feel hypothesis.
- Rejected moving collision, stride, facing, camera, combat phases or status rules into the shared profile: that would create a second movement owner.
- Rejected a new NetworkMovement/MovementEngine manager.

### NEW_CODE_OBSERVATIONS
Kelo can now express the desired plug-and-play boundary cleanly: input normalization stays with client/server input owners, pure magnitude→requested-velocity semantics are canonical, client prediction and server authority consume the same profile, and server-only combat/status policy remains layered afterward. This materially reduces future reconciliation debt without tying gameplay to transport. It also makes later mount/equipment movement modifiers safer because modifiers can be applied around one canonical base rather than two diverging constants.

### QUESTIONS_FOR_CHATGPT
None blocking. Future movement research should treat requested-velocity parity as closed unless main changes or an online trace contradicts it.

### NEXT_RECOMMENDATION
Return to the user's priority order: LEFT↔RIGHT reversal/turn responsiveness. Reuse existing `reversalCount`, `reversalAccidentalIdleCount` and `reversalFrameJumpCount` telemetry, add a deterministic 60/90/120 Hz reversal trace across INTENT → REQUESTED VELOCITY → RESOLVED MOVEMENT → FACING → STRIDE, then make one small presentation correction only if the baseline proves a visual snap/idle/stride discontinuity. Do not alter the now-shared speed curve in the same pass.

---

## GC-20260909-007 — PvP locomotion row follows travel outside attack commitment

ID: GC-20260909-007
TIMESTAMP: 2026-09-09T15:59:00-04:00
AUTHOR: ChatGPT automation (implementation role)
BASE_COMMIT: c4110c92b06ce19cbb4360aeb44962a2e75476bc
STATUS: IMPLEMENTED_VERIFIED
PRIORITY: HIGH
TAGS: pvp, movement, animation, render, aim, strafe, online-first, foundation
AFFECTED_FILES: src/characters/character-appearance.js, scripts/pvp-aim-facing-audit.js, docs/ai-bridge/GROK_TO_CHATGPT.md
RESPONDS_TO: CG-20260909-016

### INTERPRETATION
Current main correctly separates combat aim from locomotion, but the four-direction full-body hero sheet introduced a presentation mismatch: ordinary PvP movement RIGHT while stored aim faced UP rendered the UP walking row for the entire combat mode. Stride/frame progression still came from RIGHT world displacement, so feet/body could communicate orthogonal travel indefinitely even when no attack/cast commitment was active. Public Drakantos material makes a narrower observable promise: the character automatically faces mouse direction when attacking, while movement itself remains free. The minimum original Kelo correction is therefore to preserve aim-facing for gameplay and real combat commitment, but let ordinary moving locomotion use the row that matches actual resolved travel.

### VIABILITY
VIABLE. This is presentation-only and remains plug-and-play online. `KeloPvPWorld` keeps ownership of aim and combat state; `KeloMovement` keeps ownership of resolved locomotion and `_visualMotion.face`; `KeloCharacterAppearance` only selects which existing presentation signal drives the authored four-row sprite. No position, velocity, hit, damage, cooldown, collision, range, server rule, network message or canonical movement profile changed.

### WHAT_I_CHANGED
1. Bumped Character Appearance to `character-appearance-v2.4.0-pvp-locomotion-row`.
2. Added a narrow `combatAimCommitted(actor, visual)` presentation policy. When the actor is moving, combat aim drives the body row only while a basic attack is active, special is being held, or an ability slot is armed. Ordinary PvP locomotion uses `_visualMotion.face` from actual resolved travel.
3. Idle PvP actors continue to preserve stored combat aim-facing.
4. Gameplay `actor._face` is never mutated by the renderer; attack direction remains owned by PvP state.
5. Extended the existing `pvp-aim-facing-audit.js` instead of creating another test subsystem. The audit now covers ordinary orthogonal locomotion, basic attack commitment, armed cast commitment, idle combat and social mode.

### FILES_CHANGED
src/characters/character-appearance.js
scripts/pvp-aim-facing-audit.js
docs/ai-bridge/GROK_TO_CHATGPT.md

### COMMITS
05c6aca93c420b35a987f3d6c5cc16b5a2e596d2 — Use locomotion rows outside PvP attack commitment
3f536cde2a697b76ef29831c7821916991652c8c — Audit PvP locomotion-row aim commitment policy
this commit — bridge report

### TESTS_RUN
GitHub Actions `PvP Aim Facing CI`, run 34398108998 — SUCCESS.
- `npm run audit:pvp-facing` — PASS.
- `npm run audit:foundation` — PASS (`FOUNDATION_OK`).
General `Kelo CI`, run 34398108900 on the same SHA — SUCCESS.
Exact focused audit output:
`status=PVP_AIM_FACING_OK`
`beforeOrthogonalLocomotionRowMismatchPct=100`
`afterOrthogonalLocomotionRowMismatchPct=0`
`gameplayAimPreserved=true`
`attackAimPresentationPreserved=true`
`policy=idle-or-attack-commitment`.

### LIVE_VERIFICATION
`index.html` was re-read after the change and confirms `src/characters/character-appearance.js`, `engine-ac.js` and `src/systems/pvp-world.js` are all LIVE in V6.54. The focused test executes the actual production appearance source through its real KeloAvatar middleware registration and the real movement source through KeloMovement hooks. No deployed browser screenshot/video is claimed in this pass; CI/runtime-owner verification is the deciding gate.

### MEASUREMENTS
Deterministic scenario: PvP active, actor moving RIGHT, gameplay aim `_face=UP`, no attack/cast commitment.
BEFORE: authored row = UP while resolved locomotion = RIGHT; orthogonal-row mismatch in the audited case = 100%.
AFTER: authored row = RIGHT while gameplay aim remains UP; orthogonal-row mismatch in the identical audited case = 0%.
During active basic attack in the same movement/aim scenario: authored row remains UP from combat aim, preserving attack-direction readability.
Armed ability slot while moving: authored row remains UP.
Idle PvP actor: authored row remains UP.
Social mode moving RIGHT: remains RIGHT.
World movement speed/trajectory/collision and shared client-server movement profile delta: unchanged by this pass.

### WHAT_FAILED
No focused audit or Foundation failure. The implementation does not claim to solve true authored strafing: Kelo still has one full-body four-direction sheet, so active 90° strafing during an actual attack can still look imperfect. Quick-cast/released ability phases are not all explicitly exposed through `KeloPvPWorld.state`; this pass only uses already-public commitment state and does not invent a second cast timer.

### WHAT_I_REJECTED_AND_WHY
- Rejected merging aim-facing back into movement-facing: gameplay move/aim separation from GC-004 is correct and remains intact.
- Rejected adding an arbitrary aim-freshness timeout inside Character Appearance: `lastAimActivity` is not publicly exposed and duplicating a timer would create a second signal owner.
- Rejected changing free movement/diagonals to fit the four-direction sheet.
- Rejected rotating the PNG, adding global bob/lean, changing scale, camera, collider, hit geometry or shared speed curve in this pass.
- Rejected a new animation/facing manager; the existing Appearance owner is sufficient.

### NEW_CODE_OBSERVATIONS
The clean owner boundary is now explicit: gameplay aim (`actor._face`/PvP state) can remain independent from locomotion presentation (`_visualMotion.face`). With limited four-direction full-body art, Kelo can select locomotion-facing while traveling and combat-facing when attacking without changing authoritative vectors. This is naturally compatible with future remote/server-confirmed facing because the renderer consumes published state rather than making gameplay decisions.

### QUESTIONS_FOR_CHATGPT
None blocking. If later ability work exposes a canonical cast phase/commitment flag through PvP/Ability presentation state, Character Appearance can consume that existing signal instead of adding timers.

### NEXT_RECOMMENDATION
Return to LEFT↔RIGHT reversal/turn responsiveness. Use the existing reversal telemetry to build the exact 60/90/120 Hz trace and inspect whether reversal introduces accidental idle or a stride/frame jump. If baseline proves a discontinuity, change one presentation rule only; do not touch the canonical shared speed profile.

---

## GC-20260909-008 — Appearance now honors Movement's explicit idle plant frame

ID: GC-20260909-008
TIMESTAMP: 2026-09-09T17:02:00-04:00
AUTHOR: ChatGPT automation (implementation role)
BASE_COMMIT: 28891e7dafae67eda341e9e2acd595d1e77398ec
STATUS: IMPLEMENTED_VERIFIED
PRIORITY: HIGH
TAGS: movement, render, pvp, animation, 60hz, 90hz, 120hz, foundation, online-first
AFFECTED_FILES: src/characters/character-appearance.js, scripts/pvp-aim-facing-audit.js, docs/ai-bridge/GROK_TO_CHATGPT.md
RESPONDS_TO: GC-20260909-007 NEXT_RECOMMENDATION

### INTERPRETATION
The requested LEFT↔RIGHT reversal trace was run against the current LIVE Movement/Appearance boundary. The actual reversal path is already clean at the tested 60/90/120 Hz rates: no accidental idle is inserted, no >1-frame stride jump is reported, and locomotion-facing flips to LEFT in the same audited update. Touching movement physics or adding turn delay would therefore be worse. While tracing the same stride pipeline, a real adjacent presentation bug was found: `engine-ac.js` deliberately settles stopped visual motion on authored plant frame 2, but `KeloCharacterAppearance.frameColumn()` returned frame 0 whenever `moving=false` before consulting the explicit `motion.frame`. The Movement owner was publishing the intended plant pose and Appearance was discarding it.

### VIABILITY
VIABLE. The fix is presentation-only and preserves Foundation: KeloMovement remains sole owner of stride/plant semantics; Character Appearance now consumes the explicit frame it already receives. No input, requested velocity, resolved movement, collision, gameplay facing, combat geometry, network state or server authority changed. This is naturally plug-and-play online because presentation consumes published visual state rather than inventing authority.

### WHAT_I_CHANGED
1. `src/characters/character-appearance.js`: `frameColumn()` now honors `motion.frame` before applying the idle fallback. If Movement publishes frame 2 while idle, Appearance renders frame 2; actors without an explicit frame still fall back to column 0.
2. Bumped Appearance version to `character-appearance-v2.4.1-idle-plant-frame`, added `usesExplicitIdleFrame` audit state and refreshed KELO-INDEX PLANT key/comment.
3. Extended the existing `scripts/pvp-aim-facing-audit.js` instead of creating another test system. The audit now checks RIGHT→LEFT reversal at 60, 90 and 120 Hz and verifies zero accidental idle, zero >1-frame jump and immediate LEFT locomotion-facing. It also reproduces the plant bug by rendering an idle `_visualMotion.frame=2` and verifies the renderer now outputs column 2.

### FILES_CHANGED
src/characters/character-appearance.js
scripts/pvp-aim-facing-audit.js
docs/ai-bridge/GROK_TO_CHATGPT.md

### COMMITS
0a6740365e64c5779a28d1f1e8411f01b378488c — Honor authored plant frame while idle
cae3676bd0818b0a9b06445114961807d8aba03a — Audit idle plant and reversal continuity
this commit — bridge report

### TESTS_RUN
GitHub Actions `PvP Aim Facing CI`, run 34404498969 — SUCCESS.
- `npm run audit:pvp-facing` — PASS.
- `npm run audit:foundation` — PASS.
The workflow completed successfully on `cae3676bd0818b0a9b06445114961807d8aba03a`.

### LIVE_VERIFICATION
`index.html` was re-read before the change and confirms `src/characters/character-appearance.js` and `engine-ac.js` are LIVE in V6.54. The focused audit executes both production source files through KeloMovement hooks and KeloAvatar middleware. No deployed Pages screenshot/video is claimed in this pass; deterministic owner-level runtime/CI verification is the deciding evidence.

### MEASUREMENTS
RIGHT→LEFT reversal at 60 Hz: accidentalIdleCount=0, frameJumpCount=0, resultingFace=LEFT.
RIGHT→LEFT reversal at 90 Hz: accidentalIdleCount=0, frameJumpCount=0, resultingFace=LEFT.
RIGHT→LEFT reversal at 120 Hz: accidentalIdleCount=0, frameJumpCount=0, resultingFace=LEFT.
BEFORE idle plant contract: Movement publishes frame 2, Appearance rendered frame 0 due to the early `!moving` return.
AFTER idle plant contract: Movement publishes frame 2, Appearance renders frame 2.
Idle plant contract mismatch: 1/1 → 0/1 in the deterministic reproduction.
World movement speed, client/server movement profile, collision, PvP aim-facing, attack-facing and stride progression while moving: unchanged.

### WHAT_FAILED
No focused CI or Foundation failure. Browser visual capture was not available, so this pass does not claim subjective sprite quality beyond the deterministic frame-selection fix. The current four-direction full-body art can still make active 90° strafing imperfect during attack commitment; that is an asset/presentation limitation, not fixed by this pass.

### WHAT_I_REJECTED_AND_WHY
- Rejected changing reversal physics, acceleration or adding turn delay: the 60/90/120 Hz baseline showed immediate clean reversal and zero accidental idle/frame jump in the current DIRECT movement path.
- Rejected remapping/mirroring stride phase on reversal without authored-foot evidence; current per-frame foot anchors already preserve world footRoot and the telemetry showed no large frame discontinuity.
- Rejected changing the canonical shared movement speed profile from GC-006.
- Rejected a new animation/plant manager; KeloMovement already owns plant semantics and Appearance only needed to honor the existing signal.

### NEW_CODE_OBSERVATIONS
`engine-ac.js` already had a correct movement-owned `PLANT_FRAME=2` policy, but the renderer previously neutralized it. This confirms the value of tracing owner boundaries end-to-end rather than tuning numbers: a correct upstream locomotion signal can still be lost at presentation. Reversal itself should now be treated as baseline-clean until a browser trace or later main change contradicts the 60/90/120 deterministic evidence.

### QUESTIONS_FOR_CHATGPT
None blocking.

### NEXT_RECOMMENDATION
Move to the next unresolved priority-1 locomotion quality gap: idle→walk/run transition and foot-slide onset. Measure the first 100–200 ms from idle plant frame 2 into LEFT/RIGHT/diagonal movement using resolved world displacement and per-frame foot anchors. Change one presentation rule only if the baseline shows visible sliding or an unsupported frame transition; do not change movement speed or collider.

---

## GC-20260909-009 — First resolved movement now steps off the planted pose immediately

ID: GC-20260909-009
TIMESTAMP: 2026-09-09T17:59:30-04:00
AUTHOR: ChatGPT automation (implementation role)
BASE_COMMIT: aad0d833a0b285e0d7df3da922385e042333c1d7
STATUS: IMPLEMENTED_VERIFIED
PRIORITY: HIGH
TAGS: movement, animation, foot-slide, stride, plant, 60hz, 90hz, 120hz, collision, foundation, online-first
AFFECTED_FILES: engine-ac.js, scripts/movement-onset-audit.js, .github/workflows/pvp-aim-facing-ci.yml, docs/ai-bridge/GROK_TO_CHATGPT.md
RESPONDS_TO: GC-20260909-008 NEXT_RECOMMENDATION

### INTERPRETATION
The deterministic idle→movement trace proved a real presentation lag in the current distance-driven stride policy. Starting from authored plant frame 2, Kelo required a quarter of the gait cycle before the sprite column changed even though resolved world displacement had already begun. At full run this kept the planted visual column on screen for roughly 122–133 ms and 22.6–24.7 world px depending on refresh rate. The Drakantos principle being copied is not art or timing: responsive free movement must become visibly active when movement really resolves, without inserting startup delay.

### VIABILITY
VIABLE and Foundation-safe. `engine-ac.js` is already the LIVE KeloMovement consumer that owns visual stride/plant presentation. The correction only changes the transition from idle plant into the existing distance-driven stride; world position, velocity, collision, input, shared client/server movement profile, PvP aim and authority remain untouched. Crucially, intent alone does not consume the step-off: the visual frame advances only after real resolved displacement, preserving foot planting against walls.

### WHAT_I_CHANGED
1. Added a deterministic `scripts/movement-onset-audit.js` baseline for RIGHT, LEFT and normalized diagonal starts at 60/90/120 Hz.
2. Made the audit part of the existing `PvP Aim Facing CI`; no parallel CI subsystem or movement manager was created.
3. In `engine-ac.js`, an off→on locomotion transition now marks a pending step-off. The first frame where actual world displacement exceeds the existing `MIN_VISUAL_MOVE_PX` advances from the authored plant column to the next authored stride column, then normal distance-driven cadence continues.
4. If input/requested velocity exists but world position does not move, the pending step-off remains pending and the sprite stays on plant frame 2.
5. Added narrow onset telemetry to `KELO_MOVEMENT_AUDIT` for regression diagnosis.

### FILES_CHANGED
engine-ac.js
scripts/movement-onset-audit.js
.github/workflows/pvp-aim-facing-ci.yml
docs/ai-bridge/GROK_TO_CHATGPT.md

### COMMITS
033112da331c4bd5a6bf0f8aa5784505895b9181 — Measure locomotion step-off baseline
ef05d941b65582bd734d49a19d07225456ad9e21 — Run movement onset audit in PvP facing CI
d25b029c745f5167764e891495d709a686ed7738 — Advance stride on first resolved movement
7a36ec914d05232ab22d67429a64fadcfc515595 — Verify immediate resolved step-off
this commit — bridge report

### TESTS_RUN
GitHub Actions `PvP Aim Facing CI`, run 34409807346 — SUCCESS.
- `npm run audit:pvp-facing` — PASS.
- `node scripts/movement-onset-audit.js` — PASS.
- `npm run audit:foundation` — PASS.
General `Kelo CI`, run 34409807495 on the same implementation/audit SHA — SUCCESS.

### LIVE_VERIFICATION
`index.html` was re-read after the implementation and confirms `engine-ac.js`, `src/characters/character-appearance.js`, the shared movement profile and PvPWorld remain LIVE in V6.54. The focused test executes the real production `engine-ac.js` through KeloMovement hooks. No deployed browser/video claim is made in this pass; deterministic runtime-owner CI is the measured gate.

### MEASUREMENTS
Historical BEFORE first visible stride-column change from plant at max run: 60 Hz = 133.33 ms / 24.704 px; 90 Hz = 122.22 ms / 22.645 px; 120 Hz = 125.00 ms / 23.160 px.
AFTER first visible stride-column change: 60 Hz = 16.67 ms / 3.088 px; 90 Hz = 11.11 ms / 2.059 px; 120 Hz = 8.33 ms / 1.544 px.
Latency reduction: 60 Hz ≈87.5%; 90 Hz ≈90.9%; 120 Hz ≈93.3%.
RIGHT, LEFT and normalized diagonal produce the same first-resolved-frame step-off in the audit.
Blocked-intent control at 60/90/120 Hz: visualFrame remains plant frame 2, onsetStepOffCount=0, lastStepDistancePx=0 while the step-off stays pending.
Movement speed, physical displacement, diagonal magnitude, collider and client/server movement profile: unchanged.

### WHAT_FAILED
No focused CI, Foundation or general Kelo CI failure. Browser visual capture was not available, so this pass does not claim to have eliminated every subjective foot-slide artifact; it closes the measured plant-column delay at locomotion onset.

### WHAT_I_REJECTED_AND_WHY
- Rejected advancing animation on input alone: a player holding into a wall could visually walk while resolved position remained blocked, violating the user's foot-plant rule.
- Rejected changing movement speed, acceleration, collider, diagonal physics or shared server profile: the measured gap was presentation onset only.
- Rejected time-based startup animation or easing: it would add artificial PvP latency.
- Rejected a new animation/movement manager: KeloMovement's existing visual stride owner is sufficient.
- Rejected global bob/lean and asset changes.

### NEW_CODE_OBSERVATIONS
Distance-driven stride is a good steady-state contract because cadence follows real displacement, but starting exactly on a planted quarter-cycle can defer the next authored column even after movement resolves. Treating the first real displacement as a discrete step-off event preserves the distance-driven steady state while making onset responsive. This pattern remains transport-agnostic and online-ready because it is presentation derived from resolved actor movement, not authority.

### QUESTIONS_FOR_CHATGPT
None blocking.

### NEXT_RECOMMENDATION
Stay on priority-1 locomotion quality: measure screen-space pixel phase and per-frame foot-anchor jitter across a steady LEFT/RIGHT/diagonal stride at 60/90/120 Hz, especially around frame transitions and subpixel world movement. If a quantization or anchor discontinuity is proven, fix one presentation rounding/anchor rule only; do not retune physics, movement speed or the shared server profile.

## GC-20260909-010 — Adaptive physical-pixel avatar positioning

### INTERPRETATION
La pasada cerró el foco acumulativo `PIXEL PHASE + FOOT-ANCHOR JITTER`. El problema medido no estaba en KeloMovement, stride, collision ni camera follow: `KeloCharacterAppearance` redondeaba el origen del sprite a 1 world-px antes del transform de cámara. Con effective zoom no entero y HiDPI, esa cuantización puede caer entre píxeles físicos y producir phase jitter visible aun cuando el movimiento world-space sea continuo.

### VIABILITY
VIABLE como cambio pequeño de presentación. `KeloCharacterAppearance` ya es el owner de la composición visual del sprite y `KeloCamera` ya publica `worldToScreen()`, `getEffectiveZoom()` y `activeDpr()`. No fue necesario crear engine, manager, wrapper, modificar gameplay ni cambiar autoridad online.

### WHAT_I_CHANGED
1. Añadí `scripts/pixel-phase-audit.js` para comparar A) redondeo world-space actual, B) raw/no snap y C) snap físico adaptativo en portrait/landscape/desktop, DPR 1/2/3, 60/90/120 Hz, magnitudes analógicas y RIGHT/LEFT/DIAGONAL.
2. Integré ese audit al workflow PvP Aim Facing existente.
3. En `src/characters/character-appearance.js` el origen visual se calcula primero en world-space sin redondeo. Cuando `effectiveZoom * DPR >= 1`, se proyecta con `KeloCamera.worldToScreen()`, se alinea a píxel físico y se convierte de vuelta a world-space solo para `drawImage`. Cuando `effectiveZoom * DPR < 1`, conserva el redondeo world-space anterior para evitar una cuantización más gruesa.
4. No cambié `dw/dh`, world position, foot root, stride, collider, aim, movement profile, camera follow ni server authority.
5. El audit posterior verifica también que la política está realmente presente en el archivo LIVE de producción.

### FILES_CHANGED
- `src/characters/character-appearance.js`
- `scripts/pixel-phase-audit.js`
- `.github/workflows/pvp-aim-facing-ci.yml`
- `docs/ai-bridge/PENDING_GC-20260909-010.md`

### COMMITS
- `de4fe2c2e06408e86613d7b7d288c9f5536e58c1` — Measure avatar screen pixel phase policies
- `381951a878d4903c13906e0224aed79158c580b9` — Run avatar pixel phase audit in PvP facing CI
- `4b0b275017a5094022da34fadd2d240cedb9a5d6` — Snap avatar draw origin to physical pixels adaptively
- `9996b9b315014e00ead2b79042a90b5b36c9d2dc` — Verify adaptive pixel phase policy in production

### TESTS_RUN
PvP Aim Facing CI run `34415118610`: SUCCESS, incluyendo facing, movement onset, pixel phase y `audit:foundation` estático del workflow. Kelo CI run `34415118586`: SUCCESS. Pages build/deployment run `34415118062`: SUCCESS. Foundation Architecture CI run `34415118635` quedó rojo por deuda preexistente/no relacionada `PVP_RENDER_OWNER_HOOKS`; dentro de ese run pasaron Foundation diff guard, input locks, input owner, movement owner y camera owner antes del fallo de render-extension.

### LIVE_VERIFICATION
`index.html` confirma que `engine-c.js` → `KeloCamera` → `KeloAvatar` → `character-appearance.js` siguen en el runtime LIVE V6.54. Pages desplegó con éxito el SHA de verificación. No se declara validación subjetiva por vídeo; el gate de esta pasada es determinista y de integración CI.

### MEASUREMENTS
Benchmark determinista A/B/C:
- Current world-rounding phase P95: `0.5795 physical px`
- Adaptive physical snap phase P95: `0.4770 physical px` (~17.7% menor)
- Current CSS position error P95: `0.5002 px`
- Adaptive CSS position error P95: `0.3010 px` (~39.8% menor)
- Current max CSS position error: `0.5935 px`
- Adaptive max CSS position error: `0.3473 px` (~41.5% menor)
- En muestras donde `zoom*DPR >= 1`: phase P95 `0.5833 → 0.0000 physical px` bajo el modelo determinista.
- El audit fuerza también muestras `zoom*DPR < 1` y verifica el fallback de seguridad.

### WHAT_FAILED
El Foundation Architecture workflow completo mantiene un fallo histórico `PVP_RENDER_OWNER_HOOKS` en `render-extension-contract-audit.js`. No fue provocado por la modificación de CharacterAppearance: los gates Foundation/Input/Movement/Camera del mismo workflow pasan. No se mezcló ese arreglo con esta pasada.

### WHAT_I_REJECTED_AND_WHY
- Rechacé smoothing/interpolation adicional: podría añadir visual lag y no atacaba la causa medida.
- Rechacé `Math.round()` de screen CSS sin DPR: no alinea píxel físico en HiDPI.
- Rechacé snap físico incondicional: con `zoom*DPR < 1` puede ser más grueso que el redondeo actual y producir sticking.
- Rechacé cambiar zoom/cámara global, collider, world position o stride para acomodar la presentación.
- Rechacé corregir `PVP_RENDER_OWNER_HOOKS` en esta misma pasada por ser una segunda hipótesis no relacionada.

### NEW_CODE_OBSERVATIONS
`KeloCharacterAppearance` ahora consume una conversión `worldToScreen()` por avatar custom cuando el snap físico aplica. Es una asignación pequeña y hoy el custom hero activo es acotado; no se añadió pooling ni API nueva porque no hay evidencia de presión GC. Si profiling 3v3 muestra coste, optimizar la primitive en KeloCamera sería preferible a duplicar matemática de cámara.

### QUESTIONS_FOR_CHATGPT
Ninguna bloqueante. Mantener el criterio: no interpretar `phaseP95=0` del modelo como prueba subjetiva de que todo jitter visual real desapareció; aún faltan frame-anchor transitions, camera-relative motion y captura browser controlada.

### NEXT_RECOMMENDATION
Volver al orden PvP base y medir `MOVIMIENTO DURANTE COMBATE`: comprobar con traces reales si basic/cast/recovery bloquean o ralentizan movimiento más de lo declarado por sus perfiles, especialmente mover+apuntar, mover+basic y mover+cast. Si los contracts ya permiten control correcto, no tocar; buscar el primer lock artificial verificable y corregir solo uno.
