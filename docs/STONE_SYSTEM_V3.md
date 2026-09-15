# Kelo World — Stone System V3

Estado: LIVE candidate
Objetivo: una sola fuente de verdad para piedras, loadout y futura transferencia PvP.

## Regla central

Kelo World decide qué piedras posee y equipa el jugador. El runtime de combate jamás inventa habilidades: deriva sus 5 slots exclusivamente de `STATE.equipped`.

Cada piedra de habilidad es un objeto único:

```js
{
  schemaVersion: 3,
  uid: 'stone_...',
  kind: 'ability',
  abilityId: 1,
  abilityKey: 'fireball',
  recipe: ['fire', 'projectile'],
  tier: 'Epic',
  level: 1,
  xp: 0,
  affixes: [{ id: 'damage', value: 0.08 }],
  locked: false,
  bound: false,
  source: 'world',
  createdAt: 0
}
```

`typeId`, `name`, `icon`, `color`, `baseCd`, `dmg` y `isUlt` se mantienen únicamente como campos de compatibilidad con el engine legado mientras se completa la migración.

## Dueños

- `src/abilities/abilityData.js`: catálogo inmutable de componentes, tiers y 10 habilidades V1.
- `src/abilities/stone-system.js`: dominio de piedras; creación, migración, afijos, fusión y snapshots PvP.
- `src/abilities/kelo-ability-boot.js`: runtime del mundo; sincroniza las piedras equipadas con el hotbar y ejecuta los efectos locales.
- `src/abilities/disable-old-hud.js`: handoff del HUD viejo. Nunca debe borrar inventario ni loadout.
- `scripts/audit-stones.js`: auditoría reproducible del sistema.

## Invariantes

1. `STATE.inventory` contiene piedras poseídas y no equipadas.
2. `STATE.equipped` contiene como máximo 5 piedras poseídas y equipadas.
3. El hotbar no es inventario; es una proyección runtime de `STATE.equipped`.
4. Ningún boot puede vaciar `STATE.equipped`.
5. Ningún panel de debug puede regalar piedras salvo `KELO_ABILITY_DEBUG === true`.
6. Una piedra equipa una sola `abilityKey` válida del catálogo.
7. Recetas del catálogo deben ser únicas.
8. Tres piedras solo pueden fusionarse si comparten `abilityKey` y `tier`.
9. Definiciones de habilidades son inmutables; los afijos se aplican sobre clones runtime.
10. El cliente PvP futuro debe recibir un snapshot del loadout autorizado, no elegir habilidades.

## Contrato PvP preparado

```js
window.KeloAbilities.getLoadoutSnapshot()
```

produce:

```js
{
  schemaVersion: 3,
  size: 5,
  slots: [
    {
      slot: 0,
      stoneUid: 'stone_...',
      abilityId: 1,
      abilityKey: 'fireball',
      recipe: ['fire', 'projectile'],
      tier: 'Epic',
      level: 1,
      affixes: []
    }
  ],
  fingerprint: '...'
}
```

El `fingerprint` sirve para identidad/cache y detección de mismatch. No sustituye autenticación ni autoridad del servidor. En PvP, el servidor debe reconstruir y validar el snapshot contra el inventario persistente del jugador.

## Migración legado

Mapeo temporal:

- `dash` → `wind_dash`
- `shield` → `stone_shield`
- `fireball` → `fireball`
- `frostnova` → `ice_nova`
- `meteor` → `fire_tornado`

Piedras que no puedan migrarse se guardan en `STATE.stoneQuarantine` en vez de desaparecer silenciosamente.

## Tres pasadas de auditoría

### A — Arquitectura

Eliminada la segunda fuente de verdad del hotbar. El runtime deriva todo desde `STATE.equipped`.

### B — Reglas / seguridad

UID por piedra, normalización, migración, validación de fusión y snapshot verificable para futura autoridad de servidor.

### C — UX / escala

Panel de Arsenal usa solo piedras realmente poseídas, muestra receta/tier/afijos, permite ordenar 5 slots y está preparado para catálogos grandes sin branches por habilidad.

## Auditoría

Ejecutar:

```bash
npm run audit:stones
```

Debe producir:

```text
KELO_STONE_AUDIT=PASS
```

La auditoría valida catálogo, recetas, migración, loadout y creación/resolución de 1,000 instancias.
