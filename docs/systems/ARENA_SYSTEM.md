# Kelo Arena Ranked — System Contract

## Propósito

`KeloArena` añade una capa competitiva sobre el PvP action-combat existente sin crear un segundo combat engine. Publica dos modos reutilizando el mismo owner: `3v3 Control` y `1v1 MOBA`. Ambos pueden funcionar desde población casi cero mediante bots transparentes y reducirlos progresivamente cuando existan suficientes humanos.

## OWNER

- Runtime/domain owner: `src/systems/arena-system.js` → `window.KeloArena`.
- Soporte de presión de carril MOBA: `src/systems/arena-lane-pressure.js` → `window.KeloArenaLanePressure`.
- UI consumer: `src/ui/arena-ui.js` → `window.KeloArenaUI`.
- Combat owner reutilizado: `KeloPvPWorld` + `KeloCombatEngine` + `KeloMeleeEngine` + `KeloHitResolver` + `KeloDamageResolver`.
- Simulation: ambos sistemas usan `KeloSimulation.after(...)`; no existe segundo loop.
- Online final: server authority pendiente para matchmaking/rating competitivo real y para waves/War Sigil.

## Estado que posee

`KeloArena` posee lifecycle de cola/match, ruleset seleccionado, roster fallback, objetivos del modo, estructuras MOBA, estado de bots, profile/rating fallback y resultado.

`KeloArenaLanePressure` posee únicamente el estado temporal de presión de carril del 1v1 MOBA: minions activos, cadence de oleadas, estado del War Sigil y la siguiente oleada élite.

Ninguno posee hit geometry, input core, movement core, ability delivery, render base ni networking transport.

## API pública

- `joinQueue(mode)` / `openQueue(mode)` — entra en Control por defecto o en el modo solicitado.
- `joinMobaQueue()` — acceso explícito a 1v1 MOBA.
- `rematch()` — vuelve a entrar al mismo modo tras limpiar el match anterior.
- `leaveQueue()` — cancela antes del match.
- `finishMatch(winner, reason)` — cierre interno/fallback; en online final será server-only.
- `abort(reason)` — limpia un match incompleto.
- `getHostileActors(viewer)` — entrega héroes, objetivos estructurales y, cuando lane pressure está activo, minions hostiles.
- `getActorById(id)` — targeting de héroes/estructuras/minions.
- `drawWorld(ctx)` — presentation support sobre el renderer PvP existente.
- `snapshot()` y `getRank(mmr?)` — lectura para UI/debug.
- `KeloArenaLanePressure.snapshot()` — lectura de oleadas/War Sigil para HUD/debug.

## Ruleset 3v3 Control

- equipos 3v3;
- score a 100;
- máximo 180 s;
- zona central disputable;
- OVERTIME si el tiempo termina con ambos equipos disputando el punto;
- 100 HP / 100 maná normalizados;
- fallback inicial: 1 humano + 5 bots `[Bot]`.

## Ruleset 1v1 MOBA

- equipos 1v1;
- un solo carril;
- una torre y un núcleo por equipo;
- la torre enemiga debe caer antes de que el núcleo aparezca como objetivo atacable;
- victoria al destruir el núcleo rival;
- máximo 300 s; si expira, se compara HP restante de los núcleos;
- respawn de héroes;
- torre defensiva con rango/cadencia propios;
- stats de héroes normalizados igual que en Control;
- fallback sin rival: 1 humano contra 1 bot `[Bot]`;
- Match Quality reducido en fallback bot para evitar farmear rating completo.

### Oleadas ligeras

El 1v1 MOBA añade una capa ligera de presión sin convertir el modo en una partida larga de MOBA tradicional:

- primera oleada aproximadamente a los 7 s;
- después, una nueva oleada cada 20 s;
- 3 soldados por equipo;
- los soldados pueden luchar contra soldados, héroes y la estructura enemiga actualmente vulnerable;
- sus ataques reutilizan `KeloCombatEngine.attackSweep(...)`; no mutan HP directamente;
- el jugador puede golpearlos porque se integran en el mismo proveedor de hostiles que usa `KeloPvPWorld`;
- existe un límite de unidades para evitar crecimiento indefinido en partidas largas.

### War Sigil

