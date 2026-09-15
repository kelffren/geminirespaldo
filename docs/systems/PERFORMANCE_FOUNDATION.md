# Kelo Performance Foundation

## Propósito

Kelo World debe poder crecer en contenido sin convertir todo el contenido disponible en trabajo permanente del cliente. La regla de diseño es:

```text
coste_runtime ≈ visible + activo + cercano + recursos_residentes_necesarios
```

No debe aproximarse a `todo_lo_que_existe_en_el_juego`.

Este documento no crea un nuevo engine. Define cómo los OWNERS existentes cooperan para reducir coste de arranque, CPU, GPU/memoria y red.

## Owners reutilizados

- `KeloRuntimeBootstrap`: único loader de foundations Combat/Effects/Status/Melee. Su script ligero está en core, pero sus módulos no cargan hasta `ensure()`.
- `KeloSimulation`: scheduler oficial de extensiones de simulación. Sus hooks pueden quedar `enabled=false` sin desregistrarse.
- `KeloRender`: scheduler oficial de extensiones de frame. Sus hooks pueden quedar `enabled=false` sin crear otro loop.
- `KeloAbilities`: conserva la arquitectura PvP Bible basada en `KeloEffectEngine`/`KeloStatusEffects`; no hace polling de boot y duerme sus hooks fuera de PvP cuando no queda trabajo real.
- `KeloVisualSystem`: presentación modular; su fast-path evita updates costosos cuando no hay animaciones/FX/secuencias activas.
- `KeloPvPWorld`: conserva ownership de entrada/salida/orquestación PvP; su bridge solo solicita `KeloRuntimeBootstrap.ensure()` en first-use y luego delega al owner real.
- `KELO_PERF` / `KELO_PERFORMANCE_GOVERNOR`: calidad, telemetría, LOD espacial y lifecycle de visibilidad.
- `KELO_ATLAS_CONTRACT`: adquisición, refcount, warm residency y eviction de imágenes/atlases.
- `KELO_WORLD_RENDERER`: chunks visibles, cache LRU y assets de distrito.
- `KeloNetAuthority`: transporte cliente, predicción/reconciliación PvP y pose social; no autoridad gameplay.
- Kelo plaza room server + `server/pvp-authority.js`: autoridad de red/PvP y relevancia AOI.
- Cada feature conserva su owner. Performance no puede convertirse en un manager paralelo que posea gameplay ajeno.

## Estados de lifecycle

```text
UNLOADED -> LOADED -> ACTIVE -> SLEEPING -> ACTIVE
                         |          |
                         |          +-> recursos externos pueden liberarse
                         +-> presentación/recursos solo mientras se necesiten
```

El código JS ya cargado normalmente queda cacheado en el realm. Por eso después del primer uso el ahorro principal viene de dormir CPU, liberar listeners/observers/timers/DOM/atlases y reducir red; no de fingir que se puede descargar arbitrariamente el módulo JS.

## Contratos

### Startup y first-use

Features opcionales no pertenecen al critical path. Character Customizer y Studio cargan su código pesado solo bajo acción explícita. Profile no puede arrancar Combat/Effects/Status/Melee como efecto lateral.

`src/core/kelo-runtime-bootstrap.js` sí está presente en `index.html`, pero es un **bootstrap ligero**: al evaluarse no carga su lista `MODULES`. Solo `KeloRuntimeBootstrap.ensure()` activa en orden la cadena PvP Bible actual: schema/hit/damage, effects/status, combat, melee y presentation bridge. La llamada es idempotente y comparte una sola Promise.

El primer `enterPvPWorld()` pasa por `pvp-combat-runtime-loader.js`, que deduplica intentos simultáneos, llama al owner `KeloRuntimeBootstrap`, espera también a `KeloAbilities` y luego delega al `enter()` original de `KeloPvPWorld`. El bridge no inyecta scripts ni implementa otro loader.

`KeloAbilities` se registra de forma ligera al boot social, pero no hace el antiguo retry de 60 ms mientras faltan foundations. `KeloAbilitiesLoader.ensure()` reutiliza `KeloRuntimeBootstrap.ensure()`. Abrir Piedras, entrar en PvP o montar una montura puede calentar este runtime bajo demanda. De esta forma las tres puertas de uso comparten el mismo loader/owner y el juego no sacrifica monturas ni UI de piedras por hacer Combat lazy.

### CPU

Un feature sin trabajo no debe ejecutar lógica significativa cada frame. `KeloSimulation.setEnabled()` y `KeloRender.setEnabled()` son los puntos oficiales para sleep/wake. No se crean `requestAnimationFrame`, watchdogs o `setInterval` paralelos para scheduling.

