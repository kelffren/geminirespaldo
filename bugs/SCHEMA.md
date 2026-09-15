# KELO WORLD — Bug Schema v2

Este documento define el contrato humano/IA para `/bugs`.

Schema v2 conserva el ciclo de vida existente y añade una memoria de investigación estructurada para impedir que agentes nuevos repitan diagnósticos, commits o pruebas ya descartadas.

## Bug canónico

Cada archivo `bugs/registry/BUG-NNNN.json` debe contener como mínimo:

- `schema_version`: entero. Los bugs activos deben usar `2` o superior.
- `id`: ID estable `BUG-NNNN`.
- `title`: síntoma corto, no teoría de causa.
- `status`: uno de los estados permitidos.
- `severity`: `critical | high | medium | low`.
- `area`: lista de áreas afectadas.
- `source`: `player | ai | test | human | monitoring | mixed`.
- `discovered_at`: fecha/hora ISO cuando se conoce; usar solo precisión real.
- `reported_by`: lista de orígenes/actores sin datos sensibles.
- `reports`: IDs de reportes crudos asociados.
- `environment`: entorno donde se observa; usar `null`/`unknown` si no se sabe.
- `reproduction`: pasos reproducibles.
- `expected`: comportamiento esperado.
- `actual`: comportamiento observado actualmente.
- `evidence`: referencias a logs, screenshots, Actions, BrowserStack u otras pruebas.
- `suspected_files`: pistas, nunca presentarlas como causa confirmada.
- `owner_hint`: owner/área probable según Foundation; puede ser `null`.
- `claimed_by`: agente/persona que lo reclama; `null` si libre.
- `claim_started_at`: ISO o `null`.
- `research`: expediente estructurado de diagnóstico.
- `attempt_history`: historial inmutable de intentos materiales.
- `next_best_actions`: acciones priorizadas por valor informativo.
- `fix`: objeto con `status`, `commits`, `files`, `summary`.
- `verification`: objeto con `status`, `method`, `evidence`, `verified_by`, `verified_at`.
- `blocked_by`: IDs de bugs/dependencias conocidas.
- `duplicate_of`: bug canónico si terminó siendo duplicado.
- `related_bugs`: IDs relacionados pero distintos.
- `notes`: hechos contextuales que no encajen mejor en campos estructurados.
- `updated_at`: última fecha/hora conocida de cambio.

## `research`

```json
{
  "status": "in_progress",
  "summary": "Comprensión compacta del problema a día de hoy.",
  "known_facts": [
    {
      "id": "F1",
      "statement": "Hecho verificable.",
      "evidence": ["referencia concreta"]
    }
  ],
  "hypotheses": [
    {
      "id": "H1",
      "theory": "Explicación posible.",
      "confidence": "low",
      "status": "unverified",
      "why": "Por qué explica el síntoma.",
      "evidence_for": [],
      "evidence_against": [],
      "test_next": "Experimento que mejor separa esta teoría de otras."
    }
  ],
  "ruled_out": [
    {
      "hypothesis_id": "H2",
      "theory": "Teoría descartada.",
      "reason": "Por qué ya no debe perseguirse.",
      "evidence": []
    }
  ],
  "unknowns": [
    {
      "id": "U1",
      "question": "Dato que falta.",
      "why_it_matters": "Qué decisión depende de él.",
      "quickest_test": "Prueba mínima que lo resuelve."
    }
  ],
  "external_references": [
    {
      "title": "Documentación oficial relevante",
      "url": "https://example.com",
      "lesson": "Conclusión operativa aplicable al bug."
    }
  ],
  "last_researched_at": null
}
```

Valores permitidos:

- `research.status`: `not_started | in_progress | sufficient | blocked`.
- `hypotheses[].status`: `unverified | supported | weakened | ruled_out | confirmed`.
- `hypotheses[].confidence`: `low | medium | high`.

`confirmed` significa causa demostrada por evidencia, no simplemente una teoría que parece convincente.

## `attempt_history`

Cada intento material recibe un ID estable `A1`, `A2`, ... y **nunca se borra aunque falle**.

```json
{
  "id": "A1",
  "at": "2026-09-14T00:00:00Z",
  "actor": "agent/human/test",
  "goal": "Qué se intentaba demostrar o corregir.",
  "hypothesis_ids": ["H1"],
  "change": {
    "commits": [],
    "files": [],
    "summary": "Cambio realizado; null si fue solo diagnóstico."
  },
  "validation": {
    "environment": "LIVE / iPhone / CI / etc.",
    "method": "Prueba ejecutada.",
    "result": "FAIL",
    "evidence": []
  },
  "conclusion": "Qué aprendimos realmente.",
  "do_not_repeat_without": "Qué evidencia nueva justificaría repetir este intento."
}
```

