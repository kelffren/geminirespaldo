# ENGINE_MAP — Kelo World

**Estado:** índice maestro operativo del runtime actual.  
**Auditado:** 2026-09-03 13:49 EDT (America/New_York).  
**Repositorio:** `kelffren/gemini` · branch `main`.  
**Base de código auditada:** `11241241674f8308cb4366c6c52e53aaa2440766`.  
**Versión declarada y desplegada:** `Kelo World — V6.16`.  
**Pages:** https://kelffren.github.io/gemini/  
**Último Pages verificado para la base auditada:** SUCCESS.

> Este archivo describe **quién manda realmente hoy**. Si contradice código cargado por `index.html`, gana el código y este mapa debe corregirse. Para trabajo visual, leer también `docs/VISUAL_DIRECTION_MEMORY.md` antes de tocar renderer, TileRegistry, atlases o composición.

## Etiquetas

- **OWNER LIVE** — dueño actual del comportamiento en runtime.
- **SUPPORT** — participa en el sistema, pero no tiene la última palabra.
- **LEGACY** — sigue cargado o conservado por compatibilidad; no usar como autoridad para trabajo nuevo.
- **EMPTY/DEAD** — intencionalmente vacío/desactivado. No revivir sin auditoría.
- **EXPERIMENTAL** — prototipo funcional; no asumir producción completa.
- **SERVER-AUTHORITATIVE** — online, la decisión final vive en servidor.
- **CLIENT/FALLBACK** — implementación local/UI/offline/desarrollo.
- **NEEDS_AUDIT** — hay ownership compartido o deuda que no debe resolverse por intuición.

---

# ESTADO DEL PROYECTO EN 60 SEGUNDOS

Kelo World es hoy un juego web 2D top-down móvil-first con un mundo `3600×3200`, cinco distritos y renderer por chunks de `512×512`. El entorno usa TileRegistry + atlases authored + capas de profundidad; la Plaza tiene suelo authored `800×560`, fuente PNG en dos capas y Kelo Luxe como arquitectura activa. El personaje visible usa `assets/hero.PNG`; movimiento y gait están separados del renderer.

El proyecto tiene dos generaciones de combate/habilidades coexistiendo: engines legacy de stones/aim y el sistema nuevo data-driven de `src/abilities/`. Para trabajo nuevo de piedras/habilidades, el sistema `src/abilities/*` es la referencia; los engines antiguos siguen cargados por compatibilidad y son deuda técnica.

Nobleza y Forja tienen cliente local/fallback, pero cuando hay conexión WebSocket sus resultados importantes pasan por `engine-net.js` → `server/index.js`; Nobleza usa `server/nobility-store.js` y Forja `server/forge-store.js`. Supabase está preparado mediante migraciones, aunque la Forja del servidor actual sigue usando RAM incluso cuando reporta `supabase-prepared`; no asumir persistencia de Forja hasta completar esa migración real.

La UI actual es la capa Luxe; los paneles móviles permiten `pan-y`. CI y auditorías LIVE con Playwright son parte del contrato de calidad: una feature visual no se considera terminada solo porque el código cargue.

---

# ARQUITECTURA GENERAL ACTUAL

```text
index.html
  ↓
engine-a.js                    CORE state/input/physics/camera/loop
  ↓
legacy + compatibility engines (b..k)
  ↓
environment atlases
  ↓
TileRegistry base
  ↓
registry extensions / Gardens compositions
  ↓
world-map.js                   chunked world renderer
  ↓
rural-ground.js
  ↓
engine-l.js                    authored Plaza ground + overlay
  ↓
late render/gameplay wrappers (m..aj)
  ↓
new abilities                  abilityData → stone-system → ability boot
  ↓
engine-net.js                  optional WebSocket client authority bridge
  ↓
late visual/UI environment     nature / Luxe / architecture / fountain / Gardens landmark
  ↓
systems                        Nobleza → authority → combat → equipment → Forge → Aura → Illumination
```

La arquitectura visual objetivo sigue siendo:

```text
assets/atlases
→ TileRegistry
→ biome/district definitions
→ world/map renderer
→ ground/transitions/decals
→ props_back
→ actors
→ props_front/occlusion
→ VFX
→ UI
```

---

# ORDEN REAL DE CARGA DESDE `index.html`

La última definición global cargada puede pisar una anterior. Por eso el orden importa.

1. `engine-a.js`
2. `engine-b.js`
3. `engine-c.js`
4. `engine-d.js`
5. `engine-e.js`
6. `engine-f.js`
7. `engine-g.js`
8. `engine-h.js`
9. `engine-i.js`
10. `engine-j.js`
11. `engine-k.js`
12. `src/environment/rural-nature-atlas.js`
13. `src/environment/gardens-atlas.js`
14. `src/environment/gardens-joins.js`
15. `src/environment/tile-registry.js`
16. `src/environment/district-decals-registry.js`
17. `src/environment/gardens-compositions.js`
18. `src/environment/world-map.js`
19. `src/environment/district-decals.js`
20. `src/environment/rural-ground.js`
21. `engine-l.js`
22. `engine-m.js`
23. `engine-n.js`
24. `engine-o.js`
25. `engine-p.js`
26. `engine-q.js`
27. `engine-r.js`
28. `engine-s.js`
29. `engine-t.js`
30. `engine-u.js`
31. `engine-v.js`
32. `engine-w.js`
33. `engine-x.js`
34. `engine-y.js`
35. `engine-z.js`
36. `engine-aa.js`
37. `engine-ab.js`
38. `engine-ac.js`
39. `engine-ae.js`
40. `engine-af.js`
41. `engine-ag.js`
42. `engine-ah.js`
43. `engine-ai.js`
44. `engine-aj.js`
45. `src/abilities/abilityData.js`
46. `src/abilities/stone-system.js`
47. `src/abilities/kelo-ability-boot.js`
48. `engine-net.js`
49. `src/environment/plaza-nature.js`
50. `src/environment/rural-landmarks.js`
51. `src/ui/luxe-shell.js`
52. `src/ui/luxe-boutique.js`
53. `src/environment/luxe-compose.js`
54. `src/environment/luxe-kiosk-atlas.js`
55. `src/environment/plaza-depth.js`
56. `src/environment/gardens-landmark.js`
57. `src/systems/nobility.js`
58. `src/systems/nobility-authority.js`
59. `src/systems/nobility-combat.js`
60. `src/systems/equipment-system.js`
61. `src/systems/forge-system.js`
62. `src/systems/armor-aura.js`
63. `src/systems/illumination.js`

