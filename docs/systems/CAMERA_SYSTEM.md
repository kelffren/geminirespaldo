# KeloCamera — Camera / Viewport Foundation

> **Estado:** Foundation V3 · OWNER LIVE transicional.  
> **Owner:** `window.KeloCamera`.  
> **Fuente principal:** `src/core/camera-system.js`.  
> **Core legacy consumido:** `camera`, `CONFIG`, `canvas`, `ctx`, `screenW/screenH`, `updateCamera()` de `engine-a.js`.

## Propósito

`KeloCamera` existe para que Kelo World tenga **una sola puerta de entrada para todo lo que controla lo que el jugador ve**.

Antes de Foundation V3 varias capas podían modificar la misma responsabilidad:

- `engine-a.js` poseía el seguimiento, viewport básico y `updateCamera()`;
- `engine-h.js` reemplazaba `resize`, cambiaba DPR y escribía zoom;
- `mobile-orientation.js` volvía a escribir zoom según orientación y reemplazaba `cycleZoom`;
- gameplay legacy escribía `camera.targetX/Y` directamente;
- distintas funciones calculaban screen → world de forma independiente.

Eso era funcional para un prototipo, pero no escala a cinemáticas, bosses, vehículos, interiores, camera shake, spectator mode o cientos de habilidades.

Foundation V3 NO reescribe el feel actual. Conserva la matemática de follow/dead-zone de `engine-a` y coloca un owner estable alrededor de ella.

---

## Qué posee KeloCamera

KeloCamera posee:

- comandos externos de target/focus;
- base zoom y zoom efectivo;
- adaptación de zoom portrait/landscape;
- política de DPR;
- tamaño físico del Canvas;
- viewport CSS;
- conversión `screen → world`;
- conversión `world → screen`;
- AABB read-only del viewport visible en coordenadas world mediante `worldView()`;
- parámetros de seguimiento de cámara;
- entrypoint público de `updateCamera`;
- lifecycle de resize/visualViewport;
- eventos de viewport, zoom y target.

## Qué NO posee

KeloCamera NO posee:

- posición física del jugador;
- movimiento del jugador;
- colisiones;
- reglas de PvP;
- UI de fullscreen/orientación;
- lógica de una habilidad;
- world rendering;
- server authority.

`KELO_ORIENTATION` continúa siendo owner de la UX de orientación/fullscreen. Consume KeloCamera para framing y viewport.

`engine-h` continúa aportando la política HD/pixel-perfect, pero la configura mediante KeloCamera; ya no reemplaza camera APIs.

---

# Flujo del sistema

## Arranque

```text
engine-a
  ↓
crea camera + CONFIG + canvas + updateCamera legacy
  ↓
engine-b
  ↓
arranca gameLoop legacy
  ↓
engine-c
  ↓
define zoom/render legacy
  ↓
KeloCamera
  ↓
captura updateCamera + target/zoom/tuning legacy
  ↓
engine-h
  ↓
configura DPR/pixel-perfect mediante KeloCamera
  ↓
mobile-orientation
  ↓
consume KeloCamera para viewport/framing
```

Aunque `gameLoop()` fue definido antes, resuelve `updateCamera()` en cada frame. KeloCamera reemplaza ese entrypoint antes del siguiente frame útil y conserva como implementación interna la función legacy original.

---

# API pública

## `KeloCamera.setTarget(x, y, options?)`

Solicita un nuevo objetivo de cámara.

```js
KeloCamera.setTarget(1400, 1600, { source: 'quick-travel' });
```

Opciones:

- `source`: etiqueta de observabilidad;
- `snap: true`: coloca también la cámara inmediatamente en el objetivo y limpia look-ahead.

Por defecto NO hace snap para conservar el damping existente.

## `KeloCamera.focus(pointOrActor, options?)`

Atajo sobre `setTarget()`.

```js
KeloCamera.focus(boss, { source: 'boss-intro' });
```

El objeto necesita `x` e `y`.

