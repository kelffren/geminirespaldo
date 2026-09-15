/* KELO-INDEX
 * area: VISUAL
 * keys: MELEE SWORD ATTACK REACTION SLASH HITSTOP SFX SEQUENCE MOBILE 8WAY SKIN-AGNOSTIC PERCEPTIBLE IMPACT ALIGNMENT
 * hace: registra el paquete visual data-driven del melee ligero con anticipación, strike-through e impacto corporal perceptibles sin tocar daño, hitbox ni cooldown
 * online: define únicamente IDs/timings de presentación reconstruibles desde eventos semánticos
 * invariant: VFX y motion se anclan al centro lógico del actor, nunca a una skin concreta
 */
(function (root) {
  'use strict';

  const VERSION = 'melee-visual-manifest-v1.3.0-perceptible-impact-motion';
  const IMPACT_AT_MS = 90;
  const ATTACK_DURATION = 0.33;
  const REACTION_DURATION = 0.13;
  const DIRECTIONS_8 = Object.freeze(['up', 'up_right', 'right', 'down_right', 'down', 'down_left', 'left', 'up_left']);
  const VECTORS = Object.freeze({
    up: Object.freeze({ x: 0, y: -1 }),
    up_right: Object.freeze({ x: Math.SQRT1_2, y: -Math.SQRT1_2 }),
    right: Object.freeze({ x: 1, y: 0 }),
    down_right: Object.freeze({ x: Math.SQRT1_2, y: Math.SQRT1_2 }),
    down: Object.freeze({ x: 0, y: 1 }),
    down_left: Object.freeze({ x: -Math.SQRT1_2, y: Math.SQRT1_2 }),
    left: Object.freeze({ x: -1, y: 0 }),
    up_left: Object.freeze({ x: -Math.SQRT1_2, y: -Math.SQRT1_2 })
  });

  const assetRegistry = root.KeloAssetRegistry;
  const animationRegistry = root.KeloAnimationRegistry;
  const fxRegistry = root.KeloFXRegistry;
  const sfxRegistry = root.KeloSFXRegistry;
  const sequenceRegistry = root.KeloSequenceRegistry;

  if (!assetRegistry || !animationRegistry || !fxRegistry || !sfxRegistry || !sequenceRegistry) {
    console.error('[Kelo melee manifest] visual registries unavailable');
    return;
  }

  function freezeFrames(frames) {
    return Object.freeze(frames.map(function (frame) { return Object.freeze(frame); }));
  }

  function registerSafe(registry, def) {
    if (registry.get(def.id)) return def.id;
    return registry.register(Object.freeze(def));
  }

  function motionFor(face, magnitude) {
    const v = VECTORS[face] || VECTORS.down;
    const sign = Math.abs(v.x) > 0.01 ? (v.x > 0 ? 1 : -1) : (v.y > 0 ? -1 : 1);
    return Object.freeze({
      backX: -v.x * 6,
      backY: -v.y * 6,
      strikeX: v.x * magnitude,
      strikeY: v.y * magnitude,
      followX: v.x * magnitude * 0.56,
      followY: v.y * magnitude * 0.56,
      rotation: 0.13 * sign
    });
  }

  function reactionFor(face) {
    const v = VECTORS[face] || VECTORS.down;
    const sign = Math.abs(v.x) > 0.01 ? (v.x > 0 ? 1 : -1) : (v.y > 0 ? -1 : 1);
    return Object.freeze({ x: v.x * 9, y: v.y * 9, rotation: 0.06 * sign });
  }

  const attackMotion = {};
  const reactionMotion = {};
  DIRECTIONS_8.forEach(function (face) {
    attackMotion[face] = motionFor(face, 16);
    reactionMotion[face] = reactionFor(face);
  });

  const slashAssets = {};
  const slashFx = {};
  DIRECTIONS_8.forEach(function (face) {
    const slug = face.replace('_', '-');
    const assetId = 'melee_slash_sword_light_01_' + face + '_asset';
    const fxId = 'melee_slash_sword_light_01_' + face;
    registerSafe(assetRegistry, {
      id: assetId,
      type: 'image',
      src: 'src/visuals/melee-assets/sword-light-slash-' + slug + '.svg',
      preload: true
    });
    registerSafe(fxRegistry, {
      id: fxId,
      type: 'static_sprite',
      assetId: assetId,
      space: 'ACTOR',
      layer: 'actorFrontFX',
      socket: 'center',
      duration: 0.11,
      loop: false,
      width: 94,
      height: 94,
      alpha: 0.96,
      fadeOut: true
    });
    slashAssets[face] = assetId;
    slashFx[face] = fxId;
    assetRegistry.load(assetId);
  });

  const attackClips = {};
  DIRECTIONS_8.forEach(function (face) {
    const m = attackMotion[face];
    const id = 'melee_sword_light_01_' + face;
    registerSafe(animationRegistry, {
      id: id,
      type: 'transform',
      channel: 'action',
      priority: 45,
      duration: ATTACK_DURATION,
      loop: false,
      interruptible: true,
      directions: Object.freeze([face]),
      markers: Object.freeze({ swing: 0.052, impact: IMPACT_AT_MS / 1000, recover: 0.205 }),
      keyframes: freezeFrames([
        { t: 0.00, scaleX: 1.00, scaleY: 1.00, rotation: 0, offsetX: 0, offsetY: 0 },
        { t: 0.12, scaleX: 0.96, scaleY: 1.045, rotation: -m.rotation * 0.52, offsetX: m.backX, offsetY: m.backY },
        { t: 0.28, scaleX: 1.085, scaleY: 0.93, rotation: m.rotation, offsetX: m.strikeX, offsetY: m.strikeY },
        { t: 0.40, scaleX: 1.07, scaleY: 0.945, rotation: m.rotation * 0.80, offsetX: m.strikeX * 0.90, offsetY: m.strikeY * 0.90 },
        { t: 0.66, scaleX: 1.025, scaleY: 0.985, rotation: -m.rotation * 0.30, offsetX: m.followX, offsetY: m.followY },
        { t: 1.00, scaleX: 1.00, scaleY: 1.00, rotation: 0, offsetX: 0, offsetY: 0 }
      ])
    });
    attackClips[face] = id;
  });

  const reactionClips = {};
  DIRECTIONS_8.forEach(function (face) {
    const m = reactionMotion[face];
    const id = 'melee_hit_reaction_light_' + face;
    registerSafe(animationRegistry, {
      id: id,
      type: 'transform',
      channel: 'reaction',
      priority: 60,
      duration: REACTION_DURATION,
      loop: false,
      interruptible: true,
      directions: DIRECTIONS_8,
      keyframes: freezeFrames([
        { t: 0.00, scaleX: 1.00, scaleY: 1.00, rotation: 0, offsetX: 0, offsetY: 0 },
        { t: 0.10, scaleX: 0.985, scaleY: 1.02, rotation: 0, offsetX: 0, offsetY: 0 },
        { t: 0.24, scaleX: 1.06, scaleY: 0.94, rotation: m.rotation, offsetX: m.x, offsetY: m.y },
        { t: 0.52, scaleX: 1.045, scaleY: 0.955, rotation: m.rotation * 0.72, offsetX: m.x * 0.78, offsetY: m.y * 0.78 },
        { t: 1.00, scaleX: 1.00, scaleY: 1.00, rotation: 0, offsetX: 0, offsetY: 0 }
      ])
    });
    reactionClips[face] = id;
  });

  registerSafe(fxRegistry, {
    id: 'melee_hit_sparks_light_01',
    type: 'burst',
    space: 'WORLD',
    layer: 'foregroundFX',
    duration: 0.13,
    loop: false,
    radius: 19,
    color: '#ffd978',
    accent: '#ffffff',
    rays: 7,
    alpha: 0.88
  });

  registerSafe(fxRegistry, {
    id: 'melee_hit_glow_light_01',
    type: 'glow',
    space: 'WORLD',
    layer: 'foregroundFX',
    duration: 0.075,
    loop: false,
    radius: 12,
    color: '#fff7d6',
    alpha: 0.42
  });

  registerSafe(sfxRegistry, {
    id: 'melee_swing_light_01',
    type: 'synth',
    waveform: 'triangle',
    frequency: 520,
    frequencyEnd: 165,
    duration: 0.075,
    gain: 0.027
  });

  registerSafe(sfxRegistry, {
    id: 'melee_hit_light_01',
    type: 'synth',
    waveform: 'sawtooth',
    frequency: 145,
    frequencyEnd: 58,
    duration: 0.085,
    gain: 0.034
  });

  const swingSequences = {};
  DIRECTIONS_8.forEach(function (face) {
    const id = 'sequence_melee_sword_light_01_' + face;
    registerSafe(sequenceRegistry, {
      id: id,
      duration: 180,
      cues: Object.freeze([
        Object.freeze({ at: 52, type: 'sfx', ref: 'melee_swing_light_01' }),
        Object.freeze({ at: 58, type: 'fx', ref: slashFx[face], socket: 'center' })
      ])
    });
    swingSequences[face] = id;
  });

  registerSafe(sequenceRegistry, {
    id: 'sequence_melee_hit_light_01',
    duration: 170,
    cues: Object.freeze([
      Object.freeze({ at: 0, type: 'fx', ref: 'melee_hit_glow_light_01' }),
      Object.freeze({ at: 0, type: 'fx', ref: 'melee_hit_sparks_light_01' }),
      Object.freeze({ at: 0, type: 'sfx', ref: 'melee_hit_light_01' }),
      Object.freeze({ at: 8, type: 'screenFx', ref: 'impact_melee_light' }),
      Object.freeze({ at: 8, type: 'screenFx', ref: 'flash_melee_light' })
    ])
  });

  root.KELO_MELEE_VISUAL_MANIFEST = Object.freeze({
    version: VERSION,
    attackId: 'sword_light_attack_1',
    attackDurationMs: Math.round(ATTACK_DURATION * 1000),
    anticipationMs: 40,
    swingMs: 52,
    impactAtMs: IMPACT_AT_MS,
    recoveryMs: 240,
    reactionDurationMs: Math.round(REACTION_DURATION * 1000),
    visualThrottleMs: 180,
    directions: DIRECTIONS_8,
    attackClips: Object.freeze(attackClips),
    reactionClips: Object.freeze(reactionClips),
    slashAssets: Object.freeze(slashAssets),
    slashFx: Object.freeze(slashFx),
    swingSequences: Object.freeze(swingSequences),
    hitSequence: 'sequence_melee_hit_light_01',
    anchorSocket: 'center',
    skinAgnostic: true,
    perceptualMotion: Object.freeze({
      baseAnticipationPx: 6,
      baseForwardPeakPx: 16,
      baseTravelPx: 22,
      impactAligned: true
    })
  });

  root.KELO_MELEE_VISUAL_AUDIT = Object.assign(root.KELO_MELEE_VISUAL_AUDIT || {}, {
    manifestReady: true,
    version: VERSION,
    attackClips: Object.keys(attackClips).length,
    reactionClips: Object.keys(reactionClips).length,
    slashAssets: Object.keys(slashAssets).length,
    impactAtMs: IMPACT_AT_MS,
    directions: DIRECTIONS_8.length,
    anchorSocket: 'center',
    skinAgnostic: true,
    perceptualMotion: true
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
