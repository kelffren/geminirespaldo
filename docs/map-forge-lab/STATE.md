# Kelo Map Forge Lab — Persistent State

## Resume point

- Current cycle: **02 — ASSET_SCALE_WRONG for ordinary market props**.
- Phase: **cycles 01 and 02 integrated; visual/LIVE acceptance queued**.
- Baseline commit verified in LIVE: `05cb1e2b8f78a83d44fa794a984167c17f9f7eb8`.
- Cycle 01 implementation commit on `main`: `3bc05bf842ff3fa320a0be636a97f4617fae0fb7`.
- Cycle 02 implementation commit on `main`: `3d3f5c794a1d529f225413a30826526da1d8a60c`.
- GitHub Pages deployed that commit successfully in run `34542519251`; the served modules report generator `1.1.0` and contain both paving hard gates.
- LIVE URL: `https://kelffren.github.io/gemini/?mapEditor=1&offline=1`.
- LIVE title at baseline: `Kelo World — V6.54`.
- Generator baseline: `1.0.0`; deployed paving version: `1.1.0`; current repository version after later independent work: `1.1.1`.
- Baseline screenshot: `map-forge-cycle-01-before-seed-68-desktop.jpg` (external test artifact; not stored in Git).
- Exact after evidence: Actions artifact `10177815921` from run `34542519816`, containing preview and exterior captures at `390x844` and `1440x900`.

## Active result

Random stone fill (`72%` per terrain cell in plaza/royal/commerce) has been replaced by connected semantic paving plans. Every planned stone cell identifies its plan, district and purpose. Validation now rejects `paving_intent_missing` and `paving_blob_excessive`; therefore `generateBestOf()` cannot select those candidates.

Across seeds `1..100` for each current recipe:

| Recipe | Baseline largest component | Candidate largest component | Change |
|---|---:|---:|---:|
| Royal Capital | 22.36% average; 35.71% max | 2.42% average; 4.17% max | -89.2% average |
| Village | 20.29% average; 31.94% max | 6.03% average; 8.33% max | -70.3% average |
| Forest | 0% | 0% | unchanged |

Canary Royal Capital seed `68` moves from `60/168` connected stone cells (`35.71%`) to `4/168` (`2.38%`).

## Cycle 02 candidate

The real catalog contains both `imperial:kiosco` (`160x160`) and `imperial:carrito-mercado` (`128x96`). The importer previously resolved both a market landmark and every ordinary `market_prop` decoration to the kiosk. The candidate adds a more specific semantic rule so only ordinary props use the cart; market landmarks continue using the kiosk.

Across the fixed development corpus (20 seeds for each of Royal Capital, Village and Forest), 257 ordinary market props move from `6,579,200 px²` of projected kiosk footprint to `3,158,016 px²` of cart footprint: a deterministic **52% reduction**. All 7,383 inspected semantic placements resolve to the intended intrinsic family, and three deterministic replays are identical.

## Owners confirmed

- Generation: `src/world/map-forge/map-forge-core.mjs` + builder/recipes/quality.
- Preview/import projection: `src/studio/adapters/map-forge-draft-importer.mjs`.
- Preview renderer: `KELO_WORLD_BUILDER.renderSnapshotPreview()`.
- Real asset templates: `KELO_PROPERTY_CATALOG`.
- Ground/tiles: `KELO_TILE_REGISTRY` + `KELO_ATLAS_CONTRACT`.
- Exterior draft authority: `KELO_WORLD_EDIT`.
- Camera: `KeloCamera`.

## Known defects and next hypothesis

1. `PROP_REPETITION` / `ASSET_SCALE_WRONG`: active cycle 02 candidate maps `market_prop` to `imperial:carrito-mercado` while preserving `imperial:kiosco` for market landmarks. It is measured locally but still needs paired visual and LIVE verification.
2. `ASSET_UNUSED`: Map Forge emits `rock`, `crate` and `barrel`, plus castle/barn landmarks, but the current semantic resolver has no reliable active catalog match for them.
3. `ASSET_VARIETY_LOW`: tree/lamp/fountain rules list variants but deterministic resolution always chooses the first available ID.
4. `BAD_TRANSITION`: no approved active marble/path atlas equivalent to `surfaceGround`; World Builder owns the centralized fallback.
5. Settlemaker: no request, endpoint or provenance enum exists in the current repository path. Current generation is local; it must not be labelled `REMOTE_SETTLEMAKER`.

## Objective blockers

- The deployed source payload and exact 390×844 / 1440×900 branch captures are verified. The final interactive check against the public URL remains queued.
- Post-Pages LIVE verification was added in merge `f93b652b9294a7bf05c3957092d4c9172d3e8da5` and made forward-compatible in `07336cd31ee800cd015a2ff33dd11517b9ca8db4`.
- At `2026-09-11T07:09Z`, GitHub Actions had 18 runs in progress and 140 queued due concurrent repository work; intermediate Pages deployments were being cancelled. Keep cycle 01 at `DEPLOY_PENDING` until `Map Forge Live Paving` completes against a successful Pages run.
- Cycle 02 cannot be accepted from footprint metrics alone. Its exact mobile/desktop before/after and exterior artifacts remain pending in the same saturated Actions queue.
- Pre-existing regression at the baseline commit: `scripts/map-forge-block-overlap-audit.mjs` reports 70 Royal Capital near-touching pairs because its 24 px effective separation rule is stricter than the builder's 14 px rejection pad. The cycle-01 terrain change does not alter this count; track it separately instead of attributing it to semantic paving.

## Performance and holdout

- Alternating benchmark, 1,000 seeds per recipe: p95 generation changed `+1.6%` Royal Capital, `+0.5%` Village and `-2.0%` Forest, all within the 5% budget.
- Holdout generation 1: 30/30 valid, zero paving hard gates; maximum connected paving ratio `2.38%` Royal, `8.33%` Village and `0%` Forest.

## Next execution

1. Read this file and the three JSON ledgers in this directory.
2. Confirm the deployed commit/version before generating anything.
3. Read the first completed `Map Forge Live Paving` run and attach its artifact IDs; then change cycle 01 to `ACCEPTED` only if it passed.
4. Run the cycle 02 semantic variety audit and paired visual suite on its integrated commit; accept or revert from that evidence.
