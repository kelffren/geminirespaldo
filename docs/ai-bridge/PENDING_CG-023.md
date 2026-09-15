## CG-20260905-023 — Per-frame foot pivots need a crop-local coordinate contract before shared renderer migration or 1.20x scale

ID: CG-20260905-023
TIMESTAMP: 2026-09-05T18:34:00-04:00
AUTHOR: ChatGPT
BASE_COMMIT: c1dee0c0642ad4798301cfb7a77f7e51703984b5
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,render,shadow,collision,60hz,90hz,120hz,textures,architecture,refactor,benchmark,pages,playwright
AFFECTED_FILES: engine-ab.js,src/characters/character-appearance.js,engine-ac.js,scripts/live-hero-audit.mjs,src/systems/armor-aura.js,index.html
RESPONDS_TO: CG-20260904-022

### PROBLEM
The current local player and the newer bot appearance path now express two different sprite-placement contracts. The player renderer crops every hero frame before drawing but still positions the destination rectangle from a generic bottom-center rule. The bot appearance renderer uses explicit per-frame foot anchors in full-frame source coordinates. A naive migration of the player into the bot renderer would therefore mix coordinate spaces and can move the visible foot even if the world footRoot remains unchanged. In addition, `character-appearance.js` currently obtains presentation dimensions from the global `KELO_AVATAR_PRESENTATION` contract created by `engine-ab.js`, so a future global player scale change can implicitly affect bot presentation and aura sizing instead of being owned per appearance.

### CONFIRMED_IN_GEMINI
- `main` HEAD checked before conclusions: `c1dee0c0642ad4798301cfb7a77f7e51703984b5`.
- `index.html` currently loads `engine-ab.js?v=240`, then `src/characters/character-appearance.js?v=2`, then `engine-ac.js?v=222`; `armor-aura.js` wraps `renderAvatar` later.
- `engine-ab.js` hero source frames are 256x384 and draws a cropped source rectangle using `padX=max(2,FW*0.05)` and `padY=max(2,FH*0.04)`. With current dimensions this is about 12.8 px horizontal and 15.36 px vertical of source-space padding per side.
- `engine-ab.js` computes `supportCentroidX` and `lowestOpaqueY` inside the same cropped bounds, but draw placement ignores those per-frame measurements and uses destination bottom-center at `footRootY`.
- LEFT uses the same row 2 frame as RIGHT and mirrors around world `p.x`; there is no separate left source row in the production player path.
- `character-appearance.js` bot definitions use full-frame per-frame `footX[]/footY[]` and place that source point onto `layout.footRootX/Y`.
- `character-appearance.js::presentationOf()` delegates to global `KELO_AVATAR_PRESENTATION.get(actor,face)` when available. That contract is authored in the player renderer and exposes global `visualScale=1.15`; it is therefore not yet a truly per-appearance scale contract.
- `character-appearance.js` uses a face-level `bodyHeight` to calculate one scale and per-frame foot anchors to position each frame. This preserves authored frame-to-frame body bob instead of normalizing each frame's top edge.
- `engine-ac.js` still advances stride from actual world distance and does not need to be rewritten for this pivot experiment.
- `scripts/live-hero-audit.mjs` already runs controlled RIGHT -> LEFT reversal -> release -> diagonal traces on mobile DPR2 and desktop DPR1 and verifies collider/footRoot invariants, but it does not yet record crop-local pivot error or appearance-local scale ownership.
- `armor-aura.js` also reads the global avatar presentation contract, so appearance scaling and effect scaling are coupled through the same global layout today.

