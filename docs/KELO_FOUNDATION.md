# KELO WORLD — FOUNDATION RULES

> **START HERE.** Antes de modificar Kelo World, lee este archivo y después `ENGINE_MAP.md`.
>
> Baseline auditado para el pass Mount/Stats/Appearance: `main` en `1c6fe6a35f606c2629c6fea0159995c48666a853` (Kelo World V6.53 antes del candidato V6.54). Si `main` avanzó, vuelve a auditar antes de cambiar comportamiento.

## 1. Regla principal

Kelo World usa **OWNER único por responsabilidad**.

Antes de crear cualquier sistema, función, manager, renderer, collider, listener, wrapper o API nueva:

1. Busca si ya existe un OWNER de esa responsabilidad.
2. Si existe, reutilízalo.
3. Si falta una capacidad, extiende el contrato del OWNER antes de crear un sistema paralelo.
4. No dupliques comportamiento existente.
5. No añadas wrappers directos sobre funciones core si existe un hook oficial.
6. No modifiques directamente estado que pertenece a otro sistema.
7. UI no gobierna gameplay.
8. Visuales no gobiernan gameplay.
9. Contenido repetible debe ser data-driven siempre que el contrato existente lo permita.
10. Código LEGACY no recibe features nuevas.
11. La existencia de miles de contenidos no puede implicar miles de actores/assets/DOM activos.
12. Editors/Creators reutilizan infraestructura común y no inventan un segundo runtime.

La pregunta obligatoria antes de escribir código es:

> **¿QUÉ OWNER EXISTENTE DEBERÍA HACER ESTO?**

Solo si la respuesta demostrable es “ninguno” se evalúa una capacidad nueva.

---

## 2. Contenido vs capacidad

### CONTENIDO

Ejemplos: habilidad, item, arma, prop, NPC, VFX, edificio, material, outfit, montura, pieza de equipo.

Debe entrar por contratos existentes.

- Ability: `definition → targeting → delivery → effects → visuals`.
- Mount: `MountDefinition → MovementProfile → 3 ability IDs → AppearanceProfile → EquipmentSlotProfile`.
- Prop: `definition → asset → layer → collision policy → interaction`.
- Item: `definition → inventory → equipment/modifiers → visuals`.
- Outfit: `AppearanceItem → compatible profile → slot → asset/transform/layer`.
- Stat bonus: `source owner → StatModifier → KeloStats`.
- VFX: `manifest → primitive → KeloVisualSystem`.

**Contenido nuevo NO justifica un engine nuevo.**

### CAPACIDAD

Una capacidad nueva solo existe cuando ningún primitive/owner actual puede expresar el comportamiento sin romper su contrato.

Antes de añadirla:

1. Demostrar el hueco.
2. Elegir OWNER.
3. Definir contrato reusable.
4. Implementar primitive genérico.
5. Probarlo.
6. Documentarlo.
7. Reutilizarlo en más de un contenido cuando aplique.

---

## 3. Ownership objetivo

