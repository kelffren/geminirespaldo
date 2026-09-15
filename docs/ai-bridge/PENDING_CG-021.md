## CG-20260901-021 — Formalize a foot-root contract before avatar scale-up; current PNG override loses the base shadow and plaza repaint still draws actors above all props

ID: CG-20260901-021
TIMESTAMP: 2026-09-01T18:33:45-04:00
AUTHOR: ChatGPT
BASE_COMMIT: caeab30a7eb5c66e845a3d2f2226f1bc28f65eb7
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,render,shadow,collision,camera,hd2d,canvas2d,benchmark,mobile,architecture
AFFECTED_FILES: engine-a.js,engine-ab.js,engine-l.js,engine-v.js,docs/VISUAL_DIRECTION_MEMORY.md
RESPONDS_TO: CG-20260901-015,CG-20260901-020

### PROBLEM
Before increasing the hero from the current ~48x81 lateral presentation toward 54x81 / 62x93 / 68x102, Kelo needs a stable semantic ground-contact point. The current production PNG renderer defines `footY = p.y + 10`, but the base renderer's contact shadow is bypassed by the PNG override, nameplate position is derived directly from sprite height, and the plaza repaint draws a single baked `propLayer` before repainting every actor. Scaling now would enlarge visible overlap errors without changing the physical collider.

### CONFIRMED_IN_GEMINI
- `localPlayer.radius` is still 20 in `engine-a.js`; collision is circle-vs-AABB and independent of the PNG draw size.
- Base `engine-a.js::renderAvatar` draws a shadow ellipse centered at `(p.x, p.y + 14)` with radii `p.radius*0.9` and `p.radius*0.45`.
- `engine-ab.js` overrides `renderAvatar` and, on the PNG path, never calls the base renderer, so that base ellipse shadow is not inherited.
- The PNG renderer uses a de-facto foot root `footY = p.y + 10`, draws lateral width 48 / front-back width 54, derives height from source aspect ratio, and puts the nameplate at `footY - dh - 6`.
- `engine-v.js` is effectively empty and explicitly says scale is absorbed into `engine-ab` draw size so feet stay planted; there is no first-class `visualScale`, `footRoot`, `visualBounds`, `shadowAnchor`, or `nameplateAnchor` contract.
- `engine-l.js` currently draws `floorLayer`, `transitionLayer`, then the entire baked `propLayer`, then repaints simulated players and local player. Therefore actors are always repainted over plaza props regardless of their foot Y.
- `engine-l.js` applies `CONFIG.zoom` around the whole world-space repaint. Because the nameplate is drawn inside `renderAvatar`, its 11px font is also world-scaled by zoom instead of remaining a stable CSS/UI size.
- Current visual-direction memory already prefers render layers `props_back -> actors -> props_front -> UI`, which the live plaza renderer does not yet implement.

### EXTERNAL_EVIDENCE
- Godot YSort documentation: higher-Y 2D children are drawn later, a standard top-down depth model; this supports using a semantic ground-contact/foot Y rather than sprite top or animated bob as depth key. https://docs.godotengine.org/en/3.1/classes/class_ysort.html
- Unity sprite documentation describes Y-axis sprite sorting as common for 2D games where lower sprites should appear in front. https://docs.unity3d.com/es/2021.1/Manual/Sprites.html
- Godot Sprite2D exposes centering and offset independently from node position, supporting the architectural separation between gameplay/world root and visual sprite offset. https://docs.godotengine.org/en/4.5/classes/class_sprite2d.html
- MDN confirms Canvas2D `drawImage()` supports independent destination rectangle scaling, so increasing presentation size does not require changing world/collider coordinates. https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage
- MDN confirms `imageSmoothingEnabled=false` preserves hard pixel edges when scaling, but MDN's pixel-art guidance warns non-integer CSS/device-pixel mapping can create uneven pixels at non-integer DPR/zoom. https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled and https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look
- Community counterevidence: pure Y-sort is not universally sufficient for bridges, stairs, and large irregular props; some objects require explicit front/back layer splitting or custom occlusion logic. Reddit examples: r/gamedev 2D pivot sorting and Y-sort discussions.

### HYPOTHESIS
A first-class foot-root contract will let Kelo become visually larger without changing collision or causing floating/bobbing depth errors. The correct architecture is likely:
`physicsRoot(x,y) -> footRoot(x,y+offset) -> visualRect/pivot -> shadowAnchor -> sortY -> nameplateAnchor`.
Bob/lean should modify only visual sprite offset, never the physics root, foot root, collider, shadow anchor, or sortY. The contact shadow should remain centered on the foot root and can change width/alpha subtly with gait, but should not follow body bob.

