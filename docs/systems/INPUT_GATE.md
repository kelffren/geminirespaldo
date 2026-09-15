# INPUT GATE — retirado dentro de KeloInput

**Estado:** RETIRED COMPAT.  
**Código histórico:** `src/core/input-gate.js`  
**Reemplazo:** `src/core/input-system.js` / `window.KeloInput`.  
**Owner de locks:** `KeloInputLocks`.

## Qué cambió

El primer tramo de Foundation introdujo un bridge separado llamado Input Gate para impedir que los paneles siguieran peleándose por `processInput`.

Después se consolidó Input por completo en un owner explícito:

```text
KeloInputLocks  → claims de bloqueo
       ↓
KeloInput       → pipeline único de processInput
       ↓
KeloMovement / otros consumidores
```

Por tanto el archivo `src/core/input-gate.js` ya no está cargado por `index.html`, no envuelve `processInput` y no debe recibir funcionalidad nueva.

## Por qué no se borró todavía

Se conserva temporalmente porque tests, diagnósticos o caches históricos pueden conocer el nombre del archivo y `KELO_INPUT_GATE_AUDIT`.

`KeloInput` publica un audit compatible mientras dura la transición.

## Regla de reutilización

NO importar/cargar `input-gate.js`.

Para bloquear input:

```text
KeloInputLocks.acquire/release
```

Para observar o extender el pipeline:

```text
KeloInput.before/after
```

## Condición para borrar el archivo

Puede eliminarse cuando:

- ninguna referencia runtime lo cargue;
- ningún CI o diagnóstico necesite leerlo;
- no haya clientes/cache relevantes esperando el nombre;
- `KeloInput` esté validado en browser/móvil.

La documentación viva del sistema activo está en `docs/systems/INPUT_SYSTEM.md`.