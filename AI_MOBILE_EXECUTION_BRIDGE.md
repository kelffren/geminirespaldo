# KELO WORLD — AI MOBILE EXECUTION BRIDGE

> **Objetivo:** definir cómo debe trabajar cualquier IA sobre Kelo World cuando el operador está en iPhone y no se quiere depender de una computadora personal.
>
> Este archivo es un puente operativo. No sustituye `AGENTS.md`, Foundation, ONLINE-FIRST, Bug Intelligence ni los contratos de sistema. Si hay contradicción, mandan esas leyes y el runtime LIVE.

## 1. Regla de entorno

Kelo opera el proyecto desde **móvil**. El flujo normal debe funcionar sin depender de que una PC del usuario esté encendida, conectada o disponible.

No recomendar como camino principal una solución que exija Windows/Mac local, VS Code local, navegador desktop conectado, túnel desde una computadora personal o cualquier paso que Kelo no pueda iniciar desde el teléfono.

Si una verificación obligatoria solo puede ejecutarse en un entorno no disponible, marcarla como `BLOCKED` o `INCONCLUSIVE`; nunca inventar un PASS.

## 2. Arquitectura del puente

```text
Kelo (iPhone)
    ↓ orden natural
IA en ChatGPT / agente
    ↓
GitHub connector → kelffren/gemini → main
    ↓
GitHub Pages LIVE → https://kelffren.github.io/gemini/
    ↓
TinyFish browser cloud → interacción real/QA del juego
    ↓
evidencia PASS / FAIL / INCONCLUSIVE
    ↓
GitHub connector → inspección / fix / commit
    ↓
repetir prueba atómica
```

Servicios auxiliares:

```text
AppDeploy → builds/probes aislados, snapshots QA, screenshots y errores runtime
GitHub Actions → CI, auditorías, imports, gates y automatizaciones del repo
```

## 3. Rol exacto de cada herramienta

### GitHub connector — fuente de trabajo

Usarlo para:

- leer `main` y HEAD actuales;
- inspeccionar archivos y owners antes de modificar;
- crear/actualizar archivos y commits;
- revisar workflows, CI, issues y evidencia;
- comprobar que el código que se cree desplegado realmente está en el repo.

No asumir una ruta, handler, botón o owner por memoria. Leer el estado actual.

### GitHub Pages — runtime LIVE

URL canónica de prueba pública:

```text
https://kelffren.github.io/gemini/
```

Un commit no significa automáticamente que el LIVE ya cambió. Cuando una prueba dependa del deploy, confirmar que Pages sirve la versión esperada antes de concluir.

### TinyFish — jugador/QA remoto

TinyFish es el navegador cloud para interactuar con Kelo World sin computadora local.

Usarlo para tareas que requieran:

- abrir el juego LIVE;
- pulsar botones;
- abrir menús;
- usar controles visibles;
- probar movimiento;
- entrar en World/Studio/Editor;
- intentar reproducir un freeze;
- comprobar qué responde antes/después de un fallo.

#### Regla crítica: tareas atómicas

**NO** pedir una misión enorme del tipo:

```text
carga → mueve → abre todos los menús → entra al editor → crea mapa → prueba 20 cosas → diagnostica
```

Una prueba larga ya consumió decenas de pasos y terminó por timeout antes de cerrar el diagnóstico.

Dividir siempre:

1. `MOVEMENT`: solo confirmar movimiento.
2. `OPEN-WORLD`: solo abrir World/Studio/Editor.
3. `MAP-LOAD`: solo iniciar carga del mapa y observar transición.
4. `FREEZE-REPRO`: solo reproducir el freeze conocido.
5. `POST-FIX`: repetir exactamente el flujo que fallaba.

Cada run debe tener **un objetivo principal**, una condición de PASS y una condición de FAIL/INCONCLUSIVE.

Preferir runs cortos y deterministas. Si el browser no identifica el control de forma fiable, devolver `INCONCLUSIVE`; no improvisar una conclusión.

### AppDeploy — QA auxiliar, no jugador principal

AppDeploy sirve para:

- levantar probes/builds aislados;
- verificar que una web construye/carga;
- obtener screenshots QA;
- ver errores frontend/network/backend cuando estén disponibles;
- probar pequeñas superficies independientes.

No asumir que AppDeploy sustituye a TinyFish para interacción compleja del juego. Si una ejecución devuelve snapshots pero no e2e interactivo, eso demuestra render/carga, no movimiento ni gameplay.

## 4. Protocolo obligatorio antes de tocar código

1. Leer `AGENTS.md`.
2. Leer `docs/KELO_FOUNDATION.md`.
3. Leer `ENGINE_MAP.md`.
4. Leer `docs/ONLINE_FIRST.md`.
5. Leer `docs/CODE_INDEX.md`.
6. Si es bug, leer `bugs/AI_BRIDGE.md`, Bug Intelligence y el registro canónico relacionado.
7. Leer este archivo.
8. Confirmar repo `kelffren/gemini`, rama `main` y HEAD actual.
9. Identificar owner real del sistema tocado.
10. Definir cómo se verificará el cambio **antes** de modificar.

## 5. Ciclo de trabajo estándar

