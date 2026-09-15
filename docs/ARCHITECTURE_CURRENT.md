# Kelo World — Architecture Current

**Actualizado:** 2026-09-14 · Runtime V6.54.2

## Capas

### 1. Boot / Account
`index.html` → Supabase/Auth UI → Guest bypass → engine boot diferido.

### 2. Foundation Core
`src/core/` posee eventos, input locks, input, movement extension, camera, avatar composition, render/simulation extension y update system.

### 3. Legacy Core
`engine-a.js` y `engine-c.js` todavía contienen estado/física/render base. Los demás `engine-*.js` son módulos históricos/feature support. No deben recibir nuevas responsabilidades si existe owner moderno.

### 4. World / Environment
`src/environment/` posee terrain contract, atlases, world map, layer stack, surface ground, prop contract, prefab contract, district visuals y World Builder support.

### 5. Asset Infrastructure
`KELO_ATLAS_CONTRACT` resuelve atlas; `KELO_PROPERTY_CATALOG` expone templates placeables. Compilers producen metadata, no renderers.

### 6. Studio / Creators
`src/studio/` contiene document/kernel/tools/UI. `src/creators/` contiene workspaces, Map Forge, asset compiler y evolución. Todos delegan mutations a owners existentes.

### 7. Gameplay Domains
Abilities, equipment, mounts, backpack, PvP/Arena, identity/titles, nobility, economy, commerce, property, instances y guardian son owners separados.

### 8. Online
`engine-net.js`, auth lifecycle y módulos server/Supabase implementan o preparan autoridad online. La regla es server-authoritative para valor persistente/competitivo.

## Flujo de asset moderno

`PNG/JPEG/WebP → foreground analysis → asset sheet compiler → sourceRects irregulares → manifest → atlas → semantic catalog → Studio palette → placement`

Forest Plaza es el caso de referencia actual: 146 piezas, IDs legacy preservados, nombres semánticos y 7 carpetas visuales.

## Fronteras obligatorias

- cámara solo vía `KeloCamera`;
- colisiones solo vía `KELO_COLLISION`;
- render feature vía `KeloRender`/contratos de environment;
- templates vía `KELO_PROPERTY_CATALOG`;
- World changes vía Studio/`KELO_WORLD_EDIT`;
- assets importados no inventan un renderer;
- UI no se convierte en autoridad gameplay;
- cliente no se convierte en autoridad final online.

## Móvil

El editor se abre con chrome-first y prewarm/boot por etapas. Evitar canvas/blur/import masivo simultáneo en iPhone. La verificación final de World móvil es dispositivo real + LIVE.