## `KeloCamera.setBaseZoom(value, source?)`

Modifica el zoom de referencia portrait.

KeloCamera calcula el zoom efectivo de landscape para mantener el span vertical equivalente.

## `KeloCamera.cycleZoom(source?)`

Recorre los presets Foundation actuales:

```text
0.70 → 0.82 → 1.00 → 0.70
```

El resultado sigue pasando por la adaptación de orientación.

## `KeloCamera.getBaseZoom()`

Devuelve el zoom portrait de referencia.

## `KeloCamera.getEffectiveZoom()`

Devuelve el zoom realmente usado por el renderer en este momento.

## `KeloCamera.configureViewport(options)`

Configura política de rendering sin crear otro owner.

Campos actuales:

- `dprCap`;
- `pixelPerfect`;
- `roundPixels`;
- `smoothing`;
- `imageRendering`.

`engine-h` utiliza esta API.

## `KeloCamera.syncViewport(source?)`

Sincroniza:

1. `screenW/screenH`;
2. backing resolution de Canvas;
3. tamaño CSS;
4. DPR;
5. transform del context;
6. smoothing;
7. CSS viewport variables;
8. zoom efectivo;
9. telemetría/eventos.

No debe existir otra feature que replique este proceso.

## `KeloCamera.scheduleViewportSync(source?)`

Coalescing con `requestAnimationFrame()` para resize frecuentes.

## `KeloCamera.screenToWorld(x, y)`

Convierte un punto de pantalla a coordenadas de mundo usando:

- centro real de cámara;
- viewport;
- zoom efectivo.

## `KeloCamera.worldToScreen(x, y)`

Operación inversa.

## `KeloCamera.worldView()`

Devuelve un snapshot **read-only** del rectángulo world-space visible por la cámara actual.

Campos:

- `x`, `y`, `w`, `h`;
- `left`, `top`, `right`, `bottom`;
- `centerX`, `centerY`;
- `zoom`;
- `screenW`, `screenH`.

La geometría usa exactamente el mismo `effectiveZoom`, centro y viewport que `screenToWorld()` / `worldToScreen()`.

Ejemplo para culling simple:

```js
const view = KeloCamera.worldView();
const visible = object.x < view.right &&
  object.x + object.w > view.left &&
  object.y < view.bottom &&
  object.y + object.h > view.top;
```

Los consumidores pueden añadir su propio margen de seguridad, pero **no deben volver a calcular** `screenW / zoom`, `screenH / zoom` o el centro de cámara.

`world-map.js` es el primer consumidor migrado: conserva su margen histórico de chunks y solo sustituye la matemática duplicada del viewport por esta primitive.

## `KeloCamera.setFollowTuning(values)`

Parámetros soportados:

- `dampX`;
- `dampY`;
- `deadXRatio`;
- `deadYRatio`;
- `lookAheadDist`;
- `lookAheadDecay`.

Esto permite que un preset reutilice el mismo owner sin escribir CONFIG desde sistemas nuevos.

## `KeloCamera.snapshot()`

Devuelve estado observable de cámara/viewport sin entregar internals mutables.

---

# Adaptadores legacy

Foundation V3 necesita migración incremental y por eso mantiene adapters controlados.

## `camera.targetX / camera.targetY`

Se convierten en propiedades administradas por KeloCamera. Código legacy que todavía escriba esos campos termina modificando el estado poseído por el owner.

**Esto NO convierte la escritura directa en patrón permitido.** Código nuevo usa `setTarget()` o `focus()`.

## `CONFIG.zoom`

Queda administrado por KeloCamera para que una escritura histórica no cree un segundo storage de zoom.

Código nuevo usa `setBaseZoom()`.

## Follow tuning en `CONFIG`

Las claves de damping/dead-zone/look-ahead permanecen visibles para `engine-a`, pero su storage queda encapsulado por KeloCamera.

Código nuevo usa `setFollowTuning()`.

## `window.updateCamera`

