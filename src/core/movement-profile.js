/* KELO-INDEX
 * area: MOVEMENT / SHARED PROFILE
 * owner: KeloMovement shared data contract
 * keys: MOVEMENT SPEED GAIT ANALOG PARITY SERVER CLIENT
 * purpose: define una sola curva pura magnitud->speed/gait consumible por browser y servidor
 * public-api: KeloMovementProfile / CommonJS export
 * consumes: Math only
 * state-owned: none; pure immutable profile/functions
 * extension-points: profile data/functions only; no input, collision, stride, facing, camera or authority
 * reuse: client locomotion prediction + server PvP authoritative locomotion
 * online: misma curva pre-colisión para LocalAuthority/ServerAuthority; policy scales siguen en sus owners
 * do-not: NO parsear input devices, NO resolver collision, NO mutar actors, NO decidir PvP phases
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KeloMovementProfile = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PROFILE = Object.freeze({
    version: 'movement-profile-v1',
    walkMax: 0.74,
    walkSpeed: 110,
    runSpeed: 178,
    maxSpeed: 185.28,
    speedBlendStart: 0.48,
    gaitIdleMax: 0.03,
    gaitRunStart: 0.70
  });

  function clamp01(value) {
    const n = Number(value) || 0;
    return Math.max(0, Math.min(1, n));
  }

  function smoothstep01(value) {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
  }

  function speedCapForMagnitude(magnitude) {
    const mag = clamp01(magnitude);
    if (mag <= PROFILE.speedBlendStart) return PROFILE.walkSpeed;
    const t = (mag - PROFILE.speedBlendStart) / (1 - PROFILE.speedBlendStart);
    return PROFILE.walkSpeed + (PROFILE.maxSpeed - PROFILE.walkSpeed) * smoothstep01(t);
  }

  function gaitForMagnitude(magnitude) {
    const mag = clamp01(magnitude);
    if (mag < PROFILE.gaitIdleMax) return 'idle';
    if (mag < PROFILE.gaitRunStart) return 'walk';
    return 'run';
  }

  function requestedVelocity(x, y) {
    let mx = Number(x) || 0;
    let my = Number(y) || 0;
    const rawMag = Math.hypot(mx, my);
    if (rawMag > 1) {
      mx /= rawMag;
      my /= rawMag;
    }
    const magnitude = Math.min(1, rawMag);
    const speedCap = speedCapForMagnitude(magnitude);
    return Object.freeze({
      x: mx * speedCap,
      y: my * speedCap,
      magnitude,
      speedCap,
      targetSpeed: magnitude * speedCap,
      gait: gaitForMagnitude(magnitude)
    });
  }

  return Object.freeze({
    version: PROFILE.version,
    profile: PROFILE,
    speedCapForMagnitude,
    gaitForMagnitude,
    requestedVelocity
  });
});