| Responsabilidad | Owner/contrato actual o candidato | Estado Foundation | Regla |
|---|---|---|---|
| Core state / loop base | `engine-a.js` | ACTIVE / demasiado amplio | Reducir progresivamente; no reescribir |
| Input ownership | `KeloInput` + `KeloInputLocks` | OWNER / TRANSITIONAL | UI reclama tokens; no writes legacy directos |
| Movement extension ownership | `KeloMovement` | OWNER / TRANSITIONAL | Features usan before/after; no segundo loop/wrapper |
| Movement physics base | `engine-a.js` | LEGACY CORE | Extraer gradualmente sin cambiar feel |
| Collision geometry + lifecycle | `KELO_COLLISION` | OWNER | Publicar buckets; no `obstacles.push/splice` |
| Camera/viewport | `KeloCamera` | OWNER / TRANSITIONAL | Target/zoom/viewport/screen↔world por API |
| Render extensions | `KeloRender` | OWNER / TRANSITIONAL | Hooks; no wrapper feature-level |
| Simulation extensions | `KeloSimulation` | OWNER / TRANSITIONAL | Hooks; no wrapper feature-level |
| Avatar composition | `KeloAvatar` | OWNER / TRANSITIONAL | Middleware; no renderer paralelo |
| World renderer | `KELO_WORLD_RENDERER` | OWNER | Mundo entra por contracts/renderer |
| Visual/VFX | `KeloVisualSystem` + visual primitives | OWNER | Presentación no decide gameplay |
| Ability runtime | `KeloAbilities` | OWNER | Delivery/effects/cooldown/collision; `castSource/predictSource` permite fuentes no-Stone sin tocar hotbar; mount/weapon reutilizan este owner |
| Stone/loadout | `KeloStones` | OWNER | **Exactamente 5 slots Stone**; mount no entra en `STATE.equipped` |
| Mount definitions/profiles | `KeloMountCatalog` | FOUNDATION CANDIDATE | Nueva montura = data; no class/switch por mount ID |
| Mount runtime/state | `KeloMounts` | FOUNDATION CANDIDATE / CLIENT FALLBACK | Único owner de `STATE.mounts`; equip/mount/dismount/equipment/outfit |
| Mount exclusive ability channel | `KeloMountAbilityChannel` → `KeloAbilities.engine.castSource` | SUPPORT CANDIDATE | Exact 3 M1/M2/M3 mounted-only; no MountAbilityEngine ni préstamo de slots Stone |
| Shared stat resolution | `KeloStats` | FOUNDATION CANDIDATE | Modifiers declarativos; sources poseen su propio state |
| Player equipment | `KeloEquipment` | OWNER client + stats adapter | API legacy preservada; mount equipment no vive aquí |
| Shared appearance definitions | `KeloAppearance` | FOUNDATION CANDIDATE | Cosmetic profiles/items/anchors; no stats ni gameplay state |
| Character visual state | `KeloCharacterCustomization` | OWNER LIVE | No reemplazar; shared Appearance entra por adapter |
| Character slot/order | `KeloCharacterSlotSchema` | OWNER LIVE PURE DATA | No duplicar lista de 24 slots |
| Character visual resolver | `KeloCharacterVisualStack` | OWNER LIVE PURE DATA | Juego/editor comparten orden donde aplique |
| Backpack/inventory moderno | `src/systems/backpack-system.js` | OWNER candidato | Consolidar legacy antes de retirar |
| Property | `src/property/property-system.js` | OWNER | Una placement = un owner físico |
| Instances | `src/instances/*` | OWNER | Reutilizar runtime/bridges existentes |
| Kelo Creators platform | `src/creators/creator-entry.mjs` | LAZY OWNER | Workspaces por registry; Hub no contiene lógica de editor |
| Creator history/recovery | Studio History + Studio Store | OWNER común | Mount/Appearance no implementan undo/store paralelos |
| Creator large lists | `virtualRange` | OWNER primitive | 20k definitions ≠ 20k DOM rows |
| Networking client | `engine-net.js` | OWNER transporte client | No confundir transporte con autoridad |
| Server authority | `server/*` | OWNER online donde aplique | Cliente no se declara autoridad online |
| UI | `src/ui/*` | CONSUMER | UI llama APIs; no gobierna state ajeno |
| Combat/effects/melee | existing modern foundation | ACTIVE/DYNAMIC según boot | Extender owners; no engines paralelos |

**Importante:** existir en el repositorio no equivale a estar LIVE. `index.html`, carga dinámica real, CI y validación LIVE mandan.

---

## 4. Dependencias permitidas

Dirección conceptual:

```text
INPUT → MOVEMENT → COLLISION
              ↓
           ACTOR STATE
              ↓
CAMERA ← SIMULATION → ABILITIES / SYSTEMS
              ↓              ↓
           RENDER          KeloStats
       ┌──────┼──────┐        ↑
      WORLD  ACTORS  VISUALS  stat sources
                      ↓
                     VFX

KeloMounts → KeloMovement
          → KeloAbilities (M1/M2/M3 adapter)
          → KeloStats
          → KeloAppearance

UI → PUBLIC APIs
CREATORS → draft schemas/validators/history/store → future publish authority
NETWORK → authority bridge / transport
SERVER → authoritative decisions online
```

Dependencias peligrosas:

```text
UI → localPlayer.x/y
UI → STATE.mounts / STATE.equipped direct
VFX → damage/hp
Appearance → gameplay stats
feature → obstacles.push directamente
feature → render = wrapper
feature → processInput = wrapper
feature → updateMovement = wrapper
mount content → if(mountId) core branch
mount → fake Stone in STATE.equipped
creator → runtime catalog mutation on every edit
creator → 20k DOM rows
legacy → nuevas features
```

---

## 5. Prohibiciones Foundation

Salvo excepción auditada y documentada:

- No `engine-v2`.
- No sistemas paralelos para una responsabilidad con OWNER existente.
- No duplicar collision, inventory, abilities, movement, renderer, stats o appearance del mismo dominio.
- No escribir directamente estado ajeno.
- No UI modificando posición/HP/economía/equipment state directamente.
- No VFX decidiendo daño.
- No features nuevas en código LEGACY.
- No `setInterval`/watchdog para mantener correcto un estado roto.
- No monkey patch silencioso.
- No wrappers nuevos directos de `render`, `renderAvatar`, `updateSimulation`, `processInput`, `updateMovement` cuando exista hook oficial.
- No manager nuevo solo para “organizar”.
- No migración tecnológica masiva sin baseline y rollback.
- No `Horse.js`, `Wolf.js`, `Dragon.js` por contenido.
- No `MountAbilityEngine`: M1/M2/M3 usan `KeloAbilities`.
- No convertir los 5 Stone slots en 8.
- No gameplay stats dentro de `AppearanceItem`.
- No equipment de montura dentro de `STATE.equipmentSlots` player.
- No XLSX/Creator modules en el boot normal del juego.
- No una lista DOM completa para catálogos de 20k.

---

## 6. Política de wrappers y hooks

Kelo World arrastra wrappers históricos. No se borran a ciegas.

Proceso:

`IDENTIFICAR → MAPEAR CADENA → MIGRAR A HOOK/API → TEST → LIVE → RETIRAR`

A partir de Foundation, un wrapper nuevo de core requiere una justificación explícita en el PR.

Hooks/APIs que deben preferirse donde apliquen:

- `KeloInput.before/after`
- `KeloMovement.before/after`
- `KeloCamera.*`
- `KeloRender.intercept/beforeFrame/afterFrame`
- `KeloSimulation.before/after`
- `KeloAvatar.setBase/use`
- `KELO_COLLISION.replaceOwner/upsert/remove/clearOwner`
- `KELO_WORLD_RENDERER.draw/drawPreActors/drawPostActors`
- `KeloVisualSystem` layers/update
- `KeloAbilities`
- `KeloStats.registerSource/resolve/markDirty`
- `KeloAppearance.registerProfile/registerItem/resolveLoadout`
- `KeloMountCatalog` + `KeloMounts`
- Kelo Creators workspace registry + shared definition session
- buses/eventos de sistemas propietarios

---

## 7. Legacy

Estados válidos:

- `OWNER`
- `SUPPORT`
- `LEGACY`
- `HOTFIX`
- `DEAD`
- `EXPERIMENTAL`
- `SERVER-AUTHORITATIVE`
- `CLIENT/FALLBACK`
- `NEEDS_AUDIT`
- `PREPARED`
- `FOUNDATION CANDIDATE`

Regla de retirada:

`IDENTIFICAR → MIGRAR CONSUMIDORES → TEST → LIVE → MARCAR DEAD → RETIRAR`

Nunca `BORRAR → arreglar lo que rompa`.

`force-unlock-move.js` está RETIRED y no se debe reactivar/copiar como patrón. Si un panel rompe movimiento, corregir ownership/acquire-release del lock.

---

## 8. Public API vs internal

Toda API estable reutilizable debe documentar:

- owner;
- propósito;
- métodos públicos;
- estado que posee;
- invariantes;
- consumidores conocidos;
- extension points.

Convención actual a respetar durante transición:

- `KELO_*`: infraestructura/contratos globales.
- `Kelo*`: API/subsistema global moderno.
- globals lowerCamel/uppercase legacy: INTERNAL/LEGACY salvo documentación expresa.

No añadir una cuarta convención.

---

## 9. KELO-INDEX

Owner files importantes deben converger a este encabezado:

