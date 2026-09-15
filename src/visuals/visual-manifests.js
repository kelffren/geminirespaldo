/* KELO-INDEX
 * area: VISUAL
 * keys: ASSET ANIMATION VFX PROJECTILE SFX SEQUENCE PROFILE STATUS MANIFEST
 * hace: manifiestos data-driven de piezas visuales reutilizables; ninguna definición depende de una piedra
 * online: solo IDs visuales locales; el cable transporta eventos semánticos y contexto, no estas definiciones
 */
(function (root) {
  'use strict';

  const ASSETS = Object.freeze({
    hero_default_sheet: Object.freeze({
      id: 'hero_default_sheet', type: 'spritesheet', src: 'assets/hero.PNG', preload: false,
      frameWidth: 256, frameHeight: 384, columns: 4, rows: 4
    }),
    sword_swap_activation_eye_asset: Object.freeze({
      id: 'sword_swap_activation_eye_asset', type: 'image',
      src: 'assets/fx/sword-swap/activation-eye.PNG', preload: true
    }),
    sword_swap_activation_eye_anim_asset: Object.freeze({
      id: 'sword_swap_activation_eye_anim_asset', type: 'image',
      src: 'assets/fx/sword-swap/activation-eye-anim.PNG', preload: true,
      frameWidth: 512, frameHeight: 512, columns: 3, rows: 2, frames: 6
    }),
    sword_swap_katana_throw_asset: Object.freeze({
      id: 'sword_swap_katana_throw_asset', type: 'image',
      src: 'assets/fx/sword-swap/katana-throw.PNG', preload: true,
      frameWidth: 362, frameHeight: 724, columns: 6, rows: 1, frames: 6
    })
  });

  const ANIMATION_CLIPS = Object.freeze({
    cast_magic_01: Object.freeze({
      id: 'cast_magic_01', type: 'transform', channel: 'action', priority: 40,
      duration: 0.42, loop: false, interruptible: true,
      directions: Object.freeze(['up', 'down', 'left', 'right']), mirrorLeftFromRight: false,
      markers: Object.freeze({ release: 0.20, recover: 0.34 }),
      keyframes: Object.freeze([
        Object.freeze({ t: 0.00, scaleX: 1.00, scaleY: 1.00, rotation: 0, offsetX: 0, offsetY: 0 }),
        Object.freeze({ t: 0.22, scaleX: 0.96, scaleY: 1.04, rotation: -0.035, offsetX: 0, offsetY: -1 }),
        Object.freeze({ t: 0.52, scaleX: 1.07, scaleY: 0.96, rotation: 0.045, offsetX: 2, offsetY: 0 }),
        Object.freeze({ t: 1.00, scaleX: 1.00, scaleY: 1.00, rotation: 0, offsetX: 0, offsetY: 0 })
      ])
    }),
    cast_self_01: Object.freeze({
      id: 'cast_self_01', type: 'transform', channel: 'action', priority: 38,
      duration: 0.36, loop: false, interruptible: true,
      directions: Object.freeze(['up', 'down', 'left', 'right']), mirrorLeftFromRight: false,
      markers: Object.freeze({ release: 0.18, recover: 0.30 }),
      keyframes: Object.freeze([
        Object.freeze({ t: 0.00, scaleX: 1, scaleY: 1, rotation: 0, offsetX: 0, offsetY: 0 }),
        Object.freeze({ t: 0.45, scaleX: 1.04, scaleY: 0.96, rotation: 0, offsetX: 0, offsetY: 2 }),
        Object.freeze({ t: 1.00, scaleX: 1, scaleY: 1, rotation: 0, offsetX: 0, offsetY: 0 })
      ])
    })
  });

  const FX = Object.freeze({
    fire_hand_charge_small: Object.freeze({
      id: 'fire_hand_charge_small', type: 'glow', space: 'ACTOR', layer: 'actorFrontFX',
      socket: 'castOrigin', duration: 0.34, loop: false, radius: 16, color: '#ff8a3d', alpha: 0.52
    }),
    fire_muzzle_flash: Object.freeze({
      id: 'fire_muzzle_flash', type: 'burst', space: 'ACTOR', layer: 'actorFrontFX',
      socket: 'castOrigin', duration: 0.18, loop: false, radius: 24, color: '#ffd27a', rays: 8, alpha: 0.9
    }),
    fire_trail_01: Object.freeze({
      id: 'fire_trail_01', type: 'trail', space: 'WORLD', layer: 'foregroundFX',
      duration: 0.32, loop: false, radius: 8, color: '#ff6b35', alpha: 0.48
    }),
    fire_explosion_medium: Object.freeze({
      id: 'fire_explosion_medium', type: 'burst', space: 'WORLD', layer: 'foregroundFX',
      duration: 0.52, loop: false, radius: 64, color: '#ff6b35', accent: '#ffd166', rays: 16, alpha: 0.95
    }),
    burn_body_small: Object.freeze({
      id: 'burn_body_small', type: 'particle_emitter', space: 'ACTOR', layer: 'actorFrontFX',
      socket: 'center', duration: 1.0, loop: true, radius: 28, color: '#ff8c42', particleCount: 8, alpha: 0.72
    }),
    magic_ground_ring_01: Object.freeze({
      id: 'magic_ground_ring_01', type: 'ring', space: 'WORLD', layer: 'groundFX',
      duration: 0.8, loop: false, radius: 42, color: '#e7c56a', alpha: 0.42
    }),
    shield_ring_01: Object.freeze({
      id: 'shield_ring_01', type: 'ring', space: 'ACTOR', layer: 'actorFrontFX',
      socket: 'center', duration: 0.65, loop: false, radius: 34, color: '#ffd166', alpha: 0.58
    }),
    fire_impact_ring_01: Object.freeze({
      id: 'fire_impact_ring_01', type: 'expanding_ring', space: 'WORLD', layer: 'foregroundFX',
      duration: 0.32, loop: false, radius: 52, aspect: 1, color: '#ffb347', innerColor: '#ffe0a3',
      lineWidth: 3.8, alpha: 0.95, fade: 'out'
    }),
    ice_hand_charge_small: Object.freeze({
      id: 'ice_hand_charge_small', type: 'glow', space: 'ACTOR', layer: 'actorFrontFX',
      socket: 'castOrigin', duration: 0.32, loop: false, radius: 15, color: '#9ad8ff', alpha: 0.55
    }),
    ice_nova_fill_01: Object.freeze({
      id: 'ice_nova_fill_01', type: 'area_disk', space: 'WORLD', layer: 'groundFX',
      duration: 0.46, loop: false, radius: 130, aspect: 1, color: 'rgba(126,200,255,0.28)',
      accent: '#c9ecff', lineWidth: 2.6, alpha: 0.9, fade: 'in-out'
    }),
    ice_nova_ring_01: Object.freeze({
      id: 'ice_nova_ring_01', type: 'expanding_ring', space: 'WORLD', layer: 'foregroundFX',
      duration: 0.48, loop: false, radius: 130, aspect: 1, startScale: 0.12,
      color: '#7ec8ff', innerColor: '#e8f7ff', lineWidth: 4.2, alpha: 1, fade: 'out'
    }),
    ice_nova_shards_01: Object.freeze({
      id: 'ice_nova_shards_01', type: 'crystal_burst', space: 'WORLD', layer: 'foregroundFX',
      duration: 0.38, loop: false, radius: 92, aspect: 1, shards: 10, color: '#bfe7ff',
      accent: '#ffffff', alpha: 0.92, fade: 'out'
    }),
    ice_frost_pulse_01: Object.freeze({
      id: 'ice_frost_pulse_01', type: 'ring', space: 'WORLD', layer: 'groundFX',
      duration: 0.55, loop: false, radius: 118, aspect: 1, color: '#a8d8ff', alpha: 0.5, fade: 'out'
    }),
    wind_dash_burst_01: Object.freeze({
      id: 'wind_dash_burst_01', type: 'burst', space: 'WORLD', layer: 'actorFrontFX',
      duration: 0.22, loop: false, radius: 28, color: '#b8f2e6', accent: '#ffffff', rays: 8, alpha: 0.82
    }),
    wind_dash_streak_01: Object.freeze({
      id: 'wind_dash_streak_01', type: 'streak', space: 'WORLD', layer: 'foregroundFX',
      duration: 0.28, loop: false, length: 86, width: 16, color: '#9be7d4', accent: '#f4fffb',
      alpha: 0.95, fade: 'out'
    }),
    wind_dash_end_01: Object.freeze({
      id: 'wind_dash_end_01', type: 'ring', space: 'WORLD', layer: 'groundFX',
      duration: 0.22, loop: false, radius: 26, aspect: 0.7, color: '#d7fff4', alpha: 0.7, fade: 'out'
    }),
    poison_trap_place_01: Object.freeze({
      id: 'poison_trap_place_01', type: 'burst', space: 'WORLD', layer: 'worldFX',
      duration: 0.28, loop: false, radius: 26, color: '#8ac926', accent: '#d4ff6a', rays: 7, alpha: 0.85
    }),
    poison_trap_sigil_01: Object.freeze({
      id: 'poison_trap_sigil_01', type: 'sigil', space: 'WORLD', layer: 'foregroundFX',
      duration: 0.9, loop: true, radius: 22, color: '#8ac926', accent: '#d8ff8a', alpha: 0.95, fade: 'pulse'
    }),
    poison_trap_area_01: Object.freeze({
      id: 'poison_trap_area_01', type: 'area_disk', space: 'WORLD', layer: 'groundFX',
      duration: 0.9, loop: true, radius: 55, aspect: 1, color: 'rgba(138,201,38,0.16)',
      accent: '#b6e85a', lineWidth: 2, alpha: 0.8, fade: 'pulse'
    }),
    poison_trap_trigger_01: Object.freeze({
      id: 'poison_trap_trigger_01', type: 'burst', space: 'WORLD', layer: 'foregroundFX',
      duration: 0.4, loop: false, radius: 48, color: '#8ac926', accent: '#f1ffb0', rays: 12, alpha: 0.92
    }),
    poison_trap_armed_01: Object.freeze({
      id: 'poison_trap_armed_01', type: 'expanding_ring', space: 'WORLD', layer: 'foregroundFX',
      duration: 0.32, loop: false, radius: 55, aspect: 1, startScale: 0.4,
      color: '#d8ff8a', innerColor: '#8ac926', lineWidth: 3.2, alpha: 0.95, fade: 'out'
    }),
    poison_body_small: Object.freeze({
      id: 'poison_body_small', type: 'particle_emitter', space: 'ACTOR', layer: 'actorFrontFX',
      socket: 'center', duration: 1.0, loop: true, radius: 26, color: '#8ac926', particleCount: 7, alpha: 0.7
    }),
    slow_body_small: Object.freeze({
      id: 'slow_body_small', type: 'ring', space: 'ACTOR', layer: 'actorFrontFX',
      socket: 'center', duration: 0.8, loop: true, radius: 22, aspect: 0.55, color: '#7ec8ff', alpha: 0.5, fade: 'pulse'
    }),
    sword_swap_activation_eye: Object.freeze({
      id: 'sword_swap_activation_eye', type: 'static_sprite', assetId: 'sword_swap_activation_eye_asset',
      space: 'ACTOR', layer: 'actorFrontFX', socket: 'head', duration: 0.35, loop: false,
      width: 72, height: 72, alpha: 1
    }),
    sword_swap_activation_eye_anim: Object.freeze({
      id: 'sword_swap_activation_eye_anim', type: 'sprite_animation', assetId: 'sword_swap_activation_eye_anim_asset',
      frameWidth: 512, frameHeight: 512, columns: 3, rows: 2, frames: 6, fps: 12,
      space: 'ACTOR', layer: 'actorFrontFX', socket: 'head', duration: 0.5, loop: false,
      width: 92, height: 92, offset: Object.freeze({ x: 0, y: -10 }), alpha: 1, fadeOut: false
    })
  });

  const PROJECTILE_VISUALS = Object.freeze({
    projectile_fire_orb_01: Object.freeze({
      id: 'projectile_fire_orb_01', type: 'orb', layer: 'foregroundFX', radius: 15,
      color: '#ff6b35', coreColor: '#ffe0a3', glowRadius: 32, trailRef: 'fire_trail_01',
      defaultSpeed: 420, defaultMaxDistance: 500
    }),
    sword_swap_katana_throw_visual: Object.freeze({
      id: 'sword_swap_katana_throw_visual', type: 'sprite_animation',
      assetId: 'sword_swap_katana_throw_asset', layer: 'worldFX',
      frames: 6, fps: 12, loop: true,
      frameRects: Object.freeze([
        Object.freeze({ x: 16, y: 299, width: 290, height: 119 }),
        Object.freeze({ x: 333, y: 299, width: 302, height: 123 }),
        Object.freeze({ x: 661, y: 277, width: 321, height: 159 }),
        Object.freeze({ x: 997, y: 273, width: 365, height: 190 }),
        Object.freeze({ x: 1373, y: 271, width: 385, height: 188 }),
        Object.freeze({ x: 1768, y: 248, width: 394, height: 260 })
      ]),
      sourcePixelScale: 0.348, width: 140, height: 94,
      alpha: 1, alignToVelocity: true, rotationOffset: 0,
      defaultSpeed: 720, defaultMaxDistance: 420
    })
  });

  const SFX = Object.freeze({
    fire_cast_01: Object.freeze({
      id: 'fire_cast_01', type: 'synth', waveform: 'triangle', frequency: 180,
      frequencyEnd: 480, duration: 0.18, gain: 0.055
    }),
    fire_impact_01: Object.freeze({
      id: 'fire_impact_01', type: 'synth', waveform: 'sawtooth', frequency: 120,
      frequencyEnd: 55, duration: 0.15, gain: 0.045
    }),
    ice_cast_01: Object.freeze({
      id: 'ice_cast_01', type: 'synth', waveform: 'sine', frequency: 420,
      frequencyEnd: 880, duration: 0.16, gain: 0.04
    }),
    ice_impact_01: Object.freeze({
      id: 'ice_impact_01', type: 'synth', waveform: 'triangle', frequency: 260,
      frequencyEnd: 90, duration: 0.18, gain: 0.05
    }),
    wind_dash_01: Object.freeze({
      id: 'wind_dash_01', type: 'synth', waveform: 'sawtooth', frequency: 240,
      frequencyEnd: 720, duration: 0.14, gain: 0.035
    }),
    poison_place_01: Object.freeze({
      id: 'poison_place_01', type: 'synth', waveform: 'triangle', frequency: 140,
      frequencyEnd: 90, duration: 0.16, gain: 0.035
    }),
    poison_trigger_01: Object.freeze({
      id: 'poison_trigger_01', type: 'synth', waveform: 'square', frequency: 90,
      frequencyEnd: 40, duration: 0.18, gain: 0.04
    })
  });

  const SCREEN_FX = Object.freeze({
    impact_medium: Object.freeze({ id: 'impact_medium', type: 'shake', duration: 0.16, amplitude: 3.5 }),
    flash_warm_small: Object.freeze({ id: 'flash_warm_small', type: 'flash', duration: 0.10, alpha: 0.08, color: '#ffd7a1' }),
    impact_melee_light: Object.freeze({ id: 'impact_melee_light', type: 'shake', duration: 0.075, amplitude: 1.65 }),
    flash_melee_light: Object.freeze({ id: 'flash_melee_light', type: 'flash', duration: 0.055, alpha: 0.025, color: '#fff1c4' }),
    impact_ice: Object.freeze({ id: 'impact_ice', type: 'shake', duration: 0.14, amplitude: 2.8 }),
    flash_ice_small: Object.freeze({ id: 'flash_ice_small', type: 'flash', duration: 0.09, alpha: 0.06, color: '#cfefff' })
  });

  const SEQUENCES = Object.freeze({
    sequence_fire_cast_01: Object.freeze({
      id: 'sequence_fire_cast_01', duration: 420,
      cues: Object.freeze([
        Object.freeze({ at: 0, type: 'actorAnimation', ref: 'cast_magic_01' }),
        Object.freeze({ at: 40, type: 'fx', ref: 'fire_hand_charge_small', socket: 'castOrigin' }),
        Object.freeze({ at: 150, type: 'sfx', ref: 'fire_cast_01' }),
        Object.freeze({ at: 200, type: 'fx', ref: 'fire_muzzle_flash', socket: 'castOrigin' })
      ])
    }),
    sequence_fire_impact_01: Object.freeze({
      id: 'sequence_fire_impact_01', duration: 560,
      cues: Object.freeze([
        Object.freeze({ at: 0, type: 'fx', ref: 'fire_explosion_medium' }),
        Object.freeze({ at: 0, type: 'fx', ref: 'fire_impact_ring_01' }),
        Object.freeze({ at: 0, type: 'sfx', ref: 'fire_impact_01' }),
        Object.freeze({ at: 16, type: 'screenFx', ref: 'impact_medium' })
      ])
    }),
    sequence_debug_explosion_reuse: Object.freeze({
      id: 'sequence_debug_explosion_reuse', duration: 600,
      cues: Object.freeze([
        Object.freeze({ at: 0, type: 'fx', ref: 'magic_ground_ring_01' }),
        Object.freeze({ at: 180, type: 'fx', ref: 'fire_explosion_medium' })
      ])
    }),
    sequence_sword_swap_activation_eye: Object.freeze({
      id: 'sequence_sword_swap_activation_eye', duration: 350,
      cues: Object.freeze([
        Object.freeze({ at: 0, type: 'fx', ref: 'sword_swap_activation_eye', socket: 'head' })
      ])
    }),
    sequence_sword_swap_activation_eye_anim: Object.freeze({
      id: 'sequence_sword_swap_activation_eye_anim', duration: 500,
      cues: Object.freeze([
        Object.freeze({ at: 0, type: 'fx', ref: 'sword_swap_activation_eye_anim', socket: 'head' })
      ])
    }),
    sequence_ice_nova_cast_01: Object.freeze({
      id: 'sequence_ice_nova_cast_01', duration: 360,
      cues: Object.freeze([
        Object.freeze({ at: 0, type: 'actorAnimation', ref: 'cast_self_01' }),
        Object.freeze({ at: 30, type: 'fx', ref: 'ice_hand_charge_small', socket: 'castOrigin' }),
        Object.freeze({ at: 90, type: 'sfx', ref: 'ice_cast_01' })
      ])
    }),
    sequence_ice_nova_impact_01: Object.freeze({
      id: 'sequence_ice_nova_impact_01', duration: 520,
      cues: Object.freeze([
        Object.freeze({ at: 0, type: 'fx', ref: 'ice_nova_fill_01' }),
        Object.freeze({ at: 0, type: 'fx', ref: 'ice_nova_ring_01' }),
        Object.freeze({ at: 40, type: 'fx', ref: 'ice_nova_shards_01' }),
        Object.freeze({ at: 80, type: 'fx', ref: 'ice_frost_pulse_01' }),
        Object.freeze({ at: 0, type: 'sfx', ref: 'ice_impact_01' }),
        Object.freeze({ at: 20, type: 'screenFx', ref: 'impact_ice' }),
        Object.freeze({ at: 20, type: 'screenFx', ref: 'flash_ice_small' })
      ])
    }),
    sequence_wind_dash_01: Object.freeze({
      id: 'sequence_wind_dash_01', duration: 280,
      cues: Object.freeze([
        Object.freeze({ at: 0, type: 'fx', ref: 'wind_dash_burst_01' }),
        Object.freeze({ at: 0, type: 'fx', ref: 'wind_dash_streak_01' }),
        Object.freeze({ at: 20, type: 'sfx', ref: 'wind_dash_01' })
      ])
    }),
    sequence_wind_dash_end_01: Object.freeze({
      id: 'sequence_wind_dash_end_01', duration: 220,
      cues: Object.freeze([
        Object.freeze({ at: 0, type: 'fx', ref: 'wind_dash_end_01' })
      ])
    }),
    sequence_poison_trap_cast_01: Object.freeze({
      id: 'sequence_poison_trap_cast_01', duration: 320,
      cues: Object.freeze([
        Object.freeze({ at: 0, type: 'actorAnimation', ref: 'cast_magic_01' }),
        Object.freeze({ at: 80, type: 'sfx', ref: 'poison_place_01' })
      ])
    }),
    sequence_poison_trap_place_01: Object.freeze({
      id: 'sequence_poison_trap_place_01', duration: 280,
      cues: Object.freeze([
        Object.freeze({ at: 0, type: 'fx', ref: 'poison_trap_place_01' })
      ])
    }),
    sequence_poison_trap_trigger_01: Object.freeze({
      id: 'sequence_poison_trap_trigger_01', duration: 420,
      cues: Object.freeze([
        Object.freeze({ at: 0, type: 'fx', ref: 'poison_trap_trigger_01' }),
        Object.freeze({ at: 0, type: 'sfx', ref: 'poison_trigger_01' })
      ])
    })
  });

  const VISUAL_PROFILES = Object.freeze({
    ability_visual_fireball_01: Object.freeze({
      id: 'ability_visual_fireball_01', abilityKey: 'fireball',
      castSequence: 'sequence_fire_cast_01',
      projectileVisual: 'projectile_fire_orb_01',
      impactSequence: 'sequence_fire_impact_01',
      statusVisuals: Object.freeze({ burn: 'burn_body_small' })
    }),
    ability_visual_ice_nova_01: Object.freeze({
      id: 'ability_visual_ice_nova_01', abilityKey: 'ice_nova',
      castSequence: 'sequence_ice_nova_cast_01',
      impactSequence: 'sequence_ice_nova_impact_01',
      areaFx: 'ice_nova_fill_01',
      statusVisuals: Object.freeze({ slow: 'slow_body_small' })
    }),
    ability_visual_wind_dash_01: Object.freeze({
      id: 'ability_visual_wind_dash_01', abilityKey: 'wind_dash',
      castSequence: 'sequence_wind_dash_01',
      dashSequence: 'sequence_wind_dash_01',
      dashEndSequence: 'sequence_wind_dash_end_01',
      travelEffect: 'wind_dash_streak_01'
    }),
    ability_visual_poison_trap_01: Object.freeze({
      id: 'ability_visual_poison_trap_01', abilityKey: 'poison_trap',
      castSequence: 'sequence_poison_trap_cast_01',
      placeSequence: 'sequence_poison_trap_place_01',
      persistentFx: 'poison_trap_sigil_01',
      areaFx: 'poison_trap_area_01',
      armedFx: 'poison_trap_armed_01',
      triggerSequence: 'sequence_poison_trap_trigger_01',
      statusVisuals: Object.freeze({ poison: 'poison_body_small' })
    }),
    ability_visual_sword_swap_01: Object.freeze({
      id: 'ability_visual_sword_swap_01', abilityKey: 'swap_sword',
      castSequence: 'sequence_sword_swap_activation_eye_anim',
      throwVisual: 'sword_swap_katana_throw_visual'
    })
  });

  const STATUS_VISUALS = Object.freeze({
    burn: 'burn_body_small',
    shield: 'shield_ring_01',
    poison: 'poison_body_small',
    slow: 'slow_body_small'
  });

  root.KELO_VISUAL_MANIFESTS = Object.freeze({
    version: 'visual-manifests-v1.4.0',
    assets: ASSETS,
    animationClips: ANIMATION_CLIPS,
    fx: FX,
    projectileVisuals: PROJECTILE_VISUALS,
    sfx: SFX,
    screenFx: SCREEN_FX,
    sequences: SEQUENCES,
    visualProfiles: VISUAL_PROFILES,
    statusVisuals: STATUS_VISUALS
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