---

# DUEÑOS ACTUALES POR SISTEMA

| Sistema | Estado | OWNER LIVE | SUPPORT / notas | No confundir con |
|---|---|---|---|---|
| Core / loop / STATE / input / física base / cámara | OWNER LIVE | `engine-a.js` | `engine-aj.js` deduplica obstáculos | wrappers posteriores no reemplazan el core completo |
| Movimiento base | OWNER LIVE + SUPPORT | `engine-a.js` | `engine-ac.js` gait/velocidad; `engine-ah.js` hard-stop | `engine-ag.js` DEAD |
| Gait / walk-run / ciclo visual por distancia | OWNER LIVE | `engine-ac.js` | publica `_visualMotion`, `_gait` | bob viejo de `engine-ah.js` ya no existe |
| Hero visible | OWNER LIVE | `engine-ab.js` + `assets/hero.PNG` | `engine-ac.js` suministra movimiento visual | `engine-d.js`, `engine-e.js`, `engine-w.js` son renderers anteriores |
| Zoom móvil | NEEDS_AUDIT | `engine-z.js` es el ajuste más tardío | `engine-h.js` HiDPI/cycleZoom; `engine-t.js` clamp previo | no editar uno aislado sin revisar los tres |
| Mundo base | OWNER LIVE | `src/environment/world-map.js` | `engine-c.js` orquesta render; `engine-l.js` superpone Plaza | fondos legacy |
| TileRegistry runtime | OWNER LIVE | `src/environment/tile-registry.js` + extensiones | `district-decals-registry.js` eleva versión runtime a `1.11.1`; `gardens-compositions.js` extiende `styles` | no asumir que `tile-registry.js` solo (`1.10.26`) es la versión final runtime |
| Plaza ground | OWNER LIVE | `engine-l.js` | `assets/plaza-ground-v1.png` `800×560`; fallback atlas | plaza JPG legacy eliminado |
| Fuente central | OWNER LIVE | `src/environment/plaza-depth.js` | `plaza-fountain-back.PNG` + `plaza-fountain-front.PNG`; collider propio | círculos/fx legacy en `engine-s.js`/`engine-aa.js` |
| Profundidad fuente | OWNER LIVE | `src/environment/plaza-depth.js` | composite `back → actor → front`, re-render de actor si está delante | depth genérico histórico del TileRegistry no sustituye este wrapper final |
| Naturaleza Plaza | OWNER LIVE | `src/environment/plaza-nature.js` | TileRegistry define atlas/placements | árboles procedurales antiguos |
| NPC Portero/Joyero | OWNER LIVE | `engine-p.js` | TileRegistry visual + minijuego; `engine-q.js` añade Maestro | perfil/bots no son NPC owner |
| Dummy entrenamiento | OWNER LIVE | `engine-o.js` | `engine-q.js` prueba de 12 s | dummy procedural fallback solo si asset falla |
| Distrito Rural suelo/finca | OWNER LIVE | `src/environment/rural-ground.js` | TileRegistry soil/props; mantiene `renderFarm` original como fallback | rectángulos de tierra de `engine-b.js` son fallback legacy |
| Distrito Rural borde/naturaleza | OWNER LIVE | `src/environment/rural-landmarks.js` | usa `ruralNature` y envuelve `renderFarm` | metadata barn/silo aún existe en registry, pero el renderer actual no la usa: NEEDS_AUDIT |
| Jardines del Sur | OWNER LIVE | `world-map.js` + `gardens-compositions.js` | `gardens-atlas.js`, `gardens-joins.js`, `gardens-landmark.js` | placements fijos ya no deben hardcodearse en renderer |
| Decals de distrito | OWNER LIVE | `district-decals-registry.js` + `district-decals.js` | layer `decals/details`, 13 placements authored | no meter decals nuevos con coordenadas sueltas en `world-map.js` |
| Arquitectura authored | OWNER LIVE | `luxe-kiosk-atlas.js` | TileRegistry `architectureAssets/Prefabs`; renderer `architecture-prefab-renderer-v1.4` | `engine-y.js` fachadas legacy |
| Kelo Luxe edificio | OWNER LIVE | TileRegistry + `luxe-kiosk-atlas.js` | único prefab activo permitido actualmente: `luxeBoutique` | Market Pavilion está explícitamente disabled |
| Kelo Luxe UI | OWNER LIVE | `src/ui/luxe-shell.js` | `luxe-boutique.js` compra local | UI vieja todavía puede existir oculta |
| Social menu routing | OWNER LIVE | `engine-c.js` | Luxe abre `toggleMenu`; systems inyectan botones | paneles demo antiguos |
| Chat / mochila simple | OWNER LIVE/SUPPORT | `engine-s.js` | Luxe oculta chat viejo y reutiliza `keloSay`; bag sigue disponible vía `KeloSocialUI` | no confundir con inventario/equipment |
| Abilities nuevas | OWNER LIVE para trabajo nuevo | `src/abilities/kelo-ability-boot.js` | `abilityData.js`, `stone-system.js` | engines `f/g/j/k/l/m` mantienen camino legacy/compat |
| Stone schema/loadout | OWNER LIVE | `src/abilities/stone-system.js` | schema v3, 5 slots, migración legacy | `STATE.equipped` viejo sin normalizar |
| Ability definitions | OWNER LIVE data | `src/abilities/abilityData.js` | 10 habilidades iniciales, tiers y recipes | datos antiguos de stones en engines |
| Equipment | OWNER LIVE client | `src/systems/equipment-system.js` | 9 slots, Quality/Grade 1–9, Armor Score | joyería/ranks antiguos de `engine-d/e` |
| Armor Aura | OWNER LIVE visual | `src/systems/armor-aura.js` | envuelve el `renderAvatar` final; Aura 0–9 | aura no es autoridad de stats, solo visual/derivada |
| Forja online | SERVER-AUTHORITATIVE | `server/forge-store.js` vía `server/index.js` | cliente/UI: `forge-system.js`; bridge: `engine-net.js` | local forge es fallback |
| Forja offline | CLIENT/FALLBACK | `src/systems/forge-system.js` | mismo contrato conceptual | no tratar roll local como autoridad online |
| Nobleza online | SERVER-AUTHORITATIVE | `server/nobility-store.js` + `server/index.js` | `nobility-authority.js` render/ingest; `engine-net.js` transporte | `engine-d/e` ranks son legacy distintos |
| Nobleza offline | CLIENT/FALLBACK | `src/systems/nobility.js` | seed board local de prototipo | no equivale al ranking global real |
| Bonus Nobleza en PvP | SERVER-AUTHORITATIVE online | `server/nobility-store.js::resolveDamage` | wrapper cliente `nobility-combat.js` | offline calcula bonus local |
| Iluminación | OWNER LIVE CLIENT | `src/systems/illumination.js` | integra level/Nobleza/Aura y ficha social | no existe autoridad server de Iluminación hoy |
| Networking cliente | OWNER LIVE | `engine-net.js` | WebSocket opcional por `?net=`; playerKey localStorage; interpolación peers | sin `?net`, juego queda local |
| Networking servidor | SERVER-AUTHORITATIVE | `server/index.js` | max 32, pose, Nobleza, Forge, combat resolve | GitHub Pages no hospeda este WebSocket |
| Supabase Nobleza | SERVER-AUTHORITATIVE preparado | `server/nobility-store.js` + `20260903_nobility.sql` | usa RPC `nobility_donate` con env vars | RAM si no hay credenciales |
| Supabase Forja | EXPERIMENTAL / NEEDS_AUDIT | `20260903_forge.sql` existe | `server/forge-store.js` actualmente marca `supabase-prepared` pero sigue manteniendo Map/RAM | no afirmar persistencia real de Forja todavía |
| Economía base / Oro / KC / inventory | OWNER LIVE CLIENT base | `engine-a.js` | Boutique, Nobleza fallback, equipment y Forge modifican/leen STATE | online Nobleza/Forja tienen saldos/estado autoritativos separados |
| UI scroll móvil | OWNER LIVE | CSS de `index.html` | canvas `touch-action:none`; `.app-panel/#menu-sheet` `pan-y` | regla global `touch-action:none` fue eliminada |
| CI | OWNER LIVE | `.github/workflows/ci.yml` | contratos de assets, sintaxis, Nobleza, entorno | no reemplaza inspección LIVE visual |
| LIVE audit | OWNER LIVE QA | `.github/workflows/live-audit.yml` | world, Gardens, decals, Rural, NPC, Luxe, fountain, Nobleza | documentación-only no necesita captura visual |
| Scroll audit | OWNER LIVE QA | `.github/workflows/ui-scroll-audit.yml` | swipe Playwright real | expected title de ese workflow está históricamente en V6.14: deuda documental/QA |
| Visual memory | OWNER LIVE doc | `docs/VISUAL_DIRECTION_MEMORY.md` | append vía pending + workflow | no editar historia validada arbitrariamente |
| ChatGPT → Grok bridge | OWNER LIVE doc/workflow | `docs/ai-bridge/CHATGPT_TO_GROK.md` | pending `CG-*` + `append-chatgpt-bridge.yml` | es append-only; no reescribir historia |
| Grok → ChatGPT bridge | SUPPORT | `docs/ai-bridge/GROK_TO_CHATGPT.md` | feedback separado | no da autoridad automática a un agente sobre el otro |

