/* KELO-INDEX
 * area: VISUAL
 * owner: Sword Swap PvP presentation; simulation extension owned by KeloSimulation
 * keys: SWORD SWAP PVP ACTIVATION EYE IMPACT PLANTED LOOP TELEPORT RETURN SPRITESHEET BLOCKER FOUNDATION
 * hace: puente visual del PvP aislado para activación, impacto, espada clavada, bloqueo físico, teleport y llamada/retorno usando los PNG reales en la capa projectile worldFX que sí renderiza la arena
 * online: consume eventos semánticos y añade únicamente presentación + colisión local de prototipo; no decide daño, cooldown ni autoridad remota
 * extension-points: KeloSimulation.after para resolver el blocker de espada plantada tras la simulación
 * do-not: NO envolver updateSimulation
 */
(function (root) {
  'use strict';

  const VERSION = 'sword-swap-pvp-visuals-v1.5.0-foundation';
  const FRAME_W = 362;
  const FRAME_H = 724;
  const IMPACT_MS = 500;
  const TELEPORT_MS = 500;
  const EYE_MS = 520;
  const RETURN_END_HOLD_MS = 90;
  const BLOCK_W = 28;
  const BLOCK_H = 26;
  const BLOCK_Y_OFFSET = -18;

  const IDS = Object.freeze({
    eyeAsset: 'sword_swap_pvp_eye_asset_v42',
    impactAsset: 'sword_swap_pvp_impact_asset_v42',
    loopAsset: 'sword_swap_pvp_loop_asset_v42',
    teleportAsset: 'sword_swap_pvp_teleport_asset_v42',
    returnAsset: 'sword_swap_pvp_return_asset_v42',
    eyeVisual: 'sword_swap_pvp_eye_visual_v42',
    impactVisual: 'sword_swap_pvp_impact_visual_v42',
    loopVisual: 'sword_swap_pvp_loop_visual_v42',
    teleportVisual: 'sword_swap_pvp_teleport_visual_v42',
    returnFlightVisual: 'sword_swap_pvp_return_flight_visual_v42',
  });

  const swordObjects = new Map();
  const active = new Map();
  const transient = new Set();
  let installed = false;
  let blockerInstalled = false;
  let lastPlayerPos = null;
  let trackingStarted = false;

  const audit = root.KELO_SWORD_SWAP_PVP_VISUAL_AUDIT = {
    ready: false,
    version: VERSION,
    sourceAssets: ['activation-eye-anim.PNG', 'clavandose .PNG', 'loop2.PNG', 'teleport .PNG', 'regreso2.PNG'],
    renderPath: 'KeloProjectileVisuals/worldFX',
    assetsReady: false,
    eyePlayed: 0,
    impactPlayed: 0,
    loopPlayed: 0,
    teleportPlayed: 0,
    returnPlayed: 0,
    blockerInstalled: false,
    blockerActive: false,
    blockerHits: 0,
    blockerBox: null,
    simulationOwner: 'KeloSimulation',
    blockerHook: 'sword-swap-pvp-visuals:blocker',
    lastPhase: null,
    lastSwordEntityId: null,
    lastTeleportPoints: null,
    lastReturnDirection: null,
    lastReturnDurationMs: null,
    returnSyncedToGameplayObject: false,
    lastReturnSyncError: null,
    reason: 'PvP arena has an isolated renderer; Sword Swap uses projectile worldFX plus a planted-sword local blocker',
  };

  function player() {
    try { return typeof localPlayer !== 'undefined' ? localPlayer : null; }
    catch (e) { return null; }
  }

  function pointOf(p) {
    return p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))
      ? { x: Number(p.x), y: Number(p.y) }
      : null;
  }

  function keyOf(payload) {
    return String(payload && payload.swordEntityId || '');
  }

  function stopVisual(id) {
    if (id && root.KeloProjectileVisuals && typeof root.KeloProjectileVisuals.stop === 'function') {
      root.KeloProjectileVisuals.stop(id);
    }
  }

  function clearTransient(id) {
    if (!id) return;
    stopVisual(id);
    transient.delete(id);
  }

  function clearReturnAnimation(item) {
    if (!item) return;
    if (item.returnFlightTimer) clearTimeout(item.returnFlightTimer);
    if (item.returnTimer) clearTimeout(item.returnTimer);
    if (item.returnFrame && typeof root.cancelAnimationFrame === 'function') root.cancelAnimationFrame(item.returnFrame);
    if (item.returnAnchor) item.returnAnchor._keloVisualDead = true;
    stopVisual(item.returnId);
    item.returnFlightTimer = null;
    item.returnTimer = null;
    item.returnFrame = null;
    item.returnAnchor = null;
    item.returnId = null;
  }

  function clearActive(key, forgetObject) {
    const item = active.get(key);
    if (item) {
      if (item.timer) clearTimeout(item.timer);
      clearReturnAnimation(item);
      stopVisual(item.impactId);
      stopVisual(item.loopId);
      active.delete(key);
    }
    if (forgetObject) swordObjects.delete(key);
  }

  function registerVisual(def) {
    if (!root.KeloProjectileVisualRegistry.get(def.id)) root.KeloProjectileVisualRegistry.register(def);
  }

  function registerDefinitions() {
    if (!root.KeloAssetRegistry || !root.KeloProjectileVisualRegistry) return false;

    const assets = [
      { id: IDS.eyeAsset, type: 'image', src: 'assets/fx/sword-swap/activation-eye-anim.PNG', preload: true },
      { id: IDS.impactAsset, type: 'image', src: 'assets/fx/sword-swap/clavandose%20.PNG', preload: true },
      { id: IDS.loopAsset, type: 'image', src: 'assets/fx/sword-swap/loop2.PNG', preload: true },
      { id: IDS.teleportAsset, type: 'image', src: 'assets/fx/sword-swap/teleport%20.PNG', preload: true },
      { id: IDS.returnAsset, type: 'image', src: 'assets/fx/sword-swap/regreso2.PNG', preload: true },
    ];

    assets.forEach(function (def) {
      if (!root.KeloAssetRegistry.get(def.id)) root.KeloAssetRegistry.register(def);
    });

    registerVisual({
      id: IDS.eyeVisual,
      type: 'sprite_animation', assetId: IDS.eyeAsset, layer: 'worldFX',
      frameWidth: FRAME_W, frameHeight: FRAME_H, columns: 6, rows: 1, frames: 6, fps: 14, loop: false,
      sourcePixelScale: 0.18, alpha: 1, alignToVelocity: false, defaultSpeed: 0, defaultMaxDistance: 1,
    });

    registerVisual({
      id: IDS.impactVisual,
      type: 'sprite_animation', assetId: IDS.impactAsset, layer: 'worldFX',
      frameWidth: FRAME_W, frameHeight: FRAME_H, columns: 6, rows: 1, frames: 6, fps: 12, loop: false,
      sourcePixelScale: 0.22, alpha: 1, alignToVelocity: false, defaultSpeed: 0, defaultMaxDistance: 1,
    });

    registerVisual({
      id: IDS.loopVisual,
      type: 'sprite_animation', assetId: IDS.loopAsset, layer: 'worldFX',
      frameWidth: FRAME_W, frameHeight: FRAME_H, columns: 6, rows: 1, frames: 6, fps: 10, loop: true,
      sourcePixelScale: 0.22, alpha: 1, alignToVelocity: false, defaultSpeed: 0, defaultMaxDistance: 1,
    });

    registerVisual({
      id: IDS.teleportVisual,
      type: 'sprite_animation', assetId: IDS.teleportAsset, layer: 'worldFX',
      frameWidth: FRAME_W, frameHeight: FRAME_H, columns: 6, rows: 1, frames: 6, fps: 14, loop: false,
      sourcePixelScale: 0.34, alpha: 1, alignToVelocity: false, defaultSpeed: 0, defaultMaxDistance: 1,
    });

    // Frames 5-6 de regreso2 son el vuelo limpio. El mango queda al frente con PI.
    registerVisual({
      id: IDS.returnFlightVisual,
      type: 'sprite_animation', assetId: IDS.returnAsset, layer: 'worldFX',
      frames: 2, fps: 12, loop: true,
      frameRects: [
        { x: FRAME_W * 4, y: 0, width: FRAME_W, height: FRAME_H },
        { x: FRAME_W * 5, y: 0, width: FRAME_W, height: FRAME_H },
      ],
      sourcePixelScale: 0.22, alpha: 1, alignToVelocity: true,
      rotationOffset: Math.PI, defaultSpeed: 1, defaultMaxDistance: 1,
    });

    root.KeloAssetRegistry.preload(assets.map(function (a) { return a.id; })).then(function () {
      audit.assetsReady = assets.every(function (a) { return root.KeloAssetRegistry.isReady(a.id); });
    }).catch(function () {
      audit.assetsReady = false;
    });
    return true;
  }

  function contextFor(payload, object, direction) {
    const position = pointOf(payload && (payload.position || payload.target)) || pointOf(object) || { x: 0, y: 0 };
    return {
      actor: payload && payload.actor || player(),
      actorId: payload && payload.actorId || payload && payload.playerId || null,
      abilityId: payload && payload.abilityId,
      abilityKey: payload && payload.abilityKey || 'swap_sword',
      origin: { x: position.x, y: position.y },
      target: { x: position.x, y: position.y },
      direction: direction || { x: 0, y: -1 },
      gameplay: { speed: 0, range: 1 },
      visual: { seed: Date.now() & 65535, scale: 1 },
    };
  }

  function attachStaticVisual(point, visualId, durationMs) {
    if (!point || !root.KeloProjectileVisuals) return null;
    const anchor = { x: point.x, y: point.y, _keloVisualDead: false };
    const context = {
      abilityKey: 'swap_sword', origin: { x: point.x, y: point.y }, target: { x: point.x, y: point.y },
      direction: { x: 0, y: -1 }, gameplay: { speed: 0, range: 1 }, visual: { seed: Date.now() & 65535, scale: 1 },
    };
    const id = root.KeloProjectileVisuals.attach(anchor, visualId, context, { speed: 0, maxDistance: 1, loop: false });
    if (!id) return null;
    transient.add(id);
    setTimeout(function () { anchor._keloVisualDead = true; clearTransient(id); }, Math.max(100, durationMs || TELEPORT_MS));
    return id;
  }

  function playActivationEye() {
    const p = player();
    const at = pointOf(p);
    if (!at) return;
    const eyePoint = { x: at.x, y: at.y - 42 };
    const id = attachStaticVisual(eyePoint, IDS.eyeVisual, EYE_MS);
    if (!id) return;
    audit.eyePlayed += 1;
    audit.lastPhase = 'ACTIVATION_EYE';
  }

  function playTeleportPair(from, to) {
    const a = pointOf(from), b = pointOf(to);
    if (!a || !b) return;
    attachStaticVisual(a, IDS.teleportVisual, TELEPORT_MS);
    attachStaticVisual(b, IDS.teleportVisual, TELEPORT_MS);
    audit.teleportPlayed += 1;
    audit.lastPhase = 'TELEPORT';
    audit.lastTeleportPoints = { from: a, to: b };
  }

  function beginReturnVisual(key, payload) {
    const object = key && swordObjects.get(key);
    const actor = player();
    if (!key || !object || !actor || !root.KeloProjectileVisuals) return;

    const origin = pointOf(object);
    if (!origin) return;
    const dx = Number(actor.x) - origin.x;
    const dy = Number(actor.y) - origin.y;
    const len = Math.hypot(dx, dy) || 1;
    const dir = { x: dx / len, y: dy / len };
    const totalMs = Math.max(700, Number(payload && payload.returnDurationSec || 3) * 1000);

    const record = active.get(key) || {
      impactId: null, loopId: null, returnId: null,
      timer: null, returnFlightTimer: null, returnTimer: null, returnFrame: null, returnAnchor: null,
    };
    if (record.timer) { clearTimeout(record.timer); record.timer = null; }
    clearReturnAnimation(record);
    stopVisual(record.impactId); record.impactId = null;
    stopVisual(record.loopId); record.loopId = null;

    // La VFX sigue la MISMA entidad que mueve el gameplay. Así no se separa, no salta y no se corta.
    const anchor = { x: Number(object.x), y: Number(object.y), _keloVisualDead: false };
    record.returnAnchor = anchor;
    const context = contextFor(payload, anchor, dir);
    context.target = { x: Number(actor.x), y: Number(actor.y) };
    context.gameplay = { speed: 1, range: 1 };
    record.returnId = root.KeloProjectileVisuals.attach(anchor, IDS.returnFlightVisual, context, {
      speed: 1,
      maxDistance: 1,
      loop: true,
    });

    const startedAt = root.performance && typeof root.performance.now === 'function' ? root.performance.now() : Date.now();
    function step(now) {
      const live = active.get(key);
      if (!live || live !== record || !record.returnAnchor) return;
      record.returnAnchor.x = Number(object.x);
      record.returnAnchor.y = Number(object.y);
      audit.returnSyncedToGameplayObject = true;
      audit.lastReturnSyncError = Math.hypot(record.returnAnchor.x - Number(object.x), record.returnAnchor.y - Number(object.y));
      const elapsed = Math.max(0, Number(now) - startedAt);
      if (elapsed < totalMs) {
        record.returnFrame = root.requestAnimationFrame(step);
        return;
      }
      record.returnFrame = null;
      record.returnTimer = setTimeout(function () {
        const latest = active.get(key);
        if (!latest || latest !== record) return;
        clearReturnAnimation(record);
        active.delete(key);
        swordObjects.delete(key);
      }, RETURN_END_HOLD_MS);
    }
    record.returnFrame = root.requestAnimationFrame(step);

    active.set(key, record);
    audit.returnPlayed += 1;
    audit.lastPhase = 'RETURN';
    audit.lastSwordEntityId = key;
    audit.lastReturnDirection = dir;
    audit.lastReturnDurationMs = totalMs;
  }

  function currentSwordBlock() {
    const pvp = root.KeloPvPWorld;
    const snapshot = pvp && pvp.state;
    const sword = snapshot && snapshot.swapSword;
    if (!sword || sword.phase !== 'planted') return null;
    return {
      x: Number(sword.x) - BLOCK_W * 0.5,
      y: Number(sword.y) + BLOCK_Y_OFFSET,
      w: BLOCK_W,
      h: BLOCK_H,
    };
  }

  function resolveEntityAgainstSword(entity, box) {
    if (!entity || !box || !root.KELO_COLLISION || typeof root.KELO_COLLISION.resolveCircleAABB !== 'function') return false;
    const radius = Math.max(10, Number(entity.radius) || 18);
    const hit = root.KELO_COLLISION.resolveCircleAABB(Number(entity.x), Number(entity.y), radius, box);
    if (!hit || !hit.collided) return false;
    entity.x = Number(entity.x) + Number(hit.pushX || 0);
    entity.y = Number(entity.y) + Number(hit.pushY || 0);
    if (Math.abs(Number(hit.pushX || 0)) >= Math.abs(Number(hit.pushY || 0))) {
      if ('vx' in entity) entity.vx = 0;
    } else if ('vy' in entity) entity.vy = 0;
    audit.blockerHits += 1;
    return true;
  }

  function applySwordBlocker() {
    if (root.KELO_COMBAT_ENABLED !== true) {
      audit.blockerActive = false;
      audit.blockerBox = null;
      return;
    }
    const box = currentSwordBlock();
    if (!box) {
      audit.blockerActive = false;
      audit.blockerBox = null;
      return;
    }
    audit.blockerActive = true;
    audit.blockerBox = { x: box.x, y: box.y, w: box.w, h: box.h };
    const local = player();
    if (local) resolveEntityAgainstSword(local, box);
    try {
      if (typeof simulatedPlayers !== 'undefined' && simulatedPlayers) {
        if (typeof simulatedPlayers.forEach === 'function') {
          simulatedPlayers.forEach(function (entity) { if (entity && entity !== local) resolveEntityAgainstSword(entity, box); });
        } else if (Array.isArray(simulatedPlayers)) {
          simulatedPlayers.forEach(function (entity) { if (entity && entity !== local) resolveEntityAgainstSword(entity, box); });
        }
      }
    } catch (e) {}
  }

  function installSwordBlocker() {
    if (blockerInstalled) return true;
    if (!root.KeloSimulation || typeof root.KeloSimulation.after !== 'function') return false;
    root.KeloSimulation.after('sword-swap-pvp-visuals:blocker', function () {
      applySwordBlocker();
    }, 220);
    blockerInstalled = true;
    audit.blockerInstalled = true;
    return true;
  }

  function onThrown(payload) {
    if (root.KELO_COMBAT_ENABLED !== true) return;
    const key = keyOf(payload);
    if (!key || !payload || !payload.gameplayObject) return;
    clearActive(key, false);
    swordObjects.set(key, payload.gameplayObject);
    playActivationEye();
    audit.lastPhase = 'THROW';
    audit.lastSwordEntityId = key;
  }

  function onLanded(payload) {
    if (root.KELO_COMBAT_ENABLED !== true || !root.KeloProjectileVisuals) return;
    const key = keyOf(payload);
    const object = key && swordObjects.get(key);
    if (!key || !object) return;

    clearActive(key, false);
    const context = contextFor(payload, object);
    const impactId = root.KeloProjectileVisuals.attach(object, IDS.impactVisual, context, { speed: 0, maxDistance: 1, loop: false });
    const record = {
      impactId: impactId, loopId: null, returnId: null,
      timer: null, returnFlightTimer: null, returnTimer: null, returnFrame: null, returnAnchor: null,
    };
    active.set(key, record);
    audit.impactPlayed += 1;
    audit.lastPhase = 'IMPACT';
    audit.lastSwordEntityId = key;

    record.timer = setTimeout(function () {
      const current = active.get(key);
      if (!current || current !== record || root.KELO_COMBAT_ENABLED !== true) return;
      stopVisual(current.impactId);
      current.impactId = null;
      current.loopId = root.KeloProjectileVisuals.attach(object, IDS.loopVisual, context, { speed: 0, maxDistance: 1, loop: true });
      current.timer = null;
      audit.loopPlayed += 1;
      audit.lastPhase = 'STUCK';
    }, IMPACT_MS);
  }

  function onAbilityCast(payload) {
    if (!payload || payload.abilityKey !== 'swap_sword') return;
    const phase = String(payload.specialPhase || payload.swapStage || '');
    if (phase !== 'recall_to_sword' && phase !== 'swap_character' && phase !== 'SWAP') return;

    const key = keyOf(payload);
    const actor = player();
    const before = pointOf(lastPlayerPos);
    const after = pointOf(actor);

    if (phase === 'recall_to_sword') {
      if (key) clearActive(key, false);
      if (before && after) playTeleportPair(before, after);
      if (key) swordObjects.delete(key);
      audit.lastSwordEntityId = key || null;
      return;
    }

    if (phase === 'swap_character' || phase === 'SWAP') {
      if (before && after) playTeleportPair(before, after);
      if (key) beginReturnVisual(key, payload);
    }
  }

  function onCancelled(payload) {
    const key = keyOf(payload);
    if (key) clearActive(key, true);
  }

  function trackPlayer() {
    if (!trackingStarted) trackingStarted = true;
    const p = player();
    if (p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))) lastPlayerPos = { x: Number(p.x), y: Number(p.y) };
    root.requestAnimationFrame(trackPlayer);
  }

  function install() {
    if (installed) return true;
    if (!registerDefinitions()) return false;
    const bus = root.KeloAbilities && root.KeloAbilities.bus;
    if (!bus || typeof bus.on !== 'function') return false;

    bus.on('SWAP_SWORD_THROWN', onThrown);
    bus.on('SWAP_SWORD_LANDED', onLanded);
    bus.on('SWAP_SWORD_THROW_CANCELLED', onCancelled);
    bus.on('SWAP_SWORD_RESOLVED', onCancelled);
    bus.on('ABILITY_CAST', onAbilityCast);

    if (!installSwordBlocker()) return false;
    if (!trackingStarted && typeof root.requestAnimationFrame === 'function') root.requestAnimationFrame(trackPlayer);
    installed = true;
    audit.ready = true;
    return true;
  }

  function boot() {
    if (install()) return;
    setTimeout(boot, 80);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : window);
