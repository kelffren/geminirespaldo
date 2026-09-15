# Kelo World — Bug Intelligence Self-Learning

## Propósito

Extiende Bug Coordination con aprendizaje medible para que el sistema no solo recuerde defectos, sino que use el historial **y el resultado de sus propias defensas** para prevenir regresiones futuras.

```text
BUGS + REPORTS + ATTEMPTS + PREVENTION CI
→ ejemplos cronológicos
→ KeloEvolution champion/challenger
→ search
→ holdout
→ policy champion acotada
→ hotspots + prevention gaps
→ bug:risk aprendido
→ auditorías preventivas del siguiente cambio
→ resultado preventivo sanitizado
→ feedback
→ volver a aprender
```

## OWNER

- Motor de evolución, selección, holdout y memoria: **KeloEvolution**.
- Evidencia canónica de defectos: `/bugs`.
- Adapter de aprendizaje: `scripts/bug-learning-autopilot.mjs`.
- Captura de feedback: `scripts/bug-learning-observe.mjs`.
- Auditor de memoria: `scripts/bug-learning-audit.mjs`.
- Predictor de diff: `scripts/bug-risk.mjs`.
- Runner preventivo: `scripts/bug-prevention.mjs`.
- Contrato de memoria: `bugs/learning/STATE.json`.

No existe un segundo motor de IA/evolución.

## Estado que posee

Los workflows autónomos solo pueden persistir:

`bugs/learning/STATE.json`

Ese estado contiene:

- policy champion de multiplicadores para reglas existentes de `RISK_MAP`;
- memoria de experimentos KeloEvolution;
- métricas search/holdout;
- hasta 200 observaciones sanitizadas de `Bug Prevention`;
- hotspots históricos/de feedback de archivos;
- prevention gaps;
- fingerprints/evidence fingerprints;
- safety bounds.

Una observación preventiva guarda solo:

- `head_sha` / `base_sha`;
- fecha;
- conclusión del workflow;
- paths cambiados.

No guarda logs, stack traces, payloads de usuario ni secretos.

## Estado que NO posee

No posee autoridad para:

- cambiar lifecycle de `BUG-*`;
- declarar causa raíz;
- declarar `PASS`, `VERIFIED` o `CLOSED`;
- modificar source code;
- cambiar gameplay;
- merge/deploy de código;
- modificar server/Supabase/secrets;
- inventar pruebas de dispositivo.

Un `Bug Prevention = success` es evidencia de que las defensas automáticas aplicables pasaron; **no** equivale a verificación funcional de un bug.

## Aprendizaje

`bug-learning-autopilot.mjs` convierte evidencia histórica en ejemplos con target de riesgo según:

- severidad;
- resultado de intentos (`PASS/FAIL/PARTIAL/BLOCKED`);
- reincidencias/reportes;
- estado `REOPENED`;
- conclusión de `Bug Prevention` (`success/failure/timed_out/...`);
- recencia relativa a la evidencia más nueva.

Los challengers solo ajustan multiplicadores de reglas ya existentes y están limitados a `0.75..1.75`.

### Feedback de prevención

`bug-learning-observe.mjs` registra la conclusión de un run de `Bug Prevention` en `STATE.json.observations`.

El learner incorpora esas observaciones al mismo dataset cronológico que bugs/reportes/intentos. Por tanto, una policy no puede aprender de los propios resultados por una vía privilegiada: vuelve a pasar por el torneo KeloEvolution y por holdout.

Targets iniciales del feedback son deliberadamente conservadores: fallo/timed-out elevan riesgo; success lo reduce, pero no hasta cero.

### Holdout

Con al menos ocho ejemplos se reserva el bloque cronológico final como holdout. Una policy solo se promociona si mejora search y no pierde en holdout.

Con poca evidencia se pueden aprender hotspots/gaps, pero no promocionar una nueva policy.

## Hotspots

Los hotspots combinan evidencia de:

- bugs canónicos;
- intentos fallidos/parciales;
- reportes;
- feedback preventivo.

Cada hotspot guarda conteos y un `risk_bonus` máximo de `20`. `bug-risk` aplica un cap adicional al agregado aprendido para que la memoria no pueda dominar ilimitadamente el score.

Repeated prevention failures pueden generar un `prevention_gap` específico para que el sistema señale una defensa insuficiente aunque todavía no exista un nuevo bug canónico.

## Prevención

`bug-risk.mjs` aplica una policy aprendida únicamente cuando el fingerprint del `RISK_MAP.json` actual coincide con el fingerprint con el que se entrenó el estado.

Si el estado está stale, el scoring vuelve automáticamente a la base estática + historia canónica.

`bug-prevention.mjs` convierte las recomendaciones de reglas/hotspots en dos grupos:

1. **Auditorías automáticas:** solo `npm run audit:*` que existan realmente en `package.json`.
2. **Obligaciones manuales:** iPhone, reload/reopen, smoke visual, etc. Se muestran pero nunca se falsifican como ejecutadas.