```js
/* KELO-INDEX
 * area:
 * owner:
 * purpose:
 * public-api:
 * consumes:
 * state-owned:
 * extension-points:
 * reuse:
 * legacy:
 * do-not:
 */
```

No documentar cada línea. Documentar fronteras, ownership y puntos de reutilización.

---

## 10. Cómo añadir cosas

### Quiero añadir una habilidad Stone

1. Revisar `src/abilities/abilityData.js` y `KeloStones`.
2. Reutilizar `KeloAbilities` delivery/effects soportados.
3. Reutilizar Visual System/manifests.
4. No tocar core salvo capacidad genuinamente nueva.

### Quiero añadir una habilidad exclusiva de montura

1. Añadir definition mount-only al catálogo correspondiente.
2. Mantenerla fuera de `KeloStones` / `STATE.equipped`.
3. Reutilizar delivery/effects de `KeloAbilities`.
4. Si falta delivery genérico, extender `KeloAbilities`; NO crear `MountAbilityEngine`.
5. Añadirla como uno de los tres IDs de MountDefinition.

### Quiero añadir una montura

1. Elegir/reutilizar `MovementProfile`.
2. Elegir exactamente 3 mount ability IDs.
3. Elegir `AppearanceProfile` y `EquipmentSlotProfile`.
4. Registrar `assetBundleId`/animation contract cuando exista arte real.
5. Añadir `MountDefinition` data-driven.
6. No tocar `KeloMounts` core salvo que falte una capacidad genérica demostrable.
7. Validar Creator/20k audit y LIVE visual cuando existan assets.

### Quiero añadir equipo de montura

1. Crear EquipmentDefinition compatible con un EquipmentSlotProfile.
2. Expresar bonus como `StatModifier` target `player` o `mount`.
3. Usar scopes (`whileMounted`, `whileEquipped`, etc.).
4. No mutar `player.defense`, `CONFIG.speed` ni state desde la pieza/UI.

### Quiero añadir un outfit

1. Revisar `KeloAppearance` y perfiles compatibles.
2. Crear AppearanceItem: target, slot, asset bundle, transforms/layer rules.
3. Mantenerlo gameplay-stat free.
4. Character usa adapter al schema actual; Mount usa perfiles mount.
5. Probar direcciones/motions reales antes de release visual.

### Quiero añadir un VFX

1. Revisar Visual System/manifests/FX primitives.
2. Añadir definición/presentación.
3. Gameplay emite evento; VFX lo representa.

### Quiero añadir un prop

1. Usar contratos/registry/property/world existentes.
2. Definir collision policy explícita.
3. No hacer `obstacles.push` desde la feature.

### Quiero añadir UI

1. Consumir API pública del sistema owner.
2. UI no modifica state gameplay directamente.
3. Input lock debe usar el owner/contrato común.

### Quiero añadir un Creator/editor

1. Registrar un workspace en Kelo Creators.
2. Reutilizar History/Studio Store/virtualRange/input locks/preview services donde apliquen.
3. Mantener módulos pesados lazy.
4. Separar authoring draft de runtime/publish authority.
5. No implementar otro undo/redo/store/list virtualization.

### Quiero añadir un comportamiento nuevo

`buscar owner → buscar primitive → extender owner → test → documentar`

No `nuevo archivo → nuevo global → nuevo wrapper`.

---

## 11. Regla de cambio

Todo cambio Foundation debe poder responder:

1. ¿Problema confirmado?
2. ¿Owner?
3. ¿Capacidad existente reutilizable?
4. ¿Gameplay cambia?
5. ¿API cambia?
6. ¿Tests?
7. ¿Métrica/criterio de éxito?
8. ¿Qué legacy/deuda queda?
9. ¿Documentación actualizada?
10. ¿La existencia de 20k contenidos cambia el costo del runtime activo?
11. ¿Se puede crear el segundo contenido equivalente sin modificar el Core?

---

## 12. Performance

Optimización siempre:

`BASELINE → CAMBIO → TEST → MÉTRICA → KEEP/REVERT`

Prioridades acumuladas ya investigadas incluyen collider sync, viewport culling, visual hot paths, DPR móvil, memory accounting, lazy loading, World Edit boot/clones/storage, networking snapshots y catálogos Creator virtualizados.

