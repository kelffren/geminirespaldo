# KeloAvatar — composición del actor

## Propósito

`KeloAvatar` es el OWNER único del punto global `renderAvatar` durante la migración Foundation. Evita que renderers históricos se sustituyan o envuelvan entre sí sin un contrato explícito.

La cadena LIVE preservada es:

```text
renderAvatar
   │
   ▼
KeloAvatar
   ├─ middleware 200: Character Appearance
   │       └─ fallback
   ├─ middleware 100: hero.PNG de engine-ab
   │       └─ fallback
   └─ base: engine-w
```

Durante el boot `engine-d`, `engine-e` y `engine-w` llaman `setBase()` en ese orden. El último base queda activo, igual que ocurría cuando cada archivo reasignaba directamente `renderAvatar`.

## Owner

**Owner:** `window.KeloAvatar`  
**Fuente:** `src/core/avatar-render-system.js`

## API pública

### `KeloAvatar.setBase(owner, fn)`

Sustituye el renderer base. Se usa únicamente para migrar reemplazos históricos cuyo comportamiento era “el último cargado gana”.

### `KeloAvatar.use(owner, fn, priority)`

Registra middleware condicional con firma:

`fn(actor, isSelf, next, context)`

El middleware puede dibujar y terminar, o llamar `next()` para delegar al siguiente fallback. Mayor prioridad significa capa más externa.

### `KeloAvatar.unregister(id)`

Retira middleware registrado.

### `KeloAvatar.snapshot()`

Expone base owner, revisión y middleware/prioridades para auditoría.

## Invariantes

- Solo `src/core/avatar-render-system.js` puede reasignar directamente `renderAvatar` después de `engine-c`.
- `engine-d`, `engine-e` y `engine-w` cambian el base mediante `setBase()`.
- `engine-ab` y `character-appearance` usan middleware y no tocan el global.
- Un middleware que llama `next()` más de una vez no provoca dobles draws: `next` es idempotente por invocación.
- Avatar es presentación; no decide daño, economía ni autoridad online.
- Los manifests de Universal Sprite Ingestion pueden declarar `directions` y `frameCounts` dinámicos para rigs 1D, 4D y 8D; `KeloAvatar` conserva esos datos y resuelve diagonales por octante.
- El fallback de producción debe conservar `character-appearance → engine-ab → engine-w`.

## Estado

**FOUNDATION ACTIVE / TRANSITIONAL AVATAR OWNER**