El runner nunca ejecuta comandos arbitrarios provenientes de la memoria aprendida.

En pull requests, Prevention evalúa el diff completo `base SHA → head SHA`; no solo el último commit.

## Automatización

### Self Learning

`.github/workflows/bug-self-learning.yml`

- corre cada hora;
- corre cuando cambia evidencia relevante;
- audita KeloEvolution + registry + reports antes de aprender;
- no escribe si el evidence fingerprint no cambió;
- refresca `main` antes de persistir para evitar aprender sobre evidencia sabidamente vieja;
- solo commitea `bugs/learning/STATE.json`.

### Prevention

`.github/workflows/bug-prevention.yml`

En cambios de source/build/assets:

1. syntax-check de los componentes de aprendizaje;
2. dry-run del learner contra evidencia real;
3. audita bounds de memoria;
4. calcula riesgo estático + aprendido;
5. ejecuta auditorías preventivas permitidas;
6. calcula blast radius.

### Feedback

`.github/workflows/bug-learning-feedback.yml`

Escucha `workflow_run` de **Bug Prevention**. Solo para runs `push` sobre `main`:

1. registra `head/base/date/conclusion/files`;
2. audita el estado;
3. refresca `main` antes de escribir;
4. commitea exclusivamente `bugs/learning/STATE.json` si existe feedback nuevo.

Self Learning y Feedback comparten `concurrency: bug-learning-state-writes`, evitando escrituras simultáneas sobre la memoria.

Los commits de memoria usan `[skip ci]`; además, las rutas de Prevention/Self Learning excluyen el propio `STATE.json`, evitando bucles de workflows.

## Invariantes

1. KeloEvolution sigue siendo el único owner de champion/challenger/holdout.
2. El learner no escribe source code.
3. El único auto-write es `bugs/learning/STATE.json`.
4. Multiplicadores quedan entre `0.75` y `1.75`.
5. Hotspot bonus por archivo no supera `20`.
6. Policy nueva requiere holdout suficiente.
7. Estado stale no influye en `bug:risk`.
8. Auditorías aprendidas se ejecutan desde allowlist; nunca shell arbitrario.
9. Prueba manual nunca se transforma en PASS automático.
10. Feedback preventivo no cambia estado de bugs.
11. Observaciones de feedback están limitadas a 200 y a 120 paths por evento.
12. Un resultado de Prevention no prueba causa raíz.
13. Aprender no equivale a arreglar ni cerrar.

## Rollback

La policy aprendida es datos. Rollback consiste en restaurar `bugs/learning/STATE.json` a un champion previo o reiniciar multiplicadores a baseline. `RISK_MAP.json` sigue siendo la base humana/auditada.

Si un nuevo champion empeora la verificación posterior, nueva evidencia/feedback entra al loop y KeloEvolution puede seleccionar otra policy; el historial anterior permanece en `memory.entries`.

## Seguridad

- No se persiste texto crudo de logs dentro de learning state.
- Los REPORTs deben pasar `bug-report-audit` antes de aprender.
- No se guardan tokens/cookies/JWT.
- `bug-learning-audit.mjs` bloquea ampliación del auto-write scope y cualquier bandera de auto-close/source-write.
- Feedback solo acepta conclusiones GitHub conocidas y SHAs válidos.
- `bug-learning-observe.mjs` deriva los paths desde Git; no acepta texto de logs como evidencia persistente.

## Tests / auditoría

- `node --check scripts/bug-learning-autopilot.mjs`
- `node --check scripts/bug-learning-observe.mjs`
- `node scripts/bug-learning-autopilot.mjs --json` para dry-run
- `node scripts/bug-learning-audit.mjs --strict`
- `node scripts/bug-prevention.mjs <base> <head> --plan`
- `node scripts/kelo-evolution-audit.mjs`

## Observabilidad

`bug:health` muestra:

- champion actual;
- search/holdout score;
- tamaño del dataset;
- número de feedback examples;
- experimentos;
- hotspots aprendidos;
- gaps de prevención.

Así el sistema no puede “mejorar” de forma invisible: la memoria y sus decisiones siguen auditables en Git.

## Online-first

Es infraestructura de repositorio/CI, no autoridad gameplay. Si la evidencia futura vive en backend, el adapter puede recibir snapshots serializables equivalentes sin cambiar el contrato de KeloEvolution ni poner Git authority en el cliente.

## Deuda conocida

- La calidad del aprendizaje depende todavía de que agentes registren archivos/resultados reales en `attempt_history` para bugs canónicos.
- Con pocos bugs canónicos el learner depende más de intentos, reportes y feedback preventivo que de diversidad de defectos.
- Un CI success no demuestra el comportamiento LIVE; device/visual signals siguen siendo otra fuente que puede añadirse después al mismo contrato.
- No existe aún un judge de dispositivo real automático para iPhone; esas obligaciones siguen manuales cuando BrowserStack/infra no las puede ejecutar.
- Branch protection sigue siendo configuración externa al repo.
