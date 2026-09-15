# INPUT LOCK SYSTEM — KeloInputLocks

**Estado:** Foundation V1 · owner activo en la rama Foundation.  
**Código:** `src/core/input-lock-system.js`  
**API pública:** `window.KeloInputLocks`  
**Compatibilidad legacy:** `window.KELO_MODAL_INPUT_LOCK`

## Propósito

`KeloInputLocks` es el único owner de las reclamaciones temporales de input. Su trabajo es responder una sola pregunta de infraestructura:

> ¿Hay algún sistema que esté reclamando temporalmente el input del jugador?

No decide gameplay, no mueve al personaje, no abre paneles y no sabe qué significa PvP, mochila o Build Mode.

## Problema que resuelve

Antes de Foundation varios paneles escribían directamente `KELO_MODAL_INPUT_LOCK` y un hotfix final (`src/ui/force-unlock-move.js`) borraba locks periódicamente para evitar que el jugador quedara inmóvil. Ese patrón no escala: dos paneles pueden reclamar input y uno puede borrar el lock del otro.

El nuevo contrato usa claims independientes por token.

## Ownership

### Posee

- colección de claims activos;
- token de cada claim;
- owner semántico de cada claim;
- metadata opcional;
- adapter temporal para `KELO_MODAL_INPUT_LOCK`;
- snapshot/telemetría de owners activos.

### NO posee

- `localPlayer.x/y`;
- velocidad o física;
- joystick;
- DOM de paneles;
- `isBuildMode`;
- reglas de PvP;
- cámara;
- cooldowns;
- economía.

## API pública

### `acquire(owner, meta?) -> token`

Registra un claim independiente y devuelve un token único.

Ejemplo:

```js
const token = KeloInputLocks.acquire('inventory', { reason: 'modal-open' });
```

El caller debe conservar el token y liberarlo cuando termina su responsabilidad.

### `release(token) -> boolean`

Libera exclusivamente ese claim. Nunca debe liberar claims de otro owner.

### `releaseOwner(owner) -> number`

Limpieza explícita de todos los claims de un owner. Útil para recovery controlado, teardown o tests. No debe usarse como sustituto habitual de `release(token)`.

### `isLocked() -> boolean`

Indica si existe al menos un claim activo.

### `has(owner) -> boolean`

Indica si un owner concreto mantiene al menos un claim.

### `owners() -> readonly string[]`

Lista de owners activos.

### `snapshot(reason?)`

Snapshot de observabilidad con número de claims, owners y contador de cambios.

## Flujo correcto

```text
Panel abre
  ↓
KeloInputLocks.acquire('inventory')
  ↓
guarda token localmente
  ↓
el core consulta si hay lock
  ↓
panel cierra
  ↓
KeloInputLocks.release(token)
```

Dos paneles pueden coexistir:

```text
inventory token A ─┐
                   ├─ isLocked() = true
emotes token B ────┘

release(A)
  ↓
emotes sigue activo
  ↓
isLocked() = true

release(B)
  ↓
isLocked() = false
```

## Adapter legacy

Foundation redefine `window.KELO_MODAL_INPUT_LOCK` mediante getter/setter para que código antiguo siga funcionando durante la migración.

```js
KELO_MODAL_INPUT_LOCK = 'inventory';
```

se convierte internamente en un claim legacy.

```js
KELO_MODAL_INPUT_LOCK = null;
```

libera el claim legacy actualmente enfocado.

Este adapter es TRANSITORIO. Código nuevo debe usar tokens.

## Eventos

Si `KeloEvents` está disponible, cada cambio publica:

`input-locks:changed`

El payload viene de `snapshot()`.

Consumidores pueden observar cambios sin monkey-patchear el owner.

## Online-first

Este sistema es infraestructura cliente. No representa autoridad de gameplay y no necesita sincronizar sus claims al servidor.

Un modal local puede bloquear input visualmente sin cambiar la autoridad server sobre posición, combate o economía.

## Reutilización

Usar para:

- inventario abierto;
- personalizador;
- panel modal;
- transición que temporalmente no debe aceptar input;
- diálogos o overlays que necesiten exclusividad temporal.

No usar para:

- stun de combate;
- root/slow;
- cooldown;
- colisión;
- knockback;
- reglas de Build Mode persistentes.

Esos son estados de gameplay y deben pertenecer a sus owners.

## Anti-patrones

Incorrecto:

```js
setInterval(() => { KELO_MODAL_INPUT_LOCK = null; }, 200);
```

Incorrecto:

```js
localPlayer.vx = 0;
localPlayer.vy = 0;
```

desde una UI para simular ownership de movimiento.

Incorrecto:

```js
KELO_MODAL_INPUT_LOCK = null;
```

en código nuevo que no sabe quién creó el claim.

Correcto:

```js
let lockToken = null;
function open(){
  lockToken = KeloInputLocks.acquire('my-panel');
}
function close(){
  if (lockToken) KeloInputLocks.release(lockToken);
  lockToken = null;
}
```

## Tests

`scripts/input-lock-contract-audit.js` valida:

- dos claims coexistentes;
- release independiente;
- adapter legacy sin clobber de token claims;
- estado final limpio;
- publicación de eventos cuando `KeloEvents` existe.

## Observabilidad

`window.KELO_INPUT_LOCK_AUDIT`

expone versión y capacidades del contrato.

`KeloInputLocks.snapshot()` permite inspeccionar owners activos durante debugging.

## Deuda pendiente

- migrar cada UI legacy a `acquire/release(token)`;
- comprobar cómo el core consume actualmente `KELO_MODAL_INPUT_LOCK`;
- separar completamente Build Mode de modal input locks;
- retirar `force-unlock-move.js` solo cuando menú/PvP/touch/movement pasen smoke tests sin watchdog.

## Checklist para extender

Antes de añadir un nuevo tipo de lock:

1. ¿Es realmente input local o es un estado de gameplay?
2. ¿Puede reutilizar `acquire(owner, meta)` sin modificar el owner?
3. ¿El caller conserva y libera su token?
4. ¿Cerrar un panel deja intactos claims de otros owners?
5. ¿Existe test para el nuevo flujo si introduce una interacción especial?

Si las respuestas son sí, no hace falta crear otro sistema de locks.
