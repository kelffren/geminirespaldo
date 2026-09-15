/* KELO-INDEX
 * area: QA / PVP / MOVEMENT / APPEARANCE
 * owner: FOUNDATION CI
 * keys: PVP AIM FACING MOVEMENT APPEARANCE CONTRACT ONLINE STRAFE COMMITMENT PLANT REVERSAL 60HZ 90HZ 120HZ
 * purpose: valida aim/locomoción independientes, continuidad de reversal y que Appearance respete el plant frame publicado por Movement al quedar idle
 * public-api: CLI `node scripts/pvp-aim-facing-audit.js`
 * consumes: engine-ac.js, src/characters/character-appearance.js
 * state-owned: ninguno
 * extension-points: contrato presentación move+aim independiente + stride/plant publicado por KeloMovement
 * reuse: regresión PvP desktop/touch/controller; no decide gameplay
 * legacy: N/A
 * do-not: no sustituir smoke browser ni autoridad server
 */
'use strict';

const fs = require('fs');
const vm = require('vm');

const acSource = fs.readFileSync('engine-ac.js', 'utf8');
const appearanceSource = fs.readFileSync('src/characters/character-appearance.js', 'utf8');

function ok(condition, message) {
  if (!condition) throw new Error('PVP_AIM_FACING_FAIL:' + message);
}

