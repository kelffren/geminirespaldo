# Kelo World — System Documentation Standard

> Obligatorio para cualquier sistema/capacidad nueva y para todo owner que cambie de contrato.

## Dos niveles

1. **Documentación global canónica**: describe engine/arquitectura/estado actual.
2. **Documento técnico del sistema**: describe un owner específico.

Empieza siempre por `docs/DOCUMENTATION_INDEX.md`.

## Documento técnico obligatorio

Ruta: `docs/systems/<SYSTEM_ID>.md`.

Debe incluir propósito, owner, fuentes, estado que posee/no posee, API, flujo, dependencias, eventos, local-vs-online authority, persistencia, invariantes, extension points, ejemplos, anti-patrones, legacy/adapters, tests/CI, observabilidad, deuda y checklist de extensión.

## Catálogo

`docs/system-catalog.json` enlaza `id`, `owner`, `source`, `technicalDoc`, `playerVisible`, `playerGuideAnchor` cuando aplique y `status`.

## Player guide

Si el cambio altera una mecánica visible, también debe actualizar `guide.html`. No exponer secretos, claves, rutas admin ni internals explotables.

## Regla de sincronización

Si cambia API, ownership, boot order, authority, asset pipeline o flujo visible, el mismo pass debe evaluar y actualizar:

- código;
- system doc afectado;
- `system-catalog.json` si cambia metadata;
- `guide.html` si aplica;
- `ENGINE_MAP.md` si cambia engine/boot/owner;
- `docs/ARCHITECTURE_CURRENT.md` si cambia frontera arquitectónica;
- `docs/GAME_STATE_CURRENT.md` si cambia capacidad observable;
- `docs/CODE_INDEX.md` si se añade/mueve un owner importante;
- tests/CI.

No hace falta reescribir auditorías o archivos históricos; se preservan como evidencia y se enlazan desde el índice.

## Autoridad documental

LIVE verificado > owner contracts > boot real > docs canónicos > system docs > memory/historical.

Un sistema nuevo sin documentación no está terminado.
