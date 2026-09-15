# KeloSimulation — extensiones de simulación

## Propósito

`KeloSimulation` es el OWNER único de extensiones que necesitan ejecutar lógica antes o después de la simulación legacy consolidada por `engine-c.js`.

No crea un segundo game loop y no reemplaza la física base. Su función es retirar la cadena histórica de wrappers de `updateSimulation` y convertirla en hooks observables, ordenados y capaces de dormir cuando su owner no tiene trabajo.

```text
updateSimulation legacy post-engine-c
            │
            ▼
      KeloSimulation
      ├─ before hooks activos
      ├─ simulación base exacta
      └─ after hooks activos
```

## Owner

**Owner:** `window.KeloSimulation`  
**Fuente:** `src/core/simulation-extension-system.js`

## API pública

### `KeloSimulation.before(owner, fn, priority)`

Registra preparación previa a la simulación base.

### `KeloSimulation.after(owner, fn, priority)`

Registra updates posteriores: timers gameplay ya existentes, interpolación, actualizaciones de entidades auxiliares o compatibilidad en migración.

### `KeloSimulation.setEnabled(id, enabled)`

Activa o duerme un hook ya registrado. `false` lo saca del hot path sin perder identidad, prioridad ni función; `true` lo devuelve al orden determinista original. Es la API Foundation para sleep/wake de simulación auxiliar.

No sustituye autoridad de gameplay ni permite congelar un sistema si sus timers/recursos siguen necesitando avanzar. El owner de la feature decide si realmente está idle.

### `KeloSimulation.unregister(id)`

Retira definitivamente un hook.

### `KeloSimulation.snapshot()`

Devuelve owners, prioridades, estado `enabled` y conteos activos/dormidos para observabilidad.

## Invariantes

- Solo `src/core/simulation-extension-system.js` puede envolver directamente el `updateSimulation` post-`engine-c` durante esta fase.
- El update capturado se ejecuta exactamente una vez.
- Los hooks no renderizan.
- Los hooks no crean otro `requestAnimationFrame` ni otro game loop.
- Features nuevas no deben envolver `updateSimulation` directamente.
- Menor prioridad se ejecuta primero dentro de cada fase.
- Un hook dormido no se ejecuta.
- Cambiar `enabled` reconstruye la lista activa solo al cambiar lifecycle; no se hace un filtro completo de hooks en cada frame.

## Migración legacy

Cada wrapper se migra de forma incremental y conserva su orden histórico mediante prioridad explícita. No se mezcla esta migración con cambios de gameplay.

## Online-first

La simulación local puede contener predicción/presentación. Estado autoritativo online debe permanecer en los owners/server correspondientes; `KeloSimulation` es infraestructura de extensión cliente, no authority.

## Performance Foundation

Para el contrato conjunto de startup, CPU, memoria, mundo y red, ver `docs/systems/PERFORMANCE_FOUNDATION.md`.

## Estado

**FOUNDATION ACTIVE / TRANSITIONAL CORE BRIDGE — SLEEP/WAKE ENABLED**