# Kelo World — Code Index

**Actualizado:** 2026-09-14

## Runtime

- `index.html` — orden LIVE, auth-first y engine boot.
- `engine-a.js` — legacy state/movement physics core.
- `engine-c.js` — legacy render/simulation orchestration.
- `engine-net.js` — networking runtime.

## Foundation Core

- `src/core/events/event-bus.js` — `KeloEvents`.
- `src/core/input-lock-system.js` — `KeloInputLocks`.
- `src/core/input-system.js` — `KeloInput`.
- `src/core/movement-system.js` — `KeloMovement`.
- `src/core/camera-system.js` — `KeloCamera`.
- `src/core/avatar-render-system.js` — `KeloAvatar`.
- `src/core/render-extension-system.js` — `KeloRender`.
- `src/core/simulation-extension-system.js` — `KeloSimulation`.
- `src/core/update-system.js` — `KeloUpdater`.

## World / Environment

- `src/environment/world-map.js` — definición principal.
- `src/environment/terrain-contract.js` — terrain.
- `src/environment/tile-registry.js` — tile/atlas registry.
- `src/environment/atlas-contract.js` — atlas authority.
- `src/environment/environment-layer-stack.js` — draw phases.
- `src/environment/surface-ground.js` — suelo.
- `src/environment/prop-contract.js` — props data-driven.
- `src/environment/prefab-contract.js` — prefab rendering contract.
- `src/environment/world-builder-system.js` — builder integration.
- `src/environment/generated/forest-plaza-tileset-v2-manifest.js` — manifest irregular Forest Plaza.

## Forest Plaza / Assets

- `assets/world/plaza/forest-plaza-tileset-v2.png` — atlas fuente LIVE.
- `src/property/forest-plaza-asset-catalog.js` — 146 templates, nombres/categorías.
- `src/property/property-asset-catalog.js` — catálogo general.
- `src/creators/assets/asset-sheet-compiler.mjs` — compiler heterogéneo.
- `src/creators/sprite-compiler/sprite-foreground-analysis.mjs` — foreground/components.
- `src/creators/sprite-compiler/sprite-world-asset-compiler.mjs` — perfil world asset.

## Studio / Creator

- `src/ui/studio-launcher.js` — launcher.
- `src/creators/workspaces/world-workspace.mjs` — route/prewarm móvil.
- `src/studio/integration/world-studio-bridge.mjs` — bridge de carga.
- `src/studio/integration/live-studio-controller.mjs` — sesión LIVE.
- `src/studio/studio-entry.mjs` — composición Studio.
- `src/studio/core/studio-kernel.mjs` — document/commands.
- `src/studio/ui/studio-live-shell.mjs` — shell.
- `src/studio/ui/studio-asset-palette.mjs` — búsqueda/categorías/carpetas.
- `src/world/map-forge/` — generación/composición Map Forge.

## Gameplay

- `src/abilities/` — abilities/Stone/equipment channels.
- `src/systems/pvp-world.js` — PvP world.
- `src/systems/arena-*` — Arena.
- `src/systems/equipment-system.js` — equipo.
- `src/mounts/` — monturas.
- `src/systems/backpack-system.js` — mochila.
- `src/systems/container-system.js` — contenedores.
- `src/systems/title-system.js` + `player-stats.js` — títulos/stats.
- `src/systems/nobility.js` — nobleza.
- `src/systems/commerce-authority.js` — commerce.
- `src/systems/regional-economy-system.js` — economía regional.
- `src/systems/caravan-system.js` — caravanas.
- `src/property/property-system.js` — placements/property.
- `src/instances/` — instancias.

## Admin / Reliability

- `src/systems/admin-key-system.js`
- `src/systems/guardian-system.js`
- `src/systems/game-tuning-system.js`
- `src/bug-reporting/`
- `bugs/` — registry/evidence canónico.

## Documentación

Empieza por `docs/DOCUMENTATION_INDEX.md`. Los documentos `*_MEMORY.md` son contexto acumulado, no autoridad superior al runtime.
