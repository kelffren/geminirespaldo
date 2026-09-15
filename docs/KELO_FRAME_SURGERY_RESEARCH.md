# Kelo Frame Surgery — Research Quality Bar

Frame Surgery is intentionally not a general Photoshop clone. It is a finger-first repair workstation for irregular AI-generated sprites that must compile into Kelo World's canonical avatar runtime.

## External references used for the v2 hardening pass

- Aseprite selection docs: https://www.aseprite.org/docs/selecting/
  - relevant behavior: exact active-cel selection; replace/add/subtract/intersect operations; transform the selected content.
- Aseprite onion skin docs: https://www.aseprite.org/docs/onion-skinning/
  - relevant behavior: several previous/next frames visible as animation reference.
- Aseprite layers docs: https://www.aseprite.org/docs/layers/
  - relevant behavior: independent transparent layers, visibility, selection-to-new-layer workflow.
- Aseprite transformations docs: https://www.aseprite.org/docs/transformations/
  - relevant behavior: move/scale/rotate the active selection/cel without affecting unrelated content.
- Aseprite pixel-perfect context-bar docs: https://www.aseprite.org/docs/context-bar/
  - relevant behavior: pixel-perfect strokes are a first-class mode for pixel art.
- Pixelorama selection tools manual: https://orama-interactive.github.io/Pixelorama-Docs/user_manual/tools/selection_tools/
  - relevant behavior: Magic Wand, Select by Color, Lasso, polygonal selection and boolean selection modes.
- Pixelorama timeline/layers manual: https://orama-interactive.github.io/Pixelorama-Docs/user_manual/animation_timeline/
  - relevant behavior: onion-skin reference frames and per-layer visibility/locking during animation work.
- MDN Pointer Events: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
  - relevant behavior: pointer capture, pointer cancellation and device-independent touch/pen/mouse handling.
- MDN pinch gesture guidance: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures
  - relevant behavior: cache independent pointer identities and derive two-pointer scale gestures from their geometry.

## What v2 adopts

1. Exact RLE selection masks instead of bounding-box-only magic selection.
2. Replace/Add/Subtract/Intersect/Invert selection algebra.
3. Color-aware contiguous Magic Wand with adjustable tolerance instead of treating all connected opaque pixels as one object.
4. Finger Lasso that rasterizes a real polygon mask and can participate in the same boolean selection algebra.
5. Exact selection-to-piece extraction: unselected pixels inside the bounding rectangle remain transparent.
6. Multi-frame onion skin for previous/next frames.
7. Pixel-perfect rasterization of erase/restore strokes on integer pixels.
8. Pixel-snap for committed translation, scale and rotation, enabled by default but reversible.
9. Clone stamp whose sampled source follows the destination path delta.
10. Safe small-gap fill that refuses a transparent component touching the frame edge or exceeding its bounded repair area.
11. Piece controls for visibility, lock, order, selection, duplication and deletion.
12. A dedicated VISTA mode: one finger pans and two fingers zoom the inspection view without modifying sprite transforms.
13. Explicit pointercancel rollback and multi-touch commit suppression so lifting one finger cannot double-commit a pinch.
14. Original PNG remains immutable; every repair remains a reversible patch.
15. Runtime acceptance still belongs to Universal Sprite Ingestion + Frame Doctor, never to the editor alone.
16. V6 can use staged V4 only as structural corroboration when V6 already contains a strong matching hypothesis; V4 never becomes the runtime renderer.
17. Source-risk evidence survives normalization: extreme source-scale outliers and noisy/textured backgrounds can remain REVIEW_REQUIRED even if Auto-Fix produces a visually clean derivative.
18. Pixel-art runtime compilation defaults to nearest-neighbor; smoothing must be requested explicitly.

## What v2 deliberately rejects

- A general-purpose Photoshop clone with unrelated photo-editing features.
- Destructive mutation of the source PNG.
- Generative reconstruction of missing anatomy without an explicit replacement piece.
- Soft antialiased brush edges as the default for pixel art.
- A second sprite renderer or second avatar runtime.
- Blind trust in a single layout detector when independent deterministic evidence disagrees.
- A UI-only quality gate that can pass while Avatar Quick Import compatibility is broken.
- Fixing adversarial fixtures by filename or hardcoded test-case IDs.

## Release gates

`Kelo Frame Surgery Guardian` owns the 35-capability core contract. Its advanced checks exercise mask algebra, pixel snapping, raster line continuity, enclosed-gap detection, locked piece behavior and real selective-frame-patch compatibility.

`Kelo Frame Surgery Research Adversary` independently exercises the new research-driven capabilities and safety claims: color tolerance, lasso rasterization/simplification, non-destructive view navigation wiring, internal-contact vs true clipping policy, preservation of source-scale/background risk, V4/V6 corroboration constraints and nearest-neighbor pixel-art defaults.

Both must pass together with:

- adversarial sprite ingestion corpus;
- Frame Doctor audit;
- Avatar Quick Import audit;
- browser/runtime sprite-ingestion audit when that workflow is available.

A 35/35 core Guardian result is necessary but not sufficient if the Research Adversary or a relevant regression audit is red.