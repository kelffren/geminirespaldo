# Kelo World — Equipment Ability System

## Propósito

Kelo World da identidad de combate al arma equipada sin clases fijas y sin crear un segundo motor de habilidades. Los cinco slots Stone siguen siendo el loadout principal. A pie, el arma proyecta exactamente tres técnicas `Q/W/E`; montado, esa misma fila contextual se sustituye por `M1/M2/M3`. El máximo visible sigue siendo ocho habilidades y nunca se apilan arma + montura.

La capacidad source-native actual elimina la deuda del bridge antiguo: armas y monturas ya no sustituyen temporalmente ningún slot Stone. `KeloAbilities` acepta directamente definitions externas mediante `engine.castSource()` y `engine.predictSource()`, reutilizando el mismo pipeline de validación, recursos, delivery, effects y eventos.

## Ownership y archivos

- `KeloAbilities` (`src/abilities/kelo-ability-boot.js`) es el único owner de ejecución: targeting, validación de recursos, delivery, effects, collision y eventos de cast.
- `KeloStones` es el único owner de los **5 Stone slots** y de sus cooldowns runtime.
- `KeloEquipment` (`src/systems/equipment-system.js`) es el único owner del arma equipada y de la selección Q/W/E persistida en el item.
- `KeloEquipmentAbilityChannel` (`src/abilities/equipment-ability-channel.js`) proyecta el arma equipada a Q/W/E y posee únicamente sus cooldowns efímeros `readyAt`.
- `KeloMounts` + `KeloMountAbilityChannel` poseen el estado/canal M1/M2/M3 de montura y sus cooldowns efímeros.
- `src/abilities/equipment-ability-data.js` es contenido puro: AbilityDefinitions, WeaponProfiles, bindings y `slotChoices`.
- `src/abilities/ability-source-cast.js` queda como **shim de compatibilidad**. Delega a `KeloAbilities.engine.castSource()` y no toca hotbar ni gameplay state.
- `src/ui/equipment-action-bar.js` y Backpack son consumidores UI; nunca escriben gameplay state directamente.

No existe `WeaponAbilityEngine`, `EquipmentAbilityEngine` ni `MountAbilityEngine`.

## Estado que posee cada parte

### `KeloAbilities`

Posee:
- hotbar Stone de cinco slots;
- deliveries runtime efímeros (`projectiles`, `areas`, `walls`, `traps`);
- ejecución común de casts.

No posee:
- inventario/equipment del jugador;
- selección Q/W/E del arma;
- cooldown `readyAt` de arma/montura;
- estado de montura;
- autoridad competitiva final online.

### `KeloEquipmentAbilityChannel`

Posee solo:
- tres descriptors runtime Q/W/E;
- `readyAt` por técnica;
- fingerprint de la proyección actual.

### `KeloMountAbilityChannel`

Posee solo:
- tres descriptors runtime M1/M2/M3;
- `readyAt` por técnica;
- fingerprint de la montura/loadout actual.

### `KeloAbilitySourceCast`

No posee estado. Es compatibilidad pura y solo delega al API source-native del owner.

## API pública source-native

### `KeloAbilities.engine.castSource(options)`

```js
KeloAbilities.engine.castSource({
  sourceType: 'equipment',
  sourceId: 'weapon_2042',
  sourceSlot: 'Q',
  sourceFingerprint: 'weapon_2042|weapon.longbow|...',
  definition,
  request: {
    slotIndex: 0,
    direction: { x: 1, y: 0 }
  }
});
```

Campos:
- `sourceType`: fuente semántica no-Stone, por ejemplo `equipment` o `mount`.
- `sourceId`: identidad estable de la fuente real.
- `sourceSlot`: slot semántico (`Q/W/E`, `M1/M2/M3`).
- `sourceFingerprint`: identidad del loadout/equipo que produjo ese cast.
- `definition`: AbilityDefinition validada por el caller owner de contenido/loadout.
- `request`: target/direction/position del cast.

`sourceType: 'stone'` se rechaza en este API. Stone mantiene su camino normal `engine.cast({slotIndex})`, preservando ownership.

### `KeloAbilities.engine.predictSource(options)`

Usa exactamente la misma definición, targeting y delivery en modo visual/predicción, pero no consume recursos ni aplica resultados gameplay autoritativos.

### APIs Stone existentes

- `KeloAbilities.engine.cast(request)`
- `KeloAbilities.engine.predict(request)`

Siguen resolviendo la habilidad desde `hotbar.slots[slotIndex]` y conservan cooldown Stone dentro del runtime Stone.

### `KELO_EQUIPMENT_ABILITY_DATA`

