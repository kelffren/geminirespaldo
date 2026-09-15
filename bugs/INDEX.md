# KELO WORLD — Bug Index

Este índice es una vista rápida. La fuente canónica de cada bug es su JSON en `bugs/registry/`.

| ID | Estado | Severidad | Resumen |
|---|---|---:|---|
| `BUG-0001` | `OPEN` | high | BrowserStack real iPhone falla antes de abrir la página por mismatch `reducedMotion`. |
| `BUG-0002` | `FIXED_PENDING_VERIFY` | critical | Guest tiene fixes candidatos, pero falta prueba E2E real de `Jugar como invitado` en iPhone. |
| `BUG-0003` | `FIXED_PENDING_VERIFY` | critical | World delayed freeze + sin preview assets; candidato A11 world-bridge-20260915-22. Falta iPhone real. |

## Dependencias actuales

`BUG-0001` bloquea la verificación real de `BUG-0002` y `BUG-0003`.

## Cómo mantener este índice

- Actualizarlo cuando cambie el estado/resumen de un bug canónico.
- No usarlo para guardar evidencia extensa; eso vive en el JSON correspondiente.
- Si hay discrepancia, gana `bugs/registry/BUG-NNNN.json` y este índice debe corregirse.
