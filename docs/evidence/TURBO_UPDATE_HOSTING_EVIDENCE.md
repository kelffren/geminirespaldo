# Turbo Update — Hosting Evidence

Status: **LIVE_NETLIFY_VERIFICATION_REQUIRED_EACH_CI**

This file is evidence, not a waiver. Turbo Update MUST NOT be declared complete from configuration, comments, provider promises, or unverified code alone.

## Production candidate

Netlify project `kelo-world` is connected to `kelffren/gemini` `main` and production deploys are automatic. GitHub remains the source of truth and GitHub Pages remains a fallback deployment.

The repository intentionally keeps these persistent flags false:

HOSTING_HEADERS_VERIFIED: false
COMPRESSION_VERIFIED: false
TRANSPORT_VERIFIED: false

They are promoted to `true` only inside a Turbo Guardian CI workspace after `scripts/turbo-live-host-audit.mjs` has successfully probed the public production host during that exact CI run. This prevents stale evidence from surviving a hosting regression.

HOSTING_LIMITATION: Live production transport and compression cannot be proven from repository configuration alone; the public host must be reachable and probed on every acceptance run.
MIGRATION_PLAN: Keep the host-agnostic build and GitHub source of truth. If Netlify fails the live gate or becomes unavailable, retain GitHub Pages as fallback and promote another header-controllable CDN only after it passes the same live audit.

## Netlify deployment evidence

The connected Netlify deployment reports:

- project: `kelo-world`;
- branch: `main`;
- context: `production`;
- deployment mode: Git-connected / non-manual;
- six configured response-header rules processed without errors;
- public production alias: `https://kelo-world.netlify.app`.

`netlify.toml` carries the host adapter policy while the game/runtime remains provider-independent.

## Live CI acceptance gate

`scripts/turbo-live-host-audit.mjs` runs against `TURBO_PRODUCTION_HOST` and fails unless the public host proves all of the following:

- `index.html` returns `Cache-Control: no-cache, max-age=0, must-revalidate`;
- `version.json` returns the same revalidation policy;
- a real content-hashed production JavaScript object returns `Cache-Control: public, max-age=31536000, immutable`;
- `Accept-Encoding: br,gzip` returns Brotli for a compressible production asset;
- `Accept-Encoding: gzip` returns gzip fallback;
- the response contains Netlify/CDN evidence headers;
- a real HTTP/2 connection to the production host succeeds.

The audit writes `dist/turbo-live-host-evidence.json`. Only after that file exists from a passing live probe does the workflow temporarily promote the three VERIFIED flags in its disposable CI checkout and execute the final 15-point Guardian.

If the host regresses, the live audit fails before the flags are promoted and Turbo returns to FAIL-CLOSED automatically.

## Local host implementation evidence

The repository also contains `scripts/turbo-host-server.mjs` and `scripts/turbo-host-integration-test.mjs`. The integration test builds the real hashed production output, launches the local reference host and verifies revalidation, immutable caching, Brotli, gzip and source denylisting. This proves implementation behavior but does not substitute for the live public-host gate.

## Acceptance policy

TU-09 passes only from same-run public response evidence for immutable hashed assets and revalidated control-plane documents.

TU-10 passes only from same-run public `Content-Encoding` negotiation evidence.

TU-11 passes only from same-run HTTP/2 or HTTP/3 plus CDN/edge evidence, or remains explicitly blocked with a documented executable migration path.

Provider configuration alone is never sufficient.