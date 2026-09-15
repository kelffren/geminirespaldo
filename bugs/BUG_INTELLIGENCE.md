# KELO WORLD — Bug Intelligence

Este sistema convierte `/bugs` de un registro reactivo en una defensa progresiva contra regresiones.

## Ciclo

`CAMBIO -> RIESGO -> BLAST RADIUS -> PRUEBAS DIRIGIDAS -> TELEMETRIA/MILESTONES -> DETECCION -> FINGERPRINT -> CANDIDATO -> CLUSTER/DEDUPE -> CULPRIT CORRELATION -> BUG -> HIPOTESIS -> EXPERIMENTO -> FIX -> VERIFICACION -> REGRESSION TEST -> CLOSE GATE -> RECURRENCE GATE`

## Comandos

### Detectar / deduplicar un fallo desde logs

`npm run bug:scan -- path/al/log.txt`

Normaliza ruido variable, crea un fingerprint estable y compara el fallo contra bugs conocidos. Su resultado es una ayuda de triage: nunca crea ni cierra bugs automáticamente.

La normalización está centralizada en `scripts/lib/bug-fingerprint.mjs`. Antes de fingerprinting se redactan ejemplos comunes de secretos/PII como bearer tokens, cookies, JWT, emails e IPs.

### Crear un candidato sanitizado

`npm run bug:candidate -- path/al/log.txt --source=monitoring`

Convierte una observación/log en `bugs/incoming/REPORT-*.json` sin convertirla automáticamente en bug canónico. El reporte contiene:
- fingerprint estable;
- `git_head` observado cuando está disponible;
- excerpt sanitizado;
- clasificación aproximada;
- bugs conocidos más cercanos;
- estado `MATCH_CANDIDATE` o `NEW_CANDIDATE`.

Si ya existe un incoming report con el mismo fingerprint, no crea otro: devuelve el reporte existente. Usar `--dry-run` para CI/tests.

### Detectar reincidencias

`npm run bug:triage`

Agrupa `bugs/incoming` por fingerprint y muestra `SINGLE`, `REPEATED` o `RECURRENT`. Un fingerprint repetido debe actualizar/reabrir primero el bug canónico relacionado; no se debe crear otro ID por costumbre.

### Correlacionar commits sospechosos

`npm run bug:culprit -- BUG-0003 --limit=30`

Busca commits recientes que tocaron archivos históricamente relacionados con el bug (`suspected_files`, archivos de intentos y archivos del fix), muestra qué superficie tocaron y rebaja commits ya registrados como fixes conocidos.

Es una herramienta para priorizar investigación, no para declarar causa raíz. El propio comando recuerda la regla: correlación no implica causalidad; reproducir o bisectar antes de acusar un commit.

### Predecir riesgo antes de declarar seguro un cambio

`npm run bug:risk -- <base> <head>`

Combina:
- archivos modificados;
- `bugs/RISK_MAP.json`;
- archivos históricamente asociados a bugs;
- severidad de bugs relacionados.

Niveles: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.

HIGH/CRITICAL obliga conceptualmente a ejecutar verificaciones dirigidas antes de afirmar que el cambio es seguro. El score no significa que exista un bug; significa que el coste/probabilidad de regresión merece más evidencia.

### Calcular blast radius

`npm run bug:impact -- src/algo.mjs --depth=3`

O sobre un commit:

`npm run bug:impact -- --diff HEAD~1 HEAD --depth=2`

Construye el grafo de imports relativos de `src/`, recorre dependencias inversas y muestra qué módulos consumidores pueden verse afectados. Además cruza el radio con:
- bugs históricos;
- reglas del risk map;
- verificaciones recomendadas.

Esto evita revisar solo el archivo editado cuando una regresión puede aparecer varios módulos arriba.

### Salud del sistema de bugs

`npm run bug:health`

Muestra estados, severidades, bugs con más intentos fallidos, hotspots históricos de archivos y fixes pendientes de verificación.

### Regresiones permanentes

`npm run audit:bug-regressions`

Un bug `VERIFIED` o `CLOSED` debe dejar evidencia de protección permanente: test/spec/script o un contrato `regression.test` / `regression.command` en el bug.

