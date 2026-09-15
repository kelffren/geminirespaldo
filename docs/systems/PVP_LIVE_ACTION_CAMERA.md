# PvP Live Action Camera + Critical Health FX

> Estado: LIVE / Foundation extension.  
> Owner de cámara: `KeloCamera` (`src/core/camera-system.js`).  
> Owner de soporte visual PvP: `KeloPvPVisualCompetitivePass` (`src/systems/pvp-visual-competitive-pass.js`).  
> Autoridad de gameplay: sin cambios; esta capacidad es presentation-only.

## Propósito

Durante PvP la cámara deja de seguir únicamente al jugador y recibe un `camera intent` contextual que considera al jugador, al rival más relevante, distancia, aim y estado de vida. El objetivo es mejorar composición y anticipación sin mover hitboxes, aim, collider, movimiento físico ni estado de servidor.

## Estados iniciales

- `NORMAL`: fuera de un engagement válido; vuelve progresivamente al framing base.
- `ENGAGED`: compone jugador + rival y modifica suavemente el zoom según distancia.
- `CRITICAL`: conserva el framing de combate y abre ligeramente el campo de visión mientras la periferia comunica peligro.

El contrato queda preparado para capas futuras como chase/finisher/multi-target sin crear otra cámara.

## API de KeloCamera

### `setPvPDirectorIntent(intent)`

Consume únicamente datos de presentación:

- `playerX/playerY`
- `enemyX/enemyY`
- `aimX/aimY`
- `velocityX/velocityY`
- `distance`
- `hpRatio`
- `critical`
- `engaged`

KeloCamera suaviza el offset y zoom dentro de límites. El jugador sigue siendo la referencia principal; el enemigo aporta una fracción del framing.

### `clearPvPDirectorIntent()`

Retira el intent PvP y hace que el director vuelva progresivamente a `NORMAL`.

### `pulsePvPImpact(strength)`

Añade un micro-focus corto para impactos importantes. No pausa simulación ni cambia coordenadas de gameplay.

## Límites Candidate ganador

La primera variante usó una periferia demasiado intensa y fue rechazada por el judge. La variante ganadora conserva el director de cámara, pero reduce el Critical Health FX a:

- vignette máxima: `0.60`;
- edge displacement máximo base: `1.45 px`;
- pulso: `1.85 Hz`;
- safe-zone central: `50%`;
- critical enter: `20% HP`;
- critical exit: `25% HP` (hysteresis);
- subida de peligro rápida (`riseDecay=12`);
- retirada al curarse más suave (`healDecay=3.8`).

## Critical Health FX

`KeloPvPVisualCompetitivePass` crea una capa fija `#kelo-pvp-critical-fx` con `pointer-events:none`. La capa NO mueve la cámara del mundo. El centro del viewport permanece transparente/estable; la intensidad aumenta hacia los bordes mediante un gradiente radial y un desplazamiento screen-space pequeño.

Cuando HP cae:

1. sube rápido la intensidad;
2. si cruza 20%, entra el latch CRITICAL;
3. daño adicional en crítico dispara un shock corto;
4. KeloCamera abre ligeramente el encuadre.

Cuando HP sube:

1. el latch no sale hasta >=25%;
2. edge movement y vignette disminuyen progresivamente;
3. la intensidad continúa decayendo en vez de desaparecer de golpe;
4. la cámara retorna suavemente a ENGAGED/NORMAL.

## Rendimiento

La Candidate A usaba sombras inset adicionales y amplitud periférica mayor. Fue rechazada por el Agent B: desktop tuvo `p95 26.7 ms`, `p99 38.9 ms` y un frame >33 ms en la muestra.

La Candidate B elimina esas sombras y deja un único gradiente radial + transform. En el mismo judge real:

- mobile: `p95 20.1 ms`, `p99 20.9 ms`, `>33 ms = 0`;
- desktop: `p95 20.4 ms`, `p99 20.5 ms`, `>33 ms = 0`.

Ambos viewports obtuvieron `GANA`, score `10/10` y cero page errors.

## Invariantes

- Nunca usar low-HP para modificar `camera.x/y` mediante random shake.
- Nunca modificar posición física, collider, damage, hitboxes o autoridad.
- No crear un segundo camera manager ni otro game loop.
- El overlay debe continuar con `pointer-events:none`.
- La cámara debe mantener jugador y rival visibles dentro del gate del judge.
- Zoom director máximo debe permanecer dentro del límite competitivo evaluado (~7%).

## QA

Judge permanente: `scripts/live-pvp-live-action-camera-judge.mjs`.
Workflow: `.github/workflows/pvp-live-action-camera-ci.yml`.

El judge reproduce en Chromium real:

1. engagement normal;
2. 15% HP;
3. 5% HP;
4. heal 5% → 40%;
5. transición progresiva;
6. visibilidad player/enemy;
7. bounds de cámara/FX;
8. frame timing y page errors;
9. mobile landscape y desktop.