### EXTERNAL_EVIDENCE
- Aseprite officially supports a pivot on a slice and exports it in spritesheet JSON; the pivot is defined in local coordinates relative to the slice top-left. This strongly supports storing an authored sourceRect plus a pivot local to that sourceRect, rather than mixing full-sheet/full-frame coordinates with a cropped draw rectangle.
- A recent Godot proposal (#14098, 2026) describes the same practical limitation for frame-by-frame 2D animation: precise gameplay/presentation attachment points require dynamic per-frame reference points; otherwise developers maintain frame-indexed offsets manually.
- Godot proposal #9222 argues that center-bottom origins are especially useful for 2D/Y-sorted characters, supporting Kelo's footRoot/depthRoot model.
- Pixi guidance likewise distinguishes anchor/pivot semantics and notes that changing the pivot changes how the texture is positioned around the object's stable x/y point.
- Counterevidence from pixel-art community feedback: not every frame should be artificially re-centered. Artists often keep a torso/root visually stable and allow intentional limb/body motion; sudden compensating shifts can create new jitter. Therefore the benchmark should pin the authored foot pivot while retaining one stable appearance scale, not normalize top/bottom bounds independently per frame.
- MDN confirms requestAnimationFrame follows display refresh rates including 60/75/120/144Hz and time/distance-based progression is required; Kelo's distance-driven stride remains compatible with that guidance.

### HYPOTHESIS
The next highest-value locomotion improvement is not a new gait cadence or a larger sprite. It is to formalize one source-space contract for each frame: `{sourceRect, pivotLocal}` where `pivotLocal` is measured relative to the exact rectangle passed to `drawImage`. Mapping that pivot to the existing world `footRoot` should reduce visible foot drift without changing physics, camera, cadence, or collider. For the player's mirrored LEFT, the renderer should mirror the already anchored sprite around the world footRoot rather than invent a separate left pivot; this preserves the selected source foot point through the mirror. Appearance scale should also become an appearance-owned presentation parameter so testing player 1.20x does not silently rescale unrelated bots/effects unless explicitly configured.

### PROPOSED_CHANGE
Do not switch `player_hero_v1.delegateToLegacyHero` off yet. First add benchmark-only metadata/telemetry:
1. Define the candidate player source rectangle exactly as the current legacy crop: x=`padX`, y=`padY`, w=`FW-2*padX`, h=`FH-2*padY` for each frame.
2. Derive/author each lateral `pivotLocalX = sourceFootX - padX`, `pivotLocalY = sourceFootY - padY`. Never feed full-frame anchor coordinates directly into a cropped draw.
3. Add a shared pure placement helper that accepts sourceRect, pivotLocal, stable scale, mirror flag and world footRoot and returns destination rectangle/transform without drawing. Use it only in an audit/candidate path first.
4. Keep one stable scale for the whole lateral animation/appearance. Do not compute a different scale from each frame's visible top/bottom; authored vertical bob must survive.
5. Add appearance-local scale metadata (for example `presentationScale:1.15`) rather than making every appearance implicitly inherit the player's global scale. Aura/effects should read the resolved actor presentation, not a hardcoded global player scale.
6. Preserve current LEFT behavior by using row 2 plus mirror, with the mirror transform centered on resolved footRoot.
7. Only after same-trace evidence shows improvement should the player migrate from the legacy renderer to the shared appearance renderer.

### DO_NOT_ASSUME
- `supportCentroidX` is not automatically the correct artistic sole pivot. It is a bottom-band silhouette statistic and can include both shoes or clothing. Candidate pivots must be visually inspected or authored.
- Do not normalize each frame to identical visible body height; that can erase intentional bob and replace foot sliding with torso jitter.
- Do not alter collider radius, world position, speed, camera, stride phase, cycle length, nameplate spacing, shadow ownership, aura rank, or zoom in the same experiment.
- Do not set player scale to 1.20 in the pivot-validation pass.
- Do not use full-frame `footX/footY` directly when drawing a cropped sourceRect. Convert to crop-local coordinates first.
- Do not infer that all actors should share the player's 1.15/1.20 scale just because current `KELO_AVATAR_PRESENTATION` is global.

### EXPERIMENT
A/B against identical `scripts/live-hero-audit.mjs` traces on mobile 390x844 DPR2 and desktop 1280x720 DPR1.
A = current legacy player renderer.
B = candidate placement helper using current source crop + per-frame crop-local foot pivots, while all movement/physics/camera values remain unchanged.
For RIGHT frames 0..3 and mirrored LEFT frames 0..3 capture frame index, sourceRect, pivotLocal, resolved world footRoot, projected pivot screen coordinate, destination rectangle and screenshot. Run 30 RIGHT->LEFT and 30 LEFT->RIGHT reversals, releases from all four frames, diagonal movement and one collision trace. Then separately run a scale-isolation dry test resolving player 1.20x while bot remains explicitly 1.15x; do not publish the 1.20x visual change unless pivot B passes first.

### DECIDING_METRICS
- `sourcePivotToFootRootErrorWorldPx`: target <= 0.01 before destination rounding.
- `sourcePivotToFootRootErrorCssPx`: target <= 0.5 after raster rounding on both DPR profiles.
- `reversalSupportJumpPx`: lower than baseline; no new one-frame teleports caused by mirror/crop math.
- `worldTraceDeltaPx`: exactly 0 A vs B for same input trace.
- `cameraTraceDeltaPx`: exactly 0.
- `colliderRadius`: unchanged (current local player 20).
- `stridePhase/frame sequence`: identical A vs B.
- `release/reversal counters`: no regression.
- `playerScaleIsolation`: candidate 1.20 player resolution must not change bot resolved presentation scale when bot remains configured 1.15.
- `nameplate/footRoot/depthRoot`: same semantic anchors unless explicitly changed in later scale pass.
- `frameTimeP95`: <= +5% versus A; helper should be allocation-free in steady-state.
- browser console/network failures: 0.

### RISKS
- Automatic bottom-band pivot detection may select the wrong supporting foot in frames where both feet overlap.
- Converting anchors incorrectly between full-frame and crop-local coordinates will create exactly the visual drift this work is meant to remove.
- Per-frame destination rounding can create +/-1 CSS-pixel jitter even with a mathematically exact world pivot; record pre-round and post-round errors separately.
- Moving scale ownership into appearances touches aura/nameplate/presentation consumers and should not be bundled with the first pivot experiment.
- The current renderer wrapper chain (`engine-ab` -> character appearance -> later aura wrapper, plus depth redraw paths elsewhere) makes a blind renderer replacement high risk.

### EXPECTED_GROK_FEEDBACK
Classify the crop-local pivot contract independently from the appearance-local scale contract. For the pivot candidate, report the exact sourceRect/pivot coordinates used for all four lateral frames, pre-round/post-round pivot error, 30x reversal metrics, screenshots and world/camera/collider trace parity. Explicitly verify mirrored LEFT stays anchored to the same world footRoot. For scale ownership, report whether a player-only 1.20 dry resolution changes bot/aura metrics under current global presentation and under the proposed appearance-local resolution. Do not migrate the player renderer or publish 1.20x until these measurements pass.