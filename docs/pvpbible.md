# KELO WORLD — PVP BIBLE

> Fuente de verdad operativa para la evolución del PvP de Kelo World.
> Referencia mecánica principal: Drakantos. No copiar código, assets, animaciones, sonidos, UI, mapas, nombres internos ni contenido propietario. Reproducir únicamente principios de action combat mediante los owners y contenido propios de Kelo World.
>
> Regla de autoridad documental: si esta Bible contradice el runtime LIVE cargado por `index.html`, gana el runtime; se corrige esta Bible y la documentación en el mismo pass.

## LEY ABSOLUTA

La pregunta permanente es:

> ¿Este cambio hace el combate más direccional, responsivo, legible, profundo y skill-based sin romper Foundation?

Si no, no se hace.

- REUTILIZA owners existentes.
- EXTENDER antes de crear.
- MEDIR antes de optimizar.
- PROBAR gameplay real, no solo compile.
- NO crear engines/managers paralelos.
- NO meter autoridad gameplay en UI/VFX.
- NO dejar capacidades declaradas como data muerta.
- NO decir online-ready si el servidor aún no decide el estado competitivo.

Owners obligatorios: `KeloInput`, `KeloInputLocks`, `KeloMovement`, `KeloCamera`, `KeloRender`, `KeloSimulation`, `KeloAvatar`, `KeloCombatEngine`, `KeloHitResolver`, `KeloDamageResolver`, `KeloMeleeEngine`, `KeloMeleeProfiles`, `KeloAbilities`, `KeloEvents`, `KeloVisualSystem`, `KeloNetAuthority`, `KeloStats` y los owners actuales de Effect/Status.

Prohibido crear `DrakantosEngine`, `NewCombatManager`, `PvPCombatEngine`, `ActionCombatManager`, `NewAbilityEngine`, `PvPMovementEngine`, `NewCollisionEngine`, otro Input/Render/Simulation/Camera/Network Manager.

## OBJETIVO DE PRODUCTO

Action combat libre, rápido, direccional, muy responsivo, skill-based, mobile-first, controller-ready, online-first y escalable a cientos/miles de contenidos. Debe preservar Stones, Equipment, Mounts, Character, Titles, Nobility, Market, Builders y Foundation.

Principios obligatorios:

1. movimiento libre;
2. aim independiente 360°;
3. basic sin target-lock obligatorio;
4. hitboxes físicas;
5. basic resource/charges;
6. input buffering;
7. press/hold/charge/release;
8. dashes 360°;
9. abilities direccionales;
10. cast indicators premium;
11. soft aim assist touch/controller;
12. feedback hit/miss;
13. CC legible;
14. builds data-driven;
15. World Stats vs Competitive Effective Stats;
16. base para duel/arena/objective/custom matches;
17. autoridad server real para resultados competitivos.

## BASELINE OBLIGATORIO

Antes de cada pass:

- obtener HEAD de `kelffren/gemini/main`;
- leer completos `AGENTS.md`, `docs/KELO_FOUNDATION.md`, `docs/SYSTEM_DOCUMENTATION_STANDARD.md`, `docs/ONLINE_FIRST.md`, `ENGINE_MAP.md`, `index.html`;
- inspeccionar owners LIVE y CI;
- si docs contradicen runtime, actualizar docs;
- confirmar capacidades existentes antes de implementar.

## FASE 1 — PRESERVAR ACTION COMBAT EXISTENTE

Confirmar y reutilizar si están LIVE:

- `state.aim` y aim 360°;
- movimiento/aim separados;
- `attackSweep`;
- sector/cone/capsule/oriented rect/swept circle;
- windup/active/recovery;
- telegraphs;
- hit feedback/hit-stop presentation;
- melee profiles data-driven;
- charges/rechargeTime/cancelWindow/movementScale.

No duplicar ninguna de estas capacidades.

## FASE 2 — COMBAT INPUT CONTRACT

`KeloInput` debe normalizar DOM/keyboard/pointer/gamepad a intents semánticos, no gameplay leyendo DOM crudo.

Intents mínimos:

- `MOVE_INTENT`
- `AIM_INTENT`
- `BASIC_PRESS` / `BASIC_RELEASE`
- `SPECIAL_PRESS` / `SPECIAL_HOLD` / `SPECIAL_RELEASE`
- `ABILITY_PRESS` / `ABILITY_RELEASE`
- `DODGE_PRESS`
- `CANCEL_CAST`

Estado mínimo:

```js
{
  move:{x,y},
  aim:{x,y,magnitude,source},
  basic:{pressed,held,released,pressedAt,releasedAt},
  special:{pressed,held,released,pressedAt,releasedAt}
}
```

