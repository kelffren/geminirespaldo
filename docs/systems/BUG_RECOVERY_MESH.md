# Kelo Recovery Mesh

**Estado:** internal diagnostic capability v1  
**Owner:** `/bugs` Bug Intelligence + existing Bug observability runtime + GitHub Actions QA.  
**No es un engine ni un auto-healer.** No posee gameplay, World, input, render, auth ni persistencia de jugador.

## Propósito

Recovery Mesh reduce el tiempo entre **“algo se rompió”** y **“sabemos la frontera exacta donde se rompe”**. Combina un flight recorder opt-in en navegador, milestones de carga, perfiles deterministas de Playwright, cuarentena diagnóstica de lazy feature packs, búsqueda binaria de regresiones y checkpoints de commits.

No promete que Kelo World no tendrá bugs. Su contrato es que un bug nuevo deje evidencia suficiente para aislarlo, reproducirlo, localizar su rango y volver a un punto conocido sin depender de la computadora personal del operador.

## Fuentes

- `src/core/bug-observability.mjs` — owner runtime de milestones, errores, Freeze Locator y Recovery Mesh.
- `src/core/module-loader.js` — emite fronteras de lazy-load y acepta cuarentena **solo** en recovery mode.
- `scripts/recovery-profile-runner.mjs` — perfiles cloud `boot | movement | world | full`.
- `scripts/recovery-bisect.mjs` — git bisect automatizado con perfiles allowlisted.
- `scripts/recovery-mesh-audit.mjs` — guard Foundation del propio sistema.
- `.github/workflows/recovery-lab.yml` — ejecución cloud manual desde GitHub/ChatGPT.
- `.github/workflows/recovery-checkpoints.yml` — conserva checkpoints CI-green y checkpoints manuales.
- `bugs/RECOVERY_MESH.md` — playbook operativo para agentes.

## Estado que posee

Solo diagnóstico:

- ring buffer de eventos en `sessionStorage`;
- survivor snapshot sanitizado en `localStorage` cuando Recovery Mesh está explícitamente activo;
- HUD diagnóstico opt-in;
- artifacts de CI en `recovery-artifacts/`;
- tags Git `recovery-ci-green-*` y `recovery-manual-*`.

## Estado que NO posee

- gameplay/player position/HP;
- editor/world draft;
- input locks;
- render loop;
- auth/session authority;
- economía/inventario;
- bug lifecycle (`VERIFIED`, `CLOSED`, etc.);
- deploy/rollback automático de `main`.

## Activación runtime

Recovery Mesh no forma parte del boot normal.

```text
?recoveryLab=1
```

Opciones:

```text
&recoveryFlow=world-open
&bug=BUG-0003
&recoveryHud=0
&recoverySkip=world,social
```

`freezeLab=1` activa Recovery Mesh + Freeze Locator específico de World.

Ejemplo:

```text
/?aiGuest=1&creators=1&recoveryLab=1&recoveryFlow=world-open&bug=BUG-0003
```

## Flight recorder

`installRecoveryMesh()` registra, cuando la plataforma lo soporta:

- `window.error` y `unhandledrejection`;
- último input recibido;
- cambios de superficie (`auth`, `game`, `menu`, `creators`, `studio`);
- recursos JS/MJS/CSS relevantes y su duración;
- eventos del `KeloModuleLoader`;
- event-loop gaps;
- Long Tasks;
- Long Animation Frames (LoAF) + script attribution cuando el navegador lo expone;
- `pagehide`, `pageshow`, `visibilitychange`;
- último milestone y último recurso en un survivor snapshot.

Si el proceso web muere sin lanzar una excepción, la siguiente sesión diagnóstica puede detectar un snapshot anterior todavía marcado `active` y generar `PREVIOUS_UNCLEAN_SESSION` con la última frontera conocida.

### API

```js
const mesh = window.KELO_RECOVERY_MESH;
mesh.mark('MY_PHASE_START', { id: 'x' });
mesh.report();
mesh.read();
mesh.last();
mesh.shouldSkip('world');
mesh.destroy();
```

Un owner puede emitir milestones, pero **no** debe delegar su corrección o estado a Recovery Mesh.

## Cuarentena diagnóstica

`KeloModuleLoader` soporta:

```text
?recoveryLab=1&recoverySkip=world
```

Solo feature packs del loader pueden quedar omitidos. Fuera de Recovery mode, `recoverySkip` no tiene efecto.

La cuarentena sirve para responder preguntas como:

> “¿El freeze desaparece si este pack no se descarga?”

No es feature flag de producción ni workaround permanente.

## Perfiles deterministas

### `boot`

Comprueba canvas, `localPlayer`, boot-ready y latencia de una evaluación simple.

### `movement`

Hace boot, mueve durante 8 s y verifica desplazamiento + event-loop pings.

### `world`

Abre Creators directamente, activa el workspace `World`, exige `#kelo-studio-live`, espera que deje loading y comprueba varias respuestas del hilo principal.

### `full`

Boot + movement + World.

Resultado de CLI:

- `0` = PASS;
- `1` = comportamiento probado FAIL;
- `125` = checkout/infraestructura no testeable; compatible con `git bisect run` skip.

## Bisección automática

```bash
npm run recovery:bisect -- --good=<known-good> --bad=HEAD --profile=world
```

