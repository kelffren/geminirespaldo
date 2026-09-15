/* KELO-INDEX
 * area: MOVEMENT / PRESENTATION
 * owner: KeloMovement consumer
 * keys: MOVEMENT GAIT SPEED STRIDE PLANT ONSET STEP-OFF AUDIT AIM FACING PVP PARITY DIAGONAL HYSTERESIS BLOCKED FOOT-PLANT
 * purpose: calcula gait/velocidad objetivo y estado visual de zancada usando hooks del owner KeloMovement
 * public-api: KELO_MOVEMENT_AUDIT
 * consumes: KeloMovementProfile, KeloMovement, input, CONFIG, localPlayer, KELO_COMBAT_ENABLED
 * state-owned: _visualMotion del actor local + telemetría de gait
 * extension-points: hooks before/after de KeloMovement
 * reuse: perfil compartido de marcha/carrera consumido también por autoridad PvP server
 * legacy: mantiene telemetría/stride históricas; ya no posee la curva de velocidad canónica
 * do-not: NO resolver colisiones, NO crear otro wrapper de updateMovement, NO pisar aim-facing durante PvP
 */
(function () {
  // MOV-001: one processed intent magnitude drives gait + speed.
  // MOV-004: visual stride advances from actual world distance, never render count.
  // MOV-CADENCE-V2: remove the 50->90px stride-length jump at WALK->RUN.
  // MOV-STOP-V2: release never freezes an arbitrary stride pose; physics remains unchanged.
  // MOV-REVERSAL-AUDIT-V1: measure real lateral reversal continuity instead of publishing inert counters.
  // MOV-PLANT-V1: settle on authored lateral frame 2 after release; frame 0 remains available via ?plantFrame=0 baseline.
  // MOV-ONSET-V1: first real resolved displacement steps off the plant pose immediately; blocked intent cannot advance stride.
  // MOV-COMBAT-FACING-V1: movement presentation never overwrites PvP aim-facing; combat geometry remains authority-owned elsewhere.
  // MOV-PARITY-V1: speed/gait semantics come from KeloMovementProfile, shared with server authority.
  // MOV-DIAGONAL-HYSTERESIS-V1: preserve the current locomotion axis through small analog jitter around 45 degrees.
  // MOV-BLOCKED-PLANT-V2: sustained intent without resolved displacement settles to authored plant instead of freezing a walk pose.
  const movementProfile = window.KeloMovementProfile;
  if (!movementProfile) throw new Error('KeloMovementProfile unavailable before engine-ac');
  const PROFILE = movementProfile.profile;
  const WALK_SPEED = PROFILE.walkSpeed;
  const GAIT_RUN_START = PROFILE.gaitRunStart;
  const VISUAL_STOP_HOLD_SEC = 0.075;
  const BLOCKED_SETTLE_SEC = 0.04;
  const WALK_CYCLE_WORLD_PX = 50;
  const RUN_CYCLE_WORLD_PX = 90;
  const MIN_VISUAL_MOVE_PX = 0.12;
  const DIRECTION_BASELINE_RATIO = 1.15;
  const DIRECTION_HYSTERESIS_RATIO = 1.18;
  const DEFAULT_PLANT_FRAME = 2;
  const params = new URLSearchParams(window.location.search);
  const MOV_CADENCE_V2 = params.get('movCadenceV2') !== '0';
  const MOV_STOP_V2 = params.get('movStopV2') !== '0';
  const BLOCKED_PLANT_V2 = params.get('blockedPlantV2') !== '0';
  const rawPlantFrame = params.get('plantFrame');
  const requestedPlantFrame = rawPlantFrame == null ? NaN : Number(rawPlantFrame);
  const PLANT_FRAME = Number.isInteger(requestedPlantFrame) && requestedPlantFrame >= 0 && requestedPlantFrame < 4
    ? requestedPlantFrame
    : DEFAULT_PLANT_FRAME;
  const PLANT_PHASE = PLANT_FRAME / 4;
  CONFIG.speed = WALK_SPEED;
  CONFIG.joystickDeadzone = 0.045;
  CONFIG.joystickCurve = 'LINEAR';
  CONFIG.joystickRadius = 72;
  CONFIG.movementType = 'DIRECT';
  CONFIG.accelDecay = 32;
  CONFIG.decelDecay = 18;
  let frameState={mag:0,gait:'idle',speedCap:WALK_SPEED};

  function processedMag() {
    return Math.min(1, Math.hypot(input.normX || 0, input.normY || 0));
  }

  function speedFor(mag) {
    return movementProfile.speedCapForMagnitude(mag);
  }

  function gaitFrom(mag) {
    return movementProfile.gaitForMagnitude(mag);
  }

  function cycleWorldPxFor(mag, gait) {
    if (!MOV_CADENCE_V2) return gait === 'run' ? RUN_CYCLE_WORLD_PX : WALK_CYCLE_WORLD_PX;
    if (gait !== 'run') return WALK_CYCLE_WORLD_PX;
    const t = Math.max(0, Math.min(1, (mag - GAIT_RUN_START) / (1 - GAIT_RUN_START)));
    return WALK_CYCLE_WORLD_PX + (RUN_CYCLE_WORLD_PX - WALK_CYCLE_WORLD_PX) * t;
  }

  function rawTouchMag() {
    if (!input.touchActive) return null;
    return Math.min(1, Math.hypot(input.currentX - input.originX, input.currentY - input.originY) / CONFIG.joystickRadius);
  }

  function isCardinalFace(face) {
    return face === 'left' || face === 'right' || face === 'up' || face === 'down';
  }

  function combatAimFacing(p) {
    return window.KELO_COMBAT_ENABLED === true && p && isCardinalFace(p._face) ? p._face : null;
  }

  function locomotionFace(v, dx, dy) {
    const ax = Math.abs(dx), ay = Math.abs(dy);
    let axis = v.directionAxis;
    if (axis === 'horizontal') {
      if (ay > ax * DIRECTION_HYSTERESIS_RATIO) axis = 'vertical';
    } else if (axis === 'vertical') {
      if (ax > ay * DIRECTION_HYSTERESIS_RATIO) axis = 'horizontal';
    } else {
      axis = ax * DIRECTION_BASELINE_RATIO >= ay ? 'horizontal' : 'vertical';
    }
    if (axis !== v.directionAxis && v.directionAxis) v.directionFaceSwitchCount += 1;
    v.directionAxis = axis;
    return axis === 'horizontal' ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'down' : 'up');
  }

  function publishAudit(mag, gait, speedCap, visual) {
    window.KELO_MOVEMENT_AUDIT = {
      version: 'MOV-shared-profile-v1-diagonal-hysteresis-blocked-plant-v2',
      movementProfileVersion: movementProfile.version,
      rawTouchMag: rawTouchMag(),
      processedMag: mag,
      gait,
      speedCap,
      targetSpeed: mag * speedCap,
      actualSpeed: Math.hypot(localPlayer.vx || 0, localPlayer.vy || 0),
      colliderRadius: localPlayer.radius,
      cadenceV2: MOV_CADENCE_V2,
      stopV2: MOV_STOP_V2,
      blockedPlantV2: BLOCKED_PLANT_V2,
      blockedSettleMs: BLOCKED_SETTLE_SEC * 1000,
      blockedIntentElapsedMs: visual ? visual.blockedIntentElapsed * 1000 : 0,
      blockedSettled: !!(visual && visual.blockedSettled),
      plantFrame: PLANT_FRAME,
      plantPhase: PLANT_PHASE,
      directionBaselineRatio: DIRECTION_BASELINE_RATIO,
      directionHysteresisRatio: DIRECTION_HYSTERESIS_RATIO,
      directionAxis: visual ? visual.directionAxis : null,
      directionFaceSwitchCount: visual ? visual.directionFaceSwitchCount : 0,
      combatAimFacingActive: !!combatAimFacing(localPlayer),
      movementFace: visual ? visual.face : localPlayer._face || 'down',
      actorFace: localPlayer._face || 'down',
      cycleWorldPx: visual ? visual.cycleWorldPx : cycleWorldPxFor(mag, gait),
      visualOn: !!(visual && visual.on),
      visualFrame: visual ? visual.frame : PLANT_FRAME,
      stridePhase: visual ? visual.stridePhase : PLANT_PHASE,
      strideDistancePx: visual ? visual.strideDistancePx : 0,
      lastStepDistancePx: visual ? visual.lastStepDistancePx : 0,
      onsetCount: visual ? visual.onsetCount : 0,
      onsetStepOffCount: visual ? visual.onsetStepOffCount : 0,
      onsetPendingResolvedDisplacement: !!(visual && visual.pendingStepOff),
      lastOnsetFromFrame: visual ? visual.lastOnsetFromFrame : PLANT_FRAME,
      lastOnsetToFrame: visual ? visual.lastOnsetToFrame : PLANT_FRAME,
      releaseCount: visual ? visual.releaseCount : 0,
      lastReleaseFromFrame: visual ? visual.lastReleaseFromFrame : PLANT_FRAME,
      lastReleaseFromPhase: visual ? visual.lastReleaseFromPhase : PLANT_PHASE,
      unsupportedPoseFreezeMs: visual ? visual.unsupportedPoseFreezeMs : 0,
      releaseToStablePlantMs: visual ? visual.releaseToStablePlantMs : 0,
      reversalCount: visual ? visual.reversalCount : 0,
      reversalAccidentalIdleCount: visual ? visual.reversalAccidentalIdleCount : 0,
      reversalFrameJumpCount: visual ? visual.reversalFrameJumpCount : 0,
      lastReversalFromFrame: visual ? visual.lastReversalFromFrame : PLANT_FRAME,
      lastReversalToFrame: visual ? visual.lastReversalToFrame : PLANT_FRAME
    };
  }

  function visualStateOf(p) {
    if (!p._visualMotion) {
      p._visualMotion = {
        lastX: p.x,
        lastY: p.y,
        dx: 0,
        dy: 0,
        on: false,
        face: p._face || 'down',
        directionAxis: null,
        directionFaceSwitchCount: 0,
        gait: 'idle',
        frame: PLANT_FRAME,
        stopElapsed: VISUAL_STOP_HOLD_SEC,
        stridePhase: PLANT_PHASE,
        strideDistancePx: 0,
        lastStepDistancePx: 0,
        cycleWorldPx: WALK_CYCLE_WORLD_PX,
        pendingStepOff: false,
        onsetCount: 0,
        onsetStepOffCount: 0,
        lastOnsetFromFrame: PLANT_FRAME,
        lastOnsetToFrame: PLANT_FRAME,
        releaseCount: 0,
        lastReleaseFromFrame: PLANT_FRAME,
        lastReleaseFromPhase: PLANT_PHASE,
        unsupportedPoseFreezeMs: 0,
        releaseToStablePlantMs: 0,
        blockedIntentElapsed: 0,
        blockedSettled: false,
        reversalCount: 0,
        reversalAccidentalIdleCount: 0,
        reversalFrameJumpCount: 0,
        lastReversalFromFrame: PLANT_FRAME,
        lastReversalToFrame: PLANT_FRAME,
        lastIntentHorizontalSign: 0
      };
    }
    return p._visualMotion;
  }

  function updateVisualMotion(p, dt, gait, mag) {
    const v = visualStateOf(p);
    if (v.directionAxis === undefined) v.directionAxis = null;
    if (!Number.isFinite(v.directionFaceSwitchCount)) v.directionFaceSwitchCount = 0;
    if (!Number.isFinite(v.blockedIntentElapsed)) v.blockedIntentElapsed = 0;
    const dx = p.x - v.lastX;
    const dy = p.y - v.lastY;
    const dist = Math.hypot(dx, dy);
    const spd = Math.hypot(p.vx || 0, p.vy || 0);
    const hasIntent = gait !== 'idle';
    const resolvedMoving = dist > MIN_VISUAL_MOVE_PX;
    const legacyVelocityEvidence = spd > 16;
    const physicallyMoving = resolvedMoving || (!BLOCKED_PLANT_V2 && legacyVelocityEvidence);
    if (BLOCKED_PLANT_V2 && hasIntent && !resolvedMoving) v.blockedIntentElapsed += Math.max(0, dt || 0);
    else v.blockedIntentElapsed = 0;
    v.blockedSettled = BLOCKED_PLANT_V2 && hasIntent && !resolvedMoving && v.blockedIntentElapsed >= BLOCKED_SETTLE_SEC;
    const wasOn = v.on;
    const intentX = input.normX || 0;
    const intentY = input.normY || 0;
    const horizontalIntentSign = hasIntent && Math.abs(intentX) >= Math.abs(intentY) && Math.abs(intentX) > 0.0001
      ? Math.sign(intentX)
      : 0;
    const reversalFromFrame = v.frame;
    const lateralReversal = horizontalIntentSign !== 0 && v.lastIntentHorizontalSign !== 0 && horizontalIntentSign !== v.lastIntentHorizontalSign;
    if (horizontalIntentSign !== 0) v.lastIntentHorizontalSign = horizontalIntentSign;

    if ((hasIntent && !v.blockedSettled) || physicallyMoving) {
      v.stopElapsed = 0;
      v.on = true;
      if (!wasOn) {
        v.directionAxis = null;
        v.pendingStepOff = true;
        v.onsetCount += 1;
        v.lastOnsetFromFrame = v.frame;
      }
    } else if (MOV_STOP_V2) {
      if (wasOn) {
        v.releaseCount += 1;
        v.lastReleaseFromFrame = v.frame;
        v.lastReleaseFromPhase = v.stridePhase;
      }
      v.stopElapsed = VISUAL_STOP_HOLD_SEC;
      v.on = false;
      v.directionAxis = null;
      v.pendingStepOff = false;
      v.unsupportedPoseFreezeMs = 0;
      v.releaseToStablePlantMs = 0;
    } else {
      v.stopElapsed += Math.max(0, dt || 0);
      v.on = v.stopElapsed < VISUAL_STOP_HOLD_SEC;
      if (!v.on) {
        v.directionAxis = null;
        v.pendingStepOff = false;
      }
      v.unsupportedPoseFreezeMs = v.on ? v.stopElapsed * 1000 : 0;
      v.releaseToStablePlantMs = v.on ? v.stopElapsed * 1000 : VISUAL_STOP_HOLD_SEC * 1000;
    }

    if (resolvedMoving) {
      v.dx = dx;
      v.dy = dy;
    } else if (!v.blockedSettled && legacyVelocityEvidence) {
      v.dx = p.vx || 0;
      v.dy = p.vy || 0;
    } else if (!v.blockedSettled && hasIntent) {
      v.dx = input.normX || 0;
      v.dy = input.normY || 0;
    }

    if (v.on && (Math.abs(v.dx) > 0.0001 || Math.abs(v.dy) > 0.0001)) {
      v.face = locomotionFace(v, v.dx, v.dy);
      // En social/exploración, movement posee el facing visual normal.
      // En PvP, `_face` ya representa la intención de aim de KeloPvPWorld y no debe ser sobrescrita por locomoción.
      if (!combatAimFacing(p)) p._face = v.face;
    }

    v.lastStepDistancePx = resolvedMoving ? dist : 0;
    v.cycleWorldPx = cycleWorldPxFor(mag, gait);
    if (v.on && v.lastStepDistancePx > 0) {
      if (v.pendingStepOff) {
        // Step off the authored plant pose only when world displacement actually resolved.
        // This keeps blocked intent foot-planted while making responsive movement visible on the first real step.
        v.stridePhase = ((PLANT_FRAME + 1) % 4) / 4;
        v.pendingStepOff = false;
        v.onsetStepOffCount += 1;
      }
      v.strideDistancePx += v.lastStepDistancePx;
      v.stridePhase = (v.stridePhase + v.lastStepDistancePx / v.cycleWorldPx) % 1;
      v.frame = Math.floor(v.stridePhase * 4) % 4;
      if (v.onsetStepOffCount === v.onsetCount) v.lastOnsetToFrame = v.frame;
    } else if (!v.on) {
      v.stridePhase = PLANT_PHASE;
      v.strideDistancePx = 0;
      v.frame = PLANT_FRAME;
    }

    if (lateralReversal) {
      v.reversalCount += 1;
      v.lastReversalFromFrame = reversalFromFrame;
      v.lastReversalToFrame = v.frame;
      if (!v.on) v.reversalAccidentalIdleCount += 1;
      const forward = (v.frame - reversalFromFrame + 4) % 4;
      const backward = (reversalFromFrame - v.frame + 4) % 4;
      if (Math.min(forward, backward) > 1) v.reversalFrameJumpCount += 1;
    }

    v.gait = gait;
    v.lastX = p.x;
    v.lastY = p.y;
    return v;
  }

  if(!window.KeloMovement)throw new Error('KeloMovement unavailable before engine-ac');
  window.KeloMovement.before('engine-ac:gait-speed',function(){
    const mag=processedMag();
    const gait=gaitFrom(mag);
    const speedCap=speedFor(mag);
    frameState={mag:mag,gait:gait,speedCap:speedCap};
    localPlayer.gait=gait;
    localPlayer._gait=gait;
    CONFIG.speed=speedCap;
  },10);
  window.KeloMovement.after('engine-ac:visual-motion',function(ctx){
    const visual=updateVisualMotion(localPlayer,ctx.dt,frameState.gait,frameState.mag);
    publishAudit(frameState.mag,frameState.gait,frameState.speedCap,visual);
  },20);
})();