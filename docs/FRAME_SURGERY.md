# Kelo Frame Surgery — Finger First

Frame Surgery is the manual fallback for Universal Sprite Ingestion V6. It is not a second renderer and it does not replace automatic normalization.

## Product flow

`upload → auto-detect → auto-fix → Frame Doctor → touch repair only when needed → recompile → validate → use`

The original source image is never edited. Every manual correction is stored as a reversible per-frame patch and baked only into the validated runtime derivative.

## Finger contract

- One finger moves the active character/piece.
- Two fingers pinch to scale and twist to rotate.
- Three-finger horizontal swipe performs undo/redo.
- Erase/Restore/Clone/Fill operate directly with touch strokes.
- Crop handles are deliberately oversized for mobile use.

## Five primary tools

`MOVER · BORRAR · RESTAURAR · PIEZA · COMPARAR`

Secondary repair actions include Auto-Fix, align feet, center body, match scale, magic selection, selection-to-layer, import piece, copy from frame, clone, small-gap fill, free crop and simple layer visibility.

## Release gate

`USAR COMO AVATAR` remains disabled until the same Universal Sprite Ingestion validator and Frame Doctor accept the compiled runtime. A source-edge art defect can only stop being an automatic regeneration blocker after a real piece/overlay is supplied; the resulting atlas is then judged again for clipping, alignment, consistency and final health.

## Supervisor

`scripts/avatar-frame-surgery-supervisor-audit.mjs` owns the strict 25-feature contract. CI also runs the existing adversarial sprite-ingestion corpus, Frame Doctor audit and Avatar Quick Import audit. The guardian exits non-zero on any missing promised capability or regression.