`KeloAbilities` mantiene la semántica nueva de Effect/Status/Combat y sus deliveries swept/predictivos. Una vez cargado, permanece awake durante `entering/pvp/leaving` para no interferir con reconciliación, cooldowns o recursos autoritativos. Fuera de PvP duerme cuando no quedan cooldowns, mana pendiente, dash/shield ni projectile/area/wall/trap. Un cast, cambio de loadout o apertura de panel despierta el hook. El render legacy duerme si no hay FX propios.

La hotbar usa una fingerprint visual por slot para evitar reescrituras DOM cuando no cambió el contenido ni la décima visible de cooldown. El panel de Piedras filtra de forma segura entradas no-stone de inventarios mixtos.

### GPU y memoria

`KELO_ATLAS_CONTRACT` es la frontera de lifecycle de atlases gestionados. `core` permanece retenido; `district` y `optional` pueden quedar warm un intervalo corto y evictarse después si su refcount continúa en cero.

### Mundo

`KELO_WORLD_RENDERER` construye/dibuja únicamente chunks dentro del viewport de `KeloCamera` más margen. La cache es LRU y limitada por `KELO_MOBILE_PERFORMANCE_CONTRACT`. Recursos district como Gardens se adquieren solo cuando el viewport expandido los necesita.

### Actores remotos

El cliente reutiliza `KELO_PERF.shouldUpdate()` y `KELO_PERF.shouldRenderActor()` para reducir interpolación y draw de peers lejanos. Es una optimización de presentación; nunca decide autoridad gameplay.

### Red y PvP autoritativo

La optimización no reemplaza el PvP Bible actual. `KeloNetAuthority` conserva inputs secuenciados, prediction/reconciliation e interpolación. Fuera de PvP, la pose social se envía solo cuando cambia y mantiene heartbeat idle. Los peers reutilizan el LOD espacial ya existente.

El servidor conserva `server/pvp-authority.js` y el fixed step de 60 Hz. Sobre ese authority se aplica AOI por viewer: zone + spatial cells + radio + hysteresis. Los snapshots PvP filtran players/projectiles/events por relevancia, pero un actor que sale del AOI de un cliente sigue existiendo en el estado autoritativo del servidor.

### Página oculta

`KELO_PERFORMANCE_GOVERNOR` emite lifecycle semántico con `CLIENT_HIDDEN` / `CLIENT_VISIBLE`. Presentación no esencial puede dormir al ocultarse. La corrección gameplay/authority no depende de que el navegador continúe ejecutando RAF en background.

## Invariantes CI

El audit de Performance Foundation falla si reaparece una de estas regresiones:

- RuntimeBootstrap vuelve a auto-cargar sus módulos al evaluarse.
- Combat/Effects/Status/Melee pesados vuelven a aparecer como `<script>` directos en `index.html`.
- Character Customizer vuelve a cargarse eager desde Profile.
- Profile vuelve a arrancar Combat como side effect.
- PvP vuelve a implementar su propio script loader o deja de esperar KeloAbilities.
- KeloAbilities vuelve a hacer polling de boot, pierde el lifecycle PvP-safe o deja de filtrar inventario mixto.
- KeloSimulation/KeloRender pierden `setEnabled`.
- Visual System pierde su fast-path de trabajo vacío.
- Gardens vuelve a adquirirse incondicionalmente al boot.
- La cache de chunks deja de ser LRU limitada.
- Engine Net pierde prediction/reconciliation, el LOD espacial o vuelve a enviar poses sociales idénticas continuamente.
- El servidor vuelve a emitir state/snapshots/eventos globales sin zone/AOI.

## Métricas

Se registran cuando el entorno lo permite:

- requests/bytes antes de PLAYER READY;
- tiempo hasta PLAYER READY;
- `KELO_RUNTIME_BOOTSTRAP_AUDIT.requestedAt -> readyAt`;
- `KELO_PVP_COMBAT_LOADER_AUDIT`;
- frame p50/p95/p99 y long frames;
- hooks activos/dormidos de KeloSimulation/KeloRender;
- `KeloAbilities.performanceSnapshot()`;
- decoded/resident texture budget;
- cache de chunks, hits y evictions;
- peers actualizados/dibujados vs culled;
- poses enviadas vs omitidas por no cambiar;
- snapshots/eventos relevantes por cliente.

## Regla de extensión

Antes de crear cualquier `PerformanceManager`, scheduler, asset loader, network culler o feature loader nuevo, se localiza el OWNER existente. Si la capacidad cabe allí, se extiende allí.

`pvp-combat-runtime-loader.js` no posee carga de scripts ni gameplay: es únicamente una fachada first-use de `KeloPvPWorld`. La carga real vive en `KeloRuntimeBootstrap`. `KeloAbilitiesLoader` es la frontera ligera del propio owner Ability y también delega en ese mismo bootstrap.

## Estado

**FOUNDATION ACTIVE — PERFORMANCE CONTRACT V1.1 / PVP-BIBLE SAFE**