KeloCamera es el entrypoint. Internamente llama el `updateCamera()` original de engine-a.

Esto preserva exactamente la matemática actual mientras permite una futura extracción sin cambiar consumidores.

## `window.resize`

Apunta a `KeloCamera.syncViewport()` para llamadas históricas. El listener original de engine-a todavía existe y puede escribir primero el tamaño CSS-pixel durante un evento; el listener de KeloCamera vuelve a establecer el viewport autoritativo en el mismo ciclo de resize. Retirar el listener legacy requerirá extraer esa sección de `engine-a`, no un hotfix.

---

# Orientación y FOV

La regla vigente de Kelo World conserva aproximadamente el mismo span vertical al rotar.

Portrait:

```text
effectiveZoom = baseZoom
```

Landscape:

```text
effectiveZoom = baseZoom × viewportHeight / viewportWidth
```

Por eso rotar el teléfono no debe acercar brutalmente la cámara ni cambiar la referencia de zoom elegida por el jugador.

`KELO_ORIENTATION` solo detecta/orquesta UX y pide a KeloCamera que sincronice.

---

# HiDPI / Pixel Perfect

`engine-h` ya NO es un camera owner.

Ahora hace:

```text
MobilePerformanceContract
  ↓
dprCap
  ↓
KeloCamera.configureViewport(...)
  ↓
KeloCamera.syncViewport()
```

Esto elimina el antiguo problema donde `engine-a.resize` y `engine-h.resize` podían competir por `canvas.width/height`.

---

# Eventos

## `kelo:camerazoomchange`

Se emite cuando cambia realmente el zoom efectivo.

Incluye:

- `source`;
- `orientation`;
- `baseZoom`;
- `effectiveZoom`;
- `verticalWorldSpan`;
- `portraitReferenceWorldSpan`.

## `kelo:viewportchange`

Se emite cuando cambia la firma efectiva del viewport.

Incluye:

- width/height;
- DPR;
- orientación;
- zoom.

## `kelo:cameratargetchange`

Se emite para comandos explícitos de target/focus.

---

# Reutilización futura

## Boss intro

```js
KeloCamera.focus(boss, { source: 'boss-intro' });
```

## Teleport

```js
player.x = destination.x;
player.y = destination.y;
KeloCamera.setTarget(destination.x, destination.y, { source: 'teleport' });
```

## Culling / render de mundo

Consumir `KeloCamera.worldView()` y aplicar AABB/margen propio del sistema. No crear `ViewportManager`, `CullingManager` ni volver a derivar el viewport desde globals.

## Zoom temporal

No crear un sistema paralelo.

Primero extender KeloCamera con un primitive reutilizable de zoom claim/tween y después usarlo desde abilities/cinematics.

## Camera shake

Todavía NO está implementado.

Cuando se necesite:

1. demostrar que no existe primitive equivalente;
2. añadirlo dentro de KeloCamera;
3. mantener el centro lógico separado del offset visual;
4. documentarlo;
5. añadir tests;
6. permitir que múltiples abilities/bosses lo reutilicen.

---

# Antipatrones prohibidos

Código nuevo NO debe hacer:

```js
camera.targetX = x;
camera.targetY = y;
CONFIG.zoom = 0.8;
canvas.width = window.innerWidth * devicePixelRatio;
window.resize = myResize;
window.cycleZoom = myZoom;
```

Para geometría visible tampoco debe hacer:

```js
const visibleWorldWidth = screenW / CONFIG.zoom;
const visibleWorldHeight = screenH / CONFIG.zoom;
```

Usa `KeloCamera.worldView()`.

Tampoco debe crear:

- `BossCameraManager`;
- `PvPCameraManager`;
- `VehicleCameraManager`;
- `ViewportManager`;
- `CullingManager`;
- otro resize owner;
- otro zoom bridge.

Todos deben consumir o extender KeloCamera.

---

# Online-first

La cámara es presentación local y no necesita autoridad de servidor para decidir framing.

