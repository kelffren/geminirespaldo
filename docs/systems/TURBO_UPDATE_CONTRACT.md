# KELO WORLD — Turbo Update Contract

Status: **INCOMPLETE / FAIL-CLOSED** until all 15 guarantees below have executable evidence.

This document is the acceptance source of truth for Turbo Update. Code comments, design intent, dead files, unexecuted scripts, or unverified hosting claims do not count as completion.

## ACCEPTANCE CRITERIA

1. **Delta manifest per file/content identity.** A generated production manifest must enumerate updateable objects and bind each object to a content identity/hash that verifies against emitted bytes.
2. **Global content-addressed cache.** Unchanged content must be reusable across build SHAs without redownloading. A build boundary alone must not evict identical objects.
3. **Content-hashed objects/chunks + reusable activation.** Production objects must use content-derived identities/URLs and activation must resolve/reuse those cached objects.
4. **Production compiler.** Minification, tree-shaking and code splitting must be executed in CI. A narrowly scoped legacy section may temporarily use a documented exception only when the incompatibility and migration path are concrete.
5. **Critical boot isolation.** Studio, World Editor, Map Forge and Visual Lab must not be in the critical player boot path; they load lazily on demand.
6. **Adaptive parallelism with combat hard stop.** Concurrency adapts to network/gameplay. Active PVP/combat means updater transfer concurrency = 0.
7. **Fetch Priority.** Background update requests use low priority; explicit/critical application can use high priority when supported, with graceful fallback.
8. **Storage persistence.** Request `navigator.storage.persist()` where available and expose/document denied/unsupported behavior.
9. **HTTP cache policy.** Content-hashed immutable objects receive long-lived immutable caching; HTML, version files and update manifests are revalidated.
10. **Compression.** JS/CSS/JSON/static text payloads use Brotli and/or Gzip where hosting supports it.
11. **Transport/CDN.** HTTP/2, HTTP/3 and/or CDN delivery must have live evidence; if the current host blocks a capability, record the limitation and an executable migration plan.
12. **Metrics.** Runtime/audit exposes **Update Delta Bytes** and **Time To Update Ready**.
13. **Fail-closed CI guardian.** Push/PR CI must fail whenever any contract guarantee loses evidence.
14. **Documentation.** This contract and hosting/build evidence stay synchronized with implementation.
15. **Deterministic delta tests.** A build with exactly one changed object must transfer only that object's delta bytes. An identical build must transfer **0 bytes of update assets**.

## EVIDENCE

Required evidence is executable wherever possible:

- production build command and emitted output;
- generated manifest whose hashes verify against emitted bytes;
- updater/service-worker tests exercising cache reuse and activation;
- deterministic byte-count tests for one-file delta and identical-build zero-byte behavior;
- CI workflow running the guardian and delta tests;
- live HTTP response/header/protocol evidence for hosting-dependent claims.

The command `npm run audit:turbo` is intentionally fail-closed. A red result means Turbo Update is not complete.

### Current baseline

The pre-Turbo updater is a useful staging foundation, but it is not sufficient evidence for this contract. It currently uses build-scoped staging (`kelo-update-stage-v2-<build>`), sequential transfer logic, network/gameplay gating, and explicit update activation. Those properties do not prove a global content-addressed cache, content-hashed production chunks, adaptive parallel transfer, production compilation, compression, or byte-perfect delta behavior.

### Legacy compiler note

No `LEGACY_COMPILER_EXCEPTION` is granted by this document at present. A future exception must include literal `LEGACY_COMPILER_EXCEPTION`, a `scope:` line naming the exact legacy surface, and a `migration:` line describing the executable path out. It must not be used to exempt the whole application indefinitely.

### Storage persistence fallback

No `STORAGE_PERSIST_FALLBACK` acceptance marker is granted until runtime behavior and documentation are implemented and tested.

## REGRESSION POLICY

A previously passing guarantee that loses its evidence immediately returns the contract to INCOMPLETE. The guardian must not infer success from filenames, comments, or an unused implementation. Tests must measure behavior or emitted build artifacts whenever feasible.

Firewall/safety rules that currently exist in `main` must be respected. Rules intentionally removed from the repository are not resurrected by this contract.

## Completion rule

Turbo Update may be called **COMPLETE** only when all 15 checks pass in CI and hosting-dependent evidence is current. Until then, the correct status is **INCOMPLETE**, even if individual pieces are merged.