---

# INVENTARIO DE `engine-*.js`

| Archivo | Clasificación actual | Función real hoy |
|---|---|---|
| `engine-a.js` | **CORE / OWNER LIVE** | STATE, player, input, física base, cámara, obstacles, loop, save/load, economía prototipo. |
| `engine-b.js` | **SUPPORT + LEGACY MIXED** | farm fallback, arena/PvP, build/plot, panels y stone/inventory antiguos. Partes todavía son llamadas; no borrar a ciegas. |
| `engine-c.js` | **OWNER LIVE** | menú social/quick travel, world render orchestration, farm coop/pen updates. |
| `engine-d.js` | **LEGACY/SUPPORT** | ranks/jewels/perfil y renderer procedural antiguo. Perfil aún puede ser llamado; Nobleza nueva NO vive aquí. |
| `engine-e.js` | **LEGACY/SUPPORT** | segundo contrato de jewels/profile, redefine `inspectPlayer` y renderer antes del hero authored. |
| `engine-f.js` | **LEGACY/COMPAT** | aim + dash/fireball/frostnova sobre old stones. |
| `engine-g.js` | **LEGACY/COMPAT** | `skillAim`, `dashTween`, old aimed skill/action bar, wraps movement/render. |
| `engine-h.js` | **SUPPORT LIVE** | HiDPI/pixel-perfect zoom y fallback procedural de Plaza; no dueño del arte final. |
| `engine-i.js` | **EMPTY/DEAD** | vacío intencional; Plaza pertenece a `engine-l.js`. |
| `engine-j.js` | **LEGACY/COMPAT** | rango medido del old aimed-skill. |
| `engine-k.js` | **LEGACY/COMPAT** | stick de apuntado desde slot del old hotbar. |
| `engine-l.js` | **OWNER LIVE + COMPAT** | Plaza authored/HiDPI y landing marker; todavía toca `castAimedSkill` legacy. |
| `engine-m.js` | **LEGACY/COMPAT FX** | skill shots/FX antiguos. **No es el hero renderer actual.** |
| `engine-n.js` | **EMPTY/DISABLED MARKER** | melee tap apagado (`touch-attack-off`). |
| `engine-o.js` | **OWNER LIVE** | Dummy de entrenamiento + asset authored + hit/respawn. |
| `engine-p.js` | **OWNER LIVE** | Portero/Joyero, interacción/minijuego, visuals authored. |
| `engine-q.js` | **SUPPORT** | Maestro + reto de 12 s contra Dummy. |
| `engine-r.js` | **EMPTY/DEAD** | empuje NPC/bots desactivado. |
| `engine-s.js` | **SUPPORT LIVE + DEBT** | bots, chat, mochila, bubbles; aún dibuja una fuente procedural vieja. |
| `engine-t.js` | **LEGACY/SUPPORT / NEEDS_AUDIT** | clamp de zoom previo. |
| `engine-u.js` | **EMPTY/DEAD** | overlay full-sheet Plaza eliminado. |
| `engine-v.js` | **EMPTY/DEAD** | escala absorbida por `engine-ab`. |
| `engine-w.js` | **LEGACY/FALLBACK** | renderer procedural pixel hero; después lo pisa `engine-ab`. **No es melee owner.** |
| `engine-x.js` | **LEGACY/SUPPORT UI** | slim de HUD viejo; Luxe luego domina visualmente. |
| `engine-y.js` | **LEGACY VISUAL FALLBACK** | fachadas Mercado/Banco/Atelier/Café; suprime las cubiertas por prefabs authored. |
| `engine-z.js` | **SUPPORT LIVE / NEEDS_AUDIT** | zoom móvil por cantidad de tiles. |
| `engine-aa.js` | **LEGACY VISUAL + DEBT** | lámparas/glow procedural y vuelve a dibujar actors; puede duplicar capas. |
| `engine-ab.js` | **OWNER LIVE** | spritesheet `hero.PNG`, transparencia, 4 direcciones (left espejado), feet anchor. |
| `engine-ac.js` | **OWNER LIVE** | movement contract, walk/run/idle, ciclo por distancia, `_visualMotion`. |
| `engine-ae.js` | **OWNER/SUPPORT COLLISIONS LEGACY** | sustituye obstáculos grandes por colisiones de edificios con door gap; arquitectura authored luego añade su collider. NEEDS_AUDIT antes de cambiar. |
| `engine-af.js` | **EMPTY/DEAD** | café viejo desactivado. |
| `engine-ag.js` | **EMPTY/DEAD** | caminata vieja desactivada. |
| `engine-ah.js` | **OWNER LIVE SUPPORT MOVEMENT** | hard stop al soltar input; no hace bob. |
| `engine-ai.js` | **OWNER LIVE** | entrar/salir Café Oro, zone=`plaza/cafe`, clamp interior; interior aún procedural. |
| `engine-aj.js` | **SUPPORT LIVE** | deduplicación de obstacles. |
| `engine-net.js` | **OWNER LIVE CLIENT NETWORK** | WebSocket, peers, request/response authority, pose sync, interpolación. |