El servidor sí puede ser authority de los hechos que provocan una cámara:

```text
server confirma teleport
  ↓
cliente actualiza actor
  ↓
cliente solicita KeloCamera.focus(...)
```

Nunca convertir información de cámara en prueba de posición autoritativa del jugador.

---

# Persistencia

Foundation V3 NO persiste camera target ni posición de cámara.

El zoom elegido tampoco se migra todavía a un preference owner. Si se decide persistirlo, debe entrar por el futuro sistema de preferencias/persistencia, no llamar `localStorage` desde KeloCamera.

---

# Observabilidad

Disponibles:

- `KeloCamera.snapshot()`;
- `KeloCamera.worldView()`;
- `KELO_CAMERA_AUDIT.worldViewOwner`;
- `KELO_WORLD_AUDIT.viewportOwner/viewportMode` para el renderer de chunks;
- `KELO_CAMERA_AUDIT`;
- eventos `kelo:camera*` / `kelo:viewportchange`;
- `KELO_HD_RENDER` documenta que su camera owner es `KeloCamera`;
- `KELO_ORIENTATION_AUDIT` documenta `viewportOwner/zoomOwner: KeloCamera`.

---

# Invariantes

1. Existe un solo owner de zoom.
2. Existe un solo owner final de Canvas viewport/DPR.
3. Las features no reemplazan `resize`, `cycleZoom` ni `updateCamera`.
4. El renderer consume zoom/camera; no decide su ownership.
5. Rotar preserva el base zoom.
6. Portrait y landscape mantienen el contrato de span vertical equivalente.
7. Conversiones screen/world y `worldView()` usan el mismo zoom que el renderer.
8. Consumidores de culling no duplican matemática de viewport; consultan `worldView()`.
9. El follow legacy conserva su comportamiento durante la migración.

---

# CI / pruebas

Foundation V3 añade `scripts/camera-system-contract-audit.js` y el Camera workflow/browser audit.

Debe verificar como mínimo:

- carga de KeloCamera después de `engine-c`;
- APIs públicas;
- `worldView()` read-only y geométricamente equivalente en portrait/landscape;
- `world-map.js` consumiendo `worldView()` sin duplicar `screenW/zoom`;
- `engine-h` sin reemplazos directos de resize/zoom;
- `mobile-orientation` sin escrituras directas de zoom/Canvas;
- screen↔world reversible;
- target API;
- base/effective zoom portrait/landscape;
- resize DPR coherente;
- ausencia de page errors.

---

# Deuda conocida

- `engine-a` todavía contiene la implementación matemática de follow y el listener resize inicial.
- varios callers legacy todavía escriben propiedades capturadas por adapters; deben migrarse cuando sus archivos se limpien por dominio.
- camera bounds legacy todavía usan la matemática histórica; Foundation V3 no cambia edge behavior para evitar alterar gameplay.
- consumidores de viewport distintos de `world-map.js` deben migrarse gradualmente cuando sean tocados; no hacer una reescritura masiva.
- camera shake/tween/cinematic claims aún no existen.

Esta deuda es explícita. No justifica crear otro camera system.

---

# Checklist para añadir una capacidad de cámara

Antes de implementar:

- [ ] ¿KeloCamera ya puede expresarlo?
- [ ] ¿Es contenido/configuración o una capacidad realmente nueva?
- [ ] ¿Se puede construir sobre `setTarget`, zoom, `worldView()` o viewport actual?
- [ ] ¿Mantiene un solo owner?
- [ ] ¿Evita escribir globals directamente?
- [ ] ¿Necesita evento/telemetría?
- [ ] ¿Tiene comportamiento móvil definido?
- [ ] ¿Actualiza este documento?
- [ ] ¿Actualiza la guía pública si el jugador lo percibe?
- [ ] ¿Tiene contrato CI?

La regla sigue siendo:

> **No crear una cámara para la feature. Extender la cámara de Kelo World.**
