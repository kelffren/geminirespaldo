/* KELO-INDEX
 * area: VISUAL
 * keys: ANIMATION CLIP CHANNEL LOCOMOTION ACTION REACTION OVERLAY ANCHOR SOCKET MARKER INTERRUPT PREVIEW
 * hace: controlador de animaciones corporales reutilizables y anchors semánticos sin modificar física
 * online: reproduce clips locales desde eventos; nunca decide movimiento, hit, cooldown ni validez del cast
 * creator: preview/previewLocal reproducen definiciones transitorias sin registrarlas ni convertirlas en contenido LIVE
 */
(function (root) {
  'use strict';

  const manifests = root.KELO_VISUAL_MANIFESTS;
  const bus = root.KeloVisualEventBus;
  if (!manifests || !bus) {
    console.error('[Kelo animation] visual core unavailable');
    return;
  }

  const CHANNEL_PRIORITY = Object.freeze({ locomotion: 10, overlay: 20, action: 40, reaction: 60 });
  const clips = new Map();
  const active = new Map();
  let nextId = 1;

  function cloneDef(def) { return Object.freeze(Object.assign({}, def)); }
  function register(def) {
    if (!def || !def.id) throw new Error('INVALID_ANIMATION_CLIP');
    const id = String(def.id);
    if (clips.has(id)) throw new Error('DUPLICATE_ANIMATION_CLIP_' + id);
    clips.set(id, cloneDef(def));
    return id;
  }
  Object.keys(manifests.animationClips || {}).forEach(function (id) { register(manifests.animationClips[id]); });
  function get(id) { return clips.get(String(id || '')) || null; }
  function list() { return Array.from(clips.values()); }
  function localActor() { try { return typeof localPlayer !== 'undefined' ? localPlayer : (root.localPlayer || null); } catch (e) { return root.localPlayer || null; } }

  function actorKey(actor) {
    return root.KeloVisualContext && root.KeloVisualContext.actorIdOf(actor) || (actor && actor.id) || null;
  }

  function presentation(actor, face) {
    if (actor && root.KELO_AVATAR_PRESENTATION && typeof root.KELO_AVATAR_PRESENTATION.get === 'function') {
      try { return root.KELO_AVATAR_PRESENTATION.get(actor, face || actor._face || 'down'); } catch (e) {}
    }
    const radius = actor && Number(actor.radius) || 20;
    const footY = (actor && Number(actor.y) || 0) + 10;
    return {
      footRootX: actor && Number(actor.x) || 0,
      footRootY: footY,
      depthRootX: actor && Number(actor.x) || 0,
      depthRootY: footY,
      visualWidth: radius * 2.8,
      visualHeight: radius * 4.5,
      visualLeft: (actor && Number(actor.x) || 0) - radius * 1.4,
      visualTop: footY - radius * 4.5,
      visualRight: (actor && Number(actor.x) || 0) + radius * 1.4,
      visualBottom: footY,
      nameplateAnchorX: actor && Number(actor.x) || 0,
      nameplateAnchorY: footY - radius * 4.5 - 6
    };
  }

  function faceOf(actor) { return actor && actor._face || 'down'; }
  function facingVector(face) {
    if (face === 'up') return { x: 0, y: -1 };
    if (face === 'left') return { x: -1, y: 0 };
    if (face === 'right') return { x: 1, y: 0 };
    return { x: 0, y: 1 };
  }

  function anchor(actor, name) {
    if (!actor) return null;
    const face = faceOf(actor);
    const layout = presentation(actor, face);
    const w = Math.max(1, Number(layout.visualWidth) || 56);
    const h = Math.max(1, Number(layout.visualHeight) || 90);
    const foot = { x: Number(layout.footRootX), y: Number(layout.footRootY) };
    const center = { x: foot.x, y: foot.y - h * 0.48 };
    const dir = facingVector(face);
    const side = { x: -dir.y, y: dir.x };
    const sockets = {
      foot: foot,
      ground: foot,
      center: center,
      chest: { x: foot.x, y: foot.y - h * 0.58 },
      head: { x: foot.x, y: foot.y - h * 0.86 },
      hand: { x: center.x + dir.x * w * 0.45 + side.x * w * 0.18, y: center.y + dir.y * h * 0.16 },
      weapon: { x: center.x + dir.x * w * 0.54 + side.x * w * 0.20, y: center.y + dir.y * h * 0.12 },
      castOrigin: { x: center.x + dir.x * w * 0.58 + side.x * w * 0.12, y: center.y + dir.y * h * 0.20 },
      target: center
    };
    return sockets[name] || center;
  }

  function channelMap(actor, create) {
    const key = actorKey(actor);
    if (!key) return null;
    if (!active.has(key) && create) active.set(key, new Map());
    return active.get(key) || null;
  }

  function canReplace(current, def, options) {
    if (!current) return true;
    const requestedPriority = Number(options && options.priority != null ? options.priority : def.priority != null ? def.priority : CHANNEL_PRIORITY[def.channel] || 0);
    if (requestedPriority > current.priority) return true;
    if (requestedPriority === current.priority && current.interruptible !== false) return true;
    return current.interruptible !== false && options && options.force === true;
  }

  function start(actor, definition, options) {
    if (!actor || !definition || !definition.id) return null;
    const def = definition, opts = options || {}, channel = String(opts.channel || def.channel || 'action'), map = channelMap(actor, true), current = map.get(channel);
    if (!canReplace(current, def, opts)) return null;
    const instance = {
      id: 'anim_' + (nextId++).toString(36), actor: actor, actorId: actorKey(actor), clipId: String(def.id), def: def,
      channel: channel, elapsed: 0, duration: Math.max(0.001, Number(def.duration) || 0.001),
      speed: Math.max(0.05, Number(opts.speed) || 1), loop: opts.loop != null ? opts.loop === true : def.loop === true,
      priority: Number(opts.priority != null ? opts.priority : def.priority != null ? def.priority : CHANNEL_PRIORITY[channel] || 0),
      interruptible: opts.interruptible != null ? opts.interruptible !== false : def.interruptible !== false,
      markersFired: new Set(), context: root.KeloVisualContext.normalize(opts.context || { actor: actor })
    };
    if (current) bus.emit('ANIMATION_CANCELLED', { actorId: current.actorId, clipId: current.clipId, animationId: current.id, reason: 'REPLACED' });
    map.set(channel, instance);
    bus.emit('ANIMATION_STARTED', { actorId: instance.actorId, clipId: instance.clipId, animationId: instance.id, channel: channel, context: instance.context });
    return instance.id;
  }

  function play(actor, clipId, options) {
    const def = get(clipId);
    if (!def) {
      if (root.KELO_VISUAL_AUDIT && root.KELO_VISUAL_AUDIT.missingAssets.indexOf(String(clipId)) < 0) root.KELO_VISUAL_AUDIT.missingAssets.push(String(clipId));
      return null;
    }
    return start(actor, def, options);
  }

  // Creator/debug only: transient definitions are never inserted into KeloAnimationRegistry.
  function preview(actor, definition, options) {
    if (!definition || !definition.id) throw new Error('INVALID_ANIMATION_PREVIEW_CLIP');
    return start(actor, cloneDef(definition), Object.assign({}, options || {}, { force: true }));
  }
  function previewLocal(definition, options) {
    const actor = localActor();
    if (!actor) throw new Error('ANIMATION_PREVIEW_ACTOR_UNAVAILABLE');
    return preview(actor, definition, options);
  }

  function stop(actor, channel, reason) {
    const map = channelMap(actor, false);
    if (!map) return false;
    const key = String(channel || 'action');
    const current = map.get(key);
    if (!current) return false;
    map.delete(key);
    bus.emit('ANIMATION_CANCELLED', { actorId: current.actorId, clipId: current.clipId, animationId: current.id, reason: reason || 'STOPPED' });
    if (!map.size) active.delete(current.actorId);
    return true;
  }
  function stopLocal(channel, reason) { const actor = localActor(); return actor ? stop(actor, channel, reason) : false; }

  function markerTime(def, value, duration) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (def && def.markerMode === 'seconds') return n;
    if (def && def.markerMode === 'normalized') return n * duration;
    return n <= 1 && duration > 1 ? n * duration : n;
  }

  function update(dt) {
    active.forEach(function (map, actorId) {
      map.forEach(function (instance, channel) {
        const previous = instance.elapsed;
        instance.elapsed += dt * instance.speed;
        const markers = instance.def.markers || {};
        Object.keys(markers).forEach(function (name) {
          const at = markerTime(instance.def, markers[name], instance.duration);
          if (at == null || instance.markersFired.has(name)) return;
          if (previous <= at && instance.elapsed >= at) {
            instance.markersFired.add(name);
            bus.emit('ANIMATION_MARKER', { actorId: actorId, clipId: instance.clipId, animationId: instance.id, channel: channel, marker: name, context: instance.context });
          }
        });
        if (instance.elapsed < instance.duration) return;
        if (instance.loop) {
          instance.elapsed = instance.elapsed % instance.duration;
          instance.markersFired.clear();
        } else {
          map.delete(channel);
          bus.emit('ANIMATION_ENDED', { actorId: actorId, clipId: instance.clipId, animationId: instance.id, channel: channel, context: instance.context });
        }
      });
      if (!map.size) active.delete(actorId);
    });
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function sampleKeyframes(def, progress) {
    const frames = Array.isArray(def.keyframes) ? def.keyframes : [];
    if (!frames.length) return null;
    if (frames.length === 1) return frames[0];
    const p = Math.max(0, Math.min(1, progress));
    let left = frames[0], right = frames[frames.length - 1];
    for (let i = 0; i < frames.length - 1; i++) {
      if (p >= frames[i].t && p <= frames[i + 1].t) { left = frames[i]; right = frames[i + 1]; break; }
    }
    const span = Math.max(0.0001, Number(right.t) - Number(left.t));
    const k = Math.max(0, Math.min(1, (p - Number(left.t)) / span));
    return {
      scaleX: lerp(Number(left.scaleX) || 1, Number(right.scaleX) || 1, k),
      scaleY: lerp(Number(left.scaleY) || 1, Number(right.scaleY) || 1, k),
      rotation: lerp(Number(left.rotation) || 0, Number(right.rotation) || 0, k),
      offsetX: lerp(Number(left.offsetX) || 0, Number(right.offsetX) || 0, k),
      offsetY: lerp(Number(left.offsetY) || 0, Number(right.offsetY) || 0, k)
    };
  }

  function winningInstance(actor) {
    const map = channelMap(actor, false);
    if (!map || !map.size) return null;
    let winner = null;
    map.forEach(function (instance) { if (!winner || instance.priority > winner.priority) winner = instance; });
    return winner;
  }

  function sampleTransform(actor) {
    const instance = winningInstance(actor);
    if (!instance || instance.def.type !== 'transform') return null;
    const progress = instance.duration > 0 ? instance.elapsed / instance.duration : 1;
    const sampled = sampleKeyframes(instance.def, progress);
    if (!sampled) return null;
    return Object.assign({ animationId: instance.id, clipId: instance.clipId, channel: instance.channel }, sampled);
  }

  function frameOverride(actor) {
    const instance = winningInstance(actor);
    if (!instance || instance.def.type !== 'spritesheet') return null;
    const def = instance.def;
    const configured = Array.isArray(def.frameSequence) ? def.frameSequence.map(function (frame) { return Math.max(0, Math.round(Number(frame) || 0)); }) : null;
    const sequence = configured && configured.length ? configured : null;
    const frames = sequence ? sequence.length : Math.max(1, Number(def.frames) || 1);
    const fps = Math.max(1, Number(def.fps) || 12);
    const slot = Math.min(frames - 1, Math.floor(instance.elapsed * fps) % frames);
    const frame = sequence ? sequence[slot] : slot;
    return { assetId: def.assetId, frame: frame, frameSlot: slot, frameSequenceLength: frames, frameWidth: def.frameWidth, frameHeight: def.frameHeight, anchor: def.anchor || { x: 0.5, y: 1 }, direction: faceOf(actor), mirrorLeftFromRight: def.mirrorLeftFromRight === true };
  }

  function metrics() {
    let count = 0;
    active.forEach(function (map) { count += map.size; });
    return { definitions: clips.size, active: count };
  }

  root.KeloAnimationRegistry = Object.freeze({ version: 'animation-registry-v1.0.0', register: register, get: get, list: list });
  root.KeloAnchors = Object.freeze({ version: 'anchors-v1.0.0', get: anchor, presentation: presentation });
  root.KeloAnimation = Object.freeze({
    version: 'animation-controller-v1.2.0', channels: Object.freeze(Object.keys(CHANNEL_PRIORITY)), priorities: CHANNEL_PRIORITY,
    play: play, preview: preview, previewLocal: previewLocal, stop: stop, stopLocal: stopLocal, update: update, sampleTransform: sampleTransform, frameOverride: frameOverride, metrics: metrics
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
