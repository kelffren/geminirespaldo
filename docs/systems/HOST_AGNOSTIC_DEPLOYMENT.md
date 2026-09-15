# KELO WORLD Host-Agnostic Deployment

## Source of truth
GitHub `kelffren/gemini`, branch `main`, is the only source of truth.

## Deployment model
1. Build once from `main`.
2. Generate/validate Turbo content identities and production chunks.
3. Publish the same repository output to a compatible static edge host.
4. Validate the public host before promoting it.
5. Keep GitHub Pages available as fallback while the primary host is unhealthy or unverified.

## Current targets
- Primary candidate: Netlify `kelo-world`.
- Fallback: existing GitHub Pages deployment.
- Render is not a required dependency.

## Promotion gate
A host MUST NOT become the Turbo primary merely because deployment succeeded. Promotion requires live evidence for cache policy, compression and HTTP/CDN transport plus the complete Turbo Update Guardian contract.

## Portability rule
Game/runtime code must not depend on Netlify-specific SDKs. Host-specific behavior belongs in adapter/config files such as `netlify.toml`, `_headers`, deployment workflows or equivalent edge configuration. The game build and Turbo manifests remain portable.

## Failure rule
If the primary CDN fails, the source repository and fallback deployment remain intact. A hosting outage must never require rebuilding game logic or losing the original project.