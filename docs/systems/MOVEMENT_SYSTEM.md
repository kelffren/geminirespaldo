# KeloMovement — sistema de extensión de movimiento

## Propósito

`KeloMovement` es el OWNER de los puntos de extensión del movimiento del jugador mientras la física base siga viviendo en `engine-a.js`.

Su objetivo no es reemplazar la física existente, sino impedir que cada feature vuelva a envolver `updateMovement` por su cuenta.

```text
updateMovement legacy
       │
       ▼
   KeloMovement
   ├─ before hooks
   ├─ interceptors exclusivos
   ├─ física legacy exacta si nadie interceptó
   └─ after hooks
```

## Owner y responsabilidades

**Owner:** `window.KeloMovement`  
**Fuente:** `src/core/movement-system.js`

KeloMovement posee:

- hooks `before`;
- interceptores exclusivos ordenados;
- hooks `after`;
- orden determinista por prioridad;
- el único bridge permitido alrededor de `updateMovement` legacy.

No posee UI, input modal, colisiones, abilities, VFX, cámara, PvP ni render.

La colisión y desplazamiento físico normales siguen ejecutándose en el `updateMovement` original de `engine-a.js` durante esta fase transitoria.

## API pública

### `KeloMovement.before(owner, fn, priority)`

Se ejecuta antes de decidir cómo se moverá el actor. Sirve para gait, speed cap, preparación de telemetría u otras transformaciones reutilizables de intención.

### `KeloMovement.intercept(owner, fn, priority)`

Permite que una capacidad de movimiento dirigido gestione completamente ese frame. El interceptor devuelve `true` cuando ya resolvió el movimiento y la física normal no debe ejecutarse ese frame.

Usos válidos:

- dash interpolado;
- knockback dirigido;
- cutscene/scripted motion;
- transporte temporal que deba sustituir movimiento normal.

No debe usarse para UI ni para saltarse colisiones arbitrariamente. La primitive que lo usa sigue siendo responsable de respetar su contrato físico.

Si varios interceptores están registrados, el primero por prioridad que devuelve `true` gana ese frame. Los `after` hooks siguen ejecutándose, de modo que presentación y telemetría pueden observar la distancia realmente recorrida.

### `KeloMovement.after(owner, fn, priority)`

Se ejecuta después del movimiento normal o del interceptor ganador. Sirve para stride, límites post-física, telemetría y compatibilidad que necesita observar la posición resultante.

### `KeloMovement.unregister(id)`

Retira cualquier hook/interceptor registrado.

### `KeloMovement.snapshot()`

Expone owners y prioridades de `before`, `intercept` y `after` para depuración/arquitectura.

## Orden Foundation actual

```text
before
  10 engine-ac:gait-speed

intercept
  10 engine-g:legacy-dash   ← solo gana mientras dashTween está activo

física engine-a             ← se ejecuta si ningún interceptor manejó el frame

after
  20 engine-ac:visual-motion
  30 engine-ah:release-brake
  40 engine-ai:cafe-room-clamp
```

Esto preserva el comportamiento anterior sin wrappers encadenados:

1. `engine-ac` decide gait/speed.
2. Si hay dash legacy activo, `engine-g` interpola y devuelve `true`; si no, corre la física de `engine-a`.
3. `engine-ac` mide el desplazamiento real para stride.
4. `engine-ah` conserva el freno al soltar.
5. `engine-ai` limita al jugador al interior del café cuando aplica.

## Invariantes

- Solo `src/core/movement-system.js` asigna `updateMovement` fuera de la definición original de `engine-a.js` en Foundation.
- `engine-g`, `engine-ac`, `engine-ah` y `engine-ai` no vuelven a envolver `updateMovement`.
- La física original se ejecuta exactamente una vez cuando ningún interceptor maneja el frame.
- Si un interceptor devuelve `true`, la física normal no se ejecuta ese frame.
- Los `after` hooks se ejecutan en ambos casos.
- El orden es determinista.
- Los hooks no dependen de DOM/UI.

## Reutilización

Antes de tocar movimiento:

1. Solo necesitas preparar el frame → `before`.
2. Necesitas sustituir temporalmente el movimiento normal → `intercept`.
3. Necesitas observar/ajustar el resultado → `after`.
4. Es input → pertenece al owner de Input.
5. Es colisión → pertenece a Collision.
6. Es una nueva ability → la ability debe usar una primitive genérica que se conecte a KeloMovement; no añadir lógica de la habilidad directamente al owner.

## Migración legacy realizada

- `engine-g`: dash tween → `intercept`.
- `engine-ac`: gait/speed → `before`; stride/audit → `after`.
- `engine-ah`: release brake → `after`.
- `engine-ai`: café room clamp → `after`.

Los otros comportamientos legacy de esos archivos siguen clasificados aparte; esta migración solo consolidó ownership de movimiento.

## Online-first

KeloMovement es un owner de ciclo/extension points del cliente, no autoridad final online de posición. En multiplayer autoritativo:

```text
input intent
→ prediction/request
→ server authority
→ authoritative position
→ reconciliation
```

Los hooks de presentación pueden permanecer clientes; las primitives de movimiento competitivo deberán poder delegar la decisión final al servidor.

## Tests

`scripts/movement-system-contract-audit.js` verifica:

- before/after y prioridades;
- base exactamente una vez;
- interceptor salta base;
- after sigue corriendo tras intercept;
- unregister;
- ausencia de wrappers en g/ac/ah/ai;
- registro correcto de cada consumidor;
- orden de carga en `index.html`.

## Estado

**FOUNDATION ACTIVE / TRANSITIONAL CORE BRIDGE**

Cuando la física salga de `engine-a.js`, se conservará la API pública o se migrará mediante adapter antes de retirar este bridge.