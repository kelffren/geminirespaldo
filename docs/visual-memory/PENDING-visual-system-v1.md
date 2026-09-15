## Validated Visual System V1 — modular ability animation/VFX contract (2026-09-05)

- Kelo World V6.26 now has a modular client visual pipeline whose reusable units are **asset → component → optional sequence → optional visual profile**. No visual component may require a Stone or Ability merely to exist or preview.
- OWNER LIVE split: `visual-manifests.js` definitions; `asset-registry.js` asset IDs/preload; `animation-system.js` actor clips/channels/anchors; `fx-system.js` VFX/projectile visuals/SFX/screen effects; `sequence-system.js` timelines; `ability-visuals.js` optional Ability→profile resolution; `visual-system.js` event/context/audit; `engine-c.js` world layer insertion; `visual-integration.js` final actor bridge.
- Stable visual layers are `groundFX → belowActor → actorBackFX → actor → actorFrontFX → worldFX → foregroundFX → screenFX → UI`.
- Actor action transforms pivot from the existing `KELO_AVATAR_PRESENTATION` foot-root contract; visual actions must not mutate physics/movement. LIVE retained `footRootY = physicsRootY + 10` and `MOV-plant-audit-v1`.
- Fireball is the pilot profile `ability_visual_fireball_01`; the profile only references reusable cast/FX/projectile/impact/status pieces. The old primitive remains a compatibility fallback and is restored when the visual resolver is disabled.
- LIVE mobile validation proved AnimationClip, VFX, ProjectileVisual, Sequence and SFX can execute independently with no equipped Stone/Ability requirement and without changing player x/y/collider.
- LIVE also proved Fireball gameplay remains valid with `KeloAbilityVisuals` disabled (mana 100→80, cooldown 4) and that a remote actor replays through the same semantic visual event path.
- Online visual replication sends semantic event/context IDs (`castId`, ability ID, origin/direction, visual seed, etc.), never frames, particles, Canvas/Image objects or per-particle coordinates. The current server relay is presentation-only; it does not make Ability gameplay server-authoritative.
- `?visualLab=1` is the development gallery for isolated visual previews and must not become normal production UI.
- Final authored spell art/audio can replace the pilot procedural/synth pieces without changing these contracts.
