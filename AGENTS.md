# ⚠️ LEY DEL REPO — LÉE ESTO PRIMERO

Antes de modificar Kelo World, son obligatorios estos documentos:

1. [`docs/KELO_FOUNDATION.md`](docs/KELO_FOUNDATION.md) — **cómo está permitido construir y extender el proyecto**.
2. [`ENGINE_MAP.md`](ENGINE_MAP.md) — **qué existe y quién manda en el runtime actual**.
3. [`docs/ONLINE_FIRST.md`](docs/ONLINE_FIRST.md) — **cómo preservar el camino a autoridad online/server**.
4. [`docs/CODE_INDEX.md`](docs/CODE_INDEX.md) — **convención de navegación y KELO-INDEX**.
5. [`docs/SYSTEM_DOCUMENTATION_STANDARD.md`](docs/SYSTEM_DOCUMENTATION_STANDARD.md) — **cómo documentar cada sistema para humanos/IA y jugadores**.

Si estos documentos contradicen el código LIVE cargado por `index.html`, gana el runtime y la documentación debe corregirse en el mismo pass.

## LEY FOUNDATION — 1 RESPONSABILIDAD = 1 OWNER

Antes de crear cualquier sistema, función, manager, renderer, collider, listener, wrapper o API nueva, pregunta:

> **¿QUÉ OWNER EXISTENTE DEBERÍA HACER ESTO?**

- Si es **CONTENIDO**: reutiliza contratos/data/primitives existentes.
- Si es **CAPACIDAD**: extiende el OWNER existente con una primitive reutilizable.
- Nunca crees un sistema paralelo porque resulte más rápido en el momento.

Prohibido salvo justificación auditada:

- crear `engine-v2` o una segunda implementación ACTIVE de la misma responsabilidad;
- wrappers nuevos directos de `render`, `renderAvatar`, `updateSimulation` o `processInput` cuando exista un hook oficial;
- `setInterval`/watchdogs para mantener correcto un estado roto;
- UI escribiendo directamente estado gameplay ajeno;
- VFX decidiendo daño/HP;
- features escribiendo directamente `obstacles` si no son owner de colisión;
- features nuevas dentro de código LEGACY;
- asumir que un archivo es LIVE solo porque existe en `src/`.

`src/ui/force-unlock-move.js` está clasificado como **HOTFIX TEMPORAL**. No copiar ese patrón. Se retira solo después de reparar ownership de input/movement locks y validar menú, PvP, touch y movimiento.

Toda retirada sigue:

`IDENTIFICAR → MIGRAR CONSUMIDORES → TEST → LIVE → MARCAR DEAD → RETIRAR`

Nunca:

`BORRAR → ARREGLAR LO QUE ROMPA`

---

# ⚠️ ONLINE-FIRST LAW

**Todo lo que se cree o se cambie debe nacer listo para enchufarse al online.**
No rediseñar después. Misma API hoy (local-fallback) y mañana (server).

Antes de marcar algo como listo:
> ¿Puedo conectarlo al online cambiando solo la capa de autoridad, sin rehacer lógica, IDs, dueños ni el flujo del jugador?

Si es NO, no está listo.

---

# Kelo World — Mandatory Development Rules


## RULE 0 — PLAYWRIGHT iPhone GATE (OBLIGATORIA PARA EL AGENTE)

El agente **no puede** decir listo / arreglado / VERIFICADO / push-and-done
sin correr Playwright contra el build local (iPhone UA, 390×844).

Mínimo obligatorio, cada cambio de boot/UI/runtime:

1. Nace `localPlayer` y el canvas no es negro.
2. **Caminar 8 segundos seguidos** con el joystick virtual. La posición tiene que avanzar. `page.evaluate` no puede tardar >400 ms. Si el evaluate supera 2 s → FREEZE → el trabajo NO está hecho.
3. No `page crash`. No pantalla negra al soltar.

Prohibido como única prueba: “boot + 200 px en el primer frame”.
Eso ya mintió. La prueba que cuenta es el walk sostenido de 8 s.

Si Playwright no pasa, se sigue debuggeando. No se cierra el turno.


This file is mandatory reading before any implementation, refactor, integration, or new gameplay/system pass in Kelo World.

## RULE 1 — ONLINE-FIRST ARCHITECTURE (MANDATORY)

Every new Kelo World system must work in the current playable prototype while being architected so it can later move naturally to online/server-authoritative execution without rebuilding its core domain model, ownership model, persistence contract, or UI flow.

Before implementation, explicitly identify:

1. What state the feature owns.
2. What operations mutate that state.
3. What identity/ownership rules must remain invariant.
4. Which operations are currently client-authoritative.
5. Which operations must become server-authoritative before real multiplayer/economy launch.
6. The boundary/API through which the client will eventually request those operations from the server.

