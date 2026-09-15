# KELO WORLD — PVP WORLD V1

Status: vertical slice / local authority

## Owners

- Social/world input, movement, physics and camera remain owned by `engine-a.js` with the existing later movement wrappers.
- Ability definitions remain owned by `src/abilities/abilityData.js`.
- Ability loadout/cooldowns remain owned by `src/abilities/stone-system.js` + `src/abilities/kelo-ability-boot.js`.
- PvP world mode, combat permission, target selection, basic-attack command/result boundary and PvP presentation are owned by `src/systems/pvp-world.js`.
- Multiplayer transport remains owned by `engine-net.js` and `server/index.js`.

## PERMANENT RULE — EVERY NEW ABILITY MUST BE ONLINE-READY

This is a mandatory architecture rule for all future Kelo World abilities/stones, even while the game is running with local authority.

**Every new ability MUST be designed so multiplayer integration replaces/connects the authority layer instead of requiring the ability to be rewritten.**

Required pipeline:

`Input -> Ability/Combat Command -> Authority -> Simulation/Validation -> Result -> Presentation`

Minimum command/contract fields when applicable:
- `abilityId`
- `casterId`
- `targetId` or explicit target position/direction
- cast/request id
- world/room/zone context
- authoritative state needed to validate range, cooldown and resource cost

Rules:
1. Input/UI/render/VFX MUST NOT directly mutate authoritative HP, positions, cooldowns or persistent combat state.
2. Local/offline execution must live behind an authority boundary that can later become server authority.
3. Damage, healing, teleport/swap, crowd control, projectile impacts, persistent entities, resource spending, death and cooldown start must have explicit command/result semantics.
4. Persistent ability objects (projectiles, traps, planted swords, walls, summons, zones, etc.) need stable IDs and serializable state suitable for network replication.
5. Target/range/collision checks must use world/simulation coordinates, never visual sprite size as authority.
6. Presentation may predict/animate locally for responsiveness, but the authoritative result must be reconcilable with a future server result.
7. Cooldown must have one logical source of truth. Online, the server/authority decides when it starts and the client HUD presents that result.
8. Abilities involving another player or position changes must be designed against player/entity IDs, not direct references to local JavaScript objects.
9. A new ability is architecturally incomplete if moving it online would require rewriting its gameplay rules rather than connecting `LocalAuthority -> ServerAuthority`.
10. Before accepting a new ability implementation, ask: **If multiplayer authority were enabled tomorrow, what code survives unchanged and what authority adapter changes?**

Canonical migration target:

`Local Ability Authority -> Server Ability Authority`

while keeping definitions, commands, results, targeting semantics, HUD and VFX/presentation reusable.

Example — Swap Sword:
- client input requests sword throw / target selection;
- authority owns sword entity id/state, validates target/range and resolves the swap;
- authority emits the resulting positions and cooldown start;
- presentation owns sword flight, planted effect, swap VFX and sword return animation.

## World boundary

Social mode:
- `window.KELO_COMBAT_ENABLED = false`
- body keeps `social-mode`
- action bar is hidden
- PvP dummy/arena overlay is inactive

PvP mode:
- `window.KELO_COMBAT_ENABLED = true`
- player is moved into the isolated PvP test space
- action bar becomes visible
- one existing simulated player is temporarily reused as the combat dummy so the current Ability Engine can interact with the same entity contract
- leaving restores the social position and dummy state

## Command boundary

The first local-authority slice uses:

`Input -> Combat Command -> Local Combat Authority -> Combat Result -> Presentation`

Commands currently implemented by the PvP layer:
- `SELECT_TARGET`
- `BASIC_ATTACK`
- `CAST_ABILITY`

The basic attack modifies HP only inside the local combat simulation/authority path, never directly from the pointer handler or renderer.

## Mobile interaction

- Tap an enemy: select it and attempt a basic attack.
- Tap a skill slot: arm it.
- Tap enemy/ground: submit the ability request according to its targeting type.
- Self-target abilities execute immediately.
- Existing left-side joystick remains the movement system; PvP does not introduce a second movement engine.

## Multiplayer migration rule

The components intended to survive server-authoritative multiplayer are:
- ability definitions
- loadout and cooldown representation
- combat command shape
- combat result shape
- targeting semantics
- HUD
- VFX/presentation

The layer expected to change is the execution authority:

`Local Combat Authority -> Server Combat Authority`

The current server already has an authoritative `combat:resolve` path for Nobleza damage modifiers, but it is not yet a complete authoritative PvP simulation for targets, cooldowns, projectiles, positions or deaths.

## Known V1 limitation

The current Ability Engine itself predates this world-permission layer. The social UI hides all ability input, and the PvP system owns the intended combat input path, but `KeloAbilities.engine.cast()` does not yet independently reject a direct programmatic cast while outside PvP. Before competitive/network PvP, world permission must be enforced inside the combat/ability validation boundary or its future server authority, not only by input routing.

## Next verification

A dedicated LIVE PvP audit should prove:
- social -> PvP -> social
- action bar hidden/visible/hidden
- dummy selection
- basic attack damage
- ability arm + tap cast
- cooldown visible
- death
- movement/reversal/diagonal unchanged
- 0 JS/network failures
- mobile and desktop
