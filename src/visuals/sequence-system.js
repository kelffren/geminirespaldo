/* KELO-INDEX
 * area: VISUAL
 * keys: SEQUENCE TIMELINE CUE COMPOSITION ANIMATION VFX SFX SCREEN
 * hace: reproduce composiciones opcionales que solo referencian piezas independientes
 * online: una sequence se reconstruye localmente desde IDs/eventos; no se transmiten frames ni partículas
 */
(function (root) {
  'use strict';

  const manifests = root.KELO_VISUAL_MANIFESTS;
  if (!manifests || !root.KeloVisualContext) {
    console.error('[Kelo sequence] visual core unavailable');
    return;
  }

  const defs = new Map();
  const active = [];
  let nextId = 1;

  function register(def) {
    if (!def || !def.id || !Array.isArray(def.cues)) throw new Error('INVALID_VISUAL_SEQUENCE');
    const id = String(def.id);
    if (defs.has(id)) throw new Error('DUPLICATE_VISUAL_SEQUENCE_' + id);
    defs.set(id, Object.freeze(Object.assign({}, def, { id: id, cues: Object.freeze(def.cues.slice().sort(function (a, b) { return Number(a.at) - Number(b.at); })) })));
    return id;
  }
  Object.keys(manifests.sequences || {}).forEach(function (id) { register(manifests.sequences[id]); });
  function get(id) { return defs.get(String(id || '')) || null; }
  function list() { return Array.from(defs.values()); }

  function cueContext(base, cue) {
    const raw = Object.assign({}, base, { visual: Object.assign({}, base.visual) });
    if (cue.socket) raw.visual.socket = cue.socket;
    if (Number.isFinite(Number(cue.scale))) raw.visual.scale = Number(cue.scale);
    return root.KeloVisualContext.normalize(raw);
  }

  function fireCue(instance, cue) {
    const c = cueContext(instance.context, cue);
    if (cue.type === 'actorAnimation') {
      const actor = c.actor || root.KeloVisualContext.resolveActor(c.actorId);
      if (root.KeloAnimation && actor) root.KeloAnimation.play(actor, cue.ref, { channel: cue.channel, speed: instance.speed, context: c });
    } else if (cue.type === 'fx') {
      if (root.KeloFX) root.KeloFX.spawn(cue.ref, c, { socket: cue.socket, scale: c.visual.scale });
    } else if (cue.type === 'sfx') {
      if (root.KeloSFX) root.KeloSFX.play(cue.ref, c);
    } else if (cue.type === 'screenFx') {
      if (root.KeloScreenFX) root.KeloScreenFX.play(cue.ref, { seed: c.visual.seed });
    } else if (cue.type === 'projectileVisual') {
      if (root.KeloProjectileVisuals) root.KeloProjectileVisuals.preview(cue.ref, c, { speed: c.gameplay.speed, maxDistance: c.gameplay.range });
    } else if (cue.type === 'event') {
      if (root.KeloVisualEventBus) root.KeloVisualEventBus.emit(cue.ref, c);
    }
  }

  // KELO-INDEX VISUAL/SEQUENCE composición opcional; cada cue llama APIs públicas independientes.
  function play(id, context, options) {
    const def = get(id);
    if (!def) return null;
    const opts = options || {};
    const item = {
      id: 'seq_' + (nextId++).toString(36),
      definitionId: def.id,
      def: def,
      context: root.KeloVisualContext.normalize(context || {}),
      elapsedMs: 0,
      speed: Math.max(0.05, Number(opts.speed) || 1),
      nextCue: 0,
      loop: opts.loop != null ? opts.loop === true : def.loop === true,
      stopped: false
    };
    active.push(item);
    if (root.KeloVisualEventBus) root.KeloVisualEventBus.emit('SEQUENCE_STARTED', { sequenceId: item.id, definitionId: def.id, context: item.context });
    runDue(item);
    return item.id;
  }

  function runDue(item) {
    while (item.nextCue < item.def.cues.length && Number(item.def.cues[item.nextCue].at) <= item.elapsedMs + 0.001) {
      fireCue(item, item.def.cues[item.nextCue]);
      item.nextCue += 1;
    }
  }

  function stop(id) {
    const index = active.findIndex(function (item) { return item.id === id; });
    if (index < 0) return false;
    const item = active.splice(index, 1)[0];
    item.stopped = true;
    if (root.KeloVisualEventBus) root.KeloVisualEventBus.emit('SEQUENCE_STOPPED', { sequenceId: item.id, definitionId: item.definitionId, context: item.context });
    return true;
  }

  function stopAll() {
    while (active.length) {
      const item = active.pop();
      item.stopped = true;
      if (root.KeloVisualEventBus) root.KeloVisualEventBus.emit('SEQUENCE_STOPPED', { sequenceId: item.id, definitionId: item.definitionId, context: item.context });
    }
    return true;
  }

  function update(dt) {
    const stepMs = Math.max(0, Number(dt) || 0) * 1000;
    for (let i = active.length - 1; i >= 0; i--) {
      const item = active[i];
      item.elapsedMs += stepMs * item.speed;
      runDue(item);
      const duration = Math.max(Number(item.def.duration) || 0, item.def.cues.length ? Number(item.def.cues[item.def.cues.length - 1].at) || 0 : 0);
      if (item.elapsedMs < duration) continue;
      if (item.loop) {
        item.elapsedMs = duration > 0 ? item.elapsedMs % duration : 0;
        item.nextCue = 0;
        runDue(item);
      } else {
        active.splice(i, 1);
        if (root.KeloVisualEventBus) root.KeloVisualEventBus.emit('SEQUENCE_ENDED', { sequenceId: item.id, definitionId: item.definitionId, context: item.context });
      }
    }
  }

  function metrics() { return { definitions: defs.size, active: active.length }; }

  root.KeloSequenceRegistry = Object.freeze({ version: 'sequence-registry-v1.0.0', register: register, get: get, list: list });
  root.KeloSequence = Object.freeze({ version: 'sequence-player-v1.1.0', play: play, stop: stop, stopAll: stopAll, update: update, metrics: metrics });
})(typeof globalThis !== 'undefined' ? globalThis : window);
