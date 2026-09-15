/* KELO-INDEX
 * area: QA
 * keys: VISUAL PROFILE FIREBALL ICE NOVA WIND DASH POISON TRAP FX SEQUENCE
 * purpose: valida que 4 familias de ability (proyectil, AoE, dash, trampa) resuelven perfiles reutilizables sin hardcodear VFX en StoneSystem
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const manifests = read('src/visuals/visual-manifests.js');
const abilityVisuals = read('src/visuals/ability-visuals.js');
const abilityData = read('src/abilities/abilityData.js');
const boot = read('src/abilities/kelo-ability-boot.js');
const stone = read('src/abilities/stone-system.js');
const lab = read('src/visuals/visual-lab.js');
const fx = read('src/visuals/fx-system.js');

const required = [
  ['fireball', 'ability_visual_fireball_01', 'sequence_fire_cast_01', 'projectile_fire_orb_01', 'sequence_fire_impact_01'],
  ['ice_nova', 'ability_visual_ice_nova_01', 'sequence_ice_nova_cast_01', 'sequence_ice_nova_impact_01', 'ice_nova_ring_01'],
  ['wind_dash', 'ability_visual_wind_dash_01', 'sequence_wind_dash_01', 'sequence_wind_dash_end_01', 'wind_dash_streak_01'],
  ['poison_trap', 'ability_visual_poison_trap_01', 'sequence_poison_trap_place_01', 'poison_trap_sigil_01', 'sequence_poison_trap_trigger_01']
];

required.forEach(function (row) {
  row.forEach(function (token) {
    assert(manifests.includes(token), 'manifest missing ' + token);
    if (row[0] === token || row[1] === token) assert(abilityData.includes(token), 'abilityData missing ' + token);
  });
});

['ice_nova_fill_01', 'ice_nova_shards_01', 'poison_trap_area_01', 'poison_trap_armed_01', 'wind_dash_burst_01'].forEach(function (id) {
  assert(manifests.includes(id), 'missing reusable FX ' + id);
});

['expanding_ring', 'area_disk', 'crystal_burst', 'sigil', 'streak'].forEach(function (type) {
  assert(fx.includes("type === '" + type + "'") || fx.includes("type === '" + type + "' ||"), 'FX dispatcher missing ' + type);
});

assert(abilityVisuals.includes('playCue'), 'resolver exposes playCue');
assert(abilityVisuals.includes("'dash'") && abilityVisuals.includes("'place'") && abilityVisuals.includes("'trigger'"), 'playCue covers dash/place/trigger families');
assert(abilityVisuals.includes('activeTrapVisuals') && abilityVisuals.includes('stopTrapVisuals'), 'trap visuals are pooled/stopped by trapId');
assert(boot.includes('TRAP_PLACED') && boot.includes('TRAP_ARMED') && boot.includes('TRAP_TRIGGERED') && boot.includes('TRAP_EXPIRED'), 'boot emits trap semantic events');
assert(boot.includes('DASH_STARTED') && boot.includes('DASH_ENDED'), 'boot emits dash semantic events');
assert(!stone.includes('KeloFX') && !stone.includes('KeloSequence') && !stone.includes('KeloVisualProfile'), 'StoneSystem stays visual-agnostic');
assert(lab.includes('playAbilityCue') || lab.includes('playFull'), 'Visual Lab can preview ability profiles with the same playCue path');
assert(lab.includes('PLAY FULL') && lab.includes('TEST IN GAME') && lab.includes('visualLabStop'), 'Visual Lab exposes play-full, in-game and stop');
assert(lab.includes('MISSING') && lab.includes('visualLabTab'), 'Visual Lab lists missing profiles and splits Abilities/Piezas');
assert(lab.includes('visualLabPin') && lab.includes('visualLabLoop') && lab.includes('visualLabGhost'), 'Visual Lab exposes pin, loop and range ghost');
assert(lab.includes('lab_radius_ghost') && lab.includes('lab_dummy_hit'), 'Visual Lab draws combat-range ghost and dummy hit');
assert(lab.includes("dataset.visualLabCue = 'area'") || lab.includes("addCue('area'"), 'Visual Lab exposes AREA cue');
assert(lab.includes("addCue('arm'") && lab.includes("addCue('end'"), 'Visual Lab exposes ARM and END cues');
assert(lab.includes('visualLabPad') && lab.includes('up-right'), 'Visual Lab exposes 8-direction pad');
assert(lab.includes('visualLabFamily') && lab.includes('visualLabTap') && lab.includes('visualLabCam'), 'Visual Lab exposes family filter, tap-set dummy and camera peek');
assert(lab.includes('lab_origin_ghost') && lab.includes('kelo-visual-lab-prefs-v1'), 'Visual Lab draws origin ghost and persists prefs');
assert(fx.includes('stopAllFx') && fx.includes('stopAll: stopAllFx'), 'FX runtime can stop all preview instances');
assert(abilityVisuals.includes("cue === 'arm'") || abilityVisuals.includes("'arm'"), 'playCue covers trap ARM');

console.log('PASS ability visual profiles (fireball/ice_nova/wind_dash/poison_trap)');
console.log(JSON.stringify({
  profiles: 4,
  families: ['projectile', 'self_aoe', 'dash', 'trap'],
  stoneDecoupled: true,
  trapEvents: true,
  dashEvents: true,
  visualLabPlayCue: true
}, null, 2));
