/* KELO-INDEX
 * area: QA / MOVEMENT / PRESENTATION
 * owner: FOUNDATION CI
 * keys: MOVEMENT ONSET STEP-OFF STRIDE PLANT FOOT-SLIDE COLLISION 60HZ 90HZ 120HZ
 * purpose: mide cuánto tarda el primer cambio visible de stride al salir del plant frame y verifica que solo avance con desplazamiento resuelto real
 * public-api: CLI `node scripts/movement-onset-audit.js`
 * consumes: engine-ac.js
 * state-owned: ninguno
 * extension-points: contrato visual publicado por KeloMovement
 * reuse: regresión determinista para keyboard/touch/controller porque todos terminan en normX/normY
 * legacy: N/A
 * do-not: no cambiar física ni declarar calidad subjetiva sin browser capture
 */
'use strict';

const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('engine-ac.js', 'utf8');

function ok(condition, message) {
  if (!condition) throw new Error('MOVEMENT_ONSET_FAIL:' + message);
}

function createHarness() {
  const hooks = {};
  const context = {
    console,
    URLSearchParams,
    location: { search: '' },
    CONFIG: {},
    input: {
      normX: 0,
      normY: 0,
      touchActive: false,
      currentX: 0,
      currentY: 0,
      originX: 0,
      originY: 0
    },
    localPlayer: { x: 0, y: 0, vx: 0, vy: 0, radius: 20, _face: 'right' },
    KELO_COMBAT_ENABLED: false,
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
  vm.runInContext(source, context, { filename: 'engine-ac.js' });
  return { context, hooks };
}

function directionVector(direction) {
  if (direction === 'right') return [1, 0];
  if (direction === 'left') return [-1, 0];
  if (direction === 'diagonal') {
    const n = Math.SQRT1_2;
    return [n, -n];
  }
  throw new Error('UNKNOWN_DIRECTION:' + direction);
}

function traceOnset(hz, direction) {
  const { context, hooks } = createHarness();
  const dt = 1 / hz;

  // Establish a real idle plant before movement starts.
  hooks.before();
  hooks.after({ dt });
  const plantFrame = context.KELO_MOVEMENT_AUDIT.visualFrame;
  const plantPhase = context.KELO_MOVEMENT_AUDIT.stridePhase;
  ok(context.KELO_MOVEMENT_AUDIT.visualOn === false, 'BASELINE_NOT_IDLE_' + hz + '_' + direction);

  const [dx, dy] = directionVector(direction);
  const speed = 185.28;
  context.input.normX = dx;
  context.input.normY = dy;

  let firstChangedFrame = null;
  let firstChangeFrameIndex = null;
  let firstChangeDistancePx = null;
  let firstChangeAudit = null;
  let totalDistancePx = 0;

  for (let frameIndex = 1; frameIndex <= 30; frameIndex += 1) {
    hooks.before();
    context.localPlayer.vx = dx * speed;
    context.localPlayer.vy = dy * speed;
    context.localPlayer.x += context.localPlayer.vx * dt;
    context.localPlayer.y += context.localPlayer.vy * dt;
    totalDistancePx += speed * dt;
    hooks.after({ dt });

    const visualFrame = context.KELO_MOVEMENT_AUDIT.visualFrame;
    if (visualFrame !== plantFrame) {
      firstChangedFrame = visualFrame;
      firstChangeFrameIndex = frameIndex;
      firstChangeDistancePx = totalDistancePx;
      firstChangeAudit = Object.assign({}, context.KELO_MOVEMENT_AUDIT);
      break;
    }
  }

  ok(firstChangeFrameIndex != null, 'NO_VISIBLE_STEP_OFF_' + hz + '_' + direction);
  return {
    hz,
    direction,
    plantFrame,
    plantPhase,
    firstChangedFrame,
    firstChangeFrameIndex,
    firstFrameChangeMs: firstChangeFrameIndex * dt * 1000,
    firstChangeDistancePx,
    onsetCount: firstChangeAudit.onsetCount,
    onsetStepOffCount: firstChangeAudit.onsetStepOffCount,
    pendingAfterStepOff: firstChangeAudit.onsetPendingResolvedDisplacement
  };
}

function traceBlockedIntent(hz) {
  const { context, hooks } = createHarness();
  const dt = 1 / hz;
  hooks.before();
  hooks.after({ dt });
  const plantFrame = context.KELO_MOVEMENT_AUDIT.visualFrame;

  // Intent and requested velocity exist, but world position does not resolve because collision can block it.
  context.input.normX = 1;
  context.localPlayer.vx = 185.28;
  hooks.before();
  hooks.after({ dt });
  const audit = Object.assign({}, context.KELO_MOVEMENT_AUDIT);

  return {
    hz,
    plantFrame,
    visualFrame: audit.visualFrame,
    onsetCount: audit.onsetCount,
    onsetStepOffCount: audit.onsetStepOffCount,
    pendingResolvedDisplacement: audit.onsetPendingResolvedDisplacement,
    lastStepDistancePx: audit.lastStepDistancePx
  };
}

const results = [];
for (const hz of [60, 90, 120]) {
  for (const direction of ['right', 'left', 'diagonal']) results.push(traceOnset(hz, direction));
}
const blocked = [60, 90, 120].map(traceBlockedIntent);

// Historical baseline captured immediately before MOV-ONSET-V1 on the same distance-driven stride policy.
const beforeFirstFrameChangeMs = Object.freeze({ 60: 133.33333333333334, 90: 122.22222222222223, 120: 125 });

for (const result of results) {
  ok(result.plantFrame === 2, 'UNEXPECTED_PLANT_FRAME_' + result.hz + '_' + result.direction);
  ok(result.firstChangeFrameIndex === 1, 'STEP_OFF_NOT_FIRST_RESOLVED_FRAME_' + result.hz + '_' + result.direction);
  ok(result.firstChangedFrame === 3, 'STEP_OFF_NOT_NEXT_AUTHORED_FRAME_' + result.hz + '_' + result.direction);
  ok(result.onsetCount === 1, 'ONSET_NOT_COUNTED_' + result.hz + '_' + result.direction);
  ok(result.onsetStepOffCount === 1, 'STEP_OFF_NOT_COUNTED_' + result.hz + '_' + result.direction);
  ok(result.pendingAfterStepOff === false, 'STEP_OFF_STILL_PENDING_' + result.hz + '_' + result.direction);
  ok(result.firstFrameChangeMs < beforeFirstFrameChangeMs[result.hz], 'ONSET_LATENCY_NOT_IMPROVED_' + result.hz + '_' + result.direction);
}

for (const result of blocked) {
  ok(result.visualFrame === result.plantFrame, 'BLOCKED_INTENT_ADVANCED_FRAME_' + result.hz);
  ok(result.onsetCount === 1, 'BLOCKED_ONSET_NOT_TRACKED_' + result.hz);
  ok(result.onsetStepOffCount === 0, 'BLOCKED_INTENT_CONSUMED_STEP_OFF_' + result.hz);
  ok(result.pendingResolvedDisplacement === true, 'BLOCKED_STEP_OFF_NOT_PENDING_' + result.hz);
  ok(result.lastStepDistancePx === 0, 'BLOCKED_INTENT_REPORTED_WORLD_STEP_' + result.hz);
}

console.log(JSON.stringify({
  status: 'MOVEMENT_ONSET_OK',
  policy: 'first-resolved-displacement-step-off',
  beforeFirstFrameChangeMs,
  results,
  blocked
}, null, 2));
