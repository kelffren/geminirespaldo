# KELO WORLD — App Update System Turbo V3

## Objetivo

`KeloUpdater` es el único owner del ciclo de actualización. Turbo V3 cambia el modelo desde “precargar otra build completa” a **transferir únicamente el contenido que cambió**.

Los KPI principales son **Update Delta Bytes** y **Time To Update Ready**. La meta operacional es: build idéntica = **0 bytes de assets**; un archivo cambiado = únicamente ese archivo en el delta.

## Detección casi inmediata

`version.json` sigue siendo la autoridad de qué SHA está realmente desplegado en Pages mediante `site.github.build_revision`. `update-watch.js` lo comprueba cada **15 segundos** cuando la app está visible y no existe PVP/gameplay crítico. Usa `setTimeout` recursivo; nunca `setInterval`.

## Git tree como manifest de transición

Mientras GitHub Pages siga siendo el LIVE, Turbo V3 usa una sola consulta al **Git tree** del SHA desplegado para obtener `path -> Git blob SHA + bytes` antes de descargar assets. El tree se conserva en `kelo-update-meta-v3`, por lo que se pide una sola vez por build.

Esto permite saber si un recurso cambió sin volver a bajar sus bytes. El futuro `update-manifest.json` del pipeline CDN puede sustituir el transporte del manifest sin cambiar la arquitectura.

## Caché global content-addressed

Los objetos reutilizables viven en `kelo-assets-v3` bajo una key sintética `__kelo_asset_v3__/<git-blob-sha>`. El staging `kelo-update-stage-v3-<sha>` solo conserva index/metadata/fallback del target.

Ejemplo: Build 100 usa core=A, world=B, pvp=C. Build 101 usa core=A, world=B, pvp=D. A y B cuestan **0 bytes de red**; solo D se descarga.

Cada asset nuevo se verifica reconstruyendo el Git blob hash `SHA1("blob " + byteLength + "\0" + bytes)` antes de aceptarlo.

## Critical vs deferred

Scripts/CSS/preload/iconos/manifest declarados por el nuevo `index.html` forman el **critical shell**. Solo ese conjunto bloquea `Nueva versión lista`. Recursos de sesión no críticos se descargan después mediante `requestIdleCallback` cuando sea posible. Los creator systems que ya cargan dinámicamente —World Editor, Studio creators y Map Forge— no deben bloquear una actualización normal.

## Paralelismo adaptativo

Política inicial: PVP/combate=0; 151–200 ms=1; 101–150 ms=2; red good=4; <70 ms + >=10 Mbps=6; `ACTUALIZAR` explícito=hasta 6. Al entrar gameplay crítico, las descargas background en vuelo se abortan y se reanudan luego.

Background usa `fetch(...,{priority:'low'})`; actualización explícita usa `priority:'high'`.

## iPhone storage

En boot se intenta `navigator.storage.persisted()`, `navigator.storage.persist()` y `navigator.storage.estimate()`. WebKit decide si concede persistencia; nunca se asume garantizada.

## Métricas

`KeloUpdater.getState().stage` expone `deltaBytes`, `reusedBytes`, `deltaFiles`, `reusedFiles`, `downloadedBytes`, `timeToReadyMs`, `concurrency` y `manifestSource`.

## Service Worker

Durante `?kelo_update=<sha>`, `sw.js` resuelve `request URL -> target build manifest -> blob SHA -> kelo-assets-v3`. Una vez confirmada la nueva build recibe `KELO_SET_ACTIVE_BUILD`. Fuera de la ventana de update solo sirve contenido local si esa URL está declarada en el manifest estático de la build activa.

Nunca cachea respuestas API, Supabase, tokens, WebSocket, inventario, economía, posición, HP ni estado de combate. Los JS estáticos de `src/auth/` sí pueden formar parte del boot shell porque son código, no sesión.

## Red

0–100 ms descarga; 101–150 reduce concurrencia; 151–200 usa una descarga; >200, offline, Save Data, 2g/slow-2g, app oculta o gameplay crítico pausan el background. Gameplay siempre gana.

## QA

`npm run audit:updater` valida el contrato. `node tests/updater-delta.test.cjs` prueba que una build idéntica produce `deltaBytes===0` y que un solo blob cambiado produce exactamente un asset de delta. Workflow: `.github/workflows/app-updater-ci.yml`.

## Próxima capa

El paso posterior es `source -> Vite/esbuild -> chunks content-hashed -> update-manifest.json -> CDN`. En un hosting con control de headers, chunks hashados usarán `Cache-Control: public,max-age=31536000,immutable`; HTML/version/manifest revalidarán. Cloudflare puede aportar Brotli/Gzip, HTTP/2/3 y Early Hints sin cambiar el owner.

## Invariantes

Un commit no desplegado jamás se ofrece. Assets idénticos se reutilizan por contenido. Solo critical shell bloquea ACTUALIZAR. PVP gana frente al staging. No hay `setInterval`, segundo updater ni segundo Service Worker. No se guarda estado API/gameplay. El scope continúa siendo `/gemini/`.