`FIXED_PENDING_VERIFY` sin protección permanente genera warning para que el test se cree antes del cierre.

### Gate de cierre

`npm run audit:bug-close`

Bloquea `VERIFIED/CLOSED` cuando falta cualquiera de estas piezas aplicables:
- fix identificable;
- `verification.status = PASS`;
- método y evidencia reproducible;
- protección permanente contra regresión;
- `verified_by` y `verified_at` en bugs high/critical;
- blockers abiertos en un bug marcado CLOSED.

`npm run audit:bug-close -- --strict-pending` también convierte en fallo la ausencia de protección de regresión para high/critical que estén en `FIXED_PENDING_VERIFY`.

### Gate de reincidencia

`npm run audit:bug-recurrence`

Cruza los `REPORT-*` sanitizados y enlazados con bugs canónicos. Si un reporte `MATCH_CANDIDATE` con confianza suficiente aparece **después** de que el bug quedó `VERIFIED` o `CLOSED`, la auditoría falla y obliga a revisar reapertura.

No reabre automáticamente ni inventa causa raíz. Su función es impedir que un síntoma compatible con un bug cerrado vuelva silenciosamente sin revisión.

`npm run audit:bug-recurrence -- --strict-pending` también trata como fallo una coincidencia posterior al fix mientras el bug sigue `FIXED_PENDING_VERIFY`.

## Runtime milestones

`src/core/bug-observability.mjs` permite registrar checkpoints ligeros por flujo sin depender de servicios externos.

Ejemplo conceptual:

```js
const obs=createBugObserver({flow:'world-open',bugId:'BUG-0003',version:'world-x'});
obs.mark('WORLD_TAP');
obs.mark('CONTROLLER_IMPORTED');
obs.mark('SHELL_READY');
obs.mark('TOOLS_READY');
```

Los últimos eventos quedan en `sessionStorage`. Si Safari/WebContent muere sin lanzar una excepción JavaScript, al volver a cargar puede inspeccionarse el último milestone completado y reducir el espacio de búsqueda.

También existe `installBugErrorCapture()` para convertir `window.error` y `unhandledrejection` en eventos del mismo timeline.

## Fingerprints

Un fingerprint identifica una **forma de fallo**, no una causa raíz. Dos errores con timestamps, IDs o números distintos pueden normalizarse al mismo fingerprint. Esto ayuda a detectar reincidencia y duplicados.

No almacenar secretos, cookies, JWT, access keys ni PII dentro de logs/fingerprints.

## Política de eliminación

Un bug serio no está eliminado porque desaparezca una vez.

Para llegar a `VERIFIED/CLOSED` debe existir:
1. reproducción original entendida;
2. fix identificable;
3. verificación independiente en el entorno aplicable;
4. protección de regresión permanente cuando sea automatizable;
5. si no es automatizable, contrato explícito de smoke/manual verification con razón documentada;
6. `audit:bug-close` en PASS;
7. `audit:bug-recurrence` sin evidencia posterior incompatible.

## Regla para agentes

Antes de cambios de alto riesgo:

1. `npm run bug:risk -- <base> <head>` cuando exista un diff aplicable;
2. `npm run bug:impact -- --diff <base> <head> --depth=2` para cambios con dependencias relevantes;
3. leer briefs de los bugs relacionados;
4. ejecutar los tests sugeridos por risk/impact;
5. no declarar seguro un HIGH/CRITICAL basándose solo en lint/unit tests si el fallo histórico era móvil/LIVE.

Cuando aparezca un fallo:

1. `bug:scan` para comparar;
2. `bug:candidate` para guardar una observación sanitizada si corresponde;
3. `bug:triage` para revisar reincidencias;
4. `bug:culprit` si se sospecha regresión reciente;
5. `audit:bug-recurrence` si el bug enlazado estaba verificado/cerrado;
6. actualizar/reabrir antes de crear otro bug cuando el fingerprint/síntoma coincida.

Después de un fix:

1. registrar el intento;
2. añadir/regenerar el regression test;
3. `npm run audit:bugs`;
4. `npm run audit:bug-regressions`;
5. `npm run audit:bug-close`;
6. `npm run audit:bug-recurrence`;
7. verificar el flujo original.
