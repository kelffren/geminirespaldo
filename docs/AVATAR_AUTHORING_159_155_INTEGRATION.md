# Avatar Authoring — PR 159 + PR 155 Integration

This branch deliberately composes the two avatar-authoring lines instead of merging the stale PR 155 compiler stack wholesale.

## Retained from PR 159 / current main

- Universal Sprite Ingestion and Frame Surgery remain the primary upload/repair path.
- RAW single-frame fallback, exact runtime canvas, Frame Doctor, advanced touch surgery and current compiler ownership stay authoritative.

## Promoted from PR 155

- Persistent 4×4 frame project with 16 independently replaceable slots.
- IndexedDB draft/source persistence with WebKit-safe ArrayBuffer storage.
- Shared frame compositor and non-destructive pixel masks.
- Per-frame tactile correction for scale, position, erase/restore, reference/ghost and patch recovery.
- Frame-by-frame 4×4 builder with animation preview and compilation through the existing Avatar Quick Import service.

## Deliberately not copied from PR 155

The older PR 155 versions of Universal Asset Compiler, Frame Normalizer, Frame Doctor and Ingestion Validator are not imported. Current main/PR 159 implementations retain ownership so this integration cannot regress the newer compiler pipeline.

## Product flow

The Creator Hub still exposes one `Avatar` workspace. Frame Surgery opens normally. A second in-workspace action, `CONSTRUIR 4×4 · FRAME A FRAME`, opens the persistent builder. Both paths converge on the existing Avatar Quick Import activation service.
