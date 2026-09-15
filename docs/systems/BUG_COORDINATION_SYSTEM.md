# Kelo World — Bug Coordination System

## Propósito

El sistema convierte bugs encontrados por jugadores, humanos, pruebas e IAs en memoria compartida y verificable. Separa cuatro responsabilidades que antes podían confundirse:

`REPORTAR -> TRIAGE -> CORREGIR -> VERIFICAR/CERRAR`

La fuente operativa es `/bugs`. El módulo cliente de reporte vive en `src/bug-reporting/bug-reporter.mjs` y actualmente está **dormant / no cargado por el runtime principal**.

## OWNER

- Coordinación/contrato de defectos: `/bugs`.
- UI y envelope de reporte de jugador: `KeloBugReporter` en `src/bug-reporting/bug-reporter.mjs`.
- Persistencia futura/online: backend adapter inyectado mediante `submitReport`; el cliente NO es autoridad de IDs canónicos, deduplicación, triage ni cierre.

## Estado que posee

`KeloBugReporter` posee únicamente:

- estado enabled/disabled;
- modal/draft temporal;
- screenshot temporal antes del submit;
- envelope sanitizado que solicita ser enviado.

El registro `/bugs` posee el contrato documental de:

- IDs canónicos `BUG-*`;
- estados de lifecycle;
- evidencia;
- fix candidate;
- verificación;
- relaciones/duplicados.

## Estado que NO posee

El cliente reporter NO posee:

- autoridad de gameplay;
- auth tokens;
- deduplicación canónica;
- asignación final de `REPORT-NNNNNN`;
- creación automática de bugs canónicos;
- decisión `VERIFIED/CLOSED`;
- almacenamiento permanente de screenshots.

## API pública actual

`src/bug-reporting/bug-reporter.mjs` exporta:

- `createBugReporter(options)`
- `sanitizeDiagnosticValue(value)`
- `buildBugReportEnvelope(input)`

Instancia de reporter:

- `enable()` / `disable()`
- `isEnabled()`
- `open()` / `close()`
- `render()`
- `send({ description, category })`
- `captureGameScreenshot()`
- `destroy()`

Opciones principales:

- `enabled` — `false` por defecto;
- `submitReport({ envelope, screenshotBlob })` — adaptador de transporte;
- `getGameContext()` — contexto de mundo/UI controlado por el owner real;
- `getDiagnostics()` — diagnóstico limitado/sanitizable;
- `getScreenshotTarget()` — canvas permitido;
- `gameBuild` — build/commit visible para correlación.

## Flujo de jugador futuro

Cuando se active desde una superficie existente:

1. Jugador abre `Reportar un problema`.
2. Escribe descripción y categoría.
3. Opcionalmente adjunta imagen o captura el canvas.
4. Reporter obtiene contexto/diagnóstico mediante callbacks.
5. Sanitiza valores sensibles.
6. Construye envelope local con `client_report_id`.
7. `submitReport` envía al backend.
8. Backend asigna `REPORT-NNNNNN`, almacena screenshot fuera de Git y persiste metadata.
9. Triage convierte/enlaza el reporte a un `BUG-NNNN`.

## Flujo de IA

Ver `bugs/AI_BRIDGE.md`.

Regla central:

`DETECTAR != ARREGLAR != VERIFICAR != CERRAR`

Una IA que escribe un fix mueve el registro a `FIXED_PENDING_VERIFY`. Bugs críticos/user-facing requieren verificación independiente en el entorno relevante antes de `VERIFIED`.

## Persistencia y online-first

Estado actual:

- reporter cliente no persiste por sí solo;
- screenshots quedan solo en memoria hasta submit;
- sin adapter, el módulo emite `kelo:bug-report-submit-requested` y devuelve `accepted:false / NO_TRANSPORT`;
- el módulo no está cargado por `index.html`, por lo que no cambia producción.

Destino online previsto:

- endpoint/RPC server-authoritative asigna `REPORT-*`;
- screenshot a storage externo (por ejemplo Supabase Storage) con path no sensible;
- tabla de reportes guarda metadata sanitizada;
- job/IA de triage lee reportes y sincroniza el registry canónico;
- nunca confiar en el cliente para estado `VERIFIED/CLOSED`.

Mover persistencia al server no requiere rehacer formulario, envelope ni callbacks.

## Invariantes

1. Reporter nace `disabled`.
2. No escribir screenshots/base64 pesados dentro del repo.
3. No enviar tokens/cookies/passwords/service keys.
4. Sanitizar diagnósticos antes del submit.
5. El cliente no asigna bug ID canónico.
6. `FIXED_PENDING_VERIFY` nunca equivale a `CLOSED`.
7. Bugs visibles deben verificarse en el entorno donde fallaban.
8. No crear reporter paralelo; extender `KeloBugReporter` o su adapter.

## Seguridad / privacidad

El sanitizador:

- redacta keys con nombres sensibles;
- intenta redactar Bearer/JWT/query secrets dentro de strings;
- limita profundidad, arrays y longitud de strings.

Eso es defensa en profundidad, no garantía absoluta. El backend debe volver a sanitizar/validar y definir retención/consentimiento antes de una beta pública.

La captura es una acción explícita del jugador; no hay captura silenciosa automática.

## Tests

Contrato mínimo:

`node tests/bug-reporter-contract.test.mjs`

Cubre:

- reporter apagado por defecto;
- envelope estable;
- categorías;
- redacción de secretos;
- API enable/disable.

Antes de activar para jugadores se requieren además:

- test DOM/mobile del modal;
- upload real de screenshot;
- backend auth/rate limit;
- deduplicación/triage;
- prueba de privacidad/sanitización server-side;
- QA LIVE iPhone/Android.

## Observabilidad

Cada reporte debe poder correlacionarse mediante:

- `client_report_id` local;
- `REPORT-*` asignado por server;
- game build;
- entorno;
- bug canónico eventual.

No usar identificadores personales si un hash/pseudónimo es suficiente.

## Fallos/deuda conocida

- No existe todavía backend `submitReport` production.
- El botón no está integrado en la UI principal.
- No existe aún storage de screenshots.
- No existe aún triage automático repo/backend.
- No existe todavía rate limiting/abuse handling del endpoint porque el endpoint no está creado.

Estas capacidades son pendientes; no describirlas como LIVE.

## Cómo extender sin duplicar owner

1. Para nueva categoría: extender contrato/categorías y test.
2. Para nuevo contexto: añadirlo vía `getGameContext`, no leer internals arbitrarios desde la UI.
3. Para nuevos diagnósticos: `getDiagnostics` + sanitización.
4. Para backend: implementar adapter `submitReport`, no acoplar fetch/SDK directamente al formulario.
5. Para botón de menú: llamar `reporter.open()` desde el owner de esa UI.
6. Para triage IA: respetar `/bugs/AI_BRIDGE.md`; no modificar el reporter para decidir estados canónicos.
