# Kelo Update OS V6 / Updater V5.1

## Mission

Make Kelo World updates feel near-instant on iPhone without trading away gameplay stability. The updater is not allowed to compete with movement, PvP, rendering, module activation, or the critical boot path.

There are now two update paths:

**Runtime update**

`version gate -> exact commit diff -> changed bytes only -> off-main-thread verify -> Safari HTTP cache warm -> READY -> normal reload -> health commit`

**Non-runtime update**

`version gate -> exact commit diff -> safe-path allowlist -> LIVE FAST-FORWARD -> 0 asset bytes -> 0 reload`

## Non-negotiable invariants

1. **No repo-wide tree walk for normal updates.** Use GitHub Compare between installed and deployed commits. A one-file runtime deploy should plan one relevant changed file, not rediscover the whole repository.
2. **No mandatory Service Worker on iPhone.** Safari/iPhone must work with ordinary HTTP cache warming and normal same-origin URLs.
3. **Never execute update JS while staging.** Download and verify bytes only. Runtime evaluation remains owned by the normal boot/module loader.
4. **Verification stays off the gameplay main thread.** `update-verifier-worker.js` computes Git blob SHA-1 and can parse classic scripts without running them.
5. **Never knowingly reload into a mixed CDN version.** Exact changed blobs are compared with GitHub's expected blob SHA when the verifier is available. A mismatch emits `kelo:update:consistency-wait` and retries instead of declaring that file verified.
6. **Never download while gameplay is busy.** Movement/input, combat/PvP, hidden/offline state, manual critical priority, and ModuleLoader inflight work all block staging.
7. **No permanent polling loop.** Gate checks are one rescheduled timeout. Diagnostics are event-driven. No `setInterval`.
8. **The heavy updater is lazy.** `update-gate.js` is the normal post-boot resident. V5.1 wakes only for runtime-impacting, pending, or manually requested updates.
9. **A runtime build is not installed merely because bytes downloaded.** `applyUpdate()` creates a pending health transaction. The installed-build pointer advances only after a healthy boot.
10. **Bad runtime builds are quarantined, not repeatedly retried.** After repeated health failure the deployed build is recorded in `kelo.world.updater.blockedBuild.v5` until explicitly cleared or a different build arrives.
11. **Normal play trains the predictive hotset.** The gate observes resources once after boot and when leaving/hiding the page. No extra loop or extra learning script request is allowed.
12. **Settings observability stays first-use.** Update Intelligence and Download Center must not add normal boot payload beyond the tiny existing lazy gate.
13. **Zero-byte fast-forward is allowlist-only.** It is permitted only when every changed/previous path is clearly non-runtime: `.github/`, `docs/`, `scripts/`, repository documentation/license/changelog files, or Markdown. Runtime paths never silently fast-forward.
14. **Gate Compare is reused by V5.1.** The lightweight gate seeds `kelo.world.updater.compare.v5.*`; waking the heavy updater must not repeat the same GitHub Compare request when the seed is fresh.
15. **Telemetry must distinguish a reported stage state from cryptographic evidence.** `verifiedFiles` is evidence of completed hash checks. A UI must not present a generic boolean as stronger proof than the verifier actually produced.

## Components

### `src/core/update-gate.js` — V6 Live Fast-Forward

Tiny resident detector. It checks `version.json`, pauses around gameplay, trains the resource hotset, compares installed/deployed commits, and seeds the Compare result for V5.1.

If all changed paths are non-runtime, it advances the healthy build pointer immediately and emits `kelo:update-gate:fast-forward`. That path downloads **zero runtime assets** and performs **no reload**.

If any runtime path changed, the gate hands the detected SHA to V5.1 through `window.__KELO_UPDATE_HINT__`, so the heavy updater does not repeat the same version request.

### `src/core/update-system-v5.js` — V5.1 Verified Predictive

Owns exact runtime delta planning, changed-resource warming, bounded concurrency, CDN consistency retry, predictive hotset use, stage state, apply transaction, health commit, quarantine, and metrics.

### `src/core/update-verifier-worker.js`

Worker-only integrity layer. It has no DOM, gameplay, or networking ownership. It computes Git blob SHA-1 from downloaded bytes. Classic scripts referenced by the target index can be parse/compiled with `new Function` but are never invoked.

If Worker construction is unavailable, staging may continue in a degraded/unverified mode. Diagnostics must expose that distinction instead of pretending a hash check occurred.

### Early health recorder in `index.html`

Only exists during a pending-update reload. It begins before external scripts and captures up to 10 `error` / `unhandledrejection` events. V5.1 consumes this evidence before promoting the build to installed.