### Required design rule

Client UI should request an operation and render its result. Critical game rules must not be permanently coupled to DOM/UI code, localStorage, client globals, array indexes, or other client-only implementation details.

Using localStorage/client state is allowed for the current prototype only when the system has a documented authority boundary that allows the authoritative implementation to move to the server later without redesigning the feature.

### Mandatory acceptance question

Before declaring any feature complete, answer:

> Could this feature be connected to Supabase/server-authoritative multiplayer by replacing the authority/persistence layer, without rebuilding the feature's core logic, data identities, ownership rules, or player-facing flow?

If the answer is NO, the architecture is not complete.

## RULE 2 — PRESERVE VALIDATED SYSTEMS

Do not reimplement or destructively refactor a validated subsystem merely to make a new feature cleaner. Extend through small interfaces/contracts where possible. If integration threatens an existing validated invariant, stop, inspect the dependency, and choose the smaller compatible integration.

## RULE 3 — VALIDATE REAL BEHAVIOR

A green unit/CI test alone is not sufficient for user-facing systems. When the feature is exposed in the deployed game, validate the relevant LIVE flow, inspect runtime errors, and visually inspect mobile UI when applicable before recording the feature as validated.

## RULE 4 — MEMORY

System-specific memory documents record validated implementation details. They do not override this file. Plans must never be recorded as implemented behavior.

For Inventory/Containers/Market, read `docs/BACKPACK_SYSTEM_MEMORY.md` before changes.
For visual/world work, read `docs/VISUAL_DIRECTION_MEMORY.md` before changes.
For online-first law, read `docs/ONLINE_FIRST.md` before changes.
For comment keywords, read `docs/CODE_INDEX.md` before changes.
For architecture/ownership/reuse law, read `docs/KELO_FOUNDATION.md` before changes.

## RULE 5 — COMENTARIOS ÍNDICE (OBLIGATORIO)

Todo archivo JS/HTML nuevo o tocado debe llevar comentarios que **el runtime no ejecuta** (`//` o `/* */`) y una cabecera `KELO-INDEX` con palabras clave para saltar con grep.

Plantilla:

```js
/* KELO-INDEX
 * area: NET
 * keys: POSE CAST AUTHORITY PLAYERKEY
 * hace: una línea en español de qué hace este archivo
 * online: cómo se enchufa al server (o N/A si es solo arte)
 */
```

Para owners importantes, ampliar cuando sea útil con:

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

Encima de funciones que mutan estado o que el otro jugador debe ver:

```js
// KELO-INDEX NET/POSE envia x y face gait zone
```

Reglas:
- El comentario describe la función, no narra la historia del commit.
- Claves en MAYÚSCULAS, estables: ver `docs/CODE_INDEX.md`.
- No comentar cada línea. Comentar bloques y dueños.
- No usar comentarios para desactivar sistemas vivos; para eso hay flags `disabled`.
- Un cambio sin `KELO-INDEX` en archivo nuevo no está terminado.

## RULE 6 — DOCUMENTACIÓN DOBLE DE SISTEMAS (OBLIGATORIO)

Todo sistema/capacidad nueva y todo cambio material de contrato debe mantener documentación sincronizada según `docs/SYSTEM_DOCUMENTATION_STANDARD.md`.

Obligatorio:

1. Documento técnico en `docs/systems/` con ownership, API, estado, flujo, invariantes, extensión, online-first, tests, deuda y ejemplos de reutilización.
2. Registro en `docs/system-catalog.json`.
3. Si el jugador puede percibir o usar el sistema, una sección pública en `guide.html` que explique la mecánica sin revelar internals sensibles.
4. Si cambia la regla visible, actualizar guía pública en el mismo PR.
5. Ejecutar `npm run audit:docs`.

Un sistema nuevo sin documento técnico y registro de documentación **NO está terminado**.

La documentación pública no expone secretos, claves, rutas admin ni detalles explotables de autoridad. Explica qué hace el juego, cómo usarlo, límites y estados normales.

## Required startup protocol for every development pass

1. Read `docs/KELO_FOUNDATION.md`, `ENGINE_MAP.md`, `docs/ONLINE_FIRST.md`, `docs/SYSTEM_DOCUMENTATION_STANDARD.md` and this `AGENTS.md` completely.
2. Re-scan current `main` and record HEAD before assuming ownership or LIVE status.
3. Read the memory document(s) and `docs/systems/*` document for the subsystem being changed.
4. Inspect `index.html` and current code/deployed state before modifying it.
5. Identify the OWNER and classify the change as CONTENT or CAPABILITY.
6. Preserve validated invariants and apply online-first rules.
7. Prefer an existing contract/hook/primitive over a new system/global/wrapper.
8. Test deterministically.
9. Validate LIVE when the changed feature is user-facing/deployed.
10. Update subsystem memory only with behavior actually validated.
11. Stamp or refresh `KELO-INDEX` on files you touch.
12. Update `ENGINE_MAP.md`/`docs/KELO_FOUNDATION.md` when ownership, API or architecture changes.
13. Update technical docs, system catalog and `guide.html` when the system contract or player-visible behavior changes.
14. For defect work or risky changes, run the applicable Bug Intelligence preflight/gates from RULE 7 before claiming completion.

