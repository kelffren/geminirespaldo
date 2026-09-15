# KeloPlayerStats — estadísticas de progreso

## Propósito

`KeloPlayerStats` es el OWNER único de counters reutilizables de progreso del jugador en el cliente. Su responsabilidad es convertir eventos gameplay confiables en estadísticas estables, sin conocer qué recompensa desbloquea cada valor.

Flujo Foundation:

```text
Gameplay confirmado
      │
      ▼
KeloEvents
      │ combat:entity_killed
      ▼
KeloPlayerStats
      │ player:stat_changed
      ▼
consumidores de progreso
(KeloTitles / futuras quests / seasons / leaderboards)
```

## Owner

**Owner:** `window.KeloPlayerStats`  
**Fuente:** `src/systems/player-stats.js`

## Estado poseído

Offline/prototipo:

- `STATE.playerStats`
- counters enteros no negativos por ID estable.

Online:

- snapshot read-only recibido del servidor;
- antes de recibir snapshot, las stats autoritativas fallan cerradas a `0`;
- el navegador no puede incrementar progreso valioso mientras `KeloNetAuthority.isOnline()` sea `true`.

## API pública

### `KeloPlayerStats.get(stat)`

Lee el valor actual de una stat.

### `KeloPlayerStats.snapshot()`

Devuelve una copia inmutable de los counters visibles para el cliente.

### `KeloPlayerStats.recordTrusted(stat, delta, context)`

Entrada de mutación para gameplay local confiable. Se rechaza en online con `SERVER_AUTHORITY_REQUIRED`.

### `KeloPlayerStats.ingestServerSnapshot(progress)`

Hidrata counters provenientes del servidor y emite `player:stat_changed` cuando cambia un valor.

### `KeloPlayerStats.isOpenWorldPlayerKill(payload)`

Clasificador local conservador para el prototipo. Solo acepta una muerte confirmada cuyo atacante sea el jugador local, la víctima sea un jugador distinto y el contexto declare explícitamente `worldPvP` + `open-world-pvp`.

## Stat LIVE inicial

`openWorldPlayerKills`

Cuenta únicamente bajas válidas de jugadores en PvP de Mundo Abierto. No cuenta:

- NPCs;
- dummies;
- entrenamiento;
- arena;
- self-kill;
- muertes no confirmadas.

## Autoridad online

El cliente nunca envía “tengo N kills”. La futura autoridad server de muerte PvP debe confirmar killer, víctima y contexto y después actualizar la persistencia server de progreso. `visual:event DEATH` es presentación y no es una fuente de progreso.

## DEV gate

Con `?titleDev=1` o `?titlesDev=1` aparece un helper de desarrollo para fijar una stat y simular una baja local válida. No existe en un boot normal y se bloquea si el juego está online.

## Invariantes

- Stats no desbloquea títulos ni otras recompensas.
- No recorre catálogos por frame.
- No usa `visual:event` como autoridad gameplay.
- Online siempre prevalece sobre datos locales.
- Antes de snapshot online se falla cerrado.
- Nuevos consumidores deben escuchar stats o eventos, no duplicar counters.

## Estado

**FOUNDATION ACTIVE — PROGRESSION OWNER**
