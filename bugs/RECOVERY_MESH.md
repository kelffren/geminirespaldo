# KELO WORLD — Recovery Mesh Playbook

Este documento es el **manual de desatasco universal** para humanos e IAs. Complementa `bugs/AI_BRIDGE.md`; no reemplaza el registry, Schema ni Research Protocol.

## Objetivo

Cuando un bug sea duro, no empezar parchando. Convertirlo primero en una frontera medible.

```text
SÍNTOMA → FLIGHT RECORDER → PERFIL MÍNIMO → AISLAMIENTO → BISECT SI APLICA → FIX → MISMO PERFIL → LIVE/REAL TARGET
```

## 0. Regla

Recovery Mesh no promete cero bugs. Promete que un fallo nuevo deja breadcrumbs suficientes para reducir rápido el espacio de búsqueda.

Nunca usar la infraestructura para esconder el síntoma. `PASS` exige que el flujo real vuelva a funcionar.

## 1. Activar black box

Para un fallo general:

```text
/?aiGuest=1&recoveryLab=1&recoveryFlow=<flujo>&bug=BUG-NNNN
```

Para el freeze de World:

```text
/?aiGuest=1&creators=1&recoveryLab=1&freezeLab=1&recoveryFlow=world-open&bug=BUG-0003
```

El HUD muestra superficie, último milestone, último recurso, event-loop gaps, long tasks/frames y último input.

## 2. Capturar antes de tocar código

Obtener cuando sea posible:

- `window.KELO_RECOVERY_MESH.report()`;
- `window.KELO_FREEZE_LOCATOR.report()` si aplica;
- screenshot/video del síntoma;
- build/SHA;
- último milestone;
- último recurso/módulo;
- mayor stall;
- primer error/rejection;
- si la sesión anterior quedó `PREVIOUS_UNCLEAN_SESSION`.

Registrar lo útil en el BUG canónico. No guardar secretos.

## 3. Elegir el perfil mínimo

```bash
npm run recovery:profile -- --profile=boot
npm run recovery:profile -- --profile=movement
npm run recovery:profile -- --profile=world
npm run recovery:profile -- --profile=full
```

Usar el perfil más pequeño que todavía reproduzca.

- si `boot` falla, no investigar Studio todavía;
- si `boot` pasa pero `movement` falla, el rango se reduce a input/loop/movement;
- si ambos pasan y `world` falla, concentrarse en Creators/Studio;
- `full` es aceptación amplia, no primera herramienta de diagnóstico.

## 4. Cuarentena de feature packs

Solo para packs cargados por `KeloModuleLoader`:

```text
?recoveryLab=1&recoverySkip=social
?recoveryLab=1&recoverySkip=world
?recoveryLab=1&recoverySkip=world,social
```

Si el fallo desaparece, eso solo demuestra que el pack está dentro del rango causal o de presión de recursos. No dejar el pack apagado como “fix”.

## 5. Regresión reciente → bisect

Si existe un commit known-good y uno bad:

```bash
npm run recovery:bisect -- --good=<SHA_BUENO> --bad=HEAD --profile=<perfil>
```

En GitHub Actions usar **Kelo Recovery Lab → mode: bisect**.

El resultado `firstBad` es el primer checkout donde el perfil falla. Después:

1. inspeccionar diff;
2. cruzar con `bug:risk`;
3. cruzar con `bug:impact`;
4. reproducir ese commit y su padre;
5. solo entonces elevar una hipótesis de causa.

## 6. Si no es regresión clara

Usar evidencia del recorder para partir el flujo por fronteras:

```text
INPUT
→ FEATURE REQUEST
→ RESOURCE/MODULE START
→ RESOURCE/MODULE END
→ OWNER MOUNT
→ FIRST INTERACTION
→ READY
```

Añadir milestones al **owner real**, no crear otro manager.

El último milestone completado y el primero ausente forman la frontera de investigación.

## 7. Event-loop freeze

Señales:

- `EVENT_LOOP_STALL` >= 700 ms;
- `EVENT_LOOP_SEVERE_STALL` >= 2000 ms;
- Long Task/LoAF cerca del síntoma;
- recurso/script atribuido cuando el navegador lo soporte.

Si hay muchos recursos pero ningún error, sospechar evaluación/parse/layout/rAF/memoria antes de inventar una excepción JS.

## 8. Black tab / WebContent kill

Safari puede matar el proceso sin `window.error`.

Recovery Mesh conserva un survivor snapshot opt-in. Si al siguiente arranque aparece:

```text
PREVIOUS_UNCLEAN_SESSION
```

leer:

- `previousMilestone`;
- `previousResource`;
- `previousSurface`;
- `previousUpdatedAt`.

Eso permite ubicar el kill incluso sin stack trace.

## 9. Checkpoints

Automáticos:

```text
recovery-ci-green-*
```

Manual/validado externamente:

```text
recovery-manual-*
```

No confundirlos. CI-green solo afirma que `Kelo Quality Ratchet` pasó.

Antes de un refactor grande, anotar el checkpoint conocido que sirve como baseline.

## 10. Fix

El fix debe ser el cambio más pequeño que explica la evidencia.

Después:

1. repetir exactamente el perfil que fallaba;
2. repetir el caso negativo/reopen si aplica;
3. ejecutar `bug:risk` / `bug:impact`;
4. ejecutar gates `/bugs`;
5. validar LIVE/target real;
6. dejar regression protection.

## 11. Matriz de estados

| Señal | Lectura |
|---|---|
| perfil PASS + LIVE FAIL | diferencia de entorno/deploy/cache/device |
| perfil FAIL desde boot | no perseguir feature secundaria |
| resource start sin end | red/evaluación/script load boundary |
| resource end + severe stall | evaluación/initialization/layout/rAF después de carga |
| no JS error + unclean session | posible tab/process kill |
| quarantine elimina síntoma | pack relacionado; no es fix |
| bisect encuentra commit | regresor reproducible; todavía no causa confirmada |
| Chromium PASS, iPhone real FAIL | bug mobile/Safari sigue abierto |

## 12. Para cualquier IA nueva

Antes de arreglar un bug duro, debe poder responder:

1. ¿Cuál es el BUG canónico?
2. ¿Cuál es el perfil mínimo que lo reproduce?
3. ¿Cuál fue el último milestone bueno?
4. ¿Cuál fue el primer milestone ausente/malo?
5. ¿Hubo stall, error, crash o proceso muerto?
6. ¿Cuál fue el último recurso?
7. ¿Hay known-good SHA?
8. ¿Vale la pena bisect?
9. ¿Qué intentos FAIL no deben repetirse?
10. ¿Qué prueba independiente cerraría el bug?

Si no puede responder, **diagnosticar primero**.

## 13. Comandos rápidos

```bash
npm run audit:recovery
npm run bug:health
npm run bug:brief -- BUG-NNNN
npm run recovery:profile -- --profile=world
npm run recovery:bisect -- --good=<sha> --profile=world
npm run bug:risk -- <base> <head>
npm run bug:impact -- --diff <base> <head> --depth=2
```

## Regla final

**NO MÁS “se frizó”.**

A partir de Recovery Mesh el reporte debe intentar decir:

> “Último milestone X, último recurso Y, stall Z ms, superficie W; el siguiente milestone nunca ocurrió.”

Eso es una pista accionable para cualquier agente.