## RULE 7 — BUG REGISTRY + BUG INTELLIGENCE + AI BRIDGE (OBLIGATORIO)

KELO WORLD tiene una memoria canónica de defectos y regresiones en `/bugs`.

Cuando una tarea involucre un fallo existente, descubra un fallo reproducible, toque una superficie con historial de bugs o pretenda declarar que un defecto fue corregido, el agente debe leer:

1. `bugs/README.md`
2. `bugs/SCHEMA.md`
3. `bugs/RESEARCH_PROTOCOL.md`
4. `bugs/BUG_INTELLIGENCE.md`
5. `bugs/AI_BRIDGE.md`
6. los registros relevantes de `bugs/registry/`

### Preflight obligatorio para cambios materiales

- Consultar `npm run bug:brief -- BUG-NNNN` para bugs relacionados.
- Ejecutar `npm run bug:risk -- <base> <head>` cuando haya diff aplicable.
- Ejecutar `npm run bug:impact -- --diff <base> <head> --depth=2` cuando el cambio pueda afectar consumidores/dependencias.
- Ejecutar las verificaciones dirigidas que risk/impact recomienden.

Un score alto no demuestra un bug, pero **sí invalida afirmar “seguro” sin evidencia proporcional**.

### Cuando aparece un fallo

- `npm run bug:scan -- <log>` para fingerprint/dedupe.
- `npm run bug:candidate -- <log> --source=<origen>` si la evidencia debe persistirse.
- `npm run audit:bug-reports` para validar integridad/privacidad de REPORTs.
- `npm run bug:triage` para detectar clusters/reincidencias.
- `npm run bug:culprit -- BUG-NNNN --limit=30` si parece regresión reciente; es correlación, no prueba de causalidad.
- Antes de crear un bug, buscar duplicados.
- Si el bug canónico estaba `VERIFIED/CLOSED` y aparece evidencia posterior compatible, revisar `REOPENED`; no esconder la regresión creando otro ID.

### Estados y evidencia

- Un defecto reproducible que pueda requerir trabajo posterior debe registrarse o enlazarse a un bug existente.
- Al comenzar una corrección, usar `CLAIMED` solo mientras exista trabajo activo.
- Una IA que escribe el fix puede dejar el bug en `FIXED_PENDING_VERIFY`, con commit(s), archivos y evidencia.
- **Está prohibido saltar de `CLAIMED`/`OPEN` directamente a `CLOSED`.**
- Bugs críticos o visibles para jugadores solo pueden pasar a `VERIFIED` con una validación independiente que reproduzca el flujo original en el entorno pertinente.
- Si la verificación falla o el defecto reaparece, usar `REOPENED` y conservar el historial.
- Reportes de jugadores entran como `REPORT-*`; triage decide si crean un bug nuevo o se enlazan a uno existente.
- Screenshots/videos pesados viven fuera de Git; el registro guarda referencias.
- Nunca almacenar tokens, cookies, passwords, JWT completos o claves privadas dentro de reportes/bugs.

### Gates obligatorios antes de afirmar cierre

Cuando aplique, ejecutar:

- `npm run audit:bugs`
- `npm run audit:bug-reports`
- `npm run audit:bug-regressions`
- `npm run audit:bug-close`
- `npm run audit:bug-recurrence`

`VERIFIED/CLOSED` no es válido si el close gate carece de evidencia o si existe una reincidencia posterior sin revisar.

### CI no sustituye la disciplina del agente

La rama `main` puede no estar protegida por GitHub. Por tanto:

- un push directo puede existir antes de que Actions termine;
- `queued` significa **NO VERIFICADO**, no PASS;
- un workflow rojo no puede ignorarse solo porque el commit ya esté en `main`;
- ningún agente debe presentar una tarea como “validada/segura” si los gates aplicables están fallando o todavía no fueron ejecutados;
- si el entorno impide ejecutar una prueba requerida, registrar el bloqueo de forma explícita y no falsificar PASS.

Regla mental obligatoria:

`DETECTAR != ARREGLAR != VERIFICAR != CERRAR`

Y para regresiones:

`REPORTAR DE NUEVO -> REVISAR CANÓNICO -> REOPENED SI APLICA; NO DUPLICAR PARA ESCONDER HISTORIAL`
