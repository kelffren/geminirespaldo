# Investigación — World freeze en iPhone / Safari

BUG: `BUG-0003`
FECHA: `2026-09-13`
VERSION / BUILD: `world-light-20260914-1` / página `Kelo World V6.54`
COMMIT BASE: `d6ff09277a6eecd244d89710f1043278edde1076` como candidato world-light registrado en BUG-0003; revisar HEAD actual antes de modificar código
ENTORNO: `LIVE · iPhone · iOS 26.x · Safari · Create -> World -> Kelo Studio`
ESTADO: `vigente`
INVESTIGADOR: `ChatGPT + fuentes WebKit/MDN + inspección de main`

## 1. Pregunta de investigación

¿Por qué World puede quedarse en `Abriendo World Editor…` o terminar en una pestaña Safari negra/spinner después de que la shell de Kelo Studio ya llegó a pintar?

Objetivo: encontrar explicaciones externas compatibles con el patrón real de BUG-0003 y convertirlas en experimentos pequeños que ayuden al agente sin repetir fixes anteriores.

## 2. Contexto del bug

BUG-0003 ya demostró dos modos de fallo relevantes:

- un candidato mantuvo Hub/curtain mientras cargaba Studio; se observaron aproximadamente 80 requests de módulos y la interfaz interactiva no montó dentro de la ventana observada;
- otro candidato llegó a pintar `KELO STUDIO / Abriendo World Editor…` en el iPhone y posteriormente Safari quedó negro con spinner.

IndexedDB fail-open por sí solo ya fue insuficiente. Hub stacking por sí solo también fue insuficiente. Esta investigación no debe reiniciar esos caminos sin evidencia nueva.

## 3. Hechos confirmados de KELO WORLD

- `src/ui/studio-launcher.js` genera un nonce basado en tiempo/random y lo añade al specifier de `import()` de `creator-hub.mjs`; en fallos puede intentar URLs frescas adicionales antes del import canónico.
- `src/creators/workspaces/world-workspace.mjs` también puede crear un nonce nuevo para reimportar `live-studio-controller.mjs` durante recuperación.
- `src/studio/integration/live-studio-controller.mjs` importa dinámicamente `studio-entry.mjs` después de preparar autoridad/draft.
- `src/studio/studio-entry.mjs` todavía tiene un núcleo de imports estáticos y después difiere palette/productivity extras mediante imports dinámicos.
- `src/studio/render/studio-overlay-canvas.mjs` ya limita el DPR en móvil a 1.5, reduciendo el tamaño del backing canvas respecto a DPR 3.
- Los intentos anteriores muestran que pintar una shell no equivale a tener World interactivo.

## 4. Información externa encontrada

### Fuente E1 — WebKit: “Fixing Top-Level Await in Safari”

URL: https://webkit.org/blog/18227/fixing-top-level-await-in-safari/

Fecha: 2026-09-02.

Versiones: WebKit explica que Safari 27 reemplaza el loader anterior de módulos ES con una reescritura completa y standards-compliant. Documenta problemas históricos del loader anterior con orden/evaluación de módulos y top-level await, incluyendo imports dinámicos concurrentes que podían resolverse en un orden incorrecto o exponer exports antes de terminar su evaluación.

Hallazgo operativo: Safari anterior a 27 merece tratamiento conservador en grafos ESM complejos; no asumir que una cadena grande de imports dinámicos/reintentos se comportará igual que Chromium.

Clasificación respecto a BUG-0003: `POSIBLE`.

No está demostrado que BUG-0003 use top-level await en su grafo crítico ni que este bug exacto de WebKit sea la causa. Sí aumenta la prioridad de reducir complejidad/reimportación en el boot crítico y de medir el último milestone alcanzado.

### Fuente E2 — WebKit: Safari 27 beta

URL: https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/

Hallazgo operativo: WebKit confirma que Safari 27 beta contiene una reescritura completa del loader ESM y que top-level await había sido una fuente real de bugs cross-browser en Safari.

