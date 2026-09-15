# Incoming bug reports

Esta carpeta representa la cola de observaciones antes del triage canónico.

Formato: `REPORT-*.json`. Los reportes históricos pueden usar el formato v1. Los candidatos creados por Bug Intelligence usan el contrato moderno de abajo.

Fuentes permitidas:

- jugador desde el juego;
- BrowserStack/Playwright;
- monitorización;
- IA auditora;
- humano/QA.

## Contrato moderno

Un `NEW_CANDIDATE` o `MATCH_CANDIDATE` debe incluir como mínimo:

- `id` y `created_at`;
- `source`;
- `sanitized: true`;
- `diagnostics.fingerprint`: 16 caracteres hex;
- `diagnostics.excerpt`: muestra sanitizada del fallo;
- `diagnostics.closest_known_bugs`: ranking de coincidencias conocidas;
- `diagnostics.git_head` cuando Git esté disponible;
- `triage.status`;
- para `MATCH_CANDIDATE`: `triage.bug_id` válido y `triage.confidence` entre 0 y 1.

`bug:candidate` genera este formato y evita crear un segundo reporte si ya existe el mismo fingerprint.

## Reglas

1. Sanitizar antes de persistir.
2. No guardar secretos, cookies, JWT, access tokens ni credenciales.
3. Screenshots/videos viven en storage externo; aquí solo se guarda la referencia.
4. Un reporte no equivale automáticamente a un bug nuevo.
5. El triage debe buscar un bug canónico en `../registry/` y enlazarlo cuando corresponda.
6. Si un fingerprint coincide con un bug `VERIFIED/CLOSED` y el reporte es posterior a su verificación, revisar `REOPENED` antes de crear otro ID.
7. Conservar evidencia útil; no duplicar el mismo fallo una y otra vez.
8. El heurístico de similitud no demuestra causa raíz.

## Auditoría

`npm run audit:bug-reports`

Valida integridad, enlaces a bugs conocidos y señales básicas de privacidad.

`npm run bug:triage`

Agrupa la cola por fingerprint para mostrar reincidencias.

`npm run audit:bug-recurrence`

Detecta evidencia posterior incompatible con bugs ya verificados/cerrados.