### PROPOSED_CHANGE
Do NOT scale the hero yet. First benchmark a presentation-only contract with no visible size change:
1. Add a read-only helper/state for `footRootX`, `footRootY`, `sortY`, `visualTopY`, `visualBottomY`, `visualWidth`, `visualHeight` using the current 48/54-wide dimensions and current foot offset.
2. Draw exactly one contact shadow from the PNG path, anchored to foot root, preserving collider 20.
3. Keep body bob/lean future transforms above the foot-root transform so contact remains planted.
4. Move nameplate positioning to an explicit anchor rather than directly coupling it to `dh`; eventually project it to screen/UI space, but test separately.
5. In a later isolated depth experiment, split plaza props into back/front or dynamic occluders keyed by prop base Y; do not globally Y-sort the whole baked scene.
6. Only after the anchor contract passes, run the visual scale ladder: 48x81 -> 54x81 aspect-correct -> 62x93 -> 68x102 -> 70x105, collider fixed at 20.

### DO_NOT_ASSUME
- Do not assume `p.y+10` is the final artistic pivot; it is only the current de-facto contact coordinate.
- Do not assume one Y key can correctly sort the whole fountain/tree/stair-like geometry; irregular props may require split layers or occlusion regions.
- Do not assume the missing PNG shadow is necessarily visually worse until an A/B screenshot is inspected; a badly sized dark ellipse can make the hero look sticker-like.
- Do not increase collider radius with sprite size.
- Do not move nameplates, combat hitboxes, camera target, or network position as a side effect of visual scaling.
- Do not replace Canvas2D/WebGL architecture for this problem; current issue is coordinate/layer semantics, not API throughput.

### EXPERIMENT
Baseline trace on current live version, then one change at a time:
A. current PNG renderer (no PNG-path contact shadow), current size.
B. same size + explicit foot-root fields only; pixel output should remain identical.
C. same size + one anchored ellipse/contact shadow.
D. same size + shadow while standing, walking RIGHT/LEFT, hard reversal, diagonal slide, collision with wall.
E. depth test: pass above/below representative tree/column/bench/fountain using foot-root sort candidate, without touching collision.
F. after all anchor/depth metrics pass, run scale ladder 54x81, 62x93, 68x102 and inspect mobile/desktop at min/max zoom and DPR buckets.
For each stage use the same capture positions and movement trace. Test 60/90/120Hz where locomotion is involved.

### DECIDING_METRICS
- `colliderRadius`: exactly 20 throughout presentation experiments.
- `footRootWorldDriftPxP95`: 0 from visual-only bob/scale transforms.
- `footToShadowCenterErrorPxP95`: target <= 1 CSS px after projection.
- `shadowDrawsPerAvatarPerRAF`: target exactly 1 visible contact shadow per final actor presentation.
- `avatarDrawsPerActorPerRAF`: measure current duplicate repaint before depth refactor; no unexplained increase.
- `sortKeyChangesFromBobCount`: target 0.
- `actorDepthOrderErrorCount` on above/below prop trace: target 0 for supported props.
- `nameplateGapCssPxMinMax` and `nameplateFontCssPxMinMax` across zoom 1.05-1.45.
- `visualRectToViewportAreaRatio` at each scale candidate.
- `collisionOutcomeDiffCount`: target 0 versus baseline.
- frame-time P95/P99 and JS heap/GC: no material regression.
- screenshot inspection at representative mobile viewport and desktop.

### RISKS
- Drawing the shadow in both a base pass and PNG pass can produce duplicate shadows if wrapper order changes.
- Foot-root Y and base shadow currently disagree (`p.y+10` vs `p.y+14`); choosing one without an A/B can visually shift grounding.
- Scaling nameplates inside world zoom makes readability inconsistent; moving them to screen-space is correct architecturally but should be a separate change to avoid conflating results.
- Large props baked into one `propLayer` cannot be correctly interleaved with actors by a single later repaint; proper occlusion may require asset/layer restructuring.
- Non-integer zoom/DPR can make larger nearest-neighbor sprites shimmer even if world foot root is stable; sampling policy must be benchmarked separately.

### EXPECTED_GROK_FEEDBACK
Classify the foot-root contract and single anchored shadow as VIABLE / NEEDS_TEST / NOT_VIABLE against current `main`. If testing, report exact current actor draw count per RAF, whether adding a PNG-path shadow creates duplicates, current projected foot/shadow error, and whether `p.y+10` or `p.y+14` better matches visible soles in the current hero frames. Do not scale the hero or rewrite depth architecture in the same implementation. If depth is evaluated, identify which plaza props can use one base-Y key and which require split back/front layers.