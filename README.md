# KELO WORLD

Kelo World es un MMORPG/social RPG 2D top-down, mobile-first, construido sobre un runtime web modular con Foundation owners, sistemas online-ready y herramientas internas de creación.

**Runtime LIVE declarado:** `Kelo World — V6.54.2` en `index.html`.

## Ley principal

**ONLINE FIRST:** todo sistema nuevo debe poder conectarse a autoridad online sin rehacer su arquitectura. Lee primero `ONLINE_FIRST.md`, `docs/ONLINE_FIRST.md` y `AGENTS.md`.

**AI MOBILE-FIRST:** Kelo dirige el proyecto desde iPhone. Toda IA/agente que trabaje en el repo debe leer `AI_MOBILE_EXECUTION_BRIDGE.md` para saber cómo usar GitHub + LIVE + TinyFish/AppDeploy sin depender de una computadora personal.

## Documentación actual

- `AI_MOBILE_EXECUTION_BRIDGE.md` — puente operativo entre Kelo móvil, IAs, GitHub y QA cloud.
- `docs/GAME_STATE_CURRENT.md` — estado real del juego ahora.
- `ENGINE_MAP.md` — mapa de engine, boot order, owners y fronteras.
- `docs/ARCHITECTURE_CURRENT.md` — arquitectura por capas.
- `docs/CODE_INDEX.md` — índice de archivos y owners.
- `docs/FEATURE_MATRIX.md` — matriz de sistemas activos/pending.
- `docs/KELO_STUDIO_ARCHITECTURE.md` — World/Studio/Creators.
- `docs/ASSET_CONTRACT.md` — contrato de assets, atlas y placement.
- `docs/DOCUMENTATION_INDEX.md` — qué documentos son canónicos vs históricos.

## Pipeline de assets actual

ChatGPT/archivo → puente explícito → `assets/` → Asset Sheet Compiler → manifest irregular → Atlas Contract → Property Catalog → Studio/World → placement.

El caso Forest Plaza ya está integrado con `forest-plaza-tileset-v2.png`, 146 piezas semánticamente clasificadas y carpetas visuales en Studio.

## Entradas importantes

- Runtime: `index.html`
- Engine legacy core: `engine-a.js`, `engine-c.js`
- Foundation core: `src/core/`
- Mundo: `src/environment/`
- Studio/Creators: `src/studio/`, `src/creators/`
- Sistemas gameplay: `src/systems/`
- Propiedad/catalog: `src/property/`
- Documentación de sistemas: `docs/systems/`

Repo: https://github.com/kelffren/gemini

LIVE Pages: https://kelffren.github.io/gemini/