---

# ENTORNO Y ARTE

## Mundo

- World bounds: `3600×3200`.
- Chunk: `512×512`; cache máx. 24 chunks.
- Renderer actual: `world-v1.16`.
- Distritos: Central, Rural, Arena, Comercio, Jardines.
- Caminos principales + paths propios de Jardines.
- El renderer consume atlas base, transiciones, grass variation, marble variation, Gardens base y Gardens joins.

## TileRegistry

La carga empieza en `tile-registry.js` (`1.10.26`), pero el runtime final **no se queda ahí**:

1. `district-decals-registry.js` re-publica `KELO_TILE_REGISTRY` como **`1.11.1`** y añade atlas/styles de decals.
2. `gardens-compositions.js` vuelve a extender `styles`, preservando el registry existente y añadiendo composiciones/fixed placements de Jardines.

Por eso, al auditar runtime, la versión relevante es `1.11.1`, no `1.10.26` aislado.

## Plaza

- Rect: `x=1040 y=1240 w=800 h=560`.
- Suelo authored: `assets/plaza-ground-v1.png`, `800×560`, alpha.
- `engine-l.js` owner visual de ground/overlay y fallback.
- `KELO_PLAZA_AUDIT.version = V5.93-authored-ground` es versión interna del renderer, no la versión del juego.

## Fuente

`src/environment/plaza-depth.js` usa exactamente:

- `assets/plaza-fountain-back.PNG?art=201`
- `assets/plaza-fountain-front.PNG?art=201`
- fuentes reales `1254×1254` con alpha.
- back world box: `x=1340 y=1420 w=200 h=200`.
- front: `x=1366 y=1508 w=148 h=148`, scale `0.74`.
- collider: `x=1390 y=1492 w=100 h=60`.
- depth mode: `final-composite-back-actor-front-v2`.
- audit: `plaza-fountain-v1.6`.

## Rural

- `rural-ground.js`: `rural-v2.1`, suelo 9-slice + fence/gate north + dirt threshold.
- `rural-landmarks.js`: `rural-edge-v1`, edge clusters bajos; centro y carretera norte libres.
- **NEEDS_AUDIT:** TileRegistry aún conserva metadata de `barn`/`silo`, pero el `rural-landmarks.js` actual ya no los renderiza. No afirmar que están LIVE solo por existir en registry/assets.

## Jardines del Sur

- owner de composición runtime: `world-map.js` + `gardens-compositions.js`.
- `gardens-compositions-v5`: 11 composiciones + 10 fixed placements registrados.
- fixed placements ya se consumen desde registry/composition data; no deben volver a aparecer como diccionario hardcoded dentro de `world-map.js`.
- framing actual: `registry-authored-modular-framing-v5`.
- incluye endcaps, vertical variants, corners orientadas, water/plinth/stepping accents y clearance para landmark.

## Arquitectura

- owner: TileRegistry + `luxe-kiosk-atlas.js`.
- renderer: `architecture-prefab-renderer-v1.4`.
- mode: `luxe-only-v1`.
- prefab activo: **Kelo Luxe Boutique**.
- `engine-y.js` sigue como fallback para fachadas legacy no cubiertas.
- `KELO_MARKET_PAVILION.disabled=true` (`removed-by-player`).

---

<!-- VISUAL-SYSTEM-V1:START -->
# ANIMACIÓN / VFX MODULAR — VISUAL SYSTEM V1

**Estado:** OWNER LIVE CLIENT · LIVE móvil validado en Kelo World V6.26.

Regla de ownership: `Asset → Component independiente → Sequence opcional → VisualProfile opcional → Ability event opcional`. StoneSystem no reproduce animaciones y una pieza visual debe poder ejecutarse sin Ability.

| Responsabilidad | Estado | OWNER LIVE | Notas |
|---|---|---|---|
| Visual manifests | OWNER LIVE | `src/visuals/visual-manifests.js` | definiciones data-driven; Fireball solo es piloto |
| Asset registry / preload | OWNER LIVE CLIENT | `src/visuals/asset-registry.js` | IDs estables, lazy/preload, sin Image por cast |
| Actor animation / channels / anchors | OWNER LIVE CLIENT | `src/visuals/animation-system.js` | `locomotion/action/reaction/overlay`; sockets desde `KELO_AVATAR_PRESENTATION` |
| VFX / projectile visuals / SFX / screen FX | OWNER LIVE CLIENT | `src/visuals/fx-system.js` | pooling, culling, KELO_PERF; no decide gameplay |
| Sequences | OWNER LIVE CLIENT | `src/visuals/sequence-system.js` | timeline que referencia piezas, no las posee |
| Ability visual profiles | OWNER LIVE CLIENT | `src/visuals/ability-visuals.js` | adapter semántico + fallback legacy; no toca StoneSystem |
| Visual event/context/audit | OWNER LIVE CLIENT | `src/visuals/visual-system.js` | `KeloVisualEventBus`, `KeloVisualContext`, `KELO_VISUAL_AUDIT` |
| World visual layers | OWNER LIVE | `engine-c.js` | `groundFX → belowActor → worldFX → foregroundFX → screenFX` |
| Actor visual bridge | OWNER LIVE CLIENT | `src/visuals/visual-integration.js` | final idempotent bridge: `actorBackFX → actor → actorFrontFX` |
| Visual Lab | DEV ONLY | `src/visuals/visual-lab.js` | solo `?visualLab=1`; previews sin combate |
| Semantic visual network relay | PRESENTATION-ONLY | `engine-net.js` + `server/index.js` | servidor sanea/retransmite eventos; NO es autoridad Ability gameplay |
| Ability gameplay actual | CLIENT/FALLBACK | `src/abilities/kelo-ability-boot.js` | mantiene gameplay + primitives legacy mientras se migra habilidad por habilidad |

Fireball usa `visualProfileId: ability_visual_fireball_01`; si el resolver visual se desactiva, el cast sigue funcionando y vuelve el primitive legacy. LIVE validó mana `100→80`, cooldown `4`, foot-root `+10 px`, movimiento `MOV-plant-audit-v1`, remote replay por el mismo bus y cero errores HTTP/consola.

Documento operativo: `docs/VISUAL_SYSTEM.md`.
<!-- VISUAL-SYSTEM-V1:END -->

---

# ABILITIES Y PIEDRAS

## Nuevo sistema — usar para trabajo nuevo

- `abilityData.js`: fuente de definiciones.
- `stone-system.js`: schema v3, migración/normalización, affixes, loadout de 5 slots.
- `kelo-ability-boot.js`: ejecución de abilities, cooldown/mana, projectile/self-AOE/chain/dash/blink/instant/persistent/wall/trap/aura, FX y hotbar runtime.
- 10 habilidades iniciales.
- Tiers: Common, Rare, Epic, Legendary, Mythic, Divine.

## Camino legacy todavía cargado

