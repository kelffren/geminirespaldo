/* KELO-INDEX
 * area: VISUAL
 * keys: ABILITY PROFILE CAST PROJECTILE IMPACT STATUS PREDICTION REMOTE LEGACY ADAPTER AIM DASH TRAP AREA PERSISTENT
 * hace: resuelve eventos de ability a perfiles visuales opcionales y adapta el runtime actual sin meter visuales en StoneSystem
 * online: local y remoto terminan en los mismos eventos semánticos; no decide daño/cooldown/validez
 */
(function (root) {
  'use strict';

  const manifests = root.KELO_VISUAL_MANIFESTS;
  const bus = root.KeloVisualEventBus;
  const ctxApi = root.KeloVisualContext;
  if (!manifests || !bus || !ctxApi) {
    console.error('[Kelo ability visuals] visual core unavailable');
    return;
  }

  const profiles = new Map();
  const profileByAbilityKey = new Map();
  const activeProjectileVisuals = new Map();
  const activeSwordThrowVisuals = new Map();
  const activeStatusVisuals = new Map();
  const activeCastSequences = new Map();
  const activeCastByAbility = new Map();
  const pendingBySlot = new Map();
  const maskedLegacyColors = new Map();
  const activeTrapVisuals = new Map();
  const activeDashTravel = new Map();
  const impactPlayedAt = new Map();
  let enabled = true;
  let fallbackSeq = 1;
  let pointerAim = null;

  function register(def) {
    if (!def || !def.id) throw new Error('INVALID_ABILITY_VISUAL_PROFILE');
    const id = String(def.id);
    if (profiles.has(id)) throw new Error('DUPLICATE_ABILITY_VISUAL_PROFILE_' + id);
    const frozen = Object.freeze(Object.assign({}, def, { id: id }));
    profiles.set(id, frozen);
    if (def.abilityKey) profileByAbilityKey.set(String(def.abilityKey), frozen);
    return id;
  }
  Object.keys(manifests.visualProfiles || {}).forEach(function (id) { register(manifests.visualProfiles[id]); });

  function get(id) { return profiles.get(String(id || '')) || null; }
  function list() { return Array.from(profiles.values()); }

  function abilityDef(abilityId, abilityKey) {
    const registry = root.KeloAbilities && root.KeloAbilities.registry;
    if (registry) {
      if (abilityId != null && typeof registry.getById === 'function') {
        const byId = registry.getById(Number(abilityId)); if (byId) return byId;
      }
      if (abilityKey && typeof registry.getByKey === 'function') {
        const byKey = registry.getByKey(String(abilityKey)); if (byKey) return byKey;
      }
    }
    const defs = root.ABILITIES || [];
    return defs.find(function (def) { return (abilityId != null && Number(def.id) === Number(abilityId)) || (abilityKey && def.key === abilityKey); }) || null;
  }

  function resolveProfile(abilityId, abilityKey) {
    const def = abilityDef(abilityId, abilityKey);
    if (def && def.visualProfileId && profiles.has(def.visualProfileId)) return profiles.get(def.visualProfileId);
    const key = abilityKey || def && def.key;
    return key && profileByAbilityKey.get(String(key)) || null;
  }

  function hasProfile(abilityOrDef) {
    if (!abilityOrDef) return false;
    if (typeof abilityOrDef === 'object') return !!resolveProfile(abilityOrDef.id, abilityOrDef.key);
    if (Number.isFinite(Number(abilityOrDef))) return !!resolveProfile(Number(abilityOrDef), null);
    return !!resolveProfile(null, String(abilityOrDef));
  }

  function shouldUseLegacy(abilityOrDef) { return !enabled || !hasProfile(abilityOrDef); }

  function normalizedEvent(payload) {
    const raw = payload && payload.context ? Object.assign({}, payload.context, payload) : Object.assign({}, payload || {});
    if (!raw.actor && raw.playerId) raw.actorId = raw.actorId || raw.playerId;
    if (!raw.actor && raw.actorId) raw.actor = ctxApi.resolveActor(raw.actorId);
    return ctxApi.normalize(raw);
  }

  function playCue(abilityId, cue, context) {
    const c = ctxApi.normalize(Object.assign({}, context || {}, { abilityId: abilityId != null ? abilityId : context && context.abilityId }));
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    if (!enabled || !profile) return null;
    if (cue === 'cast' && profile.castSequence && root.KeloSequence) return root.KeloSequence.play(profile.castSequence, c);
    if (cue === 'impact' && profile.impactSequence && root.KeloSequence) return root.KeloSequence.play(profile.impactSequence, c);
    if (cue === 'projectile' && profile.projectileVisual && root.KeloProjectileVisuals) return root.KeloProjectileVisuals.preview(profile.projectileVisual, c, { speed: c.gameplay.speed, maxDistance: c.gameplay.range });
    if (cue === 'throw' && profile.throwVisual && root.KeloProjectileVisuals) return root.KeloProjectileVisuals.preview(profile.throwVisual, c, { speed: c.gameplay.speed, maxDistance: c.gameplay.range, loop: true });
    if ((cue === 'dash' || cue === 'start') && (profile.dashSequence || profile.castSequence) && root.KeloSequence) return root.KeloSequence.play(profile.dashSequence || profile.castSequence, c);
    if ((cue === 'dashEnd' || cue === 'end') && profile.dashEndSequence && root.KeloSequence) return root.KeloSequence.play(profile.dashEndSequence, c);
    if (cue === 'place' && profile.placeSequence && root.KeloSequence) return root.KeloSequence.play(profile.placeSequence, c);
    if (cue === 'trigger' && profile.triggerSequence && root.KeloSequence) return root.KeloSequence.play(profile.triggerSequence, c);
    if ((cue === 'arm' || cue === 'armed') && profile.armedFx && root.KeloFX) return root.KeloFX.spawn(profile.armedFx, c);
    if (cue === 'persistent' && profile.persistentFx && root.KeloFX) return root.KeloFX.spawn(profile.persistentFx, c, { loop: true, x: c.origin && c.origin.x, y: c.origin && c.origin.y });
    if (cue === 'area' && profile.areaFx && root.KeloFX) {
      const areaDef = root.KeloFXRegistry && root.KeloFXRegistry.get(profile.areaFx);
      return root.KeloFX.spawn(profile.areaFx, c, { loop: !!(areaDef && areaDef.loop), x: c.origin && c.origin.x, y: c.origin && c.origin.y });
    }
    const ref = profile[cue];
    if (ref && root.KeloFX) return root.KeloFX.spawn(ref, c);
    return null;
  }

  function onCastStarted(payload) {
    if (!enabled) return;
    const c = normalizedEvent(payload);
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    if (!profile || !profile.castSequence || !root.KeloSequence) return;
    const def = abilityDef(c.abilityId, c.abilityKey);
    if (def && def.delivery && def.delivery.type === 'dash') return;
    const sequenceId = root.KeloSequence.play(profile.castSequence, c);
    if (c.castId && sequenceId) activeCastSequences.set(c.castId, sequenceId);
  }

  function onCastConfirmed(payload) {
    if (!enabled) return;
    const c = normalizedEvent(payload);
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    if (!profile) return;
    // Local prediction already started the cast presentation. Remote confirms enter here without prediction.
    if (!payload || payload.visualPredicted !== true) {
      const def = abilityDef(c.abilityId, c.abilityKey);
      if (def && def.delivery && def.delivery.type === 'dash') return;
      if (profile.castSequence && root.KeloSequence) {
        const sequenceId = root.KeloSequence.play(profile.castSequence, c);
        if (c.castId && sequenceId) activeCastSequences.set(c.castId, sequenceId);
      }
    }
  }

  function onCastRejected(payload) {
    const c = normalizedEvent(payload);
    const actor = c.actor || ctxApi.resolveActor(c.actorId);
    if (actor && root.KeloAnimation) root.KeloAnimation.stop(actor, 'action', 'CAST_REJECTED');
    if (c.castId && activeCastSequences.has(c.castId) && root.KeloSequence) root.KeloSequence.stop(activeCastSequences.get(c.castId));
    if (c.castId) activeCastSequences.delete(c.castId);
  }

  function onProjectileSpawn(payload) {
    if (!enabled) return;
    const c = normalizedEvent(payload);
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    if (!profile || !profile.projectileVisual || !root.KeloProjectileVisuals) return;
    const gameplayObject = payload && payload.gameplayObject || null;
    const visualId = gameplayObject
      ? root.KeloProjectileVisuals.attach(gameplayObject, profile.projectileVisual, c, { speed: c.gameplay.speed, maxDistance: c.gameplay.range })
      : root.KeloProjectileVisuals.preview(profile.projectileVisual, c, { speed: c.gameplay.speed, maxDistance: c.gameplay.range });
    const key = c.projectileId || c.castId;
    if (key && visualId) activeProjectileVisuals.set(key, visualId);
  }

  function stopProjectileFor(c) {
    const key = c.projectileId || c.castId;
    if (!key || !root.KeloProjectileVisuals) return;
    const visualId = activeProjectileVisuals.get(key);
    if (visualId) root.KeloProjectileVisuals.stop(visualId);
    activeProjectileVisuals.delete(key);
  }

  function onProjectileHit(payload) {
    if (!enabled) return;
    const c = normalizedEvent(payload);
    stopProjectileFor(c);
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    if (profile && profile.impactSequence && root.KeloSequence) root.KeloSequence.play(profile.impactSequence, c);
  }

  function onProjectileExpired(payload) { stopProjectileFor(normalizedEvent(payload)); }

  function swordThrowKey(payload, c) {
    return String(payload && payload.swordEntityId || c && (c.projectileId || c.castId) || '');
  }

  function onSwordThrown(payload) {
    if (!enabled || !root.KeloProjectileVisuals) return;
    const c = normalizedEvent(payload);
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    const ref = profile && profile.throwVisual;
    if (!ref) return;
    const gameplayObject = payload && payload.gameplayObject || null;
    const options = { speed: c.gameplay.speed, maxDistance: c.gameplay.range, loop: true };
    const visualId = gameplayObject
      ? root.KeloProjectileVisuals.attach(gameplayObject, ref, c, options)
      : root.KeloProjectileVisuals.preview(ref, c, options);
    const key = swordThrowKey(payload, c);
    if (key && visualId) activeSwordThrowVisuals.set(key, visualId);
  }

  function stopSwordThrow(payload) {
    if (!root.KeloProjectileVisuals) return;
    const c = normalizedEvent(payload);
    const key = swordThrowKey(payload, c);
    const visualId = key && activeSwordThrowVisuals.get(key);
    if (visualId) root.KeloProjectileVisuals.stop(visualId);
    if (key) activeSwordThrowVisuals.delete(key);
  }

  function statusKey(c, status) { return String(c.actorId || 'actor') + ':' + String(status || c.statusId || 'status'); }
  function onStatusApplied(payload) {
    if (!enabled || !root.KeloFX) return;
    const c = normalizedEvent(payload);
    const status = payload && (payload.status || payload.effect && payload.effect.status);
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    const ref = profile && profile.statusVisuals && profile.statusVisuals[status] || manifests.statusVisuals && manifests.statusVisuals[status];
    if (!ref) return;
    const duration = Math.max(0.1, Number(payload && payload.duration || payload && payload.effect && payload.effect.duration) || 1);
    const id = root.KeloFX.spawn(ref, c, { loop: false, duration: duration });
    if (id) activeStatusVisuals.set(statusKey(c, status), id);
  }

  function onStatusRemoved(payload) {
    if (!root.KeloFX) return;
    const c = normalizedEvent(payload);
    const status = payload && (payload.status || payload.effect && payload.effect.status);
    const key = statusKey(c, status);
    const id = activeStatusVisuals.get(key);
    if (id) root.KeloFX.stop(id);
    activeStatusVisuals.delete(key);
  }

  function onShield(payload) {
    if (!enabled || !root.KeloFX) return;
    const c = normalizedEvent(payload);
    const ref = manifests.statusVisuals && manifests.statusVisuals.shield;
    if (ref) root.KeloFX.spawn(ref, c);
  }

  // KELO-INDEX VISUAL/IMPACT un solo impacto por castId; los proyectiles ya explotan en PROJECTILE_HIT.
  function onAbilityImpact(payload) {
    if (!enabled) return;
    const c = normalizedEvent(payload);
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    if (!profile || !profile.impactSequence || !root.KeloSequence) return;
    const def = abilityDef(c.abilityId, c.abilityKey);
    const delivery = def && def.delivery && def.delivery.type;
    if (delivery === 'projectile') return;
    const key = String(c.castId || (c.abilityKey || c.abilityId || 'impact') + ':' + Math.round((c.origin && c.origin.x) || 0));
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const prev = impactPlayedAt.get(key);
    if (prev && now - prev < 420) return;
    impactPlayedAt.set(key, now);
    if (impactPlayedAt.size > 48) {
      const first = impactPlayedAt.keys().next().value;
      impactPlayedAt.delete(first);
    }
    const origin = c.target || c.origin;
    root.KeloSequence.play(profile.impactSequence, Object.assign({}, c, { origin: origin, target: origin }));
  }

  function stopDashTravel(actorId) {
    const key = String(actorId || 'actor');
    const id = activeDashTravel.get(key);
    if (id && root.KeloFX) root.KeloFX.stop(id);
    activeDashTravel.delete(key);
  }

  // KELO-INDEX VISUAL/DASH trail de movilidad; el cast local ya reprodujo la sequence de inicio.
  function onDashStarted(payload) {
    if (!enabled) return;
    const c = normalizedEvent(payload);
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    if (!profile) return;
    const seq = profile.dashSequence || profile.castSequence;
    if (seq && root.KeloSequence) root.KeloSequence.play(seq, c);
    if (profile.travelEffect && root.KeloFX) {
      const key = String(c.actorId || 'actor');
      stopDashTravel(key);
      const id = root.KeloFX.spawn(profile.travelEffect, c, { space: 'ACTOR', socket: 'center', loop: true, duration: 0.22 });
      if (id) activeDashTravel.set(key, id);
    }
  }

  function onDashEnded(payload) {
    if (!enabled) return;
    const c = normalizedEvent(payload);
    stopDashTravel(c.actorId);
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    if (profile && profile.dashEndSequence && root.KeloSequence) {
      const origin = c.target || c.origin;
      root.KeloSequence.play(profile.dashEndSequence, Object.assign({}, c, { origin: origin, target: origin }));
    }
  }

  function trapOrigin(payload, c) {
    return (payload && (payload.origin || payload.target || payload.position)) || (c && (c.origin || c.target)) || null;
  }

  function stopTrapVisuals(trapId) {
    const key = String(trapId || '');
    if (!key) return;
    const rec = activeTrapVisuals.get(key);
    if (!rec) return;
    if (rec.sigil && root.KeloFX) root.KeloFX.stop(rec.sigil);
    if (rec.area && root.KeloFX) root.KeloFX.stop(rec.area);
    activeTrapVisuals.delete(key);
  }

  // KELO-INDEX VISUAL/TRAP sigilo + radio persistente keyed por trapId; el gameplay no pinta el placeholder si hay profile.
  function onTrapPlaced(payload) {
    if (!enabled) return;
    const c = normalizedEvent(payload);
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    if (!profile) return;
    const origin = trapOrigin(payload, c);
    const ctx = Object.assign({}, c, { origin: origin, target: origin, trapId: payload && payload.trapId || c.trapId });
    if (profile.placeSequence && root.KeloSequence) root.KeloSequence.play(profile.placeSequence, ctx);
    const trapId = String(ctx.trapId || ('trap_' + (fallbackSeq++).toString(36)));
    stopTrapVisuals(trapId);
    const rec = {};
    const spawnAt = { x: origin && origin.x, y: origin && origin.y, loop: true };
    if (profile.persistentFx && root.KeloFX) rec.sigil = root.KeloFX.spawn(profile.persistentFx, ctx, spawnAt);
    if (profile.areaFx && root.KeloFX) rec.area = root.KeloFX.spawn(profile.areaFx, ctx, spawnAt);
    activeTrapVisuals.set(trapId, rec);
  }

  function onTrapArmed(payload) {
    if (!enabled) return;
    const c = normalizedEvent(payload);
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    if (!profile || !root.KeloFX) return;
    const origin = trapOrigin(payload, c);
    const ctx = Object.assign({}, c, { origin: origin, target: origin, visual: Object.assign({}, c.visual || {}, { armed: true }) });
    if (profile.armedFx) root.KeloFX.spawn(profile.armedFx, ctx);
  }

  function onTrapTriggered(payload) {
    if (!enabled) return;
    const c = normalizedEvent(payload);
    stopTrapVisuals(payload && payload.trapId || c.trapId);
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    if (!profile || !profile.triggerSequence || !root.KeloSequence) return;
    const origin = trapOrigin(payload, c);
    root.KeloSequence.play(profile.triggerSequence, Object.assign({}, c, { origin: origin, target: origin }));
  }

  function onTrapExpired(payload) {
    const c = normalizedEvent(payload);
    stopTrapVisuals(payload && payload.trapId || c.trapId);
  }

  bus.on('CAST_STARTED', onCastStarted);
  bus.on('CAST_CONFIRMED', onCastConfirmed);
  bus.on('CAST_REJECTED', onCastRejected);
  bus.on('PROJECTILE_SPAWNED', onProjectileSpawn);
  bus.on('PROJECTILE_HIT', onProjectileHit);
  bus.on('PROJECTILE_EXPIRED', onProjectileExpired);
  bus.on('SWORD_THROWN', onSwordThrown);
  bus.on('SWORD_LANDED', stopSwordThrow);
  bus.on('SWORD_THROW_CANCELLED', stopSwordThrow);
  bus.on('STATUS_APPLIED', onStatusApplied);
  bus.on('STATUS_REMOVED', onStatusRemoved);
  bus.on('SHIELD_APPLIED', onShield);
  bus.on('ABILITY_IMPACT', onAbilityImpact);
  bus.on('DASH_STARTED', onDashStarted);
  bus.on('DASH_ENDED', onDashEnded);
  bus.on('TRAP_PLACED', onTrapPlaced);
  bus.on('TRAP_ARMED', onTrapArmed);
  bus.on('TRAP_TRIGGERED', onTrapTriggered);
  bus.on('TRAP_EXPIRED', onTrapExpired);

  function faceDirection(actor) {
    const face = actor && actor._face || 'right';
    if (face === 'left') return { x: -1, y: 0 };
    if (face === 'up') return { x: 0, y: -1 };
    if (face === 'down') return { x: 0, y: 1 };
    return { x: 1, y: 0 };
  }

  function normalizeDirection(dx, dy, fallback) {
    const len = Math.hypot(Number(dx) || 0, Number(dy) || 0);
    if (!len) return fallback || { x: 1, y: 0 };
    return { x: dx / len, y: dy / len };
  }

  function slotDefinition(slot) {
    const entry = root.KeloAbilities && root.KeloAbilities.hotbar && root.KeloAbilities.hotbar.slots && root.KeloAbilities.hotbar.slots[slot];
    return entry && entry.definition || null;
  }

  function player() { try { return typeof localPlayer !== 'undefined' ? localPlayer : null; } catch (e) { return null; } }

  function makePending(slot, event) {
    const actor = player();
    const def = slotDefinition(slot);
    if (!actor || !def) return null;
    const actorId = String(actor.id || 'local');
    const castId = 'cast_' + actorId + '_' + Date.now().toString(36) + '_' + (fallbackSeq++).toString(36);
    const pending = {
      slot: slot, pointerId: event && event.pointerId, x0: event && event.clientX || 0, y0: event && event.clientY || 0,
      x1: event && event.clientX || 0, y1: event && event.clientY || 0,
      def: def, castId: castId, seed: (Date.now() ^ fallbackSeq * 2654435761) >>> 0,
      direction: faceDirection(actor), position: null
    };
    pendingBySlot.set(slot, pending);
    const c = contextForPending(pending, true);
    bus.emit('CAST_STARTED', Object.assign({}, c, { visualPredicted: true }));
    return pending;
  }

  function contextForPending(pending, predicted) {
    const actor = player();
    const def = pending.def || slotDefinition(pending.slot);
    const delivery = def && def.delivery || {};
    const target = def && def.targeting || {};
    const origin = actor && root.KeloAnchors ? root.KeloAnchors.get(actor, 'castOrigin') : actor ? { x: actor.x, y: actor.y } : null;
    return {
      actor: actor, actorId: actor && String(actor.id || 'local'), castId: pending.castId,
      abilityId: def && def.id, abilityKey: def && def.key, origin: origin,
      target: pending.position, direction: pending.direction,
      gameplay: {
        speed: Number(delivery.speed) || 0,
        range: Number(delivery.maxDistance || target.range) || 0,
        radius: Number(delivery.radius || delivery.activationRadius) || 0
      },
      visual: { seed: pending.seed, scale: 1 }, predicted: predicted === true, confirmed: predicted !== true
    };
  }

  function finalizeAim(pending) {
    if (!pending) return;
    const actor = player();
    const def = pending.def;
    const dx = pending.x1 - pending.x0, dy = pending.y1 - pending.y0;
    pending.direction = normalizeDirection(dx, dy, faceDirection(actor));
    if (def && def.targeting && def.targeting.type === 'position' && actor) {
      const zoom = typeof CONFIG !== 'undefined' && Number(CONFIG.zoom) || 1;
      const amount = Math.min(Number(def.targeting.range) || 300, (Math.hypot(dx, dy) / zoom * 1.2) || 80);
      pending.position = { x: actor.x + pending.direction.x * amount, y: actor.y + pending.direction.y * amount };
    }
  }

  // Capture phase records aiming before the existing hotbar target handlers call gameplay cast().
  function installAimCapture() {
    document.addEventListener('pointerdown', function (event) {
      const button = event.target && event.target.closest && event.target.closest('.stone-slot[data-slot]');
      if (!button) return;
      const slot = Number(button.dataset.slot);
      if (!Number.isInteger(slot)) return;
      const pending = makePending(slot, event);
      if (pending) pointerAim = pending;
    }, true);
    document.addEventListener('pointermove', function (event) {
      if (!pointerAim || pointerAim.pointerId !== event.pointerId) return;
      pointerAim.x1 = event.clientX; pointerAim.y1 = event.clientY;
    }, true);
    document.addEventListener('pointerup', function (event) {
      if (!pointerAim || pointerAim.pointerId !== event.pointerId) return;
      pointerAim.x1 = event.clientX; pointerAim.y1 = event.clientY; finalizeAim(pointerAim); pointerAim = null;
    }, true);
    document.addEventListener('pointercancel', function (event) {
      if (!pointerAim || pointerAim.pointerId !== event.pointerId) return;
      const c = contextForPending(pointerAim, false); bus.emit('CAST_REJECTED', Object.assign({}, c, { reason: 'POINTER_CANCELLED' })); pendingBySlot.delete(pointerAim.slot); pointerAim = null;
    }, true);
  }

  function maskDefinition(def) {
    if (!enabled || !def || !resolveProfile(def.id, def.key) || !def.visuals) return;
    if (!maskedLegacyColors.has(def)) maskedLegacyColors.set(def, def.visuals.color);
    def.visuals.color = 'rgba(0,0,0,0)';
  }
  function restoreLegacyMasks() {
    maskedLegacyColors.forEach(function (color, def) { if (def && def.visuals) def.visuals.color = color; });
    maskedLegacyColors.clear();
  }
  function applyLegacyMasks() {
    if (!enabled) return restoreLegacyMasks();
    const slots = root.KeloAbilities && root.KeloAbilities.hotbar && root.KeloAbilities.hotbar.slots || [];
    slots.forEach(function (slot) { if (slot && slot.definition) maskDefinition(slot.definition); });
  }

  // KELO-INDEX VISUAL/LEGACY-ADAPTER convierte el bus actual a eventos semánticos sin tocar StoneSystem ni gameplay.
  function installLegacyAbilityBusAdapter() {
    const abilityBus = root.KeloAbilities && root.KeloAbilities.bus;
    if (!abilityBus || typeof abilityBus.on !== 'function') return;
    installAimCapture();
    applyLegacyMasks();

    abilityBus.on('LOADOUT_CHANGED', function () { applyLegacyMasks(); });
    abilityBus.on('ABILITY_CAST', function (payload) {
      const slot = Number(payload.slotIndex);
      let pending = pendingBySlot.get(slot);
      if (!pending) {
        pending = makePending(slot, null);
        if (pending) finalizeAim(pending);
      }
      if (!pending) return;
      const def = slotDefinition(slot) || abilityDef(payload.abilityId, payload.abilityKey);
      pending.def = def || pending.def;
      finalizeAim(pending);
      if (def) maskDefinition(def);
      const c = contextForPending(pending, false);
      c.abilityId = payload.abilityId; c.abilityKey = payload.abilityKey; c.confirmed = true; c.predicted = false;
      activeCastByAbility.set(Number(payload.abilityId), { context: c, def: def, projectileHit: false, createdAt: performance.now() });
      bus.emit('CAST_CONFIRMED', Object.assign({}, c, { visualPredicted: true, clientSequence: payload.clientSequence }));
      if (def && def.delivery && def.delivery.type === 'projectile') {
        bus.emit('PROJECTILE_SPAWNED', Object.assign({}, c, { projectileId: 'p_' + c.castId }));
      } else if (def && (def.delivery.type === 'instant' || def.delivery.type === 'self_aoe')) {
        bus.emit('ABILITY_IMPACT', Object.assign({}, c, { target: c.origin }));
      }
      pendingBySlot.delete(slot);
    });

    abilityBus.on('SWAP_SWORD_THROWN', function (payload) {
      bus.emit('SWORD_THROWN', Object.assign({}, payload || {}));
    });
    abilityBus.on('SWAP_SWORD_LANDED', function (payload) {
      bus.emit('SWORD_LANDED', Object.assign({}, payload || {}));
    });
    abilityBus.on('SWAP_SWORD_THROW_CANCELLED', function (payload) {
      bus.emit('SWORD_THROW_CANCELLED', Object.assign({}, payload || {}));
    });

    abilityBus.on('ABILITY_FAILED', function (payload) {
      const slot = Number(payload && payload.request && payload.request.slotIndex);
      const pending = pendingBySlot.get(slot);
      if (!pending) return;
      const c = contextForPending(pending, false);
      bus.emit('CAST_REJECTED', Object.assign({}, c, { reason: payload.reason || 'REJECTED' }));
      pendingBySlot.delete(slot);
    });

    abilityBus.on('DAMAGE', function (payload) {
      const activeCast = activeCastByAbility.get(Number(payload.abilityId));
      if (!activeCast) return;
      const c = Object.assign({}, activeCast.context);
      if (payload.target) c.target = { x: payload.target.x, y: payload.target.y };
      const deliveryType = activeCast.def && activeCast.def.delivery && activeCast.def.delivery.type;
      if (deliveryType === 'projectile' && !activeCast.projectileHit) {
        activeCast.projectileHit = true;
        bus.emit('PROJECTILE_HIT', Object.assign({}, c, { projectileId: 'p_' + c.castId, targetActorId: payload.target && payload.target.id || null }));
      }
      bus.emit('ABILITY_IMPACT', Object.assign({}, c, { targetActorId: payload.target && payload.target.id || null, amount: payload.amount }));
    });

    abilityBus.on('STATUS_APPLIED', function (payload) {
      const activeCast = activeCastByAbility.get(Number(payload.abilityId));
      const base = activeCast ? activeCast.context : { abilityId: payload.abilityId };
      const target = payload.target;
      bus.emit('STATUS_APPLIED', Object.assign({}, base, {
        actor: target || null, actorId: target && String(target.id || '') || null,
        target: target ? { x: target.x, y: target.y } : null,
        status: payload.effect && payload.effect.status, effect: payload.effect,
        duration: payload.effect && payload.effect.duration
      }));
    });
    abilityBus.on('SHIELD_APPLIED', function (payload) {
      const target = payload.target;
      bus.emit('SHIELD_APPLIED', { actor: target, actorId: target && String(target.id || ''), abilityId: payload.abilityId, origin: target ? { x: target.x, y: target.y } : null, amount: payload.amount, visual: { seed: fallbackSeq++ } });
    });
    abilityBus.on('SHIELD_BROKEN', function (payload) {
      const target = payload.target; bus.emit('SHIELD_BROKEN', { actor: target, actorId: target && String(target.id || ''), origin: target ? { x: target.x, y: target.y } : null });
    });
    abilityBus.on('DEATH', function (payload) {
      const target = payload.target; bus.emit('DEATH', { actor: target, actorId: target && String(target.id || ''), origin: target ? { x: target.x, y: target.y } : null, abilityId: payload.abilityId });
    });
    abilityBus.on('DASH_STARTED', function (payload) { bus.emit('DASH_STARTED', Object.assign({}, payload || {})); });
    abilityBus.on('DASH_ENDED', function (payload) { bus.emit('DASH_ENDED', Object.assign({}, payload || {})); });
    abilityBus.on('TRAP_PLACED', function (payload) { bus.emit('TRAP_PLACED', Object.assign({}, payload || {})); });
    abilityBus.on('TRAP_ARMED', function (payload) { bus.emit('TRAP_ARMED', Object.assign({}, payload || {})); });
    abilityBus.on('TRAP_TRIGGERED', function (payload) { bus.emit('TRAP_TRIGGERED', Object.assign({}, payload || {})); });
    abilityBus.on('TRAP_EXPIRED', function (payload) { bus.emit('TRAP_EXPIRED', Object.assign({}, payload || {})); });

    root.KELO_ABILITY_SEMANTIC_EVENTS = true;
    if (root.KELO_VISUAL_AUDIT) root.KELO_VISUAL_AUDIT.legacyAbilityAdapter = 'semantic-event-bridge-v1.2';
  }

  function collectProfileAssets(profile) {
    const ids = new Set();
    function addFromFx(ref) { const def = ref && root.KeloFXRegistry && root.KeloFXRegistry.get(ref); if (def && def.assetId) ids.add(def.assetId); }
    function addFromProjectile(ref) { const def = ref && root.KeloProjectileVisualRegistry && root.KeloProjectileVisualRegistry.get(ref); if (def && def.assetId) ids.add(def.assetId); if (def && def.trailRef) addFromFx(def.trailRef); }
    function addSequence(ref) {
      const seq = ref && root.KeloSequenceRegistry && root.KeloSequenceRegistry.get(ref); if (!seq) return;
      seq.cues.forEach(function (cue) {
        if (cue.type === 'fx') addFromFx(cue.ref);
        if (cue.type === 'projectileVisual') addFromProjectile(cue.ref);
        if (cue.type === 'actorAnimation') { const clip = root.KeloAnimationRegistry && root.KeloAnimationRegistry.get(cue.ref); if (clip && clip.assetId) ids.add(clip.assetId); }
        if (cue.type === 'sfx') { const sfx = root.KeloSFXRegistry && root.KeloSFXRegistry.get(cue.ref); if (sfx && sfx.assetId) ids.add(sfx.assetId); }
      });
    }
    if (profile) {
      addSequence(profile.castSequence);
      addSequence(profile.impactSequence);
      addSequence(profile.dashSequence);
      addSequence(profile.dashEndSequence);
      addSequence(profile.placeSequence);
      addSequence(profile.triggerSequence);
      addFromProjectile(profile.projectileVisual);
      addFromProjectile(profile.throwVisual);
      addFromFx(profile.persistentFx);
      addFromFx(profile.areaFx);
      addFromFx(profile.travelEffect);
      addFromFx(profile.armedFx);
    }
    return Array.from(ids);
  }

  function preloadProfile(profile) {
    if (!profile || !root.KeloAssetRegistry) return Promise.resolve([]);
    return root.KeloAssetRegistry.preload(collectProfileAssets(profile));
  }

  function setEnabled(value) {
    enabled = value !== false;
    if (enabled) applyLegacyMasks(); else restoreLegacyMasks();
    if (root.KELO_VISUAL_AUDIT) root.KELO_VISUAL_AUDIT.abilityResolverEnabled = enabled;
    return enabled;
  }

  root.KeloVisualProfileRegistry = Object.freeze({ version: 'visual-profile-registry-v1.0.0', register: register, get: get, list: list, resolve: resolveProfile });
  root.KeloAbilityVisuals = Object.freeze({
    version: 'ability-visual-resolver-v1.3.0',
    setEnabled: setEnabled,
    get enabled() { return enabled; },
    hasProfile: hasProfile,
    shouldUseLegacy: shouldUseLegacy,
    resolveProfile: resolveProfile,
    playCue: playCue,
    preloadProfile: preloadProfile,
    applyLegacyMasks: applyLegacyMasks
  });

  if (root.KELO_VISUAL_AUDIT) root.KELO_VISUAL_AUDIT.abilityResolverEnabled = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installLegacyAbilityBusAdapter, { once: true });
  else installLegacyAbilityBusAdapter();
})(typeof globalThis !== 'undefined' ? globalThis : window);