Clasificación respecto a BUG-0003: `POSIBLE`.

Experimento útil: comparar exactamente el mismo build en Safari 26.x y Safari 27 beta/Technology Preview cuando el entorno lo permita. Una diferencia consistente fortalecería la hipótesis del loader, pero no la confirmaría por sí sola.

### Fuente E3 — MDN: dynamic `import()` y cache de módulos

URL: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import

Hallazgo operativo: MDN documenta que los módulos importados con éxito se cachean durante la vida del entorno. También advierte que usar un query parameter único, por ejemplo `?t=${Date.now()}`, para forzar reevaluación puede provocar memory leaks en aplicaciones largas porque no existe una forma de limpiar manualmente la cache de module namespace objects.

Clasificación respecto a BUG-0003: `APLICA` al patrón de código, `NO DEMOSTRADO` como causa raíz.

Nuestro launcher y el retry de World usan exactamente specifiers con query params únicos/nonce. Eso significa que cada URL fresca puede convertirse en una identidad de módulo distinta y no debe usarse como retry gratuito en iPhone.

### Fuente E4 — Apple Developer Forums: WebContent/GPU process crash en iPhone iOS 26.x

URL: https://developer.apple.com/forums/thread/822200

Hallazgo operativo: existe un reporte en iPhone/iOS 26.4 donde WebKit WebContent/GPU termina durante un flujo pesado, dejando contenido vacío y requiriendo reload, mientras el mismo flujo es estable en iPad. Es un reporte de foro, no documentación normativa.

Clasificación respecto a BUG-0003: `NO DEMOSTRADO`, pero compatible con el modo “shell pinta -> pestaña negra/spinner”.

No usar esta fuente para declarar memory crash sin logs del proceso o una prueba A/B que reduzca claramente el consumo.

## 5. Aplicación al bug

### R1 — Nonces únicos en imports

Clasificación: `APLICA` al código actual.

El patrón de cache-busting aleatorio aparece en el launcher y en el fallback de World. MDN documenta un riesgo de acumulación de memoria con esta técnica. Esto debe tratarse como un riesgo real de arquitectura del boot, aunque todavía no sea la causa confirmada del freeze.

Recomendación: para una versión/build concreta usar un specifier estable. Si el módulo ya fue importado correctamente, reintentar la operación de apertura, no crear una nueva identidad de módulo por click.

### R2 — Grafo ESM grande en Safari 26

Clasificación: `POSIBLE`.

BUG-0003 observó cerca de 80 requests en una ruta fallida. WebKit reconoce problemas históricos del loader anterior a Safari 27. El siguiente paso no es “reescribir todo”; es instrumentar milestones y reducir el grafo crítico hasta que la interfaz sea interactiva.

### R3 — Presión de memoria / WebContent

Clasificación: `POSIBLE`.

El black-tab después de pintar chrome es compatible con terminación de WebContent, pero todavía falta evidencia del proceso. El overlay ya fue reducido a DPR <= 1.5, por lo que conviene hacer una prueba A/B con overlay completamente desactivado antes de invertir más tiempo ahí.

## 6. Hipótesis afectadas

- `H3` — grafo Studio grande/eager: **fortalecida** por la documentación de WebKit sobre el loader anterior y por el patrón de ~80 módulos observado en KELO WORLD.
- `H4` — presión temprana de overlay/recursos: **sigue posible**, pero no está demostrada. Requiere A/B sin overlay.
- `H5` — world-light es suficiente: **sigue sin verificar** hasta iPhone real.
- Nueva hipótesis recomendada `H6`: los imports con query/nonce únicos aumentan identidades de módulo y presión de memoria/loader durante retries, agravando la apertura de World en Safari 26.x.

`H6` debe añadirse al bug canónico solamente si el agente que trabaja el bug confirma que el patrón sigue presente en HEAD.

## 7. Recomendación para el agente

