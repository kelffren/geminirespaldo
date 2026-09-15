/* KELO-INDEX
 * area: VISUAL
 * keys: ASSET REGISTRY PRELOAD LAZY IMAGE AUDIO SPRITESHEET ATLAS
 * hace: registra y carga assets visuales por ID estable; un asset no conoce habilidades ni piedras
 * online: N/A; recursos puramente cliente, el servidor nunca recibe rutas ni objetos Image/Audio
 */
(function (root) {
  'use strict';

  const manifests = root.KELO_VISUAL_MANIFESTS;
  if (!manifests) {
    console.error('[Kelo visuals] manifests unavailable for asset registry');
    return;
  }

  const defs = new Map();
  const runtime = new Map();
  const missing = new Set();

  function register(def) {
    if (!def || !def.id || !def.type) throw new Error('INVALID_VISUAL_ASSET');
    const id = String(def.id);
    if (defs.has(id)) throw new Error('DUPLICATE_VISUAL_ASSET_' + id);
    defs.set(id, Object.freeze(Object.assign({}, def, { id: id })));
    return id;
  }

  Object.keys(manifests.assets || {}).forEach(function (id) { register(manifests.assets[id]); });

  function get(id) { return defs.get(String(id || '')) || null; }
  function list() { return Array.from(defs.values()); }

  function markMissing(id, reason) {
    const key = String(id || 'unknown');
    missing.add(key);
    const audit = root.KELO_VISUAL_AUDIT;
    if (audit && audit.missingAssets && audit.missingAssets.indexOf(key) < 0) audit.missingAssets.push(key);
    if (root.KELO_ABILITY_DEBUG === true || new URLSearchParams(root.location && root.location.search || '').get('visualDebug') === '1') {
      console.warn('[Kelo visuals] asset missing', key, reason || 'unknown');
    }
  }

  function makeImage(def) {
    return new Promise(function (resolve) {
      const image = new Image();
      image.decoding = 'async';
      image.onload = function () {
        const item = runtime.get(def.id);
        if (!item) return;
        item.ready = true;
        item.failed = false;
        item.width = image.naturalWidth || image.width || 0;
        item.height = image.naturalHeight || image.height || 0;
        if (root.KELO_PERF && typeof root.KELO_PERF.registerTexture === 'function') {
          root.KELO_PERF.registerTexture(def.id, item.width, item.height, 1);
        }
        resolve(item);
      };
      image.onerror = function () {
        const item = runtime.get(def.id);
        if (item) { item.failed = true; item.ready = false; }
        markMissing(def.id, 'LOAD_FAILED');
        resolve(item || null);
      };
      image.src = def.src;
      const item = { id: def.id, def: def, kind: 'image', resource: image, ready: false, failed: false, promise: null, width: 0, height: 0 };
      runtime.set(def.id, item);
    });
  }

  function makeAudio(def) {
    return new Promise(function (resolve) {
      const audio = new Audio();
      audio.preload = 'auto';
      const item = { id: def.id, def: def, kind: 'audio', resource: audio, ready: false, failed: false, promise: null };
      runtime.set(def.id, item);
      const done = function () { item.ready = true; resolve(item); };
      const fail = function () { item.failed = true; markMissing(def.id, 'AUDIO_LOAD_FAILED'); resolve(item); };
      audio.addEventListener('canplaythrough', done, { once: true });
      audio.addEventListener('error', fail, { once: true });
      audio.src = def.src;
      audio.load();
    });
  }

  function load(id) {
    const key = String(id || '');
    const def = defs.get(key);
    if (!def) { markMissing(key, 'UNKNOWN_ID'); return Promise.resolve(null); }
    const existing = runtime.get(key);
    if (existing && existing.promise) return existing.promise;
    if (existing && (existing.ready || existing.failed)) return Promise.resolve(existing);

    let promise;
    if (def.type === 'audio') promise = makeAudio(def);
    else if (def.type === 'image' || def.type === 'sprite' || def.type === 'spritesheet' || def.type === 'atlas') promise = makeImage(def);
    else {
      markMissing(key, 'UNSUPPORTED_TYPE_' + def.type);
      return Promise.resolve(null);
    }
    const created = runtime.get(key);
    if (created) created.promise = promise;
    return promise;
  }

  function preload(ids) {
    const requested = Array.isArray(ids) ? ids : [];
    return Promise.all(requested.map(load));
  }

  function preloadCore() {
    return preload(list().filter(function (def) { return def.preload === true; }).map(function (def) { return def.id; }));
  }

  function resource(id) {
    const item = runtime.get(String(id || ''));
    return item && item.ready && !item.failed ? item.resource : null;
  }

  function isReady(id) {
    const item = runtime.get(String(id || ''));
    return !!(item && item.ready && !item.failed);
  }

  function metrics() {
    let loaded = 0;
    runtime.forEach(function (item) { if (item && item.ready && !item.failed) loaded += 1; });
    return { definitions: defs.size, loaded: loaded, missing: Array.from(missing) };
  }

  root.KeloAssetRegistry = Object.freeze({
    version: 'asset-registry-v1.0.0',
    register: register,
    get: get,
    list: list,
    load: load,
    preload: preload,
    preloadCore: preloadCore,
    resource: resource,
    isReady: isReady,
    metrics: metrics
  });

  preloadCore();
})(typeof globalThis !== 'undefined' ? globalThis : window);