### `src/core/update-intelligence-ui.js`

First-use Settings diagnostics. V2 exposes delta size, READY latency, hash count, syntax count, hotset hits, CDN retries, Compare cache reuse, deployment-hint reuse, early boot errors, fast-forward state, health attempts, build quarantine, and a one-tap JSON diagnostic copy workflow for iPhone.

It deliberately labels the updater's stage verification separately from the count of real hash verifications.

### `scripts/update-v5-contract-test.mjs`

Executable architecture constitution. CI fails if someone reintroduces a repo tree walk, mandatory Service Worker registration, permanent intervals, old V4 wiring, removes health/predictive contracts, or weakens the V6 fast-forward allowlist contract.

## Storage keys

- `kelo.world.updater.installedBuild.v1` — currently committed healthy build.
- `kelo.world.updater.lastGoodBuild.v5` — most recent build accepted as healthy or a safe non-runtime fast-forward target.
- `kelo.world.updater.stage.v5` — short-lived READY metadata.
- `kelo.world.updater.pendingBuild.v5` — runtime build currently undergoing post-reload health validation.
- `kelo.world.updater.blockedBuild.v5` — quarantined runtime build.
- `kelo.world.updater.hotset.v1` — learned resource frequency/recency set.
- `kelo.world.updater.compare.v5.*` — short-lived commit compare cache shared between gate and V5.1.

## Main updater events

- `kelo:update:available`
- `kelo:update:staging`
- `kelo:update:delta-plan`
- `kelo:update:staging-progress`
- `kelo:update:consistency-wait`
- `kelo:update:staged`
- `kelo:update:applying`
- `kelo:update:health-committed`
- `kelo:update:health-hold`
- `kelo:update:blocked`
- `kelo:update:staging-error`

Important gate events:

- `kelo:update-gate:compare-seeded`
- `kelo:update-gate:compare-seed-error`
- `kelo:update-gate:fast-forward`
- `kelo:update-gate:hotset-learned`
- `kelo:update-gate:heavy-start`
- `kelo:update-gate:heavy-ready`

## Performance interpretation

For runtime changes, `timeToReadyMs` is the main number. Break it down with:

- `compareMs` — commit-delta discovery when V5.1 itself had to perform it.
- `compareCacheHit` — whether the gate's Compare seed eliminated that duplicate request.
- `indexMs` — target index fetch.
- `downloadMs` — changed-resource warmup.
- `verifiedFiles` — files for which real hash verification completed.
- `syntaxChecked` — classic scripts parse/compiled off-main-thread.
- `hotsetHits` — learned resources promoted into the changed-resource plan.
- `consistencyRetries` — times Pages/CDN was detected serving stale/mixed bytes.
- `hintUsed` — whether V5.1 avoided an extra `version.json` lookup using the gate handoff.
- `earlyBootErrors` — failures captured before V5.1 itself loaded after apply.

For non-runtime changes, the target metric is simpler:

- `fast-forward` event present.
- `downloadedBytes = 0`.
- `reload = false`.

## What this system does NOT promise

- It does not make physical network latency literally zero. Detection still needs control-plane requests.
- It does not guarantee Safari will retain HTTP cache forever; iOS may evict cached resources.
- It does not perform full byte-level rollback to a prior deployed GitHub Pages build. The health shield prevents promotion and quarantines a bad build. True previous-build serving requires a versioned runtime/snapshot delivery layer.
- It does not execute or gradually compile optional modules in the background. That would violate the anti-freeze architecture.
- Fast-forward does not apply to arbitrary unloaded runtime modules yet; the current allowlist intentionally favors safety over cleverness.

## Safe future evolution

High-value next steps, in order:

1. **Compact same-origin delta feed:** remove the public GitHub Compare API from the client control plane without reconfiguring Pages unsafely.
2. **Immutable build-addressed asset URLs:** make Safari cache identity deterministic for changed resources.
3. **Verified no-reload optional-module promotion:** after proving a changed module is not currently live in memory, allow a verified module-only deploy to advance without reloading the player session.
4. **Versioned runtime snapshots:** add a server-hosted last-known-good runtime before calling the system a true rollback engine.
5. **Real-device distributions:** measure p50/p95 `timeToReadyMs`, bytes/update, CDN retries, fast-forward ratio, and health failures across iPhones before increasing concurrency or shortening checks.

When changing this architecture, run `node scripts/update-v5-contract-test.mjs` and the boot-budget audit. If an optimization violates one of the invariants above, the optimization is rejected even if it benchmarks faster on one device.
