# Kelo Arena Highlights — System Contract

## Propósito

`KeloArenaHighlights` detecta momentos competitivos observables durante Arena y los expone como eventos semánticos reutilizables. No decide daño, ganador, score, MMR, Mastery ni recompensas.

## Owners

- Detección: `src/systems/arena-highlights.js` → `window.KeloArenaHighlights`.
- Presentación: `src/ui/arena-highlights-ui.js` → `window.KeloArenaHighlightsUI`.
- Gameplay continúa perteneciendo a `KeloArena`, `KeloCombatEngine`, `KeloArenaLanePressure` y demás owners existentes.

## Highlights V1

- `FIRST BLOOD`: primera muerte de héroe confirmada del match.
- `DOUBLE KILL` / `TRIPLE KILL`: bajas locales dentro de una ventana corta.
- `SHUTDOWN`: baja a un héroe que acumulaba al menos 3 kills sin morir.
- `TORRE DESTRUIDA`: transición observada de torre viva a 0 HP.
- `NÚCLEO EXPUESTO`: emitido al caer la torre que protegía ese núcleo.
- `WAR SIGIL STEAL`: el otro equipo había acumulado progreso significativo y el equipo opuesto termina capturando el Sigil.
- `REMONTADA EN CURSO`: un equipo que estuvo al menos 20 puntos abajo en Control pasa a liderar.
- `ESCAPE CRÍTICO`: el jugador local sobrevive durante varios segundos después de caer a 10% HP o menos.

## Fuentes de verdad

Kills y shutdowns usan `KeloCombatSchema.events.ENTITY_KILLED`. Torres/Core usan snapshots de `KeloArena`. War Sigil usa `KeloArenaLanePressure`. Comeback usa score real de Control. Critical Escape usa HP real del actor local durante un match activo.

No se fabrican eventos por animaciones, partículas, texto de UI o timers independientes.

## Presentation

`KeloArenaHighlightsUI` muestra un banner temporal y reutiliza el post-match de Arena para añadir chips con los momentos y su timestamp aproximado. No crea otro menú ni otra autoridad.

## Online-first

En Ranked online, el cliente puede mostrar highlights de presentación inmediatos, pero los highlights oficiales para estadísticas, recompensas, torneos o historial deben validarse con eventos server-authoritative.

## Invariantes

1. No envolver `KeloCombatEngine`.
2. No mutar HP, score, MMR, RP o Mastery.
3. No crear un segundo simulation loop.
4. No inferir kills sin `ENTITY_KILLED`.
5. No presentar bots como humanos.
6. La UI solo consume highlights ya detectados.
7. Los highlights se conservan como semántica reutilizable para espectador/replay/clip tooling futuro.

## API

- `KeloArenaHighlights.snapshot()`
- `KeloArenaHighlights.current()`
- `KeloArenaHighlights.last()`
- `KeloArenaHighlights.reset()`

## Deuda conocida

- Server validation pendiente.
- Multi-kill usa ventana temporal inicial de tuning.
- `War Sigil Steal` exige progreso previo significativo; el umbral deberá tunearse con telemetría real.
- No existe replay buffer todavía; se guardan timestamps y metadata semántica, no video.