Flujo: `DOM/keyboard/pointer/gamepad → KeloInput → normalized intent → gameplay owner → KeloSimulation → resolution`.

Respetar `KeloInputLocks`.

## FASE 3 — INPUT BUFFER

Buffer único data-driven, tuning inicial 100–140 ms. `performance.now()` para input local. Simulation decide consumo/expiración. No usar `setTimeout()` para combos, attack phases, charges, recharge o cancel windows.

Requisitos: guardar timestamp, consumir una vez, expirar, no duplicar, funcionar cerca del final de recovery y bajo FPS variable.

## FASE 4 — BASIC CHARGES

Conectar `charges` y `rechargeTime` reales:

```js
basicResource={current,max,rechargeElapsed}
```

- ataque consume 1;
- cero charges = no ejecuta;
- input puede seguir bufferizado mientras sea válido;
- recarga por `dt`;
- preservar resto de progreso;
- perfil nuevo sincroniza sin corrupción;
- reset/death/leave/reconnect dejan estado válido;
- online server es autoridad de charges.

Ritmo inicial deseado: `2 cargas → golpe → golpe → vacío → recharge → golpe`.

## FASE 5 — BUFFER / COMBO / CANCEL SON DISTINTOS

- Input Buffer: acción guardada antes de ser legal.
- Combo Window: ventana para continuar cadena.
- Cancel Window: ventana donde una acción autorizada interrumpe otra.

No mezclar estados ni timings.

## FASE 6 — BASIC COMBO DATA-DRIVEN

Perfil/cadena declarativa, no `attack1/2/3` hardcodeado en `pvp-world.js`.

Cada step puede declarar damage, range, shape, arc, windup, active, recovery, movementScale, knockback, stagger, comboWindow, cancelWindow, visualProfileId.

Reset por timeout, CC/interrupción, resource según policy, salir de combate.

## FASE 7 — MOVEMENT SCALE POR FASE

Backward compatible:

```js
movementScale:{windup:.8,active:.45,recovery:.72}
```

Un número legacy sigue válido. No root global salvo que el profile lo pida.

## FASE 8 — FACING/AIM 360°

Gameplay siempre usa vector real + `atan2`. Sprite puede cuantizar visualmente. Debe permitirse mover izquierda y atacar derecha simultáneamente.

## FASE 9/10 — SPECIAL + PRESS/HOLD/CHARGE/RELEASE

Contrato reusable `specialAttackProfileId`. Sin `SpecialAttackEngine`.

Lifecycle genérico: `IDLE → PRESSED → HOLDING → CHARGED → RELEASED → EXECUTED`, más `CANCELLED`.

Opt-in:

```js
input:{mode:'hold_release',charge:{minTime,level1Time,level2Time,maxTime}}
```

Exponer `charge01` y `chargeLevel`. Gameplay puede escalar data-driven damage/range/speed/size/radius/dash/knockback/stun/projectile count. VFX solo consume resultado.

## FASE 11/12 — TWIN-STICK + DEADZONE

Pointer Events con múltiples `pointerId`, capture/release seguro y limpieza en `pointercancel`/orientation. Izquierda = movement; derecha = aim/cast. No romper UI/hotbar/menu/chat.

Deadzone radial con `{x,y,magnitude}` y tuning centralizado: deadzone, maxRadius, sensitivity, curve (`linear`/suave exponencial).

## FASE 13/14 — SOFT AIM ASSIST + HYSTERESIS

No target lock, no autohit, no autocast. Solo blend suave del raw aim cuando un candidato válido está ya cerca de la dirección del jugador.

```js
assist={enabled,maxAngleDeg,maxDistance,strength,hysteresis}
```

Score por error angular + distancia + prioridad opcional. Mouse ≈ 0; touch/controller moderado. Hysteresis mantiene candidato hasta que deje de ser razonablemente válido o otro sea significativamente mejor.

## FASE 15 — GAMEPAD READY

Gamepad API: left stick movement, right stick aim, deadzones independientes. Leer estado actual en input/simulation update; no mantener snapshot estático.

## FASE 16 — DASH 360°

Delivery existente de Abilities. `directionSource: aim | move | explicit`. Collision/maxDistance/startup/recovery/iFrames si data lo define. Server authority online.

## FASE 17 — TELEGRAPHS PREMIUM

LINE/CIRCLE/CONE/RECTANGLE/WALL/DASH/BLINK. Presentation-only mediante `KeloVisualSystem`/`KeloRender`. No mutan gameplay.

### Aim indicator del suelo

