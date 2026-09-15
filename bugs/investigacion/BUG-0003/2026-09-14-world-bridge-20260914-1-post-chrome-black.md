# Investigación — Black tab después del chrome de Studio

BUG: `BUG-0003`
FECHA: `2026-09-14`
VERSION / BUILD: `world-bridge-20260914-1` observado; candidato `world-bridge-20260914-2`
COMMIT BASE: `793fcdb92421b8a2fb6e1bcc4871f3f9fc38c297` como HEAD al observar IMG_8305
ENTORNO: `LIVE · iPhone · Safari · Create -> World -> Kelo Studio`
ESTADO: `vigente`
INVESTIGADOR: `development agent + player iPhone`

## 1. Pregunta

¿Por qué Safari mata la pestaña *después* de pintar las herramientas de Kelo Studio?

## 2. Hecho nuevo

IMG_8305 (01:01): chrome KELO STUDIO + PLAY/SAVE + SELECT/EDIT/MOVE/GROUND/ROAD/COLLISION visibles. El agujero del viewport está negro. El jugador confirma que a continuación la pestaña se pone negra.

El puente A6 cumplió chrome-first. El freeze del Hub ya no es el síntoma.

## 3. Owners inmediatamente posteriores al chrome

1. `importCurrent` (structuredClone del snapshot de plaza).
2. Overlay 2D en `document.body`, `position:absolute`, sized from `host.clientWidth/Height`, dpr cap 1.5, rAF cada frame: `resize + clear + grid + overlayRenderer.draw`.
3. `installStudioProductivityExtras` inmediato: pads con `backdrop-filter:blur` dentro de `#kelo-studio-live`.

Compatible con terminación de WebContent (investigación previa E4). No repetir Hub stacking ni IndexedDB.

## 4. Candidato A7 (`world-bridge-20260914-2`)

- Overlay: dpr=1 en teléfono, `position:fixed`, tamaño `visualViewport`, primer draw 160ms después de devolver chrome, throttle ~90ms.
- Live shell: `backdrop-filter:none !important` en coarse/narrow.
- Extras: delay 1.8s en teléfono.
- No reescribe kernel, tools ni autoridad.

## 5. Gate

Solo iPhone real. No VERIFIED/CLOSED desde headless_shell.