El War Sigil es un objetivo central temporal pensado para romper estados pasivos y crear una pelea importante en mitad de partida:

- aparece por primera vez alrededor de los 105 s;
- se captura permaneciendo cerca del centro durante unos 3 s sin presencia rival;
- si ambos jugadores lo disputan, la captura no progresa;
- al capturarlo se invoca inmediatamente una oleada élite para el equipo ganador;
- la oleada élite tiene más HP y daño que una normal;
- el Sigil reaparece después de un intervalo largo, no de forma constante.

La recompensa del Sigil produce presión de mapa en vez de dar un gran bonus directo de daño PvP al héroe. Así crea comeback y decisiones sin regalar automáticamente una pelea.

## Ranking y engagement

MMR oculto y rango visible/RP permanecen compartidos por Arena. Tiers actuales: Bronce → Plata → Oro → Platino → Esmeralda → Diamante → Mithril → Adamantita → Etéreo. La fórmula local es de prototipo y no es autoridad competitiva final.

El post-match puede mostrar clutch accolades, racha, victoria más rápida, remontada, overtime wins y Coach Card. Estas métricas nunca sustituyen el resultado competitivo ni alteran hit/damage.

## Bots y minions

Los bots héroe siempre se identifican como `[Bot]`. Sus decisiones utilizan utility heuristics y sus ataques reutilizan `KeloCombatEngine.attackSweep(...)`.

Los minions no se presentan como jugadores: son unidades de carril claramente diferenciadas. También reutilizan el CombatEngine y no poseen un damage resolver separado.

## Online-first

`joinQueue()` y `joinMobaQueue()` están preparados para delegar a `KeloNetAuthority.requestArena(...)`. Antes de Ranked real el servidor debe poseer matchmaking, humans/bots, equipos, stats efectivos, score/estructuras, respawns, waves, War Sigil, resultado, MMR/RP, reconnect y anti-abuse. El cliente nunca debe declarar `winner`, `score`, `coreHp`, `waveState`, `sigilOwner` o `mmrDelta` como verdad final.

## Invariantes

1. Un solo owner `KeloArena` para modos Arena.
2. `KeloArenaLanePressure` es soporte de modo, no otro CombatEngine ni otro Arena owner.
3. Ningún segundo CombatEngine o Simulation loop.
4. UI no escribe gameplay/rating.
5. Bots no se presentan como humanos.
6. Minions usan CombatEngine; no aplican daño directo.
7. Stats normalizados se restauran al salir.
8. PvPWorld sigue funcionando sin Arena.
9. Match Quality reduce progreso de fallback bot.
10. 1v1 MOBA exige torre → núcleo; el núcleo no es target mientras vive su torre.
11. War Sigil genera presión mediante una oleada élite, no mediante un buff PvP bruto permanente.

## Flujo actual

`Arena UI → elegir modo → KeloArena.joinQueue/joinMobaQueue → KeloPvPWorld.enter → Arena construye roster/objetivos → LanePressure activa waves/War Sigil en MOBA → PvPWorld pide hostiles → CombatEngine resuelve héroes/minions/estructuras → resultado → post-match/rematch → restore → KeloPvPWorld.leave`.

## Anti-patrones

- `ArenaCombatEngine` / `MobaCombatEngine`;
- `RankedDamageResolver`;
- segundo game loop;
- minions aplicando `target.hp -= damage`;
- matchmaking dentro de UI;
- bots disfrazados de jugadores;
- 100% RP contra bots;
- localStorage como autoridad online final.

## Tests / CI

- `scripts/arena-system-audit.js` valida 3v3 Control + 1v1 MOBA, torre/núcleo, overtime, rematch, oleadas, War Sigil, CombatEngine compartido, Match Quality, normalización, integración con PvPWorld, runtime y docs.
- `npm run audit:arena`.
- Ranked Arena CI.

## Deuda conocida

- Falta authority server completo de Arena y LanePressure.
- El fallback MOBA actual usa un rival bot, no población ficticia.
- Torre/núcleo, daño de torre, tiempos, minion cadence, War Sigil, MMR y tiers son tuning inicial.
- Shop, XP de lane y jungla no forman parte de este 1v1; el objetivo sigue siendo un duelo MOBA compacto.