La guía de aim permanente debe ser sutil y premium: no una línea larga tipo barra. Debe usar un segmento corto/gradiente desde el actor, fade con distancia, retícula pequeña contextual y desaparecer/reducirse cuando no hay interacción de combate. Telegraph de habilidad reemplaza visualmente al indicador base mientras se apunta. La dirección visual debe coincidir exactamente con el vector gameplay.

## FASE 18 — HIT FEEDBACK

Distinguir HIT vs MISS. Hit confirmado puede emitir impact FX, flash, damage number, recoil, presentation hit-stop, sound hook y shake moderado. Nunca pausar simulación server/global por hit-stop.

## FASE 19 — KNOCKBACK/STAGGER

Conectar data declarada. Knockback usa vector del hit y collision owner; stagger es estado temporal distinto de stun. Online server-authoritative. Definir anti-stack.

## FASE 20/21 — CC FOUNDATION + READABILITY

Extender owner de effects/status existente. Normalizar stun/root/slow/silence/knockback/stagger/shield/invulnerable/burn/bleed/buffs/debuffs con id/source/target/duration/stacks/magnitude/refreshPolicy/dispellable/tags/visualProfileId.

Presentation semántica visible sobre actor, especialmente móvil: stun, root pies, slow, shield, burn, invulnerable, silence.

## FASE 22 — HIT SHAPE LIBRARY

Una sola geometría en `KeloHitResolver`: circle, sector/cone, capsule, oriented rectangle, swept circle, segment/line. Melee y abilities reutilizan esas primitivas.

## FASE 23 — PROJECTILES

Data-driven: direction, speed, range/lifetime, radius, pierceCount, maxTargets, wall collision, actor collision, owner ignore, team filter, swept collision. Cero tunneling evidente.

## FASE 24 — AOE/PERSISTENT/TRAPS

Normalizar enter/stay/exit solo donde haga falta. Benchmark antes de spatial index. Medir 8/16/32/64 actores. No quadtree/hash por moda.

## FASE 25/26 — CANCEL + DODGE

`canCancelInto` data-driven. No cancel universal. Dodge reutiliza ability/movement/effects/invulnerability/collision; no DodgeEngine. Configurable distance/duration/directionSource/iFrames/recovery/cooldown/resource/cancelFrom/cancelInto.

## FASE 27/28 — BUILDS + EFFECTIVE STATS

Usar Stones, Equipment, Mount Abilities, future modifiers mediante contrato común de `KeloStats`; no `if(stone===...)` dentro de engines.

Resolver contextos `WORLD` y `COMPETITIVE` sobre el mismo player stats model. Competitive puede normalizar sin activar ranked balance global todavía.

## FASE 29–32 — DUEL / ARENA / OBJECTIVES / CUSTOM RULESET

Duel FSM: IDLE/REQUESTED/ACCEPTED/COUNTDOWN/ACTIVE/FINISHED/CANCELLED.

Arena genérica con teamSize configurable, match/score/objective/timer/spawn/respawn/result.

ObjectiveContract inicial: CONTROL, ESCORT, ASSAULT sin copiar mapas/nombres de otros juegos.

Custom ruleset puede override teamSize, duration, damage/cooldown multipliers, respawns, normalizedStats, ability/mount/stone/equipment restrictions.

## FASE 33–36 — ONLINE AUTHORITY

Cliente envía intents + sequence + timestamp. Server decide legalidad, resource, cooldown, hit, damage, CC, RNG, death, scoring. Cliente predice movimiento/presentación y reconcilia.

Normalizar `inputSeq` y `lastProcessedInputSeq`. Local = prediction; remote = interpolation con snapshot buffer. No GGPO completo.

Semántica común melee/abilities: request/confirmed/rejected/damage/CC/killed. Todo daño competitivo termina en `KeloDamageResolver`/owner único de damage.

## FASE 37 — UNIFICAR DAMAGE DE ABILITIES

Auditar `kelo-ability-boot.js`. Migrar mutaciones directas de HP/shield/death a Ability → Effect → DamageResolver → Combat Events de forma incremental y compatible.

## FASE 38 — SWORD SWAP

Gameplay especial no debe seguir siendo propiedad de `pvp-world.js`. Convertir `swap_sword` en delivery/capability real de `KeloAbilities`; `pvp-world.js` solo recoge intent/aim y llama al owner. RNG competitivo server-authoritative.

## FASE 39 — PRESENTATION CONTRACT

Eventos semánticos: attack started/active/hit/miss/damage/blocked/shield absorbed/dodge/CC/kill. `KeloVisualSystem` consume `visualProfileId`; gameplay no selecciona assets específicos cuando puede evitarlo.

## FASE 40/41 — PERFORMANCE

