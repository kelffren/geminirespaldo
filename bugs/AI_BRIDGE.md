# KELO WORLD — AI Bug Bridge

Este es el puente obligatorio para cualquier IA/agente que inspeccione o modifique bugs de KELO WORLD.

## 0. Antes de tocar un bug

1. Leer `AGENTS.md`.
2. Leer `bugs/README.md`.
3. Leer `bugs/SCHEMA.md`.
4. Leer `bugs/RESEARCH_PROTOCOL.md`.
5. Leer `bugs/BUG_INTELLIGENCE.md`.
6. Leer todos los bugs relevantes en `bugs/registry/`.
7. Revisar las investigaciones aplicables en `bugs/investigacion/BUG-NNNN/`.
8. Para un bug existente, ejecutar `npm run bug:brief -- BUG-NNNN` cuando el entorno lo permita.
9. Buscar duplicados antes de crear uno nuevo.
10. Inspeccionar el `main` actual; no asumir que un chat, commit viejo o memoria describe el runtime actual.

### Preflight de riesgo e impacto

Cuando exista un diff o cambio propuesto con alcance material, ejecutar:

`npm run bug:risk -- <base> <head>`

Cuando el cambio toque módulos reutilizados o superficies con dependencias relevantes, ejecutar además:

`npm run bug:impact -- --diff <base> <head> --depth=2`

El score y el blast radius no demuestran que haya un bug. Sirven para decidir cuánta verificación dirigida hace falta y qué consumidores pueden romperse lejos del archivo editado. Si aparece un bug histórico relacionado, leer su briefing antes de declarar el cambio seguro.

Si existe un log/error reproducible, ejecutar cuando sea práctico:

`npm run bug:scan -- <log-file>`

Si la observación debe conservarse para triage, usar:

`npm run bug:candidate -- <log-file> --source=<origen>`

Después revisar reincidencias con:

`npm run bug:triage`

Si el síntoma parece una regresión reciente de un bug conocido, usar:

`npm run bug:culprit -- BUG-NNNN --limit=30`

`bug:culprit` solo prioriza commits que tocaron la superficie histórica. Correlación no implica causalidad: reproducir/bisectar antes de atribuir causa raíz.

El fingerprint ayuda a detectar reincidencias/duplicados, pero nunca sustituye el triage humano/IA ni demuestra causa raíz.

### Regla anti-pérdida de tiempo

Antes de escribir código, el agente debe poder responder:

- qué hechos están confirmados;
- qué hipótesis siguen vivas;
- qué hipótesis fueron descartadas;
- qué intentos ya se hicieron y cómo terminaron;
- qué intento NO debe repetirse sin nueva evidencia;
- cuál es la `next_best_action` actual;
- cuál es la prueba exacta que demostraría éxito;
- qué bugs históricos y zonas de riesgo toca el cambio;
- cuál es el blast radius probable;
- si existen reportes recientes con el mismo fingerprint.

Si no puede responder eso, primero completa la investigación del bug.

## 1. Si descubres un bug nuevo

Regístralo si es reproducible, serio o requiere trabajo posterior.

NO crees un bug nuevo si ya existe uno con el mismo síntoma/flujo. En ese caso añade la nueva evidencia/reporte al bug existente. Si el bug estaba `VERIFIED` o `CLOSED`, la acción correcta suele ser revisar y posiblemente moverlo a `REOPENED`, no crear otro ID.

Proceso:

`DESCUBRIR -> SANITIZAR -> FINGERPRINT/DEDUPE -> CANDIDATO -> TRIAGE/RECURRENCIA -> REGISTRAR/ENLAZAR -> INVESTIGAR`

Al crear un bug:

- usar el siguiente `BUG-NNNN` libre;
- describir el síntoma, no inventar la causa;
- escribir pasos de reproducción reales;
- marcar datos desconocidos como `unknown`/`null`;
- añadir evidencia concreta;
- crear `research.known_facts`, `research.hypotheses`, `research.unknowns` y `next_best_actions`;
- separar hipótesis de hechos;
- no almacenar secretos.

## 2. Investigación obligatoria

Un bug activo usa el protocolo de `bugs/RESEARCH_PROTOCOL.md`.

### Hechos

Registrar hechos como `F1`, `F2`, ... con evidencia. No convertir inferencias en hechos.

### Hipótesis

Registrar teorías como `H1`, `H2`, ... con:

- confianza;
- estado;
- evidencia a favor;
- evidencia en contra;
- siguiente test discriminante.

Estados permitidos:

`unverified | supported | weakened | ruled_out | confirmed`

