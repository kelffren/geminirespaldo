# KELO WORLD — Bug Research Protocol

Este protocolo convierte cada bug en un **expediente vivo de investigación**. Su objetivo es que un agente nuevo pueda continuar desde el punto exacto donde quedó el anterior sin repetir hipótesis, commits o pruebas que ya fallaron.

## Principio

Un bug serio no es solamente `síntoma + fix candidate`.

Debe conservar cuatro capas distintas:

1. **HECHOS** — observaciones demostradas por evidencia.
2. **HIPÓTESIS** — explicaciones posibles, con estado y confianza.
3. **INTENTOS** — cambios/pruebas ya realizados y su resultado real.
4. **SIGUIENTES ACCIONES** — experimentos de mayor valor informativo, priorizados.

Nunca mezclar estas capas. Una hipótesis plausible no es un hecho. Un commit existente no es un fix exitoso. Un test local verde no es una verificación LIVE.

## Fast path obligatorio para cualquier agente

Antes de editar código de un bug existente:

1. Ejecutar `npm run bug:brief -- BUG-NNNN` o leer el JSON canónico completo.
2. Leer `research.summary` y `research.known_facts`.
3. Revisar **todos** los `attempt_history` para no repetir un intento fallido.
4. Revisar `research.hypotheses`, especialmente `ruled_out` y evidencia en contra.
5. Revisar `research.unknowns`.
6. Tomar primero una entrada de `next_best_actions`, salvo que nueva evidencia demuestre que dejó de ser la mejor acción.
7. Revalidar el `main` actual antes de asumir que los archivos/commits antiguos siguen representando el runtime.

## Hechos

Cada hecho debe ser pequeño, verificable y tener un ID estable (`F1`, `F2`, ...).

Buen hecho:

> `F2`: En LIVE, 80 módulos de Studio fueron solicitados pero `#kelo-studio-live` no montó dentro de 15 s. Evidencia: QA LIVE 2026-09-14.

Mal hecho:

> Studio es demasiado pesado.

Lo segundo es una hipótesis hasta demostrarlo.

## Hipótesis

Cada hipótesis usa un ID (`H1`, `H2`, ...), confianza y estado:

- `unverified`
- `supported`
- `weakened`
- `ruled_out`
- `confirmed`

Una hipótesis debe incluir:

- teoría concreta;
- por qué podría explicar el síntoma;
- evidencia a favor;
- evidencia en contra;
- el siguiente test que más información aportaría.

No subir una hipótesis a `confirmed` por intuición ni porque un fix parezca razonable.

## Intentos

Todo intento material queda en `attempt_history`, incluso si FALLA.

Cada intento debe registrar:

- ID `A1`, `A2`, ...;
- objetivo;
- hipótesis que estaba probando;
- commit(s) y archivos si hubo cambios;
- método/entorno de validación;
- resultado: `PASS | FAIL | PARTIAL | NOT_RUN | BLOCKED`;
- conclusión aprendida;
- `do_not_repeat_without`: qué evidencia nueva justificaría repetirlo.

**Nunca borrar intentos fallidos.** Son conocimiento adquirido.

Un intento `FAIL` es útil si reduce el espacio de búsqueda.

## Ruled out

`research.ruled_out` resume teorías que ya no deben consumir tiempo. Solo añadir una teoría aquí cuando exista evidencia suficiente para descartarla en el contexto descrito.

Si nueva evidencia contradice el descarte, no borrar el historial: cambiar la hipótesis y explicar por qué se reabre.

## Unknowns

Una buena investigación conserva lo que todavía NO se sabe.

Cada unknown debe responder:

- pregunta pendiente;
- por qué importa;
- cuál es el test más barato/determinista que puede resolverla.

Esto evita que un agente confunda ausencia de datos con confirmación.

## Next best actions

Las acciones se ordenan por valor informativo, no por cantidad de código.

Cada acción debe tener:

- `priority`;
- acción concreta;
- razón;
- señal esperada;
- condición de parada.

Preferir experimentos que separen dos o más hipótesis entre sí.

No usar acciones vagas como `investigar más`, `mejorar performance` o `probar cosas`.

## Investigación externa

Cuando el fallo involucre una API, framework, navegador, dispositivo, SDK o servicio externo:

1. buscar primero documentación oficial y changelogs aplicables a la versión real;
2. registrar referencias útiles en `research.external_references`;
3. guardar solamente la conclusión operativa relevante, no copiar páginas enteras;
4. separar comportamiento documentado de comportamiento observado en KELO WORLD.

## Criterio de éxito

La investigación está `sufficient` cuando un agente nuevo puede responder sin reconstruir chats:

1. ¿Qué ocurre exactamente?
2. ¿Qué hechos están demostrados?
3. ¿Qué causas siguen vivas y cuáles fueron descartadas?
4. ¿Qué se intentó ya?
5. ¿Cada intento funcionó, falló o quedó sin verificar?
6. ¿Qué NO debe repetirse?
7. ¿Cuál es el siguiente experimento de mayor valor?
8. ¿Qué prueba exacta demostraría que el bug está realmente resuelto?

## Regla de oro

`NO REPETIR SIN NUEVA EVIDENCIA.`

Si un agente quiere repetir un intento marcado `FAIL`, debe registrar primero qué cambió desde ese intento y por qué ahora podría producir información nueva.
