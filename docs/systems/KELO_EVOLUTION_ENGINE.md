# Kelo Evolution Engine — System Contract

## Propósito

`KeloEvolution` es la capacidad interna de Kelo World para ejecutar mejora medible, reversible y segura sobre candidatos de datos y código:

```text
champion / baseline
→ detectar problema o oportunidad con evidencia
→ generar challengers o propuesta de código
→ validar contrato + riesgo + paths + tests
→ sandbox / search evaluation
→ hard gates + score
→ holdout / evidencia independiente cuando aplica
→ feedback al proposer si falla
→ reintento acotado
→ keep / rollback / PR
→ memoria + evidencia reproducible
```

No es un segundo game engine. No posee gameplay, renderer, mundo LIVE, Git, secretos, deploy ni merge authority.

## Estado actual

**V4 / INTERNAL CREATOR CAPABILITY / ACTIVE / HEADLESS / HOLDOUT-GATED / AUTONOMOUS SOURCE-REPAIR READY.**

V4 conserva todo V3 y añade un loop genérico de reparación de source code para un agente externo autorizado. El agente puede recibir evidencia + snapshots acotados, proponer un `kelo-code-patch-v2`, recibir feedback de fallos y volver a intentarlo. La aceptación no depende de la confianza del agente: requiere el sandbox existente y un `objectiveScore` producido por el evaluador independiente del caller.

### Capacidades acumuladas V3

1. Search seeds separados de holdout seeds.
2. Paired seed-by-seed regression gate.
3. Pareto frontier antes del desempate escalar.
4. Fingerprint + novelty + dedupe.
5. Mutation bandit memory.
6. Stagnation escape.
7. Winner minimization.
8. Code Patch Candidate V2 con objective/tests/risk budget.
9. Code Patch Evaluator común.
10. Evidence manifest reproducible.

### Mejora principal V4

V4 cierra la deuda de “tener evaluador pero no loop de proposer”. El nuevo source proposer no da filesystem/Git/network al core. En su lugar orquesta dos callbacks inyectados:

- `agent(context)` — genera la propuesta dentro de un contexto acotado;
- `evaluate(candidate)` — produce sandbox report + objective score independiente.

Esto permite usar ChatGPT, otro agente autorizado o un runner remoto sin cambiar el contrato de seguridad de KeloEvolution.

## Owner y archivos

- Gate genérico: `src/creators/evolution/evolution-engine.mjs`.
- Memoria pura: `src/creators/evolution/evolution-memory.mjs`.
- Contrato code patch: `src/creators/evolution/code-patch-candidate.mjs`.
- Evaluador code patch: `src/creators/evolution/code-patch-evaluator.mjs`.
- **Source proposer V4:** `src/creators/evolution/source-code-proposer.mjs`.
- Sandbox Git externo: `scripts/kelo-code-evolution-sandbox.mjs`.
- Sandbox audit: `scripts/kelo-evolution-sandbox-audit.mjs`.
- **Source proposer audit:** `scripts/kelo-source-code-proposer-audit.mjs`.
- Map Forge adapter: `src/world/map-forge/map-forge-evolution.mjs`.
- Golden seeds: `src/world/map-forge/map-forge-golden-seeds.mjs`.
- Champion overrides: `src/world/map-forge/map-forge-champion-overrides.mjs`.
- Memoria persistible Map Forge: `docs/evolution/map-forge-memory.json`.
- Map Forge autopilot: `scripts/map-forge-evolution-autopilot.mjs` + `.github/workflows/kelo-evolution-autopilot.yml`.
- CI: `.github/workflows/kelo-evolution-ci.yml`.
- Evidencia visual: `tests/map-forge-evolution-visual.spec.js`.

## Estado que posee

El core no posee estado persistente. Toda API devuelve estructuras inmutables. Los callers deciden dónde persisten memoria/evidencia y quién tiene autoridad de Git.

El source proposer V4 tampoco posee state: devuelve contexto, intentos, feedback, evaluación y candidato final.

## Estado que NO posee

- gameplay/economía/HP/inventario;
- Map Forge generator/scorer;
- renderer/cámara/colisión/Property;
- publish del mundo;
- Git credentials o filesystem del runtime;
- shell arbitrario;
- merge/deploy;
- secretos;
- server gameplay authority.

## API genérica V3

### `createEvolutionMetricProfile()` / `scoreEvolutionMetrics()`

Métricas ponderadas `maximize|minimize`, normalización y hard gates `hardMin|hardMax`.

### `compareEvolutionEvaluations()`

Un challenger solo pasa si es válido, supera `minScore` y mejora al baseline al menos `minImprovement`.

### `evolutionFingerprint(value)`

Huella determinista de una estructura serializable.

### `computeEvolutionParetoFrontier(rows, objectives)`

