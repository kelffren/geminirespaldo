# Universal Content Studio

`playerVisible: false`

## Owner

- Authoring/UI owner: `Kelo Universal Content Studio`.
- Semantic runtime registry: `KELO_CREATOR_CONTENT_REGISTRY` from `src/creators/content/runtime-content-registry.mjs`.
- Persistent semantic owner: Supabase `content_definitions` + immutable `content_definition_revisions`.
- Asset bytes remain owned by the existing Creator Asset foundation (`asset_families`, `asset_revisions`, Supabase Storage).
- Runtime owners are not replaced: `KELO_PROPERTY_CATALOG`, `KeloAppearance`, `KeloMountCatalog`, Character/VFX/etc. continue owning their own runtime behavior.

## Goal

Make Creator Studio the graphical/data-driven equivalent of authoring Kelo content in code. One phone-first pipeline accepts a spreadsheet plus referenced files and turns each row into reusable, versioned content without storing raw file paths in maps or gameplay state.

## Data model

`Asset` answers **which bytes?**. `Content Definition` answers **what do those bytes mean?**.

```text
content_definitions          stable identity
  -> content_definition_revisions   immutable semantic versions
       -> content_asset_bindings     roles such as primary/idle/walk/portrait
       -> content_review_requests
       -> content_publications
```

A single definition can reference one asset (tree), many assets (character animation set), or the same asset in multiple future definitions. New `content_type` values do not require a database migration as long as they follow the stable type-key format.

## Spreadsheet contract

The existing lazy CSV/XLSX importer remains the parser. `universal-content-importer.mjs` normalizes rows into jobs.

Core columns:

- `type`, `id`, `name`
- `file`
- `file_idle`, `file_walk`, `file_run`, `file_attack`, `file_hit`, `file_death`, `portrait`
- `family`, `category`, `rig`, `slot`, `profiles`
- `species`, mount profile/ability columns
- `world_w`, `world_h`, `collision`, `layer`
- `rarity`, `tags`, `publish`

Additional asset roles may use `file_<role>`, `file.<role>`, `asset_<role>` or `asset.<role>` without changing the importer.

Aliases normalize common authoring words, e.g. `armor -> equipment`, `hair/outfit -> appearance`, `tree/prop -> world`, `hero/player -> character`.

## Phone workflow

```text
Kelo Creators
 -> Content Studio
 -> sign in to Supabase
 -> choose CSV/XLSX from Files/Drive/iCloud
 -> choose all referenced image files
 -> ANALYZE
 -> validation report per row
 -> IMPORT READY ROWS
```

The browser never executes spreadsheet formulas or arbitrary code. XLSX is parsed only after explicit user action.

## Ingest pipeline

For every valid row:

1. Validate referenced local files.
2. Decode dimensions and enforce the current image asset limits.
3. SHA-256 the bytes.
4. Create/reuse an asset family for each semantic role.
5. Upload immutable bytes into `creator-private` Storage under the authenticated user prefix.
6. Register immutable `asset_revisions`.
7. Create/reuse the stable `content_definition`.
8. Hash normalized semantic payload + immutable asset revision IDs.
9. Create an immutable `content_definition_revision` plus role bindings.
10. If `publish=YES`, submit asset/content revisions to review. Browser clients cannot approve themselves.
11. Register the new semantic revision in `KELO_CREATOR_CONTENT_REGISTRY` immediately for the creator session.
12. Existing runtime owners receive adapters when their contract is already known.

## Runtime activation V1

- `world`, `tile`: registers the image with `KELO_ATLAS_CONTRACT` and a placeable template with `KELO_PROPERTY_CATALOG` immediately.
- `appearance`, `equipment`: registers visual items through `KeloAppearance`; this covers armor, clothing, hair and outfit-style visual content when a compatible profile/slot resolves.
- `mount`: registers into `KeloMountCatalog` once required movement/equipment/appearance/ability profile IDs resolve.
- `character`, `vfx`, `item`, `audio`, `ui`, and unknown future types: the immutable semantic definition becomes live in `KELO_CREATOR_CONTENT_REGISTRY`. Specialized owners can add adapters without changing DB IDs, spreadsheet format or ingest transport.

`equipment` activation in V1 is visual/appearance registration. Inventory/stats/market authority is intentionally not invented by Creator Studio; those remain server/gameplay-owner responsibilities.

## Identity and security

Browser configuration contains only the Supabase project URL and the public `sb_publishable_*` key. No `sb_secret_*` or service-role credential may enter browser code.

Writes require an authenticated Supabase JWT. Existing RLS/RPC rules enforce ownership. Stable creator bytes use the user ID as the first Storage folder segment.

Creator-authored drafts are visible/usable by their owner. Global/official publication remains an authority operation. `publish=YES` means submit for review, not bypass moderation.

## Versioning invariants

- Maps/game definitions reference immutable IDs, never Drive filenames or blob URLs.
- Replacing bytes creates a new `asset_revision`.
- Changing semantic configuration creates a new `content_definition_revision`.
- Old published revisions remain addressable.
- Runtime temporary Data URLs are presentation-only and are never persisted as identity.

## Current media boundary

The existing Creator Asset foundation currently validates PNG/WebP/JPEG up to 5 MB and 2048 px per dimension. Universal semantic schemas already include audio/UI/future types, but binary audio/ZIP ingestion must expand the existing asset-byte owner instead of creating a second storage model.

## Tests

`npm run audit:universal-content`

The audit verifies spreadsheet alias/row planning, deterministic runtime adapter dispatch, Supabase transport headers, migration contracts, Creator Hub wiring, public-key safety and mobile file-picking surface.

## Extension rule

When a new system becomes Creator-configurable:

1. reuse the same `content_definitions`/revision/binding model;
2. add/extend a schema in `content-type-schemas.mjs` only when editor hints are useful;
3. add one adapter from the universal registry to the existing runtime owner;
4. never create a parallel gameplay/render/storage owner just to support Creator Studio.