`engine-f/g/j/k/l/m` todavía redefine aim/casts/render/update alrededor del old stone system. No añadir nuevas features ahí. Antes de eliminarlo hay que demostrar que ningún input/UI/PvP actual depende de él.

**Estado:** `NEEDS_AUDIT` para futura consolidación a un solo ability engine.

---

# EQUIPO, ARMOR SCORE, AURA Y FORJA

## Equipment

`equipment-system.js` (`equipment-v1.0.1`) es el owner de equipo en cliente:

- 9 slots: weapon, helmet, chest, gloves, boots, accessory, necklace, ring, belt.
- Quality 1–9.
- Grade 1–9.
- Armor Score derivado de grades.
- stats attack/defense/hp + porcentajes.

## Armor Aura

`armor-aura.js` (`armor-aura-v1.0`) envuelve el renderer final y dibuja ring/glow/particles delante/detrás del avatar según Aura 0–9. Es visual/derivado; no debe convertirse en fuente de verdad de equipment.

## Forja

Cliente/UI: `forge-system.js` (`forge-v1.0`).

- mejora level/quality/grade;
- ruby/sapphire/emerald;
- forge crystals; máximo 25;
- costes y chances;
- fallo consume recursos pero no destruye/degrada equipo;
- local fallback si no hay autoridad online.

Online: `engine-net.js` → `server/index.js` → `server/forge-store.js`.

**Importante:** `server/forge-store.js` actualmente usa un `Map` en memoria. Si hay env vars de Supabase cambia el label a `supabase-prepared`, pero el código mostrado no implementa adapter Supabase real para Forge. La migración `20260903_forge.sql` existe, pero persistencia server de Forge se marca **EXPERIMENTAL/NEEDS_AUDIT** hasta conectar store y DB.

---

# NOBLEZA

## Cliente base / offline

`src/systems/nobility.js`:

- Caballero: 30M donation, +1.
- Barón: 100M, +3.
- Conde: 200M, +5.
- Duque: Top 50, +7.
- Príncipe: Top 15, +9.
- Rey: Top 3, +12.
- 1 KC = 50,000 donation.
- board local seeded es prototipo, no ranking global.

## Online autoritativo

`nobility-authority.js` envuelve `KeloNobility`. Si `engine-net.js` está online:

```text
UI Nobleza
→ engine-net KeloNetAuthority
→ server/index.js
→ server/nobility-store.js
→ RAM authoritative o Supabase authoritative
```

Servidor decide saldo, donation, ranking/rank y damage multiplier. `nobility-combat.js` usa `combat:resolve` online y falla cerrado a daño base si authority falla.

Supabase Nobleza sí tiene adapter real + migration/RPC `20260903_nobility.sql`.

---

# ILUMINACIÓN

Owner: `src/systems/illumination.js` (`illumination-v1.1`).

- giver level mínimo 90;
- diferencia mínima 20 niveles;
- receptor máx. 5/día;
- banco de EXP y claim progresivo cada 20 min;
- Nobleza aumenta puntos diarios;
- ficha social integra nivel, Nobleza, HP, Aura, Quality/Grade.

**Estado actual:** CLIENT/LOCAL. No existe mensaje/protocolo server de Iluminación en `server/index.js`; no etiquetarla como server-authoritative.

---

# NETWORKING Y SERVIDOR

## Cliente

`engine-net.js` (`net-authority-v2`):

- solo conecta si URL viene en query `?net=...`;
- `playerKey` UUID persistido en localStorage;
- request IDs + timeout;
- sincroniza pose `x/y/face/gait/zone`;
- interpola peers;
- transporta Nobleza, combat resolve y Forge.

## Servidor

`server/index.js`:

- WebSocket `ws`, port default `2567`;
- max 32 jugadores;
- bounds `3600×3200`;
- pose/state broadcast;
- `hello`, Nobleza, Forge, combat resolve;
- zonas de pose aceptadas: `plaza`, `cafe`.

GitHub Pages sirve el cliente estático; **no hospeda el WebSocket Node**. El endpoint de red debe desplegarse aparte y pasarse con `?net=`.

---

# ECONOMÍA E INVENTARIO

`engine-a.js` sigue siendo la base local de `STATE` y contiene Oro, KC, inventory/equipped, farm/silo, market, auctions, prediction markets y plot/property prototype.

Módulos posteriores comparten/mutan ese STATE:

- `stone-system.js` normaliza inventory/equipped de stones;
- `equipment-system.js` añade equipment/equipmentSlots;
- `luxe-boutique.js` compra joyería local;
- `nobility.js` descuenta Oro/KC offline;
- `forge-system.js` usa materiales/equipment offline.

Online, Nobleza y Forja usan snapshots/autorización de servidor para sus dominios. Por eso **no existe todavía una única autoridad global de toda la economía**. Cualquier consolidación de wallets/inventory debe marcarse como proyecto separado y auditado.

---

# UI SOCIAL Y MÓVIL

- `luxe-shell.js` (`luxe-shell-v3.2`) es la shell visual actual y oculta HUD/chat/stone button viejos.
- `engine-c.js` es router de `openSocialTool()` y menú.
- `luxe-boutique.js` maneja la UI de compra Boutique local.
- systems inyectan sus propias entradas (Nobleza, Forja, etc.).
- `engine-s.js` mantiene bag/chat básicos detrás de Luxe.

## Scroll táctil

Contrato actual en `index.html`:

- `#game-canvas { touch-action:none }` para no mover la página durante gameplay.
- `.app-panel,#menu-sheet { overflow-y:auto; touch-action:pan-y; -webkit-overflow-scrolling:touch; overscroll-behavior:contain }`.
- hijos de panel/menu también permiten `pan-y`.

