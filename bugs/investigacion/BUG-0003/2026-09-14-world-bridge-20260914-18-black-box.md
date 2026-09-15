BUG: BUG-0003
FECHA: 2026-09-14
VERSION / BUILD: world-bridge-20260914-18 / commits f47c8b50b07c75b8f47b606de2b8ecaf8c804452 + 922cf5032f2671f8e5d8ec3a9eb12e6abae5a51f
ESTADO: vigente
ENTORNO: Kelo World main; target acceptance remains real iPhone Safari

# World open black-box instrumentation

## Objetivo

Dejar de diagnosticar `Create -> World` solamente por el síntoma visual. El bridge World→Studio ahora registra milestones persistentes en el owner existente `src/core/bug-observability.mjs`, sin crear otro renderer, authority ni store.

## Hechos nuevos

- `src/studio/integration/world-studio-bridge.mjs` es el primer hop existente World→Studio y sigue siendo el único owner del handoff.
- El bridge build se incrementó a `world-bridge-20260914-18`.
- La telemetría usa `sessionStorage` mediante `createBugObserver`, flow `world-open`, bug `BUG-0003`.
- Se registran las fases `BRIDGE_OPEN_START`, `CONTROLLER_IMPORT_WAIT`, `CONTROLLER_IMPORT_START`, `CONTROLLER_IMPORT_DONE`, `PROVISIONAL_SANITIZED`, `CONTROLLER_OPEN_START`, `SHELL_SEEN`, `SHELL_INTERACTIVE`, `CONTROLLER_OPEN_RESOLVED`, `EDITOR_READY`, cierre y `FAIL` con fase.
- Los snapshots incluyen DPR, viewport, visibility, shell/loading/interactivity, canvases, overlay, estilos Studio, cantidad de recursos `/src/studio/` y heap cuando el navegador lo expone.
- Tras `EDITOR_READY` se registran marcas diagnósticas de supervivencia a 1 s, 5 s y 10 s. Son observabilidad, no watchdogs de corrección.
- `tests/world-editor-ios-reopen.spec.js` ahora exige `CONTROLLER_OPEN_RESOLVED`, `EDITOR_READY`, supervivencia de 1 s en la primera apertura y al menos dos `EDITOR_READY` después de reproducir una sesión stale y reabrir.
- El test escribe `test-results/world-editor-black-box-first-open.json` y `test-results/world-editor-black-box-reopen.json` para conservar evidencia cuando el runner llega a ejecutar el flujo.

## Validación ejecutada

GitHub Actions `Kelo Quality Ratchet` sobre `922cf503...` confirmó:

- syntax del test modificado: PASS;
- incremental code quality ratchet: PASS;
- Foundation architecture guard: PASS.

El mismo workflow falló después en `runtime-boot-order-audit.mjs` porque el auditor exige 22 scripts/edges que el `index.html` actual ya no declara directamente después de la migración reciente a carga lazy. Ese fallo no apunta a los dos archivos cambiados en esta ronda y debe tratarse como una deuda/gate separado, no como evidencia de fallo de la caja negra.

`Kelo UI Quality` detectó que esta ronda no requiere el job de interface-quality y su detector pasó.

La ejecución de GitHub Pages correspondiente a `922cf503...` fue cancelada por la cola/concurrencia de despliegues; por tanto, esta ronda todavía no constituye evidencia LIVE.

## Bloqueador de aceptación

`BUG-0001` sigue bloqueado externamente: BrowserStack llega a `browserType.connect` pero devuelve `Automate testing time expired`. No existe todavía una ejecución legítima del gate real iPhone para `world-bridge-20260914-18`.

## Cómo usar la caja negra

Si Safari/WebContent muere o la página se recarga, inspeccionar `sessionStorage['kelo:bug-observability:v1']` y filtrar eventos con `flow === 'world-open'` y `bugId === 'BUG-0003'`.

El último milestone completado reduce el espacio de búsqueda:

- último = `CONTROLLER_IMPORT_START`: problema durante import/evaluación del controller;
- último = `CONTROLLER_OPEN_START`: fallo dentro del hydrate/runtime del controller;
- último = `SHELL_SEEN` sin `SHELL_INTERACTIVE`: shell provisional montó pero no terminó hydrate;
- `EDITOR_READY` sin `SURVIVED_1000MS`: muerte inmediatamente post-ready;
- sobrevive 1 s pero no 5 s: investigar trabajo diferido/loops/extras posteriores;
- sobrevive 10 s y falla al reabrir: investigar cleanup/session lifecycle.

## Siguiente acción de mayor valor

No añadir otro parche de comportamiento hasta obtener un trace discriminante de esta instrumentación o un real-iPhone PASS/FAIL. La siguiente modificación debe atacar la fase concreta que deje de completar, preservando el bridge y el Studio existentes.
