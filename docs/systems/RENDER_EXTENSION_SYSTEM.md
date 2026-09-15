# KeloRender — extensiones del frame

## Propósito

`KeloRender` es el OWNER único de las extensiones que necesitan ejecutar lógica antes o después del frame orquestado actualmente por `engine-c.js`.

Durante la transición Foundation, `engine-c` sigue dibujando el mundo, actores, capas visuales y joystick. `KeloRender` no reemplaza esa responsabilidad: crea un solo bridge estable para que features históricas dejen de envolver `render` una encima de otra.

```text
render legacy de engine-c
        │
        ▼
    KeloRender
    ├─ beforeFrame hooks activos
    ├─ render base exacto
    └─ afterFrame hooks activos
```

## Owner

**Owner:** `window.KeloRender`  
**Fuente:** `src/core/render-extension-system.js`

## API pública

### `KeloRender.beforeFrame(owner, fn, priority)`

Registra preparación previa al frame. Ejemplos válidos: configurar contexto, actualizar contador visual de frame o preparar compatibilidad que deba existir durante el render base.

### `KeloRender.afterFrame(owner, fn, priority)`

Registra overlays o presentación posterior al frame: minimapa, indicadores, UI Canvas, actores remotos legacy durante la migración, etc.

### `KeloRender.setEnabled(id, enabled)`

Activa o duerme un hook ya registrado. `false` lo saca del hot path sin perder su identidad, prioridad ni función; `true` lo devuelve al orden determinista original. Es la API oficial para features que necesitan sleep/wake de presentación.

No se debe reemplazar por un RAF propio, un wrapper adicional ni unregister/register continuo.

### `KeloRender.unregister(id)`

Retira definitivamente un hook registrado.

### `KeloRender.snapshot()`

Expone owners, prioridades, estado `enabled` y conteos activos/dormidos para auditoría/debug.

## Invariantes

- Solo `src/core/render-extension-system.js` puede envolver directamente el `render` final de `engine-c` durante esta fase.
- Un hook de Render no decide gameplay, HP, economía ni autoridad online.
- Features nuevas no deben hacer `const old=render; render=function(){...}`.
- Orden por prioridad es determinista; menor prioridad se ejecuta primero dentro de cada fase.
- El `render` capturado se ejecuta exactamente una vez por llamada.
- Un hook dormido no se ejecuta y no debe obligar al sistema a crear otro scheduler.
- Cambiar `enabled` reconstruye la lista activa solo cuando cambia lifecycle; no se filtra la lista completa cada frame.

## Migración legacy

Los wrappers históricos se retiran uno por uno:

`IDENTIFICAR → mover lógica a beforeFrame/afterFrame → contrato → smoke/LIVE → retirar wrapper`.

No se reescribe el renderer completo.

## Online-first

Render es presentación cliente. Eventos o snapshots autoritativos pueden alimentar contenido visual, pero `KeloRender` jamás convierte el cliente en autoridad de estado compartido.

## Performance Foundation

Para el contrato conjunto de startup, CPU, memoria, mundo y red, ver `docs/systems/PERFORMANCE_FOUNDATION.md`.

## Estado

**FOUNDATION ACTIVE / TRANSITIONAL CORE BRIDGE — SLEEP/WAKE ENABLED**