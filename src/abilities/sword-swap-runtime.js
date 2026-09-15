/* KELO-INDEX
 * area: ABILITY
 * owner: KeloSwordSwapRuntime; simulation extension owned by KeloSimulation
 * keys: SWORD SWAP THROW ANCHOR TELEPORT RETURN VFX AMENOTEJIKARA FOUNDATION
 * hace: runtime mínimo de Espada de Intercambio; usa los PNG dedicados y conserva gameplay separado de presentación
 * online: emite eventos semánticos en KeloAbilities.bus; la autoridad puede reemplazar estas mutaciones locales más adelante
 * extension-points: KeloSimulation.after para el tick de la state machine
 * do-not: NO envolver updateSimulation
 */
(function (root) {
  'use strict';

  const ABILITY_KEY = 'swap_sword';
  const SHEET_W = 362;
  const SHEET_H = 724;
  const DEFAULT_ANCHOR_SECONDS = 5.0;
  const RETURN_SPEED = 980;
  const INPUT_DRAG_THRESHOLD = 18;
  const TARGET_PICK_RADIUS = 76;

  const state = {
    phase: 'READY', slot: -1, def: null, sword: null,
    anchorRemaining: 0, phaseRemaining: 0,
    loopFxId: null, directThrowVisualId: null, returnVisualId: null,
    input: null, sequence: 1,
    simulationHookInstalled: false, inputInstalled: false, visualsRegistered: false,
  };

  function nowId(prefix) {
    return String(prefix || 'swap') + '_' + Date.now().toString(36) + '_' + (state.sequence++).toString(36);
  }

  function toast(message) {
    try { if (typeof showToast === 'function') showToast(message); } catch (e) {}
  }

  function player() {
    try { return typeof localPlayer !== 'undefined' ? localPlayer : null; } catch (e) { return null; }
  }

  function slotEntry(slot) {
    const hotbar = root.KeloAbilities && root.KeloAbilities.hotbar;
    return hotbar && hotbar.slots ? hotbar.slots[slot] || null : null;
  }

  function swapDefinitionAt(slot) {
    const entry = slotEntry(slot);
    return entry && entry.definition && entry.definition.key === ABILITY_KEY ? entry.definition : null;
  }

  function normalize(dx, dy, fallback) {
    const len = Math.hypot(Number(dx) || 0, Number(dy) || 0);
    if (!len) return fallback || { x: 1, y: 0 };
    return { x: dx / len, y: dy / len };
  }

  function faceDirection(actor) {
    const face = actor && actor._face;
    if (face === 'left') return { x: -1, y: 0 };
    if (face === 'up') return { x: 0, y: -1 };
    if (face === 'down') return { x: 0, y: 1 };
    if (face === 'right') return { x: 1, y: 0 };
    const vx = actor && Number(actor.vx) || 0;
    const vy = actor && Number(actor.vy) || 0;
    return normalize(vx, vy, { x: 1, y: 0 });
  }

  function clampWorld(p) {
    let worldW = 3600, worldH = 3200;
    try {
      if (typeof CONFIG !== 'undefined') {
        worldW = Number(CONFIG.worldWidth) || worldW;
        worldH = Number(CONFIG.worldHeight) || worldH;
      }
    } catch (e) {}
    return {
      x: Math.max(24, Math.min(worldW - 24, Number(p.x) || 24)),
      y: Math.max(24, Math.min(worldH - 24, Number(p.y) || 24)),
    };
  }

  function emit(name, payload) {
    const bus = root.KeloAbilities && root.KeloAbilities.bus;
    if (!bus || typeof bus.emit !== 'function') return;
    try { bus.emit(name, payload || {}); } catch (e) { console.error(e); }
  }

  function baseContext(def, actor, origin, target, direction, castId) {
    const delivery = def && def.delivery || {};
    const targeting = def && def.targeting || {};
    return {
      actor: actor,
      actorId: actor && String(actor.id || 'local'),
      playerId: actor && String(actor.id || 'local'),
      castId: castId || nowId('swapcast'),
      abilityId: def && def.id,
      abilityKey: def && def.key,
      origin: origin ? { x: origin.x, y: origin.y } : actor ? { x: actor.x, y: actor.y } : null,
      target: target ? { x: target.x, y: target.y } : null,
      direction: direction || { x: 1, y: 0 },
      gameplay: {
        speed: Number(delivery.speed) || 720,
        range: Number(delivery.maxDistance || targeting.range) || 420,
        radius: Number(delivery.selectRadius) || 42,
      },
      visual: { seed: state.sequence++, scale: 1 },
    };
  }

  function registerVisuals() {
    if (state.visualsRegistered) return true;
    if (!root.KeloAssetRegistry || !root.KeloFXRegistry || !root.KeloProjectileVisualRegistry) return false;

    const assets = [
      { id: 'sword_swap_impact_asset_v2', type: 'image', src: 'assets/fx/sword-swap/a.PNG', preload: true },
      { id: 'sword_swap_loop_asset_v2', type: 'image', src: 'assets/fx/sword-swap/loop.PNG', preload: true },
      { id: 'sword_swap_teleport_asset_v2', type: 'image', src: 'assets/fx/sword-swap/teleport%20.PNG', preload: true },
      { id: 'sword_swap_return_asset_v2', type: 'image', src: 'assets/fx/sword-swap/regreso2.PNG', preload: true },
    ];

    assets.forEach(function (def) {
      try { if (!root.KeloAssetRegistry.get(def.id)) root.KeloAssetRegistry.register(def); } catch (e) { console.warn('[SwordSwap] asset register', def.id, e); }
    });

    const fxDefs = [
      {
        id: 'sword_swap_impact_fx_v2', type: 'sprite_animation', assetId: 'sword_swap_impact_asset_v2',
        frameWidth: SHEET_W, frameHeight: SHEET_H, columns: 6, rows: 1, frames: 6, fps: 12,
        space: 'WORLD', layer: 'foregroundFX', duration: 0.50, loop: false,
        width: 145, height: 290, alpha: 1, fadeOut: false,
      },
      {
        id: 'sword_swap_anchor_loop_fx_v2', type: 'sprite_animation', assetId: 'sword_swap_loop_asset_v2',
        frameWidth: SHEET_W, frameHeight: SHEET_H, columns: 6, rows: 1, frames: 6, fps: 9,
        space: 'WORLD', layer: 'foregroundFX', duration: 0.67, loop: true,
        width: 145, height: 290, alpha: 1, fadeOut: false,
      },
      {
        id: 'sword_swap_teleport_fx_v2', type: 'sprite_animation', assetId: 'sword_swap_teleport_asset_v2',
        frameWidth: SHEET_W, frameHeight: SHEET_H, columns: 6, rows: 1, frames: 6, fps: 14,
        space: 'WORLD', layer: 'foregroundFX', duration: 0.43, loop: false,
        width: 155, height: 310, alpha: 1, fadeOut: false,
      },
      {
        id: 'sword_swap_return_launch_fx_v2', type: 'sprite_animation', assetId: 'sword_swap_return_asset_v2',
        frameWidth: SHEET_W, frameHeight: SHEET_H, columns: 6, rows: 1, frames: 4, fps: 13,
        space: 'WORLD', layer: 'foregroundFX', duration: 0.31, loop: false,
        width: 145, height: 290, alpha: 1, fadeOut: false,
      },
    ];

    fxDefs.forEach(function (def) {
      try { if (!root.KeloFXRegistry.get(def.id)) root.KeloFXRegistry.register(def); } catch (e) { console.warn('[SwordSwap] FX register', def.id, e); }
    });

    try {
      if (!root.KeloProjectileVisualRegistry.get('sword_swap_return_flight_visual_v2')) {
        root.KeloProjectileVisualRegistry.register({
          id: 'sword_swap_return_flight_visual_v2', type: 'sprite_animation', assetId: 'sword_swap_return_asset_v2',
          layer: 'foregroundFX', frames: 2, fps: 14, loop: true,
          frameRects: [
            { x: SHEET_W * 4, y: 0, width: SHEET_W, height: SHEET_H },
            { x: SHEET_W * 5, y: 0, width: SHEET_W, height: SHEET_H },
          ],
          sourcePixelScale: 0.36, alpha: 1, alignToVelocity: true,
          rotationOffset: Math.PI, defaultSpeed: RETURN_SPEED, defaultMaxDistance: 900,
        });
      }
    } catch (e) { console.warn('[SwordSwap] return visual register', e); }

    root.KeloAssetRegistry.preload(assets.map(function (a) { return a.id; })).catch(function () {});
    state.visualsRegistered = true;
    return true;
  }

  function spawnFx(ref, p, options) {
    if (!root.KeloFX || typeof root.KeloFX.spawn !== 'function' || !p) return null;
    return root.KeloFX.spawn(ref, { origin: { x: p.x, y: p.y }, visual: { seed: state.sequence++, scale: 1 } }, options || {});
  }

  function stopFx(id) {
    if (id && root.KeloFX && typeof root.KeloFX.stop === 'function') root.KeloFX.stop(id);
  }

  function stopLoop() {
    stopFx(state.loopFxId);
    state.loopFxId = null;
  }

  function playCastPresentation(context) {
    if (root.KELO_ABILITY_SEMANTIC_EVENTS === true) return;
    if (root.KeloAbilityVisuals && typeof root.KeloAbilityVisuals.playCue === 'function') {
      try { root.KeloAbilityVisuals.playCue(context.abilityId, 'cast', context); } catch (e) {}
    }
  }

  function beginThrowVisual(context) {
    const payload = Object.assign({}, context, { swordEntityId: state.sword.id, gameplayObject: state.sword });
    emit('SWAP_SWORD_THROWN', payload);
    if (root.KELO_ABILITY_SEMANTIC_EVENTS === true) return;
    if (root.KeloProjectileVisuals && typeof root.KeloProjectileVisuals.attach === 'function') {
      state.directThrowVisualId = root.KeloProjectileVisuals.attach(
        state.sword, 'sword_swap_katana_throw_visual', context,
        { speed: context.gameplay.speed, maxDistance: context.gameplay.range, loop: true }
      );
    }
  }

  function endThrowVisual(context) {
    emit('SWAP_SWORD_LANDED', Object.assign({}, context, { swordEntityId: state.sword && state.sword.id }));
    if (state.directThrowVisualId && root.KeloProjectileVisuals) root.KeloProjectileVisuals.stop(state.directThrowVisualId);
    state.directThrowVisualId = null;
  }

  function validateFirstUse(slot, def) {
    const actor = player();
    const entry = slotEntry(slot);
    if (!actor || actor.hp <= 0) return { ok: false, reason: 'DEAD' };
    if (!entry || !def) return { ok: false, reason: 'EMPTY_SLOT' };
    if ((entry.cooldown || 0) > 0) return { ok: false, reason: 'COOLDOWN' };
    const cost = Number(def.resource && def.resource.cost) || 0;
    if ((Number(actor.mana) || 0) < cost) return { ok: false, reason: 'NO_MANA' };
    return { ok: true };
  }

  function fail(slot, reason) {
    const labels = { DEAD: 'No puedes usarla ahora', COOLDOWN: 'Habilidad en enfriamiento', NO_MANA: 'Mana insuficiente', NO_TARGET: 'No hay personaje en esa dirección' };
    toast(labels[reason] || 'No se pudo usar la habilidad');
    emit('ABILITY_FAILED', { request: { slotIndex: slot }, reason: reason, abilityKey: ABILITY_KEY });
  }

  function castEvent(slot, def, context, stage) {
    const entry = slotEntry(slot);
    emit('ABILITY_CAST', {
      playerId: context.playerId,
      stoneUid: entry && entry.stoneUid,
      abilityId: def.id,
      abilityKey: def.key,
      slotIndex: slot,
      clientSequence: state.sequence++,
      loadoutFingerprint: root.KeloAbilities && root.KeloAbilities.getLoadoutSnapshot ? root.KeloAbilities.getLoadoutSnapshot().fingerprint : '',
      swapStage: stage,
    });
    playCastPresentation(context);
  }

  function startThrow(slot, def, gesture) {
    const check = validateFirstUse(slot, def);
    if (!check.ok) return fail(slot, check.reason);
    const actor = player();
    const dx = gesture.x1 - gesture.x0;
    const dy = gesture.y1 - gesture.y0;
    const dir = normalize(dx, dy, faceDirection(actor));
    const zoom = (function () { try { return typeof CONFIG !== 'undefined' ? Number(CONFIG.zoom) || 1 : 1; } catch (e) { return 1; } })();
    const range = Number(def.targeting && def.targeting.range) || 420;
    const amount = Math.min(range, Math.max(80, Math.hypot(dx, dy) / zoom * 1.2 || 80));
    const target = clampWorld({ x: actor.x + dir.x * amount, y: actor.y + dir.y * amount });
    const origin = { x: actor.x, y: actor.y };
    const castId = nowId('sword');
    const context = baseContext(def, actor, origin, target, dir, castId);

    actor.mana = Math.max(0, (Number(actor.mana) || 0) - (Number(def.resource && def.resource.cost) || 0));
    const entry = slotEntry(slot);
    if (entry) entry.cooldown = 0;

    state.phase = 'THROWING';
    state.slot = slot;
    state.def = def;
    state.anchorRemaining = 0;
    state.phaseRemaining = 0;
    state.sword = {
      id: 'sword_' + castId,
      x: origin.x, y: origin.y,
      tx: target.x, ty: target.y,
      speed: Number(def.delivery && def.delivery.speed) || 720,
      castId: castId,
      context: context,
      _keloVisualDead: false,
    };

    castEvent(slot, def, context, 'THROW');
    beginThrowVisual(context);
    emit('SWAP_SWORD_STATE', { phase: state.phase, swordEntityId: state.sword.id, target: target });
  }

  function landSword() {
    if (!state.sword || !state.def) return;
    const p = { x: state.sword.tx, y: state.sword.ty };
    state.sword.x = p.x; state.sword.y = p.y;
    endThrowVisual(state.sword.context);
    spawnFx('sword_swap_impact_fx_v2', p);
    state.phase = 'IMPACT';
    state.phaseRemaining = 0.50;
    state.anchorRemaining = DEFAULT_ANCHOR_SECONDS;
    emit('SWAP_SWORD_STATE', { phase: state.phase, swordEntityId: state.sword.id, position: p });
  }

  function beginAnchorLoop() {
    if (!state.sword) return;
    stopLoop();
    state.loopFxId = spawnFx('sword_swap_anchor_loop_fx_v2', state.sword, { loop: true, duration: 0.67 });
    state.phase = 'STUCK';
    emit('SWAP_SWORD_STATE', { phase: state.phase, swordEntityId: state.sword.id, position: { x: state.sword.x, y: state.sword.y }, remaining: state.anchorRemaining });
    toast('Espada anclada · toca para ir a ella o arrastra hacia un personaje');
  }

  function otherActors() {
    const actor = player();
    const out = [];
    try {
      if (typeof simulatedPlayers !== 'undefined' && simulatedPlayers) {
        if (typeof simulatedPlayers.forEach === 'function') simulatedPlayers.forEach(function (p) { if (p && p !== actor) out.push(p); });
        else if (Array.isArray(simulatedPlayers)) simulatedPlayers.forEach(function (p) { if (p && p !== actor) out.push(p); });
      }
    } catch (e) {}
    return out.filter(function (p) { return p && (p.hp == null || p.hp > 0) && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)); });
  }

  function chooseCharacterTarget(gesture, def) {
    const actor = player();
    if (!actor) return null;
    const dx = gesture.x1 - gesture.x0, dy = gesture.y1 - gesture.y0;
    const px = Math.hypot(dx, dy);
    if (px < INPUT_DRAG_THRESHOLD) return null;
    const dir = normalize(dx, dy, faceDirection(actor));
    const zoom = (function () { try { return typeof CONFIG !== 'undefined' ? Number(CONFIG.zoom) || 1 : 1; } catch (e) { return 1; } })();
    const range = Number(def.targeting && def.targeting.range) || 420;
    const amount = Math.min(range, Math.max(70, px / zoom * 1.2));
    const aim = { x: actor.x + dir.x * amount, y: actor.y + dir.y * amount };
    const pick = Math.max(TARGET_PICK_RADIUS, Number(def.delivery && def.delivery.selectRadius) || 42);
    const candidates = otherActors()
      .filter(function (p) { return Math.hypot(p.x - actor.x, p.y - actor.y) <= range + 32; })
      .map(function (p) { return { actor: p, d: Math.hypot(p.x - aim.x, p.y - aim.y) }; })
      .filter(function (item) { return item.d <= pick; })
      .sort(function (a, b) { return a.d - b.d; });
    return candidates.length ? candidates[0].actor : null;
  }

  function teleportFxAt(p) {
    spawnFx('sword_swap_teleport_fx_v2', p, { duration: 0.43 });
  }

  function activateSwap(slot, def, gesture) {
    if (!state.sword || state.phase !== 'STUCK') {
      if (state.phase === 'IMPACT') toast('La espada todavía se está clavando');
      return;
    }
    const actor = player();
    if (!actor) return;
    const drag = Math.hypot(gesture.x1 - gesture.x0, gesture.y1 - gesture.y0);
    const context = baseContext(def, actor, actor, state.sword, normalize(state.sword.x - actor.x, state.sword.y - actor.y), nowId('swap'));
    castEvent(slot, def, context, 'SWAP');
    stopLoop();

    if (drag < INPUT_DRAG_THRESHOLD) {
      const from = { x: actor.x, y: actor.y };
      const to = { x: state.sword.x, y: state.sword.y };
      teleportFxAt(from); teleportFxAt(to);
      actor.x = to.x; actor.y = to.y;
      state.phase = 'SWAP_TO_SWORD';
      state.phaseRemaining = 0.43;
      emit('SWAP_SWORD_SWAPPED', {
        abilityId: def.id, abilityKey: def.key, mode: 'sword', actor: actor,
        sourcePosition: from, targetPosition: to, swordEntityId: state.sword.id,
      });
      return;
    }

    const target = chooseCharacterTarget(gesture, def);
    if (!target) {
      beginAnchorLoop();
      return fail(slot, 'NO_TARGET');
    }

    const aPos = { x: actor.x, y: actor.y };
    const bPos = { x: target.x, y: target.y };
    teleportFxAt(aPos); teleportFxAt(bPos);
    actor.x = bPos.x; actor.y = bPos.y;
    target.x = aPos.x; target.y = aPos.y;

    state.phase = 'SWAP_CHARACTER';
    state.phaseRemaining = 0.43;
    state.sword.swapTargetId = target.id || null;
    emit('SWAP_SWORD_SWAPPED', {
      abilityId: def.id, abilityKey: def.key, mode: 'character', actor: actor, targetActor: target,
      sourcePosition: aPos, targetPosition: bPos, swordPosition: { x: state.sword.x, y: state.sword.y },
      swordEntityId: state.sword.id,
    });
  }

  function startReturn(reason) {
    if (!state.sword || !state.def) return finishResolution(reason || 'RETURN_EMPTY');
    stopLoop();
    const origin = { x: state.sword.x, y: state.sword.y };
    spawnFx('sword_swap_return_launch_fx_v2', origin, { duration: 0.31 });
    state.phase = 'RETURN_LAUNCH';
    state.phaseRemaining = 0.24;
    state.sword.returnReason = reason || 'expired';
    emit('SWAP_SWORD_RETURN_STARTED', {
      abilityId: state.def.id, abilityKey: state.def.key, reason: state.sword.returnReason,
      swordEntityId: state.sword.id, origin: origin,
    });
  }

  function beginReturnFlight() {
    const actor = player();
    if (!actor || !state.sword) return finishResolution('RETURN_NO_PLAYER');
    const dir = normalize(actor.x - state.sword.x, actor.y - state.sword.y, { x: -1, y: 0 });
    const distanceToPlayer = Math.hypot(actor.x - state.sword.x, actor.y - state.sword.y);
    const context = baseContext(state.def, actor, state.sword, actor, dir, state.sword.castId);
    state.phase = 'RETURNING';
    state.sword._keloVisualDead = false;
    if (root.KeloProjectileVisuals && typeof root.KeloProjectileVisuals.attach === 'function') {
      state.returnVisualId = root.KeloProjectileVisuals.attach(
        state.sword, 'sword_swap_return_flight_visual_v2', context,
        { speed: RETURN_SPEED, maxDistance: Math.max(120, distanceToPlayer + 120), loop: true }
      );
    }
  }

  function finishResolution(reason) {
    stopLoop();
    if (state.directThrowVisualId && root.KeloProjectileVisuals) root.KeloProjectileVisuals.stop(state.directThrowVisualId);
    if (state.returnVisualId && root.KeloProjectileVisuals) root.KeloProjectileVisuals.stop(state.returnVisualId);
    state.directThrowVisualId = null;
    state.returnVisualId = null;
    if (state.sword) state.sword._keloVisualDead = true;

    const entry = slotEntry(state.slot);
    if (entry && state.def) entry.cooldown = Number(state.def.cooldown) || 12;
    emit('SWAP_SWORD_RESOLVED', {
      abilityId: state.def && state.def.id,
      abilityKey: ABILITY_KEY,
      reason: reason || 'resolved',
      swordEntityId: state.sword && state.sword.id,
    });

    state.phase = 'READY';
    state.slot = -1;
    state.def = null;
    state.sword = null;
    state.anchorRemaining = 0;
    state.phaseRemaining = 0;
  }

  function update(dt) {
    dt = Math.max(0, Math.min(0.05, Number(dt) || 0));
    if (!state.sword) return;

    if (state.phase === 'THROWING') {
      const dx = state.sword.tx - state.sword.x;
      const dy = state.sword.ty - state.sword.y;
      const dist = Math.hypot(dx, dy);
      const step = state.sword.speed * dt;
      if (dist <= Math.max(4, step)) return landSword();
      state.sword.x += dx / dist * step;
      state.sword.y += dy / dist * step;
      return;
    }

    if (state.phase === 'IMPACT') {
      state.phaseRemaining -= dt;
      if (state.phaseRemaining <= 0) beginAnchorLoop();
      return;
    }

    if (state.phase === 'STUCK') {
      state.anchorRemaining -= dt;
      if (state.anchorRemaining <= 0) startReturn('expired');
      return;
    }

    if (state.phase === 'SWAP_TO_SWORD') {
      state.phaseRemaining -= dt;
      if (state.phaseRemaining <= 0) finishResolution('swap-sword');
      return;
    }

    if (state.phase === 'SWAP_CHARACTER') {
      state.phaseRemaining -= dt;
      if (state.phaseRemaining <= 0) startReturn('swap-character');
      return;
    }

    if (state.phase === 'RETURN_LAUNCH') {
      state.phaseRemaining -= dt;
      if (state.phaseRemaining <= 0) beginReturnFlight();
      return;
    }

    if (state.phase === 'RETURNING') {
      const actor = player();
      if (!actor) return finishResolution('return-no-player');
      const dx = actor.x - state.sword.x;
      const dy = actor.y - state.sword.y;
      const dist = Math.hypot(dx, dy);
      const step = RETURN_SPEED * dt;
      if (dist <= Math.max(24, step)) {
        state.sword.x = actor.x; state.sword.y = actor.y;
        return finishResolution(state.sword.returnReason || 'return');
      }
      state.sword.x += dx / dist * step;
      state.sword.y += dy / dist * step;
    }
  }

  function handleGesture(gesture) {
    const def = swapDefinitionAt(gesture.slot);
    if (!def) return;
    if (state.phase === 'READY') return startThrow(gesture.slot, def, gesture);
    if (gesture.slot !== state.slot) return fail(gesture.slot, 'COOLDOWN');
    if (state.phase === 'STUCK' || state.phase === 'IMPACT') return activateSwap(gesture.slot, def, gesture);
    toast('La espada está resolviendo la habilidad');
  }

  function isSwapButton(event) {
    const button = event.target && event.target.closest && event.target.closest('.stone-slot[data-slot]');
    if (!button) return null;
    const slot = Number(button.dataset.slot);
    if (!Number.isInteger(slot) || !swapDefinitionAt(slot)) return null;
    return { button: button, slot: slot };
  }

  function stopEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  }

  function installInput() {
    if (state.inputInstalled) return;
    state.inputInstalled = true;

    document.addEventListener('pointerdown', function (event) {
      const hit = isSwapButton(event);
      if (!hit) return;
      stopEvent(event);
      state.input = {
        slot: hit.slot, pointerId: event.pointerId,
        x0: event.clientX, y0: event.clientY,
        x1: event.clientX, y1: event.clientY,
      };
      try { hit.button.setPointerCapture(event.pointerId); } catch (e) {}
    }, true);

    document.addEventListener('pointermove', function (event) {
      if (!state.input || state.input.pointerId !== event.pointerId) return;
      stopEvent(event);
      state.input.x1 = event.clientX; state.input.y1 = event.clientY;
    }, true);

    document.addEventListener('pointerup', function (event) {
      if (!state.input || state.input.pointerId !== event.pointerId) return;
      stopEvent(event);
      const gesture = state.input;
      gesture.x1 = event.clientX; gesture.y1 = event.clientY;
      state.input = null;
      handleGesture(gesture);
    }, true);

    document.addEventListener('pointercancel', function (event) {
      if (!state.input || state.input.pointerId !== event.pointerId) return;
      stopEvent(event);
      state.input = null;
    }, true);
  }

  function installSimulationHook() {
    if (state.simulationHookInstalled) return true;
    if (!root.KeloSimulation || typeof root.KeloSimulation.after !== 'function') return false;
    root.KeloSimulation.after('sword-swap-runtime:tick', function (context) {
      update(context.dt);
    }, 200);
    state.simulationHookInstalled = true;
    return true;
  }

  function boot() {
    if (!root.KeloAbilities || !registerVisuals() || !installSimulationHook()) {
      setTimeout(boot, 80);
      return;
    }
    installInput();
    root.KeloSwordSwapRuntime = Object.freeze({
      version: 'sword-swap-runtime-v2.1.0-foundation',
      getState: function () {
        return {
          phase: state.phase, slot: state.slot, anchorRemaining: state.anchorRemaining,
          sword: state.sword ? { x: state.sword.x, y: state.sword.y, id: state.sword.id } : null,
        };
      },
      forceReturn: function () { if (state.sword && state.phase === 'STUCK') startReturn('forced'); },
      reset: function () { finishResolution('debug-reset'); },
    });
    root.KELO_SWORD_SWAP_AUDIT = {
      ready: true, version: '2.1.0-foundation',
      simulationOwner: 'KeloSimulation', simulationHook: 'sword-swap-runtime:tick',
      assets: ['a.PNG', 'loop.PNG', 'teleport .PNG', 'regreso2.PNG', 'katana-throw.PNG'],
      behavior: 'throw->impact->loop->[swap sword | swap character->return | timeout->return]'
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : window);