Clasifica candidatos no dominados.

### `selectEvolutionCandidate()`

Aplica hard gates/score y puede priorizar Pareto frontier.

### `runEvolutionCycle()`

```js
await runEvolutionCycle({
  baseline,
  propose,
  evaluate,
  fingerprintCandidate,
  holdoutEvaluate,
  holdoutPolicy,
  prepare,
  cleanup,
  policy,
  apply,
  rollback,
  onExperiment
});
```

El baseline y challengers atraviesan la misma frontera de preparación/evaluación. Si hay holdout, solo el ganador provisional se valida allí. `apply` nunca corre antes de los gates.

### `runChampionChallengerTournament()`

Devuelve champion antes/después, ranking, Pareto frontier, duplicados, holdout y `rejectedStage`.

## Memoria V2

`createEvolutionMemory()` normaliza snapshots a `kelo-evolution-memory-v2`. Los records pueden guardar candidate ID/fingerprint, stage, score, holdout, mutaciones, métricas/fallos y evidence fingerprints.

`mutationPerformance()` calcula intentos/aceptación/delta. `mutationPriority()` añade exploración. `candidateSeenCount()` evita repetir candidatos históricos.

## Code Patch Candidate V2

`kelo-code-patch-v2` usa:

```text
baseSha
objective
changes[].path
changes[].beforeHash
changes[].afterContent
tests[]
fingerprint
```

Los paths están allowlisted, los paths sensibles están denegados, los tests mínimos se infieren por ruta y el risk budget se calcula antes del sandbox.

Defaults relevantes:

```text
src/creators/evolution/* → evolution
src/world/map-forge/*    → evolution + map-forge-core
docs/systems/*           → docs
tests/map-forge/*        → evolution + map-forge-handoff
```

Paths sensibles como `.env`, `.git`, `server/`, `supabase/`, secrets/credentials y service-role se rechazan antes de materializar.

## Code Patch Evaluator

`evaluateCodePatchSandboxReport()` traduce evidencia a métricas Evolution:

- validationSafety;
- syntaxPassRate;
- testPassRate;
- riskSafety;
- compactness;
- objectiveScore.

Validation, syntax y tests tienen hard gate 100 %. Para source repair V4, `objectiveScore` también es obligatorio y tiene un hard minimum configurado por el caller.

## Source Code Proposer V4

### `createSourceRepairPolicy()`

Define límites del agente:

- máximo de intentos;
- máximo de archivos de contexto;
- máximo de caracteres de contexto;
- minimum objective score;
- policy `kelo-code-patch-v2` reutilizada.

Defaults V4:

```text
maxAttempts = 3
maxContextFiles = 8
maxContextChars = 80,000
minObjectiveScore = 60
problem evidence = required
```

### `normalizeSourceProblem()`

Acepta únicamente problemas tipados:

```text
ci_failure
regression
measured_opportunity
```

Cada problema tiene `id`, `summary`, `baselineSha`, paths relevantes y evidencia.

### `buildSourceRepairContext()`

Recibe snapshots explícitos proporcionados por un runner autorizado. No busca archivos por sí mismo.

Reglas:

1. Filtra por el mismo allowlist/denylist del code patch.
2. Prioriza paths relacionados con el problema.
3. Solo un archivo con contenido completo + `beforeHash` entra en `writablePaths`.
4. Archivos fuera del presupuesto pueden aparecer omitidos, pero no se pueden modificar.
5. `server/`, `supabase/`, secretos y credenciales nunca entran al contexto.

### `validateSourceAgentProposal()`

Convierte la salida del agente en `kelo-code-patch-v2` y verifica:

- path presente en `writablePaths`;
- beforeHash idéntico al snapshot;
- no-op rechazado;
- objective requerido;
- rationale requerido;
- tests requeridos por path;
- file/byte/risk budget;
- denylist y path traversal.

### `runAutonomousSourceRepairCycle()`

```js
const result = await runAutonomousSourceRepairCycle({
  problem,
  snapshot,
  policy,
  agent: async ({ context, attempt, feedback }) => proposal,
  evaluate: async ({ candidate, problem, attempt }) => ({
    report: sandboxReport,
    objectiveScore
  })
});
```

Flujo:

```text
problema con evidencia
→ construir contexto mínimo
→ agent attempt 1
→ validar proposal
→ si falla: devolver failures al agente
→ si pasa: sandbox + objective evaluation
→ si falla: devolver failures al agente
→ bloquear fingerprints repetidos
→ agent attempt N
→ aceptar solo si sandbox + tests + objective hard gate pasan
→ devolver candidato; NO aplicar
```

### Regla de independencia

El agente **no puede darse a sí mismo el objective score**. El score solo entra desde `evaluate()`, que es una frontera separada. El caller puede usar CI, benchmark, evaluación funcional, paired metric u otro judge reproducible.

