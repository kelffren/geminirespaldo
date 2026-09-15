# Arena Progression — System Contract

## Propósito

`KeloArenaProgression` posee la progresión competitiva persistente que existe fuera de una partida concreta: Mastery, objetivos de habilidad y rivalidades/series BO3. Consume resultados confirmados por `KeloArena`, telemetría observada por `KeloArenaTelemetry` y momentos semánticos de `KeloArenaHighlights`; nunca decide ganador, MMR, daño ni validez de actores.

## OWNER

- Runtime owner: `src/systems/arena-progression.js` → `window.KeloArenaProgression`.
- Match owner consumido: `window.KeloArena`.
- Telemetría consumida: `window.KeloArenaTelemetry`.
- Highlights consumidos: `window.KeloArenaHighlights`.
- UI consumer: `src/ui/arena-ui.js`.
- Persistencia local: `localStorage` como fallback de prototipo.
- Autoridad online final: servidor pendiente.

## Mastery

Mastery es independiente del Rank/MMR y no da estadísticas. Tiers: Iniciado → Combatiente → Duelista → Táctico → Maestro → Campeón → Leyenda de Arena.

La ganancia usa resultado, calidad de partida y pequeñas señales de ejecución verificadas. Todo se pondera por Match Quality para reducir farming contra bots.

## Objetivos de habilidad

Además de victorias, streaks y milestones, Mastery puede desbloquear objetivos basados en evidencia real:

- Mano Firme — 10+ ataques y al menos 60% de precisión;
- Ancla del Objetivo — 30 s dentro de Control;
- Presión de Asedio — 150+ de daño a estructuras;
- Duelo Limpio — ganar MOBA sin overextension;
- Paso Fantasma — dodge efectivo confirmado;
- Interruptor — interrupt confirmado;
- Primer Golpe — FIRST BLOOD local;
- Cazarrecompensas — SHUTDOWN local;
- Rompetorres — caída confirmada de la torre rival;
- Ladrón del Sigilo — WAR SIGIL STEAL local;
- Último Suspiro — ESCAPE CRÍTICO local.

Estos objetivos no alteran stats, matchmaking ni MMR.

## Rivalidades y BO3

Se persiste historial por `mode + opponentId`. La serie activa es Best of 3: primero en llegar a 2. Si el rival es bot, la UI lo etiqueta como Serie de práctica. `rematchSeries()` reutiliza `KeloArena.rematch()`; no existe una segunda cola.

## API pública

- `snapshot()`
- `getMastery(xp?)`
- `getRivalry(id, mode)`
- `rematchSeries()`
- `resetSeries()`

## Invariantes

1. No modifica HP, stats, abilities ni resources.
2. No modifica MMR/RP ni matchmaking.
3. No decide ganador/score.
4. No crea loop propio.
5. Bots permanecen identificados como bots.
6. Mastery no concede ventajas de combate.
7. Telemetry/highlights cliente son progreso local de prototipo; producción online debe validar server-side.

## Flujo

`KeloArena termina → Telemetry cierra resumen + Highlights cierra momentos → KeloArenaProgression procesa → Mastery/objetivos/rivalidad → Arena UI presenta → revancha opcional`.

## Tests / CI

`npm run audit:arena` protege tiers, objetivos de telemetría/highlights, BO3, Match Quality, ausencia de buffs/MMR authority y orden LIVE Arena → Lane → Telemetry → Highlights → Progression → UI.
