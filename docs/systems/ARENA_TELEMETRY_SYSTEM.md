# Kelo Arena Telemetry — System Contract

## Propósito

`KeloArenaTelemetry` mide comportamiento competitivo observable durante partidas Arena para alimentar feedback post-match y objetivos de Mastery. No decide combate, daño, matchmaking, MMR, Mastery ni resultado.

## Owner

- Runtime owner: `src/systems/arena-telemetry.js` → `window.KeloArenaTelemetry`.
- Consume `KeloArena`, `KeloSimulation`, `KeloEvents`, `KeloCombatSchema` y, cuando existe, `KeloArenaLanePressure`.
- No envuelve `KeloCombatEngine`; escucha eventos semánticos ya emitidos.
- No crea `requestAnimationFrame`, `setInterval` ni segundo loop.

## Métricas V1

- ataques resueltos;
- ataques con hit confirmado;
- precisión = ataques con hit / ataques resueltos;
- daño a héroes;
- daño a estructuras;
- daño a minions;
- daño recibido;
- daño evitado por bloqueo;
- kills / deaths;
- dodges iniciados;
- dodges efectivos solo cuando existe evidencia semántica de bloqueo por invulnerabilidad/dodge/iframe;
- CC aplicado;
- interrupts cuando el CC fuerte observable es stun/silence/stagger/root;
- segundos dentro del objetivo de Control;
- segundos ejerciendo presión cerca de la estructura vulnerable en MOBA;
- overextensions MOBA únicamente cuando el jugador muere claramente en territorio enemigo sin una oleada aliada cercana.

## Regla de evidencia

No se inventan métricas. Si el runtime no emite evidencia suficiente para demostrar una acción, la métrica permanece en cero/no confirmada. Por ejemplo, una animación visual de dodge no cuenta como dodge efectivo si no existe un bloqueo/invulnerabilidad observable.

## Load order

Arena LIVE debe mantener:

`KeloArena → KeloArenaLanePressure → KeloArenaTelemetry → KeloArenaProgression → KeloArenaUI`

`KeloCombatSchema` puede instalarse más tarde durante el boot. Por eso Telemetry usa binding perezoso: comprueba desde `KeloSimulation` hasta que el schema existe, se suscribe una sola vez y deja de intentar enlazar.

## Progresión

`KeloArenaProgression` puede consumir el último resumen congelado para objetivos como:

- Mano Firme: 10+ ataques y ≥60% precisión;
- Ancla del Objetivo: ≥30 s en Control;
- Presión de Asedio: ≥150 daño a estructuras;
- Duelo Limpio: ganar MOBA sin muerte por overextension;
- Paso Fantasma: dodge efectivo confirmado;
- Interruptor: al menos un interrupt confirmado.

Estas métricas pueden sumar Mastery XP ponderada por Match Quality, pero nunca MMR ni stats de combate.

## Online-first

La telemetría local es informativa y útil para prototipo/offline. Para Ranked de producción, las estadísticas oficiales que afecten progresión persistente deben derivarse o validarse en el servidor para evitar spoofing. El cliente no debe poder declarar accuracy, objective time, interrupts o damage como verdad competitiva final.

## Invariantes

1. No modifica HP.
2. No modifica MMR/RP.
3. No modifica Mastery directamente.
4. No decide ganador.
5. No envuelve CombatEngine.
6. No crea otro loop.
7. Usa eventos semánticos y snapshots existentes.
8. Métricas dudosas no se cuentan como confirmadas.
9. UI solo presenta el resumen.

## Tests / CI

`npm run audit:arena` verifica owner, eventos semánticos, lazy binding, métricas principales, ausencia de wrappers/authority y load order LIVE.