function createMovementHarness(combatEnabled) {
  const hooks = {};
  const context = {
    console,
    URLSearchParams,
    location: { search: '' },
    CONFIG: {},
    input: {
      normX: 1,
      normY: 0,
      touchActive: false,
      currentX: 0,
      currentY: 0,
      originX: 0,
      originY: 0
    },
    localPlayer: { x: 0, y: 0, vx: 100, vy: 0, radius: 20, _face: 'up' },
    KELO_COMBAT_ENABLED: combatEnabled,
    KeloMovementProfile: {
      version: 'audit-profile',
      profile: { walkSpeed: 110, gaitRunStart: 0.7 },
      speedCapForMagnitude(mag) { return mag <= 0 ? 110 : 185.28; },
      gaitForMagnitude(mag) { return mag <= 0 ? 'idle' : mag >= 0.7 ? 'run' : 'walk'; }
    },
    KeloMovement: {
      before(id, fn) { hooks.before = fn; return id; },
      after(id, fn) { hooks.after = fn; return id; }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(acSource, context, { filename: 'engine-ac.js' });
  return { context, hooks };
}

function movementContext(combatEnabled) {
  const harness = createMovementHarness(combatEnabled);
  harness.hooks.before();
  harness.context.localPlayer.x = 10;
  harness.hooks.after({ dt: 1 / 60 });
  return harness.context;
}

function reversalContext(hz) {
  const harness = createMovementHarness(false);
  const context = harness.context;
  const hooks = harness.hooks;
  const dt = 1 / hz;

  hooks.before();
  context.localPlayer.vx = 185.28;
  context.localPlayer.x += 185.28 * dt;
  hooks.after({ dt });
  const before = Object.assign({}, context.KELO_MOVEMENT_AUDIT);

  context.input.normX = -1;
  hooks.before();
  context.localPlayer.vx = -185.28;
  context.localPlayer.x -= 185.28 * dt;
  hooks.after({ dt });
  const after = Object.assign({}, context.KELO_MOVEMENT_AUDIT);

  return { hz, before, after };
}

function appearanceContext(combatEnabled, options) {
  options = options || {};
  let middleware = null;
  const drawCalls = [];
  class FakeImage {
    constructor() {
      this.naturalWidth = 1024;
      this.naturalHeight = 1536;
      this.width = 1024;
      this.height = 1536;
      this.onload = null;
      this.onerror = null;
    }
    set src(value) {
      this._src = value;
      if (this.onload) this.onload();
    }
    get src() { return this._src; }
  }
  function makeCanvasContext() {
    return {
      imageSmoothingEnabled: false,
      drawImage() {},
      getImageData() { return { data: new Uint8ClampedArray(4) }; },
      putImageData() {}
    };
  }
  const renderCtx = {
    imageSmoothingEnabled: false,
    fillStyle: '',
    font: '',
    textAlign: '',
    save() {},
    restore() {},
    translate() {},
    scale() {},
    fillText() {},
    drawImage() { drawCalls.push(Array.from(arguments)); }
  };
  const moving = options.moving !== false;
  const visualFrame = Number.isFinite(options.visualFrame) ? options.visualFrame : 1;
  const actor = {
    id: 'local',
    name: 'Kelo',
    x: 100,
    y: 100,
    vx: moving ? 100 : 0,
    vy: 0,
    appearanceId: 'player_hero_v1',
    actorKind: 'player',
    _face: 'up',
    _visualMotion: { dx: moving ? 10 : 0, dy: 0, on: moving, face: 'right', frame: visualFrame }
  };
  const pvpState = Object.freeze({
    basicAttack: options.basicAttack ? Object.freeze({ id: 'audit-basic', phase: 'windup' }) : null,
    specialHolding: !!options.specialHolding,
    armedSlot: Number.isFinite(options.armedSlot) ? options.armedSlot : -1
  });
  const context = {
    console,
    Uint8ClampedArray,
    Image: FakeImage,
    document: { createElement() { return { width: 0, height: 0, getContext: makeCanvasContext }; } },
    performance: { now: () => 1000 },
    localPlayer: actor,
    simulatedPlayers: [],
    KELO_WORLD_DECORATION_RESET: false,
    KELO_COMBAT_ENABLED: combatEnabled,
    KeloPvPWorld: { get state() { return pvpState; } },
    KeloAvatar: { use(id, fn) { middleware = fn; } },
    KELO_AVATAR_PRESENTATION: {
      get() {
        return {
          footRootX: 100,
          footRootY: 110,
          depthRootX: 100,
          depthRootY: 110,
          visualWidth: 62,
          visualHeight: 93,
          nameplateAnchorX: 100,
          nameplateAnchorY: 10
        };
      }
    },
    ctx: renderCtx
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(appearanceSource, context, { filename: 'character-appearance.js' });
  ok(typeof middleware === 'function', 'APPEARANCE_MIDDLEWARE_NOT_REGISTERED');
  middleware(actor, true, () => { throw new Error('UNEXPECTED_FALLBACK'); });
  ok(drawCalls.length === 1, 'APPEARANCE_NOT_DRAWN');
  return { context, actor };
}

const combatMovement = movementContext(true);
ok(combatMovement.localPlayer._face === 'up', 'MOVEMENT_OVERWROTE_COMBAT_AIM');
ok(combatMovement.localPlayer._visualMotion.face === 'right', 'LOCOMOTION_VECTOR_NOT_PRESERVED');
ok(combatMovement.KELO_MOVEMENT_AUDIT.combatAimFacingActive === true, 'COMBAT_AIM_AUDIT_NOT_ACTIVE');

const socialMovement = movementContext(false);
ok(socialMovement.localPlayer._face === 'right', 'SOCIAL_MOVEMENT_NO_LONGER_OWNS_FACING');

const reversalRates = [60, 90, 120].map(reversalContext);
for (const result of reversalRates) {
  ok(result.after.reversalCount === 1, 'REVERSAL_NOT_COUNTED_' + result.hz + 'HZ');
  ok(result.after.reversalAccidentalIdleCount === 0, 'REVERSAL_INSERTED_IDLE_' + result.hz + 'HZ');
  ok(result.after.reversalFrameJumpCount === 0, 'REVERSAL_FRAME_JUMP_' + result.hz + 'HZ');
  ok(result.after.movementFace === 'left', 'REVERSAL_FACE_NOT_IMMEDIATE_' + result.hz + 'HZ');
}

// BEFORE v2.4: move RIGHT + aim UP rendered UP for the entire PvP mode.
// AFTER v2.4: ordinary locomotion renders RIGHT, while gameplay _face remains UP.
const movingCombatAppearance = appearanceContext(true, { moving: true });
ok(movingCombatAppearance.actor._face === 'up', 'PRESENTATION_MUTATED_GAMEPLAY_AIM');
ok(movingCombatAppearance.context.KELO_CHARACTER_APPEARANCE_AUDIT.lastDraw.face === 'right', 'MOVING_PVP_DID_NOT_USE_LOCOMOTION_ROW');
ok(movingCombatAppearance.context.KELO_CHARACTER_APPEARANCE_AUDIT.lastDraw.faceSource === 'movement', 'MOVING_PVP_FACE_SOURCE_NOT_MOVEMENT');

const attackingCombatAppearance = appearanceContext(true, { moving: true, basicAttack: true });
ok(attackingCombatAppearance.context.KELO_CHARACTER_APPEARANCE_AUDIT.lastDraw.face === 'up', 'ATTACK_COMMITMENT_DID_NOT_USE_AIM_FACE');
ok(attackingCombatAppearance.context.KELO_CHARACTER_APPEARANCE_AUDIT.lastDraw.faceSource === 'combat-aim', 'ATTACK_COMMITMENT_FACE_SOURCE_NOT_AIM');

const armedCombatAppearance = appearanceContext(true, { moving: true, armedSlot: 2 });
ok(armedCombatAppearance.context.KELO_CHARACTER_APPEARANCE_AUDIT.lastDraw.face === 'up', 'ARMED_CAST_DID_NOT_USE_AIM_FACE');

// engine-ac publishes plant frame 2 when visual motion stops. Appearance must not replace it with column 0 merely because moving=false.
const idleCombatAppearance = appearanceContext(true, { moving: false, visualFrame: 2 });
ok(idleCombatAppearance.context.KELO_CHARACTER_APPEARANCE_AUDIT.lastDraw.face === 'up', 'IDLE_PVP_DID_NOT_PRESERVE_AIM_FACE');
ok(idleCombatAppearance.context.KELO_CHARACTER_APPEARANCE_AUDIT.lastDraw.frame === 2, 'IDLE_PLANT_FRAME_NOT_HONORED');
ok(idleCombatAppearance.context.KELO_CHARACTER_APPEARANCE_AUDIT.usesExplicitIdleFrame === true, 'IDLE_PLANT_POLICY_NOT_AUDITABLE');

const socialAppearance = appearanceContext(false, { moving: true });
ok(socialAppearance.context.KELO_CHARACTER_APPEARANCE_AUDIT.lastDraw.face === 'right', 'SOCIAL_RENDER_DID_NOT_USE_MOVEMENT_FACE');
ok(socialAppearance.context.KELO_CHARACTER_APPEARANCE_AUDIT.lastDraw.faceSource === 'movement', 'SOCIAL_FACE_SOURCE_NOT_REPORTED');

ok(movingCombatAppearance.context.KELO_CHARACTER_APPEARANCE_AUDIT.combatAimFacingPolicy === 'idle-or-attack-commitment', 'POLICY_NOT_AUDITABLE');

console.log(JSON.stringify({
  status: 'PVP_AIM_FACING_OK',
  beforeOrthogonalLocomotionRowMismatchPct: 100,
  afterOrthogonalLocomotionRowMismatchPct: 0,
  gameplayAimPreserved: movingCombatAppearance.actor._face === 'up',
  attackAimPresentationPreserved: attackingCombatAppearance.context.KELO_CHARACTER_APPEARANCE_AUDIT.lastDraw.face === 'up',
  reversal: reversalRates.map(result => ({
    hz: result.hz,
    accidentalIdleCount: result.after.reversalAccidentalIdleCount,
    frameJumpCount: result.after.reversalFrameJumpCount,
    resultingFace: result.after.movementFace
  })),
  beforeIdlePlantRenderedFrame: 0,
  afterIdlePlantRenderedFrame: idleCombatAppearance.context.KELO_CHARACTER_APPEARANCE_AUDIT.lastDraw.frame,
  explicitIdlePlantFrameHonored: idleCombatAppearance.context.KELO_CHARACTER_APPEARANCE_AUDIT.lastDraw.frame === 2,
  policy: movingCombatAppearance.context.KELO_CHARACTER_APPEARANCE_AUDIT.combatAimFacingPolicy
}, null, 2));