- `abilities`
- `profiles`
- `templateBindings`
- `getAbility(keyOrId)`
- `getProfile(id)`
- `getProfilesByFamily(family)`
- `resolveProfileForItem(item)`
- `resolveLoadoutForItem(item)`
- `validateProfile(profile)`
- `validateLoadout(profile, abilityKeys)`

Cada `WeaponProfile` declara exactamente tres `abilityKeys` por defecto y tres listas `slotChoices` cuando existe personalización por slot.

### `KeloEquipmentAbilityChannel`

- `sync(force)`
- `getSlots()`
- `getSnapshot()`
- `cast(request)`
- `on(event, fn)`
- `getRemainingCooldown(slot)`
- `labels = ['Q','W','E']`

### `KeloAbilitySourceCast` — compatibilidad

- `cast(options)` → delega a `KeloAbilities.engine.castSource(options)`
- `isAvailable()`

Código nuevo no necesita usar este shim.

## Flujo actual

### Stone

`Stone slot → KeloAbilities.engine.cast → dispatchResolved → validateCast → resource/cooldown Stone → delivery → effects → events`

### Arma

`KeloEquipment → WeaponProfile/loadout → KeloEquipmentAbilityChannel → KeloAbilities.engine.castSource → dispatchResolved → validateCast → resource → delivery → effects → events`

El channel inicia su `readyAt` solamente si KeloAbilities devuelve un cast válido.

### Montura

`KeloMounts → KeloMountAbilityChannel → KeloAbilities.engine.castSource → dispatchResolved → validateCast → resource → delivery → effects → events`

El channel de montura mantiene su cooldown. No se crea una entrada Stone falsa.

## Garantía: el hotbar Stone no se presta

Un cast source-native crea únicamente un descriptor local efímero dentro de la llamada. Ese objeto **nunca** se asigna a `KeloAbilities.hotbar.slots`.

Esto elimina el antiguo patrón:

`guardar Stone 0 → sustituir Stone 0 → cast → restaurar Stone 0`

El patrón anterior queda prohibido por audits. Las cinco referencias Stone deben ser idénticas antes y después de cualquier cast o predicción de arma/montura.

## Familias disponibles

- `weapon.vanguard_blade` — espada: Corte de Vanguardia / Rompeguardia, Paso del Duelista, Ruptura Real.
- `weapon.arcane_staff` — bastón: Proyectil Arcano, Salto Arcano, Tempestad Arcana.
- `weapon.longbow` — arco: Disparo Rápido / Flecha Perforante, Paso Evasivo, Lluvia de Flechas.
- `weapon.shadow_daggers` — dagas: Ráfaga de Hojas, Paso Sombrío, Círculo de Ejecución.
- `weapon.war_hammer` — martillo: Golpe de Tierra, Carga del Toro, Terremoto.
- `weapon.frost_staff` — glacial: Esquirla de Hielo, Paso Glacial, Campo Glacial.

Todas reutilizan deliveries del mismo `KeloAbilities`: `projectile`, `self_aoe`, `dash`, `blink` y `persistent_area`.

## Bindings iniciales

- `starter_weapon` / `vanguard_blade` → `weapon.vanguard_blade`
- `arcane_staff` → `weapon.arcane_staff`
- `starter_bow` / `longbow` → `weapon.longbow`
- `starter_daggers` / `shadow_daggers` → `weapon.shadow_daggers`
- `starter_hammer` / `war_hammer` → `weapon.war_hammer`
- `frost_staff` → `weapon.frost_staff`

## Invariantes

1. `KeloStones.LOADOUT_SIZE === 5`.
2. Ningún cast source-native escribe `STATE.equipped`.
3. Ningún cast source-native sustituye, añade o elimina entradas de `KeloAbilities.hotbar.slots`.
4. A pie: máximo `5 Stone + 3 weapon = 8` activas visibles.
5. Montado: máximo `5 Stone + 3 mount = 8` activas visibles.
6. Q/W/E y M1/M2/M3 son mutuamente excluyentes.
7. Weapon y mount reutilizan exactamente los mismos `deliveryHandlers` y Effect Engine.
8. Cooldowns Q/W/E y M1/M2/M3 permanecen en sus respectivos channels; Stone cooldown permanece en Stone runtime.
9. Coste de recurso, targeting y delivery de todas las fuentes pasan por `KeloAbilities`.
10. Una selección Q/W/E solo puede usar habilidades autorizadas por `slotChoices`.
11. Selección inválida hace fallback al kit por defecto y nunca ejecuta una habilidad de otra familia.
12. UI no muta estado gameplay.

## Eventos y observabilidad

`ABILITY_CAST` es el evento común del runtime y ahora incluye identidad de fuente:

- `sourceType`
- `sourceId`
- `sourceSlot`
- `sourceFingerprint`
- `abilityId`
- `abilityKey`
- `castId`
- `predicted`

Stone conserva `stoneUid` y `slotIndex`.

Para casts no-Stone, `KeloAbilities` publica además `KELO_ABILITY_SOURCE_CAST` con la misma identidad semántica. Los channels continúan emitiendo sus eventos de dominio:

- `EQUIPMENT_ABILITY_LOADOUT_CHANGED`
- `EQUIPMENT_ABILITY_CAST`
- `MOUNT_ABILITY_LOADOUT_CHANGED`
- `MOUNT_ABILITY_CAST`

## Online-first / autoridad

La API source-native prepara una frontera explícita para servidor. Antes de PvP competitivo de producción, el servidor debe validar:

- que `sourceId` pertenece al jugador;
- que arma/montura está realmente equipada/activa;
- que `sourceFingerprint` corresponde al loadout aprobado;
- que la AbilityDefinition/slot está permitido por su profile;
- cooldown autoritativo;
- resource cost;
- target/range;
- resultado de daño/status.

El cliente puede mantener predicción para sensación inmediata, pero el resultado competitivo final pertenece al servidor. La migración online no requiere reconstruir channels, IDs, perfiles ni flujo visible: cambia la capa de autoridad del cast.

## Persistencia

No hay store paralelo.

- `KeloEquipment` persiste el arma y `combatAbilityKeys` cuando existe personalización.
- `KeloMounts` persiste su estado propio.
- cooldowns Q/W/E/M1–M3 son efímeros en el prototipo.
- Stone conserva su contrato de persistencia/loadout actual.

## Extensión

Para añadir una familia de arma:

1. crear AbilityDefinitions usando primitives existentes;
2. crear `WeaponProfile` con exactamente Q/W/E por defecto;
3. definir `slotChoices` si hay selección;
4. enlazar template/profile;
5. pasar audits;
6. si falta una capacidad de gameplay genérica, extender `KeloAbilities` una sola vez.

Para una futura fuente de habilidades no-Stone:

1. su owner resuelve qué AbilityDefinition puede usar;
2. su channel/owner conserva el cooldown que le corresponde;
3. llama `KeloAbilities.engine.castSource()` con identidad estable;
4. nunca toca Stone hotbar ni duplica delivery/effects.

## Anti-patrones

- No añadir Q/W/E a `STATE.equipped`.
- No cambiar Stone de 5 a 8 slots.
- No “pedir prestado” `hotbar.slots[0]` ni ningún otro Stone slot.
- No duplicar `deliveryHandlers`.
- No crear un engine por arma, montura o futura fuente.
- No escribir cooldowns desde DOM.
- No hardcodear familias en `KeloEquipment`.
- No permitir Q/W/E y M1/M2/M3 simultáneamente.
- No usar VFX para decidir daño.
- No considerar cliente autoridad PvP final.

## Tests / CI

- `npm run audit:ability-source-native`
- `npm run audit:equipment-abilities`
- `node scripts/equipment-weapon-loadout-audit.js`
- `npm run audit:mounts`
- `npm run audit:stones`
- `npm run audit:foundation`
- `npm run audit:docs`

`ability-source-native-cast-audit.mjs` arranca el owner real, ejecuta `castSource()` y `predictSource()`, valida consumo/no consumo de maná, identidad semántica y comprueba por referencia estricta que los cinco Stone slots quedan intactos.

Los audits de Equipment y Mount rechazan dependencias activas sobre `KeloAbilitySourceCast` y cualquier acceso al hotbar Stone desde los channels.

## Deuda conocida

- `KeloAbilitySourceCast` sigue existiendo solo como shim público de compatibilidad para consumidores externos/antiguos. No participa en el camino normal Q/W/E ni M1/M2/M3.
- La autoridad competitiva del cooldown/recursos/resultado todavía debe moverse al servidor antes de PvP online de producción.
- Las técnicas reutilizan presentación existente; VFX exclusivos pueden añadirse mediante Visual System sin cambiar gameplay.

## Checklist

- [ ] ¿La fuente reutiliza `KeloAbilities.engine.castSource()`?
- [ ] ¿Los cinco Stone mantienen exactamente su owner y referencias?
- [ ] ¿No existe otro delivery/effect engine?
- [ ] ¿Cooldown de la fuente vive en su owner/channel?
- [ ] ¿KeloAbilities conserva validación de recurso/target/delivery/effects?
- [ ] ¿IDs y fingerprint son estables para server authority?
- [ ] ¿Q/W/E y M1/M2/M3 siguen mutuamente excluyentes?
- [ ] ¿Pasaron source-native, equipment, mount, Stone, foundation y docs audits?
