/* KELO-INDEX
 * area: VISUAL
 * keys: MELEE EVENT ATTACK HIT MISS REACTION DIRECTION ONLINE PRESENTATION 8WAY SKIN-AGNOSTIC COMBO M1 FEEL
 * hace: traduce eventos semánticos melee a clips/FX/SFX y da identidad visual distinta a los 3 golpes M1 sin poseer gameplay
 * online: acepta actor/target por referencia local o ID remoto; no calcula hit, daño, cooldown ni posición
 * invariant: actor._face permanece cardinal para compatibilidad de skins; el action clip usa dirección visual de 8 vías
 */
(function (root) {
  'use strict';

  const VERSION = 'melee-combat-visuals-v1.3.0-reaction-hierarchy';
  const manifest = root.KELO_MELEE_VISUAL_MANIFEST;
  const bus = root.KeloVisualEventBus;
  const contextApi = root.KeloVisualContext;
  const animationRegistry = root.KeloAnimationRegistry;

  if (!manifest || !bus || !contextApi || !root.KeloAnimation || !root.KeloSequence) {
    console.error('[Kelo melee visuals] visual runtime unavailable');
    return;
  }

  const COMBO_STYLES = Object.freeze({
    1: Object.freeze({ id: 'opener', impactAtMs: 90, slashScale: 0.96, sequenceSpeed: 1.0, reactionSpeed: 1.06, reactionScale: 1.00, heavyImpact: false }),
    2: Object.freeze({ id: 'follow', impactAtMs: 78, slashScale: 1.06, sequenceSpeed: 1.15, reactionSpeed: 1.0, reactionScale: 1.10, heavyImpact: false }),
    3: Object.freeze({ id: 'finisher', impactAtMs: 118, slashScale: 1.28, sequenceSpeed: 0.78, reactionSpeed: 0.82, reactionScale: 1.35, heavyImpact: true })
  });
  const PROFILE_TO_STAGE = Object.freeze({
    sword_light_basic: 1,
    sword_light_follow: 2,
    sword_light_finisher: 3
  });

  const lastAttackAt = new Map();
  const acceptedAttackIds = new Map();
  const timers = new Set();
  const comboClips = { 1: Object.create(null), 2: Object.create(null), 3: Object.create(null) };
  const comboReactionClips = { 1: Object.create(null), 2: Object.create(null), 3: Object.create(null) };
  let syntheticSeq = 1;

  const audit = root.KELO_MELEE_VISUAL_AUDIT = Object.assign(root.KELO_MELEE_VISUAL_AUDIT || {}, {
    runtimeReady: true,
    runtimeVersion: VERSION,
    attacksStarted: 0,
    hitsPresented: 0,
    missesPresented: 0,
    throttled: 0,
    lastAttackId: null,
    lastDirection: null,
    lastCardinalFace: null,
    lastHitTargetId: null,
    lastComboStage: 1,
    lastHitComboStage: 1,
    gameplayMutation: false,
    skinAgnostic: true,
    directionCount: 8,
    comboStages: 3,
    comboFeelProfile: 'opener-follow-finisher',
    reactionHierarchy: Object.freeze({ opener: 1.00, follow: 1.10, finisher: 1.35 })
  });

  function nowMs() {
    return root.performance && typeof root.performance.now === 'function' ? root.performance.now() : Date.now();
  }

  function actorId(actor) {
    return contextApi.actorIdOf(actor) || 'actor';
  }

  function resolveActor(value, fallbackId) {
    if (value && typeof value === 'object') return value;
    return fallbackId != null ? contextApi.resolveActor(fallbackId) : null;
  }

  function normalizedDirection(raw, actor, target) {
    let x = raw && Number(raw.x), y = raw && Number(raw.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) < 0.001) {
      if (actor && target) {
        x = (Number(target.x) || 0) - (Number(actor.x) || 0);
        y = (Number(target.y) || 0) - (Number(actor.y) || 0);
      } else {
        const face = actor && actor._face || 'down';
        if (face === 'up') { x = 0; y = -1; }
        else if (face === 'left') { x = -1; y = 0; }
        else if (face === 'right') { x = 1; y = 0; }
        else { x = 0; y = 1; }
      }
    }
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }

  function faceFromDirection(direction) {
    if (Math.abs(direction.x) > Math.abs(direction.y)) return direction.x < 0 ? 'left' : 'right';
    return direction.y < 0 ? 'up' : 'down';
  }

  function direction8FromDirection(direction) {
    const angle = Math.atan2(direction.y, direction.x);
    const octant = (Math.round(angle / (Math.PI / 4)) + 8) % 8;
    return ['right', 'down_right', 'down', 'down_left', 'left', 'up_left', 'up', 'up_right'][octant];
  }

  function profileIdOf(payload) {
    return String(payload && (payload.profileId || payload.meleeProfileId || payload.gameplay && payload.gameplay.profileId || payload.visual && payload.visual.profileId) || '');
  }

  function comboStageOf(payload) {
    const attackId = String(payload && (payload.attackId || payload.castId) || '');
    const accepted = attackId && acceptedAttackIds.get(attackId);
    if (accepted && accepted.comboStage) return accepted.comboStage;
    return PROFILE_TO_STAGE[profileIdOf(payload)] || 1;
  }

  function comboStyleOf(payload) {
    return COMBO_STYLES[comboStageOf(payload)] || COMBO_STYLES[1];
  }

  function transformedKeyframes(frames, stage) {
    return Object.freeze((Array.isArray(frames) ? frames : []).map(function (frame) {
      const out = Object.assign({}, frame);
      if (stage === 2) {
        out.rotation = -(Number(frame.rotation) || 0) * 0.96;
        out.offsetX = (Number(frame.offsetX) || 0) * 1.06;
        out.offsetY = (Number(frame.offsetY) || 0) * 1.06;
        out.scaleX = 1 + ((Number(frame.scaleX) || 1) - 1) * 1.05;
        out.scaleY = 1 + ((Number(frame.scaleY) || 1) - 1) * 1.05;
      } else if (stage === 3) {
        out.rotation = (Number(frame.rotation) || 0) * 1.42;
        out.offsetX = (Number(frame.offsetX) || 0) * 1.28;
        out.offsetY = (Number(frame.offsetY) || 0) * 1.28;
        out.scaleX = 1 + ((Number(frame.scaleX) || 1) - 1) * 1.30;
        out.scaleY = 1 + ((Number(frame.scaleY) || 1) - 1) * 1.30;
      }
      return Object.freeze(out);
    }));
  }

  function transformedReactionKeyframes(frames, scale) {
    const s = Math.max(1, Number(scale) || 1);
    return Object.freeze((Array.isArray(frames) ? frames : []).map(function (frame) {
      const out = Object.assign({}, frame);
      out.offsetX = (Number(frame.offsetX) || 0) * s;
      out.offsetY = (Number(frame.offsetY) || 0) * s;
      out.rotation = (Number(frame.rotation) || 0) * (1 + (s - 1) * 0.70);
      out.scaleX = 1 + ((Number(frame.scaleX) || 1) - 1) * (1 + (s - 1) * 0.45);
      out.scaleY = 1 + ((Number(frame.scaleY) || 1) - 1) * (1 + (s - 1) * 0.45);
      return Object.freeze(out);
    }));
  }

  function ensureComboClips() {
    if (!animationRegistry || typeof animationRegistry.get !== 'function' || typeof animationRegistry.register !== 'function') return;
    (manifest.directions || []).forEach(function (direction8) {
      const baseId = manifest.attackClips[direction8];
      const base = animationRegistry.get(baseId);
      if (!base) return;
      comboClips[1][direction8] = baseId;
      [2, 3].forEach(function (stage) {
        const id = baseId + '_m1_' + stage;
        if (!animationRegistry.get(id)) {
          const duration = stage === 2 ? 0.30 : 0.42;
          const markers = stage === 2
            ? Object.freeze({ swing: 0.052, impact: COMBO_STYLES[2].impactAtMs / 1000, recover: 0.19 })
            : Object.freeze({ swing: 0.082, impact: COMBO_STYLES[3].impactAtMs / 1000, recover: 0.30 });
          animationRegistry.register(Object.assign({}, base, {
            id: id,
            duration: duration,
            markers: markers,
            keyframes: transformedKeyframes(base.keyframes, stage)
          }));
        }
        comboClips[stage][direction8] = id;
      });
    });
  }
  ensureComboClips();

  function ensureComboReactionClips() {
    if (!animationRegistry || typeof animationRegistry.get !== 'function' || typeof animationRegistry.register !== 'function') return;
    (manifest.directions || []).forEach(function (direction8) {
      const baseId = manifest.reactionClips[direction8];
      const base = animationRegistry.get(baseId);
      if (!base) return;
      comboReactionClips[1][direction8] = baseId;
      [2, 3].forEach(function (stage) {
        const id = baseId + '_m1_' + stage;
        if (!animationRegistry.get(id)) {
          animationRegistry.register(Object.assign({}, base, {
            id: id,
            keyframes: transformedReactionKeyframes(base.keyframes, COMBO_STYLES[stage].reactionScale)
          }));
        }
        comboReactionClips[stage][direction8] = id;
      });
    });
  }
  ensureComboReactionClips();

  function attackIdOf(payload) {
    return String(payload && (payload.attackId || payload.castId) || ('melee_visual_' + (syntheticSeq++).toString(36)));
  }

  function baseContext(payload, actor, direction, direction8) {
    const targetActor = resolveActor(payload && payload.targetActor, payload && payload.targetActorId);
    const targetPoint = payload && payload.target && Number.isFinite(Number(payload.target.x)) && Number.isFinite(Number(payload.target.y))
      ? { x: Number(payload.target.x), y: Number(payload.target.y) }
      : targetActor ? { x: Number(targetActor.x) || 0, y: Number(targetActor.y) || 0 } : null;
    return {
      actor: actor,
      actorId: actorId(actor),
      castId: payload && (payload.attackId || payload.castId) || null,
      origin: { x: Number(actor.x) || 0, y: Number(actor.y) || 0 },
      target: targetPoint,
      direction: direction,
      gameplay: Object.assign({}, payload && payload.gameplay || {}),
      visual: Object.assign({
        scale: 1,
        seed: Number(payload && payload.seed) || (Date.now() & 65535),
        direction8: direction8 || direction8FromDirection(direction)
      }, payload && payload.visual || {}),
      source: payload && payload.source || 'melee',
      predicted: payload && payload.predicted === true,
      confirmed: payload && payload.confirmedHit === true,
      remote: payload && payload.remote === true,
      serverTime: payload && payload.serverTime
    };
  }

  function playAttack(payload) {
    const actor = resolveActor(payload && payload.actor, payload && payload.actorId);
    if (!actor) return null;
    const targetActor = resolveActor(payload && payload.targetActor, payload && payload.targetActorId);
    const direction = normalizedDirection(payload && payload.direction, actor, targetActor);
    const face = faceFromDirection(direction);
    const direction8 = direction8FromDirection(direction);
    const id = attackIdOf(payload);
    const key = actorId(actor);
    const now = nowMs();
    const previous = Number(lastAttackAt.get(key)) || -Infinity;

    if (now - previous < manifest.visualThrottleMs) {
      audit.throttled += 1;
      return null;
    }

    const comboStage = PROFILE_TO_STAGE[profileIdOf(payload)] || 1;
    const style = COMBO_STYLES[comboStage] || COMBO_STYLES[1];
    lastAttackAt.set(key, now);
    acceptedAttackIds.set(id, { startedAt: now, comboStage: comboStage, profileId: profileIdOf(payload) });
    if (acceptedAttackIds.size > 32) {
      const oldest = acceptedAttackIds.keys().next().value;
      acceptedAttackIds.delete(oldest);
    }

    actor._face = face;
    const context = baseContext(Object.assign({}, payload, { attackId: id }), actor, direction, direction8);
    context.visual.scale = (Number(context.visual.scale) || 1) * style.slashScale;
    context.visual.comboStage = comboStage;
    context.visual.comboStyle = style.id;
    const clipId = comboClips[comboStage] && comboClips[comboStage][direction8] || manifest.attackClips[direction8] || manifest.attackClips[face] || manifest.attackClips.down;
    const sequenceRef = manifest.swingSequences[direction8] || manifest.swingSequences[face] || manifest.swingSequences.down;
    const animationId = root.KeloAnimation.play(actor, clipId, { channel: 'action', context: context });
    const sequenceId = root.KeloSequence.play(sequenceRef, context, { speed: style.sequenceSpeed });

    audit.attacksStarted += 1;
    audit.lastAttackId = id;
    audit.lastDirection = direction8;
    audit.lastCardinalFace = face;
    audit.lastComboStage = comboStage;
    if (payload && payload.confirmedHit === false) audit.missesPresented += 1;

    return { attackId: id, animationId: animationId, sequenceId: sequenceId, face: face, direction8: direction8, comboStage: comboStage, comboStyle: style.id, impactAtMs: style.impactAtMs, clipId: clipId };
  }

  function playHitNow(payload) {
    const target = resolveActor(payload && payload.targetActor, payload && payload.targetActorId);
    const attacker = resolveActor(payload && payload.actor, payload && payload.actorId);
    if (!target) return null;
    const direction = normalizedDirection(payload && payload.direction, attacker, target);
    const face = faceFromDirection(direction);
    const direction8 = direction8FromDirection(direction);
    const comboStage = comboStageOf(payload);
    const style = COMBO_STYLES[comboStage] || COMBO_STYLES[1];
    const context = baseContext({
      attackId: payload && (payload.attackId || payload.castId),
      targetActor: attacker,
      targetActorId: attacker && actorId(attacker),
      target: attacker ? { x: attacker.x, y: attacker.y } : null,
      direction: direction,
      gameplay: payload && payload.gameplay,
      visual: payload && payload.visual,
      source: payload && payload.source,
      remote: payload && payload.remote,
      serverTime: payload && payload.serverTime,
      confirmedHit: true
    }, target, direction, direction8);
    context.visual.scale = (Number(context.visual.scale) || 1) * style.slashScale;
    context.visual.comboStage = comboStage;
    context.visual.comboStyle = style.id;

    const clipId = comboReactionClips[comboStage] && comboReactionClips[comboStage][direction8] || manifest.reactionClips[direction8] || manifest.reactionClips[face] || manifest.reactionClips.down;
    const reactionId = root.KeloAnimation.play(target, clipId, { channel: 'reaction', speed: style.reactionSpeed, context: context });
    const sequenceId = root.KeloSequence.play(manifest.hitSequence, context);
    if (style.heavyImpact && root.KeloScreenFX && typeof root.KeloScreenFX.play === 'function' && (!root.KeloScreenFX.get || root.KeloScreenFX.get('impact_medium'))) {
      root.KeloScreenFX.play('impact_medium', { seed: context.visual.seed });
    }

    audit.hitsPresented += 1;
    audit.lastHitTargetId = actorId(target);
    audit.lastHitComboStage = comboStage;
    return { reactionId: reactionId, sequenceId: sequenceId, face: face, direction8: direction8, comboStage: comboStage, comboStyle: style.id, reactionScale: style.reactionScale };
  }

  function impactDelayFor(payload) {
    const id = String(payload && (payload.attackId || payload.castId) || '');
    const accepted = id && acceptedAttackIds.get(id);
    const style = COMBO_STYLES[accepted && accepted.comboStage || comboStageOf(payload)] || COMBO_STYLES[1];
    const explicitStart = Number(payload && payload.visualStartedAt);
    const start = Number.isFinite(explicitStart) ? explicitStart : accepted && Number(accepted.startedAt);
    const elapsed = Number.isFinite(start) ? Math.max(0, nowMs() - start) : 0;
    return Math.max(0, style.impactAtMs - elapsed);
  }

  function playHit(payload) {
    const id = String(payload && (payload.attackId || payload.castId) || '');
    if (id && !acceptedAttackIds.has(id) && payload && payload.allowOrphanHit !== true) return null;

    const delay = impactDelayFor(payload);
    if (delay <= 1) {
      const out = playHitNow(payload);
      if (id) acceptedAttackIds.delete(id);
      return out;
    }
    const timer = setTimeout(function () {
      timers.delete(timer);
      playHitNow(payload);
      if (id) acceptedAttackIds.delete(id);
    }, delay);
    timers.add(timer);
    return timer;
  }

  function preview(actor, target, hit, profileId) {
    if (!actor) return null;
    const direction = normalizedDirection(null, actor, target);
    const attackId = 'melee_preview_' + (syntheticSeq++).toString(36);
    const payload = {
      attackId: attackId,
      actor: actor,
      actorId: actorId(actor),
      targetActor: target || null,
      targetActorId: target ? actorId(target) : null,
      target: target ? { x: target.x, y: target.y } : { x: actor.x + direction.x * 80, y: actor.y + direction.y * 80 },
      direction: direction,
      profileId: profileId || 'sword_light_basic',
      confirmedHit: hit === true,
      visualStartedAt: nowMs(),
      source: 'melee-preview'
    };
    const attack = playAttack(payload);
    if (attack && hit === true && target) playHit(payload);
    return attack;
  }

  bus.on('MELEE_ATTACK_STARTED', playAttack);
  bus.on('MELEE_HIT_CONFIRMED', playHit);

  root.KeloMeleeVisuals = Object.freeze({
    version: VERSION,
    playAttack: playAttack,
    playHit: playHit,
    preview: preview,
    faceFromDirection: faceFromDirection,
    direction8FromDirection: direction8FromDirection,
    comboStageOf: comboStageOf,
    comboStyleOf: comboStyleOf,
    impactDelayFor: impactDelayFor,
    comboStyles: COMBO_STYLES,
    get impactDelayMs() { return manifest.impactAtMs; }
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
