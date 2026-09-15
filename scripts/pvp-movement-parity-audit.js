'use strict';
/* KELO-INDEX
 * area: AUDIT / MOVEMENT / NETWORKING
 * keys: MOVEMENT PARITY CLIENT SERVER SPEED ANALOG DIAGONAL MELEE
 * purpose: demuestra que browser y autoridad PvP comparten la misma curva pre-colisión sin cambiar el feel cliente
 * online: protege LocalAuthority/ServerAuthority contra drift de velocidad antes de reconciliation
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const movementProfile = require('../src/core/movement-profile.js');
const { createPvpAuthority } = require('../server/pvp-authority.js');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const clientSource = fs.readFileSync(path.join(root, 'engine-ac.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(root, 'server/pvp-authority.js'), 'utf8');

assert(index.indexOf('src/core/movement-profile.js') >= 0, 'movement profile must be LIVE');
assert(index.indexOf('src/core/movement-profile.js') < index.indexOf('engine-ac.js'), 'movement profile must load before engine-ac');
assert(clientSource.includes('window.KeloMovementProfile'), 'client must consume shared movement profile');
assert(clientSource.includes('movementProfile.speedCapForMagnitude'), 'client speed cap must come from shared profile');
assert(clientSource.includes('movementProfile.gaitForMagnitude'), 'client gait must come from shared profile');
assert(serverSource.includes("require('../src/core/movement-profile.js')"), 'server must consume shared movement profile');
assert(!serverSource.includes('BASE_SPEED=320'), 'legacy authoritative BASE_SPEED must be removed');

function legacyClientSpeedCap(mag) {
  const WALK_SPEED = 110;
  const MAX_SPEED = 185.28;
  const SPEED_BLEND_START = 0.48;
  if (mag <= SPEED_BLEND_START) return WALK_SPEED;
  let t = (mag - SPEED_BLEND_START) / (1 - SPEED_BLEND_START);
  t = Math.max(0, Math.min(1, t));
  t = t * t * (3 - 2 * t);
  return WALK_SPEED + (MAX_SPEED - WALK_SPEED) * t;
}

const magnitudes = [0, 0.03, 0.04, 0.10, 0.25, 0.48, 0.69, 0.70, 0.71, 0.80, 1.0];
let clientFeelMaxDelta = 0;
let legacyServerMaxDelta = 0;
for (const mag of magnitudes) {
  const expectedCap = legacyClientSpeedCap(mag);
  const actualCap = movementProfile.speedCapForMagnitude(mag);
  clientFeelMaxDelta = Math.max(clientFeelMaxDelta, Math.abs(actualCap - expectedCap));
  const clientTarget = mag * actualCap;
  const oldServerTarget = mag * 320;
  legacyServerMaxDelta = Math.max(legacyServerMaxDelta, Math.abs(oldServerTarget - clientTarget));
  assert(Math.abs(actualCap - expectedCap) <= 1e-9, `client feel changed at magnitude ${mag}`);
}

function runServerCase(moveX, moveY, scaleKind) {
  const authority = createPvpAuthority();
  const actor = { id: `audit-${scaleKind}-${moveX}-${moveY}`, name: 'audit' };
  let seq = 1;
  const now = 100000;
  assert(authority.ingest(actor, { sequence: seq++, action: 'enter_pvp', phase: 'none', moveX: 0, moveY: 0, aimX: 1, aimY: 0, clientTime: now }, now).ok);
  assert(authority.ingest(actor, { sequence: seq++, action: 'input', phase: 'none', moveX, moveY, aimX: 1, aimY: 0, clientTime: now + 1 }, now + 1).ok);
  if (scaleKind === 'basic-windup') {
    assert(authority.ingest(actor, { sequence: seq++, action: 'basic_attack', phase: 'pressed', moveX, moveY, aimX: 1, aimY: 0, clientTime: now + 2 }, now + 2).ok);
  }
  const before = { x: actor.x, y: actor.y };
  const dt = 0.01;
  authority.step(dt, now + 12);
  const after = { x: actor.x, y: actor.y };
  const expected = movementProfile.requestedVelocity(moveX, moveY);
  const phaseScale = scaleKind === 'basic-windup' ? 0.86 : 1;
  const expectedDx = expected.x * phaseScale * dt;
  const expectedDy = expected.y * phaseScale * dt;
  const err = Math.hypot((after.x - before.x) - expectedDx, (after.y - before.y) - expectedDy);
  authority.dispose();
  return { err, expectedSpeed: expected.targetSpeed * phaseScale, dx: after.x - before.x, dy: after.y - before.y };
}

const cases = [
  [1, 0, 'free'],
  [-1, 0, 'free'],
  [0, 1, 'free'],
  [0, -1, 'free'],
  [Math.SQRT1_2, Math.SQRT1_2, 'free'],
  [-Math.SQRT1_2, Math.SQRT1_2, 'free'],
  [0.8, 0, 'free'],
  [0.48, 0, 'free'],
  [1, 0, 'basic-windup']
];

let maxServerParityError = 0;
for (const c of cases) {
  const result = runServerCase(c[0], c[1], c[2]);
  maxServerParityError = Math.max(maxServerParityError, result.err);
  assert(result.err <= 1e-7, `server movement parity failed for ${c.join(',')}: ${result.err}`);
}

const right = movementProfile.requestedVelocity(1, 0);
const diagonal = movementProfile.requestedVelocity(Math.SQRT1_2, Math.SQRT1_2);
const diagonalMagnitudeErrorPct = Math.abs(Math.hypot(diagonal.x, diagonal.y) - Math.hypot(right.x, right.y)) / Math.hypot(right.x, right.y) * 100;
assert(diagonalMagnitudeErrorPct <= 1e-9, 'diagonal speed magnitude must equal cardinal at full intent');
assert(clientFeelMaxDelta <= 1e-9, 'shared profile must preserve current browser movement feel');

console.log('PVP_MOVEMENT_PARITY_OK');
console.log(JSON.stringify({
  movementProfileVersion: movementProfile.version,
  beforeLegacyServerMaxTargetSpeedDeltaPxPerSec: Number(legacyServerMaxDelta.toFixed(6)),
  afterClientServerPreCollisionErrorPxPerStep: Number(maxServerParityError.toFixed(12)),
  clientFeelSpeedCapMaxDeltaPxPerSec: Number(clientFeelMaxDelta.toFixed(12)),
  diagonalMagnitudeErrorPct: Number(diagonalMagnitudeErrorPct.toFixed(12)),
  serverMeleeWindupScalePreserved: true
}, null, 2));