### Regla de reparación

Un intento fallido no habilita al agente a ampliar scope. Los mismos `writablePaths`, policy y límites continúan vigentes. Si el agente devuelve el mismo fingerprint, el intento se rechaza como `candidate_duplicate`.

## Sandbox

`scripts/kelo-code-evolution-sandbox.mjs` valida candidate/policy/risk/test coverage, verifica `baseSha`, crea `git worktree --detach`, verifica SHA-256 previo, aplica dentro del worktree, corre syntax + test IDs registrados, captura diff/report y limpia siempre.

No ejecuta shell commands provenientes del candidato.

## Map Forge Evolution V3

Map Forge conserva su genoma estructural, search bank + unseen holdout, paired regression gate, Pareto, novelty/dedupe, bandit de mutaciones, stagnation escape, winner minimization y evidence manifest.

V4 no reemplaza ese proposer especializado. El source proposer se usa cuando la hipótesis exige **cambiar código fuente**, mientras Map Forge V3 sigue prefiriendo evolución de datos/parámetros cuando ese contrato puede expresar la mejora.

## Autopilot y autoridad

Map Forge autopilot sigue:

```text
search → holdout → paired gate → minimization → PR → STOP
```

Source repair V4 sigue:

```text
problema/evidencia → agent → candidate → sandbox/objective → feedback/retry → candidate accepted → caller puede crear PR → STOP
```

**Ningún flujo de KeloEvolution auto-mergea.** GitHub PR + CI siguen siendo la autoridad de promoción.

## Invariantes

1. Hard gate prevalece sobre score alto.
2. Ningún code candidate se aplica antes de validación y sandbox.
3. Source agent solo puede modificar archivos visibles completos en `writablePaths`.
4. beforeHash del agente debe coincidir con el snapshot.
5. El agente no controla su objective score.
6. Un fingerprint repetido no se reevalúa dentro del mismo repair cycle.
7. Feedback de un fallo puede causar reintento, pero no ampliar authority/scope.
8. Code candidates no contienen shell commands arbitrarios.
9. Tests mínimos y risk budget se validan antes de promoción.
10. Browser/runtime no posee Git authority.
11. Autopilots crean PR y nunca auto-mergean.
12. Map Forge generator/scorer siguen siendo sus owners.
13. El source proposer no reemplaza proposers especializados cuando un contrato de datos ya existe.
14. Secrets/server/Supabase quedan fuera del scope por defecto.
15. Un caller remoto debe preservar los mismos IDs, hashes, policies y evidence contracts.

## Tests / CI

- `npm run audit:evolution`: gates, fingerprint/dedupe, Pareto, holdout, rollback, memory, code patch evaluator y Map Forge V3.
- `node scripts/kelo-source-code-proposer-audit.mjs`: contexto acotado, denylist, evidencia requerida, feedback de proposal inválida, segundo intento corregido, objective hard gate y dedupe de reintento.
- `npm run audit:evolution:sandbox`: detached worktree + beforeHash + mandatory tests + denied paths.
- `Kelo Evolution Engine CI`: syntax V4, V3 core audits, source proposer audit, sandbox audit, docs y Playwright Map Forge visual evidence.

## Online-first

Proposición, evaluación, aplicación y persistencia permanecen desacopladas. Un agent/runner remoto puede reemplazar cualquier caller manteniendo problem IDs, baseline SHA, beforeHash, candidate fingerprints, policies, test IDs y objective evidence.

Nada obliga a colocar autoridad crítica en el browser.

## Deuda pendiente real

- conectar un runner/agente persistente a V4 para vigilancia continua de CI y measured opportunities;
- visual judge semántico/vision como métrica secundaria;
- benchmark de FPS del runtime jugable;
- objective probes especializados adicionales para source patches fuera de Evolution/Map Forge;
- regeneración física parcial de chunks/distritos;
- storage remoto si experiment memory crece demasiado;
- protección de `main` sigue siendo configuración separada del repo.

## Cómo extender sin duplicar owner

- Nueva métrica: ampliar profile del owner.
- Nuevo dominio data-driven: adapter pequeño + `runEvolutionCycle()`.
- Nuevo source proposer: reutilizar `runAutonomousSourceRepairCycle()`; no crear otro repair engine.
- Nuevo code candidate: extender `kelo-code-patch-v2`; no meter filesystem/Git en el core.
- Nueva policy de tests/riesgo: `createCodePatchPolicy()`.
- Nuevo objective judge: implementarlo fuera del core y devolver `{report, objectiveScore}`.
- Map Forge: extender gene catalog/evaluator; no duplicar `map-forge-quality.mjs`.
- Persistencia: adaptar snapshots de memory; no meter storage en el core.