No reintroducir `* { touch-action:none }`; ese bug bloqueaba el swipe en iPhone.

---

# CI, PAGES Y AUDITORÍAS

## CI

`.github/workflows/ci.yml` corre en push a `main` y en PR. Comprueba:

- archivos clave;
- sintaxis Node/JS;
- contrato server/Nobleza;
- assets/environment;
- TileRegistry/decals;
- PNG dimensions/alpha de fountain y plaza;
- Plaza/NPC/Rural/Luxe contracts;
- rechazo de plaza JPG legacy, hero lowercase inexistente y procedural overlay rechazado.

## LIVE visual

`.github/workflows/live-audit.yml` usa Playwright y actualmente audita:

- world;
- Gardens;
- district decals;
- Rural;
- Plaza NPCs;
- Luxe architecture;
- fountain layered depth;
- Nobleza.

Sube screenshots/reportes como artifact.

## Auditorías adicionales

- `ui-scroll-audit.yml` + `live-ui-scroll-audit.mjs` — swipe móvil real.
- `live-fountain-only.yml` — fuente enfocada.
- `forge-ci.yml` / `forge-live-audit.yml` — Forja.
- `tests/kelo-live.spec.js` — LIVE baseline.
- `tests/stone-system.spec.js` — stones.
- scripts específicos adicionales para NPCs, Gardens variants, pavilion, decals, etc.

**Deuda QA:** `ui-scroll-audit.yml` todavía tiene `EXPECTED_TITLE: Kelo World — V6.14`; el juego está en V6.16. No se corrige en esta tarea documental porque cambiar workflow ya sería un cambio fuera de `ENGINE_MAP.md`, pero debe actualizarse en una pasada separada.

---

# MEMORIA VISUAL Y BRIDGE DE AGENTES

## Visual

`docs/VISUAL_DIRECTION_MEMORY.md` es la memoria visual persistente. Define north star, TileRegistry/atlas rules, mobile quality bar y hallazgos LIVE validados. Se actualiza mediante entries `docs/visual-memory/PENDING-*.md` y `.github/workflows/append-visual-memory.yml`, que evita reescribir la historia existente.

Para cualquier trabajo visual:

```text
leer ENGINE_MAP.md
→ leer VISUAL_DIRECTION_MEMORY.md
→ inspeccionar runtime/assets actuales
→ cambio pequeño
→ CI
→ Pages
→ LIVE móvil + consola + screenshot
→ solo entonces registrar memoria validada
```

## ChatGPT ↔ Grok

- `docs/ai-bridge/CHATGPT_TO_GROK.md`: ledger grande append-only de investigación/soluciones.
- `docs/ai-bridge/GROK_TO_CHATGPT.md`: feedback en dirección contraria.
- `PENDING_CG-*.md`: cola estructurada.
- `.github/workflows/append-chatgpt-bridge.yml`: agrega entradas CG faltantes, verifica IDs únicos y pushea el append a `main`.

Ningún agente tiene permiso implícito para aceptar decisiones del otro: uno informa, el otro evalúa/aplica y devuelve feedback.

---

# QUÉ NO TOCAR SIN AUDITORÍA

1. **`engine-a.js`** — loop, player, physics, STATE, camera, input.
2. **Cadena de movimiento:** `engine-a` → `engine-ac` → `engine-ah` y cualquier wrapper de dash.
3. **`render` / `renderAvatar` wrappers** — hay muchos y el load order importa.
4. **`engine-net.js` + `server/`** — identidad, requests, authority, peers.
5. **Nobleza:** `nobility.js`, `nobility-authority.js`, `nobility-combat.js`, server store y migration.
6. **Forja/equipment:** equipment + Forge cliente + server store.
7. **TileRegistry y sus extensiones:** base + district decals + Gardens compositions.
8. **`world-map.js`** — chunk/world topology y rutas.
9. **`engine-l.js`** — Plaza ground y parte de compat de skills.
10. **`plaza-depth.js`** — fuente, collider y back/actor/front.
11. **Economía/inventory base** — está compartida entre legacy y sistemas nuevos.
12. **Supabase migrations/RPCs** — no cambiar contrato client/server de un lado solamente.

---

# CÓMO HACER UN CAMBIO SEGURO

```text
leer ENGINE_MAP
→ localizar OWNER LIVE
→ leer SUPPORT y LEGACY que lo envuelven
→ editar el mínimo sistema correcto
→ syntax/tests
→ CI
→ merge/push seguro a main
→ esperar Pages cuando aplique
→ LIVE móvil
→ revisar consola + network/request failures
→ revisar screenshot real
→ aceptar o corregir y repetir
```

Reglas:

1. No crear otro wrapper si ya existe un OWNER LIVE sin justificarlo.
2. Antes de editar un global (`render`, `renderAvatar`, `updateMovement`, `updateSimulation`, `applyPvPDamage`) buscar todas sus reasignaciones y revisar load order.
3. No declarar “listo” por una bandera `ready=true`; screenshot LIVE sigue siendo obligatorio para visual.
4. Para cambios docs-only no fingir que una auditoría visual aporta valor; CI/document validation basta salvo que el doc cambie un contrato ejecutable.
5. Si `main` avanzó durante el trabajo, rebase/PR/merge limpio. Nunca force-push.

---

# DEUDA TÉCNICA / DOCUMENTAL ACTUAL