```text
INSPECCIONAR
→ localizar owner + runtime LIVE
→ definir hipótesis/prueba
→ CAMBIAR lo mínimo
→ COMMIT
→ esperar/confirmar LIVE si aplica
→ QA ATÓMICO con TinyFish
→ clasificar evidencia
→ si falla: inspeccionar causa, no parchear a ciegas
→ corregir
→ repetir exactamente la misma prueba
→ solo entonces documentar resultado
```

### Para bugs

```text
REPRODUCIR
→ registrar evidencia
→ encontrar frontera/owner
→ reparar causa
→ prueba original
→ regresión dirigida
→ Bug Registry
→ VERIFIED solo con evidencia suficiente
```

No cambiar cinco sistemas a la vez para perseguir un freeze. Reducir primero el punto exacto donde deja de responder.

## 6. Estados de evidencia

Usar estas palabras con disciplina:

- `CONFIRMED PASS` — la prueba exacta terminó y el resultado esperado fue observado.
- `CONFIRMED FAIL` — la prueba exacta terminó y el fallo fue observado.
- `INCONCLUSIVE` — hubo interacción parcial, timeout, control ambiguo o evidencia insuficiente.
- `BLOCKED` — el entorno/herramienta impidió ejecutar la prueba requerida.
- `NOT TESTED` — no se ejecutó.

Nunca convertir:

```text
página cargó
```

en:

```text
juego funciona
```

Y nunca convertir:

```text
botón respondió
```

en:

```text
editor está arreglado
```

## 7. Evidencia mínima de una prueba LIVE

Guardar/reportar cuando exista:

- URL probada;
- commit/HEAD esperado;
- objetivo exacto;
- control usado;
- último estado que respondió;
- primer estado que falló;
- PASS/FAIL/INCONCLUSIVE;
- run URL de TinyFish, screenshot o evidencia equivalente si está disponible;
- errores visibles o de runtime relevantes.

Para freeze, registrar especialmente:

```text
ANTES DEL FREEZE
acción exacta
↓
última UI que responde
↓
evento/carga que comienza
↓
primer síntoma de bloqueo
↓
qué todavía responde y qué no
```

## 8. Relación con Playwright y gates existentes

Este puente **NO elimina** la `PLAYWRIGHT iPhone GATE` de `AGENTS.md` ni otros gates del repo.

- Si el agente dispone del entorno Playwright requerido, debe ejecutar la gate existente.
- TinyFish añade evidencia LIVE remota y permite operar sin la computadora personal de Kelo.
- Si el agente no puede ejecutar una gate requerida, debe declararlo explícitamente y no afirmar `VERIFIED` por sustitución silenciosa.

TinyFish es especialmente útil para reproducción LIVE independiente después de un fix.

## 9. Handoff entre IAs

Toda IA que entregue el trabajo a otra debe dejar un bloque como este:

```text
KELO AI HANDOFF
Repo: kelffren/gemini
Branch: main
LIVE: https://kelffren.github.io/gemini/
HEAD esperado: <sha>
Sistema/owner: <owner>
Objetivo: <una frase>
Cambio realizado: <archivos + resumen>
Bug ID: <BUG-NNNN o none>
Última prueba: <nombre>
Resultado: CONFIRMED PASS | CONFIRMED FAIL | INCONCLUSIVE | BLOCKED | NOT TESTED
Evidencia: <run/screenshot/log/commit>
Último estado bueno: <estado>
Primer estado malo: <estado>
Siguiente prueba atómica: <una sola acción>
No repetir: <intentos ya descartados>
```

La siguiente IA debe continuar desde ese estado, no empezar de cero salvo que la evidencia esté desactualizada o contradiga `main`/LIVE.

## 10. Regla para Kelo World Editor / freeze actual

Mientras se investigue el freeze de World/Studio/Editor, usar esta secuencia y no saltar pasos:

```text
TEST A — BOOT
¿LIVE carga y responde?

TEST B — MOVEMENT
¿el jugador se mueve en al menos 2 direcciones?

TEST C — OPEN EDITOR
¿el botón abre World/Studio/Editor?

TEST D — PRE-MAP
¿la UI del editor responde antes de cargar mapa?

TEST E — MAP START
¿qué acción exacta inicia la carga?

TEST F — FREEZE BOUNDARY
¿en qué primer punto deja de responder?

TEST G — POST-FIX
repetir E→F sin cambiar el procedimiento
```

No mezclar estos tests en un único run largo.

## 11. Qué no hacer

- No depender de una computadora personal de Kelo.
- No recomendar Opera Browser Connector como camino principal móvil si requiere desktop.
- No usar Work como único puente si el flujo puede agotarse por límites de uso.
- No declarar gameplay funcional solo por screenshot.
- No declarar bug arreglado solo por CI verde.
- No perseguir un freeze agregando watchdogs/parches sin encontrar la frontera del fallo.
- No crear implementaciones paralelas para evitar entender el owner existente.
- No repetir una prueba fallida cambiando varias variables a la vez.

## 12. Comando mental para cualquier IA

Cuando Kelo diga:

> "prueba el juego", "arregla esto", "continúa", "mira el freeze"

interpretar como:

```text
leer estado actual
→ localizar owner/bug
→ modificar GitHub solo si hace falta
→ confirmar LIVE
→ ejecutar UNA prueba TinyFish concreta
→ registrar evidencia
→ iterar
```

La meta del puente es que Kelo pueda dirigir el desarrollo completo desde el iPhone mientras las IAs usan infraestructura cloud para código, deploy y QA.
