# KELO WORLD — Freeze Locator

> Herramienta opt-in del owner existente `src/core/bug-observability.mjs` para localizar el último punto sano antes de un freeze/crash móvil.

## Objetivo

Reducir bugs como `BUG-0003` de “se congela al abrir World” a una frontera concreta, por ejemplo:

```text
Studio shell = loading
status = Cargando editor… 17/30
last module = src/studio/adapters/current-world-importer.mjs
EVENT_LOOP_SEVERE_STALL = 2384 ms
```

Eso permite atacar el módulo/fase siguiente en vez de volver a probar todo el editor.

## Activación

No está activo en el juego normal.

Abrir LIVE con uno de estos query flags:

```text
?freezeLab=1
?freeze=1
?debugFreeze=1
```

Para `BUG-0003`, ruta recomendada:

```text
https://kelffren.github.io/gemini/?aiGuest=1&creators=1&freezeLab=1
```

## Qué observa

- montaje de `#kelo-studio-live`;
- `data-kelo-world-loading`;
- texto de `.ks-status` / progreso `Cargando editor… N/total`;
- último recurso `src/studio/` o `src/creators/` terminado;
- cantidad de recursos cargados;
- heartbeat del event loop;
- stalls > 700 ms;
- stalls severos > 2000 ms;
- Long Tasks cuando el navegador los expone;
- último input/tap recibido;
- `window.error` y `unhandledrejection`;
- pagehide/pageshow/visibility.

Los milestones se guardan en `sessionStorage` usando el owner existente de Bug Observability. Si WebContent muere y la pestaña vuelve a cargar, el nuevo arranque puede mostrar el último milestone conservado.

## HUD

Con Freeze Locator activo aparece un HUD pequeño con:

```text
FREEZE LOCATOR · BUG-0003
LOADING · Cargando editor… 17/30
last module: src/studio/...
loop 251ms / max 2384ms · stalls 2
input pointerdown:World ...
```

El HUD usa `pointer-events:none`; no debe bloquear el editor.

## API para agentes/tests

```js
window.KELO_FREEZE_LOCATOR.report()
window.KELO_FREEZE_LOCATOR.read()
window.KELO_FREEZE_LOCATOR.last()
window.KELO_FREEZE_LOCATOR.mark('AGENT_CHECKPOINT', { phase: '...' })
```

`report()` devuelve estado actual + últimos milestones del flujo.

## Interpretación rápida

### Caso A — status deja de avanzar

```text
STATUS_STUCK
status=Cargando editor… 17/30
lastResource=src/studio/X.mjs
```

Inspeccionar primero la transición 17 → 18 y el módulo siguiente del preload. No reescribir Studio entero.

### Caso B — event loop muere después de un módulo

```text
RESOURCE_READY X.mjs
EVENT_LOOP_SEVERE_STALL 4200ms
```

Ese recurso/fase es sospechoso, no causa confirmada. Instrumentar o aislar el siguiente paso.

### Caso C — shell READY pero taps no llegan

Si `shellState=ready`, status estable y `lastInput` no cambia al tocar, buscar overlay/pointer interception/z-index/input lock.

### Caso D — pantalla negra / WebContent kill

Si la pestaña recarga o muere sin error JS, revisar el último milestone persistido y `lastResource`. La ausencia de excepción no convierte el módulo anterior en causa confirmada.

## Regla de investigación

Freeze Locator produce **evidencia de frontera**, no causa raíz automática.

Usar:

```text
último milestone sano
→ primer milestone ausente/fallido
→ experimento discriminante
→ actualizar BUG-0003
```

No usar:

```text
último archivo visto = culpable confirmado
```

## Desactivación

Quitar `freezeLab=1`/`freeze=1`/`debugFreeze=1` de la URL. El runtime normal no instala heartbeat, HUD ni PerformanceObservers del locator.