Orden recomendado:

1. Inspeccionar HEAD y confirmar si siguen existiendo los imports con nonce único en launcher/World retry.
2. Si siguen, sustituir el retry de “nuevo URL = nuevo módulo” por un specifier estable por build y reintentar la función de apertura sobre el mismo módulo.
3. Añadir milestones persistentes/visibles del boot: `WORLD_TAP`, `AUTH_READY`, `CONTROLLER_IMPORTED`, `STUDIO_ENTRY_IMPORTED`, `KERNEL_READY`, `SHELL_READY`, `OVERLAY_READY`, `EXTRAS_READY`.
4. Ejecutar el flujo en iPhone real y anotar el último milestone alcanzado.
5. Si sigue muriendo después de `SHELL_READY`, repetir una sola vez con overlay desactivado por completo.
6. Si sigue muriendo antes de `SHELL_READY`, reducir el grafo crítico / bundlear el core antes de tocar extras o IndexedDB de nuevo.

La prioridad es obtener una frontera exacta de fallo, no otro fix amplio.

## 8. No asumir / no repetir

- No afirmar que “Safari 26 module loader es la causa” sin prueba local que conecte el comportamiento de KELO WORLD con ese mecanismo.
- No volver a arreglar únicamente Hub stacking: ya falló.
- No volver a atacar únicamente IndexedDB: ya fue insuficiente.
- No añadir más retries con `Date.now()`/random como solución defensiva sin medir su impacto.
- No considerar la shell `KELO STUDIO` como éxito; el gate sigue siendo `.ks-status` + controles táctiles interactivos.
- No introducir `modulepreload` masivo de todo Studio como primer remedio; el objetivo actual es reducir trabajo crítico simultáneo.

## 9. Experimento de validación

ENTRADA:

Build derivado de `world-light-20260914-1` con specifiers ESM estables para Creator Hub / live Studio controller y milestones de boot.

PASOS:

1. Cargar KELO WORLD en Safari/iPhone desde sesión fresca.
2. Abrir Creators.
3. Tocar World una sola vez.
4. Registrar milestones alcanzados hasta editor interactivo o fallo.
5. Cerrar/reabrir World en la misma sesión.
6. Si falla después de shell, ejecutar una variante idéntica con overlay desactivado.

SEÑAL DE ÉXITO:

World llega a `.ks-status`, herramientas responden al touch y puede cerrarse/reabrirse sin black tab ni spinner.

SEÑAL DE FALLO:

Se detiene un milestone, excede el presupuesto de apertura o Safari queda negro/spinner.

QUÉ APRENDEMOS EN CADA CASO:

- estable sin nonces: fortalece `H6`;
- falla antes de `CONTROLLER_IMPORTED`/`STUDIO_ENTRY_IMPORTED`: priorizar loader/grafo/network module path;
- falla después de `SHELL_READY` pero pasa sin overlay: fortalece `H4`;
- falla igual con overlay desactivado: debilita `H4` y prioriza graph/core/import/current-world work;
- Safari 27 pasa consistentemente donde Safari 26.x falla con mismo build: fortalece una incompatibilidad/bug del loader antiguo, pero todavía debe buscarse un workaround compatible con Safari 26.x.

## 10. Resultado posterior

RESULTADO: `PENDING`

FECHA RESULTADO: `null`

EVIDENCIA: pendiente de ejecución por el agente/QA del bug.

CONCLUSIÓN: pendiente.

## 11. Vigencia

Esta investigación aplica a BUG-0003 mientras el flujo relevante conserve el build `world-light-20260914-1` o una evolución directa que todavía use el mismo patrón de imports/retry y Safari 26.x siga dentro del target.

Si se eliminan los nonces, se bundlea el core de Studio, cambia el loader/arquitectura de World o Safari 27 se convierte en el target mínimo, crear una investigación nueva con fecha y versión nuevas y marcar esta como `parcialmente_superada` o `historica`.