1. **Dos generaciones de abilities coexistiendo.** `engine-f/g/j/k/l/m` y `src/abilities/*` comparten conceptos y globals. Consolidación pendiente.
2. **Tres renderers históricos de avatar siguen cargados.** `engine-d/e/w` redefinen `renderAvatar` antes de `engine-ab`; hoy gana `engine-ab`, luego `armor-aura` lo envuelve. Eliminar legacy requiere auditoría.
3. **Procedural fountain residue.** `engine-s.js` dibuja círculos de fuente y `engine-aa.js` dibuja fountain glow aunque la fuente real es PNG layered de `plaza-depth.js`.
4. **`engine-aa.js` vuelve a dibujar actors.** Puede provocar composición duplicada/orden extraño; candidato a migrar efectos a VFX layer.
5. **Zoom tiene múltiples participantes.** `engine-h`, `engine-t`, `engine-z`; ownership fino necesita consolidación.
6. **Rank/jewel legacy vs Nobleza moderna.** `engine-d/e` tienen `RANKS/rankId` antiguos diferentes al sistema `KeloNobility`; evitar mezclar ambos conceptos.
7. **Economía no tiene autoridad única.** STATE local convive con wallets/equipment autoritativos por dominio.
8. **Forge Supabase no está conectado realmente en `forge-store.js`.** migration existe; store sigue RAM.
9. **Rural barn/silo metadata vs renderer.** Registry conserva sprites/metadata, renderer Rural actual solo usa edge vegetation; marcar barn/silo no-LIVE hasta revalidar.
10. **Legacy house renderer sigue vivo.** `engine-y.js` pinta casas no cubiertas por authored prefabs; arquitectura no está totalmente migrada.
11. **Café Oro interior sigue procedural** en `engine-ai.js`.
12. **`ui-scroll-audit.yml` espera V6.14** mientras `index.html` está V6.16.
13. **Docs secundarias pueden estar atrasadas.** `ARCHITECTURE_CURRENT.md`, `FEATURE_MATRIX.md`, `KNOWN_ISSUES.md`, etc. no sustituyen este mapa y deben auditarse por separado si se van a usar como autoridad.
14. **ENGINE_MAP anterior estaba obsoleto.** Declaraba V5.15, atribuía hero a `engine-m.js`, trataba `engine-w.js` como melee y no incluía TileRegistry/world/Nobleza/Forge/Illumination/server actual. Esta versión reemplaza esas afirmaciones.

---

# REGLAS DE MANTENIMIENTO DE ESTE DOCUMENTO

1. `ENGINE_MAP.md` explica **cómo funciona y quién manda**.
2. `docs/VISUAL_DIRECTION_MEMORY.md` explica **cómo debe verse** y qué decisiones visuales fueron validadas.
3. Toda tarea importante debe empezar leyendo ambos cuando toque código visual; para tareas no visuales, como mínimo `ENGINE_MAP.md`.
4. No actualizar este archivo por intención futura. Solo describir código existente/verificado.
5. Cuando ownership sea ambiguo, escribir `NEEDS_AUDIT`, no adivinar.
6. Si se migra un owner, actualizar este mapa en el mismo PR o inmediatamente después.
7. La SHA arriba es la **base de código auditada**, no pretende ser una SHA autorreferencial del propio commit documental.

## Links rápidos

- Repo: https://github.com/kelffren/gemini
- LIVE: https://kelffren.github.io/gemini/
- Visual memory: `docs/VISUAL_DIRECTION_MEMORY.md`
- ChatGPT → Grok: `docs/ai-bridge/CHATGPT_TO_GROK.md`
- Grok → ChatGPT: `docs/ai-bridge/GROK_TO_CHATGPT.md`

## House Instance V1 (offline-first)
`KELO_INSTANCES` separa conceptualmente world e instancias. House usa autoridad/persistencia reemplazables y reutiliza Property placements. En online, World y House workers podrán separarse sin cambiar UI/contratos.


## Admin Key / World Creator V1
`KELO_ADMIN_KEYS` decide quién puede abrir el modo de autor del mundo. Scopes iniciales: `world.edit`, `world.export`, `world.import`, `world.publish`, `admin.issue`, `admin.revoke`. El backend futuro sustituye la autoridad local sin cambiar el editor.


<!-- WORLD-BUILDER-V1:START -->
## WORLD BUILDER / ADMIN AUTHORING V1

| Sistema | Estado | OWNER LIVE / FEATURE | SUPPORT / notas |
|---|---|---|---|
| Permisos de creador | CLIENT/FALLBACK, server-ready | `src/systems/admin-key-system.js` | scopes `world.edit/export/import/publish`, `admin.issue/revoke`; online deberá validar servidor |
| World terrain/path draft | CLIENT/FALLBACK, authority-replaceable | `src/environment/world-builder-system.js` | overrides versionados; no sustituye el mapa base destructivamente |
| World collisions draft | CLIENT/FALLBACK, authority-replaceable | `src/environment/world-builder-system.js` | IDs estables; se reflejan en `obstacles` |
| World object placements | OWNER = PROPERTY | `src/property/property-system.js` | World Builder reutiliza `parcel:world:editor`; no existe un segundo modelo de objetos |
| World object presentation bajo Decoration Reset | SUPPORT presentation-only | `src/environment/world-builder-property-renderer.js` | lee Property; nunca posee placements ni economía |
| World Builder UI | CLIENT UI | `src/ui/world-builder-ui.js` | móvil/desktop; toda mutación pasa por `request()` |

**Invariante:** parcela del jugador continúa limitada por unidades. La Llave Admin solo habilita autoría del mundo principal.

**Persistencia actual:** `kelo_world_builder_state_v1` detrás de LocalWorldBuilderAuthority; objetos siguen en Property.
<!-- WORLD-BUILDER-V1:END -->