Bench reproducible 8/16/32/64 actores; 20/50 projectiles; AoE/traps/telegraphs/impacts. Medir p50/p95/p99, collision, projectile, ability y GC spikes. Pooling/spatial index solo con evidencia.

Mobile: 390x844, 430x932, landscape, desktop 1920x1080. Budgets/limits para particles/floats/impacts/telegraphs/persistent FX. Presentation puede degradarse; gameplay no.

## FASE 42 — FEEL + NETWORK MATRIX

Medir input→visual startup p50/p95, attack startup vs config, active timing, angular aim error, dash direction error, hit/miss geometry, simultaneous move+aim, correction distance y frame p50/p95/p99.

RTT: 0/30/60/100/150/200 ms. Jitter: 0/20/50 ms. Loss: 0/1/3/5%.

## FASE 43/44 — TESTS

Unit: geometry edges, charges/recharge/profile change, input buffer valid/expired/once, charge levels/cancel, combo advance/reset, aim assist+hysteresis, CC duration/refresh/stack/expire.

Integration: move+aim, move+basic, move+ability, buffer, dodge cancel, charge, dash+collision+aim, projectile swept hit, shield/invulnerability, CC combo reset, death/cleanup, leave/re-enter PvP.

## FASE 45/46 — MOBILE + DESKTOP REAL

Mobile: dos dedos, pointer capture/cancel, rotation cleanup, UI ownership, no accidental attack, stable aim/deadzone, assist sin lock.

Desktop: WASD+mouse, backpedal attack, lateral/diagonal attack, physical miss, sidestep, 360 dash, hold/release, quick tap, queued basic.

## FASE 47 — DEBUG DEV ONLY

Toggles: hit shapes, aim raw/assisted, charge, phase, combo step, input buffer, CC. Sin UI molesta en producción.

## FASE 48 — DOCS

Actualizar `ENGINE_MAP.md`, documento técnico en `docs/systems/`, catálogo y `guide.html` si la regla es visible. Debe quedar claro:

- Input → `KeloInput`
- Combat resolution → `KeloCombatEngine`
- Melee → `KeloMeleeEngine`
- Geometry → `KeloHitResolver`
- Damage → `KeloDamageResolver`
- Abilities → `KeloAbilities`
- Presentation → `KeloVisualSystem`
- PvP World → orquestación/contexto, nunca engine owner.

Explicar cómo añadir melee/combo/special/charge/dash/assist/CC/hit shape sin inventar otro owner.

## FASE 49 — COMPATIBILIDAD

No romper social world, menu, chat, character creator, stones, inventory, equipment, mounts, title, nobility, market, builders/editors, camera ni orientación móvil.

## FASE 50 — ORDEN DE EJECUCIÓN

1. baseline;
2. combat input;
3. buffer;
4. charges;
5. combo queue;
6. combo profiles;
7. phase movement;
8. special;
9. hold/charge/release;
10. pointer input;
11. multitouch;
12. deadzone;
13. aim assist;
14. hysteresis;
15. dash;
16. dodge;
17. cancel;
18. hit feedback;
19. knockback/stagger;
20. CC;
21. readability;
22. projectile validation;
23. AoE/trap validation;
24. ability damage unification;
25. Sword Swap migration;
26. stat contexts;
27. duel;
28. arena;
29. objectives;
30. network authority;
31. prediction/reconciliation;
32. interpolation;
33. benchmarks;
34. mobile optimization;
35. tests;
36. docs;
37. final smoke/visual audit.

## FASE 51 — ACCEPTANCE

No cerrar hasta demostrar:

- move+aim independiente/simultáneo;
- basic direccional, miss físico, charges, recharge, input buffer, combo queue;
- windup/active/recovery data-driven;
- special + press/hold/release + charge contract;
- twin-stick, deadzone y soft assist sin hard lock;
- dash 360° configurable;
- CC centralizado y visualmente legible;
- abilities usan owners y damage semantics únicos;
- hit/miss/telegraph/impact claros;
- intents secuenciados + server authority para estado competitivo;
- benchmarks sin regresiones graves;
- ningún engine paralelo;
- docs y tests verdes;
- revisión visual desktop/mobile con evidencia inspeccionada y correcciones posteriores.

## FASE 52 — CIERRE OBLIGATORIO

Al terminar registrar:

1. HEAD final;
2. archivos modificados;
3. capacidades realmente implementadas;
4. tests ejecutados + resultados;
5. benchmarks;
6. deuda real;
7. clasificación exacta: `FUNCIONANDO OFFLINE`, `AUTORITATIVO ONLINE`, `PREPARADO/PENDIENTE`.

No mentir sobre el estado.