El bisector:

1. valida refs;
2. levanta servidor estático cloud/local;
3. conserva el runner en `/tmp` para que siga existiendo al cambiar de commit;
4. ejecuta `git bisect run` con un perfil allowlisted;
5. usa `125` para revisiones no testeables;
6. guarda `bisect.log` y `bisect-report.json`;
7. resetea el árbol al finalizar.

El commit encontrado es **primer sospechoso reproducible**, no causa raíz demostrada. Debe inspeccionarse y reproducirse antes de acusar su cambio.

## GitHub Recovery Lab

`.github/workflows/recovery-lab.yml` permite desde la nube:

- `current`: ejecutar un perfil sobre HEAD;
- `bisect`: localizar el primer commit malo entre good/bad.

Siempre guarda artifacts. Esto permite que Kelo opere desde iPhone sin dejar una PC encendida.

## Checkpoints

`recovery-checkpoints.yml` mantiene dos familias:

- `recovery-ci-green-*`: automáticos después de `Kelo Quality Ratchet` verde en `main`;
- `recovery-manual-*`: creados solo mediante dispatch explícito para un SHA que ya fue validado por el operador/agente.

Se conservan los 10 más recientes de cada familia.

**CI-green no significa “bug-free” ni “iPhone verified”.** Solo significa que el Quality Ratchet aplicable pasó para ese SHA.

## Flujo de desatasco

```text
SÍNTOMA
  ↓
Recovery Mesh / Freeze Locator
  ↓
última frontera + recurso + stall + error
  ↓
perfil mínimo reproducible
  ↓
¿regresión reciente?
  ├─ NO → hypotheses / targeted experiment
  └─ SÍ → automatic git bisect
               ↓
          first bad candidate
               ↓
          bug:risk + bug:impact
               ↓
          fix pequeño
               ↓
          same recovery profile
               ↓
          LIVE/real-device acceptance
```

## Dependencias

- `/bugs` registry y Research Protocol;
- Git;
- GitHub Actions;
- Node 22;
- Playwright 1.62 / Chromium para perfiles cloud;
- BrowserStack real device sigue siendo gate separado cuando el bug exige Safari/iPhone físico.

## Online-first

Recovery Mesh no contiene autoridad de juego ni datos compartidos. Si más adelante los reports se envían al backend, el navegador entregará un envelope sanitizado a un adapter de reporting; dedupe, IDs canónicos, lifecycle y retención seguirán del lado server/triage.

## Invariantes

1. Diagnóstico opt-in: nada pesado se descarga por defecto.
2. Nunca auto-modifica estado de gameplay para “destrabar”.
3. Nunca auto-cierra bugs.
4. Nunca convierte un checkpoint CI-green en “verificado en iPhone”.
5. Quarantine solo funciona con recovery mode explícito.
6. Los perfiles son allowlisted; no se acepta shell arbitrario desde workflow inputs.
7. Artifacts y snapshots deben estar sanitizados; no guardar tokens/cookies/JWT/passwords.
8. Un `first bad` de bisect es correlación reproducible, no causalidad demostrada.
9. El fix siempre se valida con el mismo perfil que lo clasificó y después con el entorno real aplicable.

## Anti-patrones

- watchdog que corrige posición/input/render para ocultar el bug;
- `try/catch` que traga un error para conseguir verde;
- saltarse un módulo en producción porque en recovery mode evitó un freeze;
- revertir `main` automáticamente sin aprobación;
- guardar URLs completas con secretos en diagnóstico;
- llamar `VERIFIED` a un Playwright Chromium PASS cuando el defecto original solo ocurre en Safari iPhone.

## Tests / CI

```bash
npm run audit:recovery
npm run recovery:profile -- --profile=boot
npm run recovery:profile -- --profile=world
npm run recovery:bisect -- --good=<sha> --profile=world
```

Recovery Lab guarda JSON + screenshots de fallo + logs como artifact.

## Observabilidad

Eventos principales:

- `RECOVERY_START`
- `PREVIOUS_UNCLEAN_SESSION`
- `SURFACE_CHANGE`
- `RESOURCE_READY`
- `EVENT_LOOP_STALL`
- `EVENT_LOOP_SEVERE_STALL`
- `LONG_TASK`
- `LONG_ANIMATION_FRAME`
- `MODULE_LOAD_START/END/ERROR`
- `MODULE_QUARANTINED`
- `FAIL`

## Deuda / siguientes capas

- añadir perfiles específicos para PvP, Backpack, Property y login cuando sus acceptance contracts estén estables;
- conectar report bundles sanitizados al futuro backend de bug reporting;
- añadir comparación automática entre survivor snapshots y recent commits;
- usar dispositivo real cuando vuelva a estar disponible BrowserStack Automate;
- no convertir la capa diagnóstica en lógica normal del juego.

## Checklist de extensión

Antes de añadir soporte para otro subsistema:

1. definir el flujo mínimo que prueba la capacidad;
2. elegir milestones del owner real;
3. añadir un perfil allowlisted solo si aporta una clasificación determinista;
4. guardar evidencia sin secretos;
5. definir qué resultado es PASS/FAIL/SKIP;
6. añadir regression contract al bug correspondiente;
7. mantener cualquier bypass/quarantine fuera del runtime normal.