`validation.result` permite:

- `PASS`
- `FAIL`
- `PARTIAL`
- `NOT_RUN`
- `BLOCKED`

Todo intento `FAIL` debe incluir `do_not_repeat_without`.

## `next_best_actions`

Lista ordenada por prioridad diagnóstica:

```json
{
  "priority": 1,
  "action": "Experimento concreto.",
  "reason": "Por qué aporta más información ahora.",
  "expected_signal": "Qué observación decidirá entre hipótesis.",
  "stop_condition": "Cuándo detener este camino y pasar al siguiente."
}
```

No usar acciones vagas como `investigar`, `optimizar` o `probar otra cosa`.

## Reporte crudo

`bugs/incoming/REPORT-NNNNNN.json` representa una observación, no necesariamente un bug único.

Campos principales:

- `id`
- `created_at`
- `source`
- `player_description`
- `category`
- `screenshot_ref`
- `environment`
- `game_context`
- `diagnostics`
- `sanitized`
- `triage.status`
- `triage.bug_id`

Las capturas deben almacenarse fuera del repositorio; `screenshot_ref` contiene solamente una referencia segura.

## Máquina de estados

Transiciones normales:

`OPEN -> TRIAGED -> CLAIMED -> FIXED_PENDING_VERIFY -> VERIFIED -> CLOSED`

Transiciones adicionales:

- `OPEN|TRIAGED|CLAIMED -> BLOCKED`
- `BLOCKED -> TRIAGED|CLAIMED`
- `FIXED_PENDING_VERIFY -> REOPENED` si falla la verificación.
- `VERIFIED|CLOSED -> REOPENED` si reaparece en una versión aplicable.
- `OPEN|TRIAGED -> WONT_FIX` solo con razón explícita.

## Invariantes duras

1. `FIXED_PENDING_VERIFY` requiere al menos una corrección identificable: commit, patch o cambio concreto.
2. `VERIFIED` requiere `verification.status = PASS` y evidencia reproducible.
3. `CLOSED` requiere haber pasado primero por `VERIFIED`, salvo duplicados administrativos que apunten a otro bug canónico.
4. El agente que escribió el fix puede ejecutar tests, pero una validación independiente debe ser la base para `VERIFIED` en bugs críticos o user-facing.
5. Un bug que vuelve a aparecer se marca `REOPENED`; no se crea otro ID salvo que la causa/síntoma sea realmente distinto.
6. No modificar la reproducción o `actual` para hacer que un fix parezca correcto. Si cambia el síntoma, añadir nota/evidencia.
7. `suspected_files` y `owner_hint` son hipótesis hasta que exista causa raíz demostrada.
8. Nunca almacenar secretos o PII innecesaria.
9. Un intento fallido nunca se elimina del historial.
10. Una hipótesis descartada solo puede reabrirse con nueva evidencia registrada.
11. Antes de repetir un intento `FAIL`, debe cumplirse o invalidarse su `do_not_repeat_without`.
12. Todo bug activo debe indicar al menos una `next_best_action`, salvo que esté explícitamente bloqueado sin acción posible.

## Severidad

- `critical`: bloquea acceso, pérdida/corrupción grave, seguridad/autoridad, crash sistemático o rompe una ruta principal.
- `high`: feature principal inutilizable o regresión seria con workaround pobre.
- `medium`: defecto importante con workaround razonable.
- `low`: visual/menor, no rompe el flujo principal.

## Cierre correcto

Un cierre válido debe poder contestar:

1. ¿Qué bug exacto se reprodujo?
2. ¿Qué hechos lo demostraron?
3. ¿Qué hipótesis se probaron y cuáles se descartaron?
4. ¿Qué intentos anteriores fallaron y qué se aprendió de ellos?
5. ¿Cuál fue la causa raíz o el cambio que lo corrige?
6. ¿Qué commit(s) contienen el fix?
7. ¿Qué prueba independiente demuestra que ya no ocurre?
8. ¿En qué entorno/versión se verificó?

## Auditoría

Ejecutar:

`npm run audit:bugs`

Para un briefing rápido de un bug:

`npm run bug:brief -- BUG-0003`