`confirmed` exige evidencia discriminante; no basta con que una teoría parezca probable.

### Intentos

Todo intento material usa `A1`, `A2`, ... dentro de `attempt_history`.

Registrar incluso los fallos. Un `FAIL` debe dejar `do_not_repeat_without`.

Nunca borrar un intento fallido para limpiar el registro.

### Investigación externa

Cuando el bug depende de navegador, iOS, BrowserStack, Playwright, SDK, API o servicio externo, consultar documentación oficial/changelog aplicable y registrar solo la conclusión útil en `research.external_references` y, cuando haga falta ampliar el razonamiento, en `bugs/investigacion/BUG-NNNN/` con BUG + FECHA + VERSION/BUILD.

## 3. Si quieres trabajar en un bug

Antes de editar código:

- comprobar que no está `CLOSED`, `WONT_FIX` o reclamado activamente por otro agente;
- si está `CLOSED` pero hay nueva evidencia posterior al cierre, ejecutar primero `npm run audit:bug-recurrence` y revisar si corresponde `REOPENED`;
- leer el briefing completo;
- revisar investigaciones vigentes para la versión/build actual;
- comprobar que la solución propuesta no repite un `attempt_history` fallido;
- revisar riesgo, historial y blast radius de los archivos que se van a tocar;
- si se sospecha regresión reciente, ejecutar `bug:culprit` antes de perseguir commits al azar;
- si repite un intento, documentar primero la nueva evidencia que invalida el resultado anterior;
- si está libre y entendido, mover a `CLAIMED`;
- rellenar `claimed_by` y `claim_started_at`;
- inspeccionar owner/arquitectura según Foundation;
- reproducir el problema antes del fix cuando sea posible;
- elegir preferiblemente la primera `next_best_action` porque debe representar el experimento de mayor valor actual.

No reclames muchos bugs para bloquear a otros agentes. Reclama solamente el que vas a trabajar.

## 4. Después de cada experimento o cambio

Antes de abandonar el bug o pasar a otra hipótesis:

1. añadir/actualizar su entrada en `attempt_history`;
2. registrar `PASS | FAIL | PARTIAL | NOT_RUN | BLOCKED`;
3. escribir qué se aprendió;
4. actualizar hipótesis afectadas;
5. mover a `research.ruled_out` las teorías realmente descartadas;
6. actualizar `research.unknowns`;
7. recalcular `next_best_actions`.

Un intento fallido que descarta una teoría es progreso real.

## 5. Cómo marcar un bug como fixed

NUNCA pasar directamente de `CLAIMED` a `CLOSED`.

Cuando exista una corrección candidata:

1. Ejecuta los tests relevantes sugeridos por `bug:risk`/`bug:impact`.
2. Registra commit(s) y archivos tocados en `fix`.
3. Registra el cambio también en `attempt_history`.
4. Resume qué cambió sin exagerar.
5. Actualiza las hipótesis según la evidencia obtenida.
6. Añade una prueba de regresión permanente cuando el fallo sea automatizable; si no lo es, documenta el contrato de smoke/manual verification y la razón.
7. Ejecuta `npm run audit:bug-regressions`.
8. Ejecuta `npm run audit:bug-close`.
9. Cambia estado a `FIXED_PENDING_VERIFY`.
10. Libera `claimed_by` si ya no estás trabajando activamente.
11. Deja `verification.status = PENDING`.
12. Asegura que `next_best_actions` incluya la verificación real pendiente.

`FIXED_PENDING_VERIFY` NO significa que el bug esté resuelto para el jugador. Significa que hay una corrección lista para ser atacada por el verificador.

## 6. Cómo verificar un fix

Preferiblemente un agente/prueba diferente al que hizo el fix:

1. Leer el bug original y su `attempt_history`, no solo el commit más reciente.
2. Reproducir el mismo flujo y entorno que fallaba.
3. Ejecutar prueba negativa/edge cuando aplique.
4. Comprobar regresiones relacionadas y repetir el flujo si históricamente fallaba en segundo open/reload/reconnect.
5. Ejecutar/confirmar la protección de regresión permanente.
6. Guardar evidencia.
7. Ejecutar `npm run audit:bug-recurrence` para comprobar que no existe evidencia posterior incompatible con el cierre.

Si pasa:

- añadir un intento con `validation.result = PASS`;
- `verification.status = PASS`;
- registrar método, evidencia, agente y fecha;
- ejecutar `npm run audit:bug-regressions`;
- ejecutar `npm run audit:bug-close`;
- ejecutar `npm run audit:bug-recurrence`;
- mover a `VERIFIED` solo si los gates aplicables pasan.

