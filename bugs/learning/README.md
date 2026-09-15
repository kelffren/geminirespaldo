# Bug Learning — aprendizaje autónomo y prevención

Esta carpeta contiene la memoria aprendida del sistema de bugs. No reemplaza `bugs/registry/`, `bugs/incoming/` ni `bugs/RISK_MAP.json`; los observa y aprende señales adicionales de riesgo.

## Owner

El motor de evaluación sigue siendo **KeloEvolution**. Bug Intelligence actúa como adapter de dominio.

Flujo cerrado:

`BUGS + REPORTS + ATTEMPTS + PREVENTION CI -> ejemplos cronológicos -> champion/challengers -> search -> holdout -> policy champion -> hotspots -> prevención -> resultado preventivo -> feedback -> volver a aprender`

## Qué aprende

`STATE.json` puede aprender:

- multiplicadores acotados para reglas existentes de `RISK_MAP.json`;
- archivos/hotspots que concentran bugs severos o intentos fallidos;
- señales de éxito/fallo de sus propias auditorías preventivas;
- pruebas recomendadas por historial;
- huecos de prevención, por ejemplo un bug high/critical sin defensa de regresión;
- fingerprints recurrentes;
- memoria de experimentos para no repetir policies que ya fallaron.

El feedback de CI se guarda como observaciones pequeñas: SHA, fecha, conclusión y archivos del diff. Nunca copia logs crudos.

## Qué NO puede hacer automáticamente

El learner no puede:

- escribir código fuente arbitrario;
- cambiar el estado de un `BUG-*`;
- marcar `PASS`, `VERIFIED` o `CLOSED`;
- ampliar su propio scope de escritura;
- modificar secretos, server authority o deploy;
- aceptar una nueva policy sin evidencia holdout cuando existe suficiente historial.

El único archivo que los workflows autónomos pueden persistir es:

`bugs/learning/STATE.json`

Los cambios de código siguen las reglas de KeloEvolution/source repair: candidato acotado, sandbox/evidence y PR; no auto-merge.

## Aprendizaje

Ejecutar una observación sin persistir:

`node scripts/bug-learning-autopilot.mjs`

Persistir una nueva memoria cuando existe evidencia nueva:

`node scripts/bug-learning-autopilot.mjs --write`

Registrar manualmente/desde CI un resultado preventivo sanitizado:

`node scripts/bug-learning-observe.mjs --head=<sha> --conclusion=success`

Auditar la memoria:

`node scripts/bug-learning-audit.mjs --strict`

Si no cambió la evidencia, el learner devuelve `NO_NEW_BUG_EVIDENCE` y no modifica archivos. Esto evita commits vacíos cada hora.

## Prevención

`bug-risk` consume la policy champion y los hotspots aprendidos cuando el `risk_map_fingerprint` coincide con el `RISK_MAP.json` actual.

`node scripts/bug-prevention.mjs <base> <head>` cruza el diff con reglas y hotspots, ejecuta únicamente auditorías npm permitidas y muestra por separado las verificaciones manuales que no puede falsificar.

Un `Bug Prevention` exitoso no equivale a `VERIFIED`: es una señal estadística de que las defensas automáticas aplicables pasaron. Un fallo tampoco demuestra causa raíz; aumenta evidencia de riesgo sobre los archivos tocados.

## Regla anti-overfit

Con suficiente historial, el último bloque cronológico queda fuera del search y actúa como holdout. Una policy no se promueve por mejorar solo los datos con los que fue creada.

Los resultados de Preventer entran como ejemplos cronológicos junto a bugs/reportes/intentos, de modo que el sistema aprende de su propio desempeño sin saltarse holdout.

Con evidencia insuficiente el sistema puede actualizar hotspots/gaps, pero no promocionar una nueva policy de riesgo.

## Automatización

`.github/workflows/bug-self-learning.yml` ejecuta el learner cada hora y cuando cambia evidencia del sistema de bugs. Solo hace commit si `STATE.json` cambia materialmente.

`.github/workflows/bug-prevention.yml` se ejecuta en cambios de código relevantes y usa la memoria aprendida para elegir auditorías preventivas. En PR analiza el diff completo contra la base real, no solamente el último commit.

`.github/workflows/bug-learning-feedback.yml` escucha la finalización de `Bug Prevention` en pushes de `main`, guarda la conclusión sanitizada en `STATE.json` y no toca código ni el registry.

Los dos workflows que escriben aprendizaje comparten `concurrency: bug-learning-state-writes`, por lo que no deben sobrescribirse entre sí.
