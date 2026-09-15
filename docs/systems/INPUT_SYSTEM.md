# KeloInput — pipeline único de intención

## Propósito

`KeloInput` es el OWNER del pipeline de procesamiento de input del cliente durante la transición Foundation. Centraliza el único wrapper permitido alrededor del `processInput` legacy de `engine-a.js`, consulta `KeloInputLocks` y ofrece hooks ordenados para consumidores que necesitan derivar información del input sin volver a envolver el core.

```text
teclado / touch / joystick state
          ↓
      KeloInput
      ├─ consulta KeloInputLocks
      ├─ before hooks
      ├─ processInput legacy de engine-a
      └─ after hooks
          ↓
     intención procesada
```

## Owner

**API:** `window.KeloInput`  
**Fuente:** `src/core/input-system.js`  
**Lock state:** pertenece a `KeloInputLocks`, no a KeloInput.

## Responsabilidades

KeloInput posee:

- el único bridge Foundation alrededor de `processInput`;
- la decisión de ejecutar o bloquear el parser legacy según `KeloInputLocks`;
- limpieza de intención cuando existe un lock activo;
- hooks `before` y `after` con prioridad determinista;
- observabilidad del pipeline mediante `snapshot()`.

No posee:

- qué panel abre/cierra un lock;
- movimiento físico;
- colisiones;
- gameplay de habilidades;
- cámara;
- render;
- autoridad online.

## API

### `KeloInput.before(owner, fn, priority)`

Hook previo al parser legacy. Se usa solo para capacidades que realmente necesitan observar/preparar el estado antes de normalizarlo.

### `KeloInput.after(owner, fn, priority)`

Hook posterior al parser. Es el punto preferido para derivar información de la intención ya procesada.

Ejemplo actual:

```text
engine-f:legacy-aim → KeloInput.after(...)
```

Así `engine-f` mantiene `aim` sin envolver `processInput`.

### `KeloInput.unregister(id)`

Retira un hook.

### `KeloInput.isLocked()`

Consulta al owner `KeloInputLocks`.

### `KeloInput.snapshot()`

Devuelve versión, estado locked y lista de hooks registrados. No debe usarse como gameplay state.

## Locks

Los paneles reclaman input mediante:

```js
const token = KeloInputLocks.acquire('inventory');
```

KeloInput detecta el claim y evita llamar al parser legacy. También limpia:

- `normX/normY`;
- touch active/id;
- teclas activas;
- velocidad residual del jugador.

Cuando se libera el último lock, el siguiente `processInput()` vuelve a delegar normalmente.

## Compatibilidad

`KELO_MODAL_INPUT_LOCK` continúa como adapter temporal propiedad de `KeloInputLocks` para writers legacy.

El antiguo `src/core/input-gate.js` está **RETIRED**. No se carga desde `index.html` y no envuelve `processInput`.

`KeloInput` publica temporalmente `KELO_INPUT_GATE_AUDIT` como alias de diagnóstico para tests/herramientas antiguas mientras se migran.

## Hot path / rendimiento

Input corre en el loop del juego. Por eso Foundation evita emitir un evento global por cada frame solo para extensiones de input. Los hooks son arrays pequeños, ordenados al registrar y copiados al ejecutar para permitir unregister seguro.

Si el número de hooks crece significativamente, debe medirse antes de introducir otra estructura.

## Reutilización

Antes de añadir lógica relacionada con input:

- ¿necesitas bloquear input por una UI? → `KeloInputLocks`;
- ¿necesitas derivar aim/intent después del parser? → `KeloInput.after`;
- ¿necesitas transformar raw input antes? → `KeloInput.before` con justificación;
- ¿necesitas mover al actor? → `KeloMovement`, no KeloInput;
- ¿necesitas una habilidad? → owner de abilities; la habilidad puede consumir intent pero no apropiarse del pipeline.

## Invariantes

- Solo `src/core/input-system.js` asigna `processInput` fuera de la definición original legacy.
- `engine-f.js` no asigna `processInput`.
- `src/core/input-gate.js` no asigna `processInput` y no está cargado.
- Un lock evita que el parser legacy y los hooks posteriores reciban intención de ese frame.
- Sin lock, el parser base se ejecuta exactamente una vez.
- El orden de hooks es determinista.

## Online-first

KeloInput representa intención local, no autoridad. En multiplayer:

```text
local input
→ KeloInput
→ movement/combat request
→ server authority
```

No debe confiarse en input cliente como prueba de una acción económica o competitiva válida.

## Tests

`scripts/input-system-contract-audit.js` debe verificar:

- unlocked → base exactamente una vez;
- locked → base 0 y estado limpio;
- release → vuelve a procesar;
- before/after order;
- unregister;
- `engine-f` consume hook y no wrapper;
- gate antiguo retirado;
- orden de carga `engine-a → input-system → engine-f`.

## Estado

**FOUNDATION ACTIVE / TRANSITIONAL CORE BRIDGE**

Cuando el parser legacy salga de `engine-a.js`, KeloInput debe conservar su contrato público o migrarse mediante adapter.