Después puede pasar a `CLOSED` cuando el cierre administrativo sea apropiado y el close gate siga en PASS.

Si falla:

- añadir un intento `FAIL` con la evidencia;
- `verification.status = FAIL`;
- mover a `REOPENED`;
- explicar el síntoma actual;
- actualizar hipótesis y siguientes acciones;
- NO borrar el historial del intento anterior.

## 7. Reincidencia de un bug verificado/cerrado

`npm run audit:bug-recurrence`

El gate cruza incoming reports sanitizados que enlazan un bug canónico con la fecha de verificación/cierre. Si aparece un `MATCH_CANDIDATE` posterior con suficiente similitud, CI falla y exige revisión de reapertura.

Reglas:

- no crea ni reabre automáticamente un bug;
- no acusa causa raíz;
- exige revisar evidencia posterior;
- si el síntoma realmente reapareció, mover el bug canónico a `REOPENED`;
- no crear otro `BUG-NNNN` para esconder una regresión del mismo defecto;
- `--strict-pending` puede tratar como fallo una reincidencia posterior al fix mientras esté `FIXED_PENDING_VERIFY`.

## 8. Si encuentras un duplicado

No mantengas dos bugs activos para el mismo defecto.

- conservar el bug canónico más útil/antiguo;
- en el duplicado, rellenar `duplicate_of`;
- enlazar sus reportes/evidencia al bug canónico;
- no perder screenshots/logs únicos.

## 9. Si un jugador reporta algo

Los reportes de jugador entran primero como `REPORT-*`.

Triage:

`REPORT -> sanitizar -> fingerprint/dedupe -> candidato -> cluster/recurrence -> enlazar BUG existente o crear BUG nuevo`

Nunca confiar ciegamente en la causa sugerida por el jugador. Su descripción sí es evidencia del síntoma.

Fotos/videos/logs se referencian por storage externo. No versionar binarios grandes en Git.

## 10. Si un test automático descubre algo

Un test rojo no siempre es un bug de producto. Determina primero si es:

- bug de producto;
- bug del test/harness;
- infraestructura externa;
- configuración incompatible.

Registra cada defecto por separado cuando las causas son distintas. Ejemplo: un test de World puede estar bloqueado por un bug de BrowserStack; no mezclar ambos como si fueran el mismo fallo.

## 11. Conflictos entre agentes

Si dos agentes trabajan el mismo bug:

- el segundo no debe sobrescribir silenciosamente el claim;
- comparar ramas/commits y conservar el fix más probado;
- registrar ambos intentos por separado;
- nunca falsificar el historial para que parezca trabajo lineal.

## 12. Auditoría

Antes de terminar un pass que cambió bugs:

`npm run audit:bugs`

`npm run audit:bug-regressions`

`npm run audit:bug-close`

`npm run audit:bug-recurrence`

Para una vista global:

`npm run bug:health`

Si una auditoría falla, el expediente, el cierre o la defensa contra regresión está incompleta.

## 13. Regla de oro

**DETECTAR no es ARREGLAR. ARREGLAR no es VERIFICAR. VERIFICAR no es CERRAR.**

Y además:

**UN INTENTO FALLIDO ES CONOCIMIENTO. NO SE REPITE SIN NUEVA EVIDENCIA.**

**UN BUG SERIO ARREGLADO DEBE DEJAR UNA DEFENSA PARA NO VOLVER SILENCIOSAMENTE.**

**SI UN BUG CERRADO REAPARECE, SE REABRE EL CANÓNICO; NO SE ESCONDE DETRÁS DE OTRO ID.**

## 14. Prompt corto para cualquier IA

> Lee `AGENTS.md`, `bugs/README.md`, `bugs/SCHEMA.md`, `bugs/RESEARCH_PROTOCOL.md`, `bugs/BUG_INTELLIGENCE.md`, las investigaciones aplicables y el bug relevante. Ejecuta `bug:brief`; evalúa `bug:risk` y `bug:impact`; usa `bug:scan`/`bug:candidate`/`bug:triage` para nueva evidencia y `bug:culprit` solo como correlación de regresores. No repitas un `FAIL` sin nueva evidencia. Cada experimento queda en `attempt_history`. Si corriges un bug, añade defensa de regresión y ejecuta `audit:bug-regressions`, `audit:bug-close` y `audit:bug-recurrence`; déjalo `FIXED_PENDING_VERIFY`. Solo una verificación independiente del flujo original puede moverlo a `VERIFIED`, y una reincidencia posterior obliga a revisar `REOPENED`.