Reglas de escala Mount/Appearance:

```text
CONTENT EXISTS != CONTENT IS ACTIVE
20,000 definitions != 20,000 actors
20,000 definitions != 20,000 textures
20,000 Creator rows != 20,000 DOM nodes
```

No conservar optimización solo porque “parece moderna”.

---

## 13. Online-first

Cliente puede tener fallback de prototipo, pero la boca debe ser reemplazable.

Para Mount/Equipment/Appearance producción, servidor debe poder validar:

- ownership/unlock de mount;
- equipped/mounted state permitido;
- mount equipment ownership/compatibility;
- mount ability/cooldown;
- stat-producing sources/modifiers aceptados;
- cosmetic ownership antes de broadcast.

Enviar IDs/revision/estado necesario, no definitions completas ni imágenes en cada snapshot.

Creators: local draft/checkpoint no equivale a publish authority. Futuro `Draft → Validate → Review → Publish` debe reemplazar repository boundary sin reescribir runtime schemas.

---

## 14. Definition of Done — KELO FOUNDATION

Foundation general no se declara terminada hasta:

- [ ] 100% de sistemas LIVE con owner conocido.
- [ ] `ENGINE_MAP.md` sincronizado con runtime actual.
- [x] `docs/KELO_FOUNDATION.md` existe y define reglas.
- [ ] Cero owner ambiguity crítica.
- [ ] Cero watchdogs/hotfixes necesarios para mantener estado correcto.
- [ ] Cero nuevos wrappers directos de core.
- [ ] Una implementación ACTIVE por responsabilidad.
- [ ] Contenido estándar añadible sin modificar core.
- [ ] APIs públicas documentadas.
- [ ] Legacy clasificado y sin features nuevas.
- [ ] CI arquitectónico activo.
- [ ] Flujo normal de `main`: branch → PR → checks → merge.
- [ ] Input/movement sin locks huérfanos.
- [ ] Smoke tests core verdes en móvil y desktop.
- [ ] LIVE validado.

### Definition of Done específica — Mount/Stats/Appearance V1

No marcar esta Foundation como ACTIVE/LIVE hasta demostrar:

- [ ] 5 Stone slots intactos.
- [ ] 3 mount slots mounted-only.
- [ ] Dos monturas creadas por data sin branches en Mount Core.
- [ ] Equip/mount/dismount sin stat drift.
- [ ] Mount equipment puede modificar player y mount via KeloStats.
- [ ] Unequip/dismount revierte scopes exactamente.
- [ ] Outfit cambia Appearance sin cambiar stats.
- [ ] Character sigue funcionando mediante su owner existente.
- [ ] Mount Creator + Appearance Creator abren lazy desde Kelo Creators.
- [ ] CSV y XLSX authoring no entran al normal boot.
- [ ] 20k mount definitions y 20k outfit definitions pasan audits sin assets/DOM masivos.
- [ ] audits legacy + Foundation + docs + Studio permanecen verdes.
- [ ] runtime sin console/page errors.
- [ ] mobile portrait/landscape validado.
- [ ] real mount/outfit art validado antes de afirmar visual pixel-perfect.

### Prueba final de escalabilidad

Un desarrollador nuevo, leyendo solo `AGENTS.md`, este documento y `ENGINE_MAP.md`, debe poder:

1. localizar el owner correcto;
2. añadir una habilidad simple;
3. añadir un prop;
4. añadir un VFX;
5. conectar UI;
6. añadir una montura y outfit por data;
7. añadir equipment bonus sin inventar stat math;
8. abrir/extender Creator sin duplicar Studio infrastructure;
9. no crear sistema paralelo;
10. no tocar core para contenido ordinario.

Si pregunta “¿en qué engine meto esto?”, la Foundation todavía no está suficientemente clara.

---

## 15. Prioridad permanente

`CORRECTO → COMPRENSIBLE → REUTILIZABLE → MEDIBLE → RÁPIDO`

Y antes de cada feature:

> **¿ESTOY CREANDO CONTENIDO O UNA CAPACIDAD?**
>
> CONTENIDO → REUTILIZA.
>
> CAPACIDAD → EXTIENDE EL OWNER.
>
> NUNCA → DUPLICA.
