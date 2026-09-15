/* KELO-INDEX
 * area: VISUAL
 * keys: VFX FX PROJECTILE TRAIL PARTICLE SFX AUDIO SCREEN SHAKE FLASH POOL CULL QUALITY SPRITESHEET PREVIEW
 * hace: runtimes independientes para VFX, proyectiles visuales, sonido y efectos de pantalla
 * online: solo representa eventos/contexto; jamás calcula hit, daño, estado real ni trayectoria autoritativa
 * creator: preview() reproduce definiciones transitorias sin registrarlas ni convertirlas en contenido LIVE
 */
(function (root) {
  'use strict';

  const manifests = root.KELO_VISUAL_MANIFESTS;
  const contextApi = root.KeloVisualContext;
  if (!manifests || !contextApi) {
    console.error('[Kelo FX] visual manifests/context unavailable');
    return;
  }

  const fxDefs = new Map();
  const projectileDefs = new Map();
  const sfxDefs = new Map();
  const screenDefs = new Map();
  const activeFx = [];
  const fxPool = [];
  const activeProjectiles = [];
  const projectilePool = [];
  let fxSeq = 1;
  let projectileSeq = 1;
  let drawn = 0;
  let culled = 0;

  function registerInto(map, def, label) {
    if (!def || !def.id) throw new Error('INVALID_' + label);
    const id = String(def.id);
    if (map.has(id)) throw new Error('DUPLICATE_' + label + '_' + id);
    map.set(id, Object.freeze(Object.assign({}, def, { id: id })));
    return id;
  }

  Object.keys(manifests.fx || {}).forEach(function (id) { registerInto(fxDefs, manifests.fx[id], 'FX'); });
  Object.keys(manifests.projectileVisuals || {}).forEach(function (id) { registerInto(projectileDefs, manifests.projectileVisuals[id], 'PROJECTILE_VISUAL'); });
  Object.keys(manifests.sfx || {}).forEach(function (id) { registerInto(sfxDefs, manifests.sfx[id], 'SFX'); });
  Object.keys(manifests.screenFx || {}).forEach(function (id) { registerInto(screenDefs, manifests.screenFx[id], 'SCREEN_FX'); });

  function randomUnit(seed) {
    let s = (Number(seed) || 1) >>> 0;
    return function () {
      s += 0x6D2B79F5;
      let t = s;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function canSpawn(kind, count) {
    return !root.KELO_PERF || typeof root.KELO_PERF.canSpawn !== 'function' || root.KELO_PERF.canSpawn(kind, count || 1);
  }

  function worldVisible(x, y, radius) {
    try {
      if (typeof camera === 'undefined' || typeof screenW === 'undefined' || typeof screenH === 'undefined') return true;
      const zoom = (typeof CONFIG !== 'undefined' && Number(CONFIG.zoom)) || 1;
      const hw = screenW / (2 * zoom) + (radius || 0) + 64;
      const hh = screenH / (2 * zoom) + (radius || 0) + 64;
      return x >= camera.x - hw && x <= camera.x + hw && y >= camera.y - hh && y <= camera.y + hh;
    } catch (e) { return true; }
  }

  function actorPosition(instance) {
    const c = instance.context;
    const actor = c.actor || contextApi.resolveActor(c.actorId);
    if (!actor) return c.origin || { x: instance.x || 0, y: instance.y || 0 };
    const socket = instance.socket || instance.def.socket || 'center';
    return root.KeloAnchors && typeof root.KeloAnchors.get === 'function' ? root.KeloAnchors.get(actor, socket) : { x: actor.x, y: actor.y };
  }

  function resetFxObject(item, def, context, options) {
    const opts = options || {};
    const c = contextApi.normalize(context || opts.context || {});
    item.id = 'vfx_' + (fxSeq++).toString(36);
    item.definitionId = def.id;
    item.def = def;
    item.context = c;
    item.space = String(opts.space || def.space || 'WORLD').toUpperCase();
    item.layer = String(opts.layer || def.layer || 'worldFX');
    item.socket = opts.socket || def.socket || null;
    const p = c.origin || c.target || { x: Number(opts.x) || 0, y: Number(opts.y) || 0 };
    item.x = Number(opts.x != null ? opts.x : p && p.x) || 0;
    item.y = Number(opts.y != null ? opts.y : p && p.y) || 0;
    item.scale = Math.max(0.05, Number(opts.scale != null ? opts.scale : c.visual.scale) || 1);
    item.elapsed = 0;
    item.duration = Math.max(0.001, Number(opts.duration != null ? opts.duration : def.duration) || 0.25);
    item.loop = opts.loop != null ? opts.loop === true : def.loop === true;
    item.seed = Number(opts.seed != null ? opts.seed : c.visual.seed) || 1;
    item.rng = randomUnit(item.seed);
    item.dead = false;
    item.samples = [];
    item.particles = null;
    if (def.type === 'particle_emitter') {
      const count = Math.min(32, Math.max(1, Number(def.particleCount) || 8));
      item.particles = [];
      for (let i = 0; i < count; i++) item.particles.push({ a: item.rng() * Math.PI * 2, r: 0.15 + item.rng() * 0.85, phase: item.rng() });
    }
    return item;
  }

  function spawnDefinition(def, context, options) {
    if (!def || !def.id || !def.type) throw new Error('INVALID_FX_DEFINITION');
    if (!canSpawn(def.type === 'particle_emitter' ? 'complexFx' : 'simpleFx', 1)) return null;
    const transient = Object.freeze(Object.assign({}, def, { id: String(def.id) }));
    const item = resetFxObject(fxPool.pop() || {}, transient, context, options);
    activeFx.push(item);
    return item.id;
  }

  // KELO-INDEX VISUAL/VFX instancia una definición registrada sin requerir ability, stone ni combate.
  function spawnFx(id, context, options) {
    const def = fxDefs.get(String(id || ''));
    return def ? spawnDefinition(def, context, options) : null;
  }

  // Creator/debug only: transient definitions never enter KeloFXRegistry or manifests.
  function previewFx(definition, context, options) {
    return spawnDefinition(definition, context, options);
  }

  function stopFx(id) {
    const index = activeFx.findIndex(function (item) { return item.id === id; });
    if (index < 0) return false;
    const item = activeFx.splice(index, 1)[0];
    item.dead = true;
    fxPool.push(item);
    return true;
  }

  function stopAllFx() {
    while (activeFx.length) {
      const item = activeFx.pop();
      item.dead = true;
      fxPool.push(item);
    }
    return true;
  }

  function updateFx(dt) {
    for (let i = activeFx.length - 1; i >= 0; i--) {
      const item = activeFx[i];
      item.elapsed += dt;
      if (item.loop && item.elapsed >= item.duration) item.elapsed %= item.duration;
      if (!item.loop && item.elapsed >= item.duration) {
        activeFx.splice(i, 1);
        item.dead = true;
        fxPool.push(item);
      }
    }
  }

  function effectPosition(item) {
    if (item.space === 'ACTOR') return actorPosition(item);
    return { x: item.x, y: item.y };
  }

  function alphaOf(item) {
    const base = Math.max(0, Number(item.def.alpha == null ? 1 : item.def.alpha));
    const p = Math.max(0, Math.min(1, item.elapsed / Math.max(0.001, item.duration)));
    const fade = String(item.def.fade || (item.loop ? 'pulse' : 'out'));
    if (fade === 'hold') return base;
    if (fade === 'pulse') return base * (0.58 + 0.42 * (0.5 + 0.5 * Math.sin(p * Math.PI * 2)));
    if (fade === 'in-out') return base * Math.sin(Math.max(0, Math.min(1, p)) * Math.PI);
    return base * (item.loop ? 1 : (1 - p));
  }

  function aspectOf(item) {
    const a = Number(item.def.aspect);
    return Number.isFinite(a) ? Math.max(0.18, Math.min(1, a)) : 0.38;
  }

  function dirOf(item) {
    const d = item.context && item.context.direction;
    const x = Number(d && d.x);
    const y = Number(d && d.y);
    const len = Math.hypot(x || 0, y || 0);
    if (!len) return { x: 1, y: 0 };
    return { x: x / len, y: y / len };
  }

  function drawRing(g, item, p) {
    const progress = Math.max(0, Math.min(1, item.elapsed / item.duration));
    const radius = (Number(item.def.radius) || 24) * item.scale * (0.7 + progress * 0.5);
    const aspect = aspectOf(item);
    g.globalAlpha = alphaOf(item);
    g.strokeStyle = item.def.color || '#fff';
    g.lineWidth = Math.max(1, Number(item.def.lineWidth) || 2 * item.scale);
    g.beginPath(); g.ellipse(p.x, p.y, radius, radius * aspect, 0, 0, Math.PI * 2); g.stroke();
  }

  function drawExpandingRing(g, item, p) {
    const raw = Math.max(0, Math.min(1, item.elapsed / item.duration));
    const progress = 1 - Math.pow(1 - raw, 2);
    const maxR = (Number(item.def.radius) || 48) * item.scale;
    const start = Number.isFinite(Number(item.def.startScale)) ? Number(item.def.startScale) : 0.08;
    const radius = maxR * (start + (1 - start) * progress);
    const aspect = aspectOf(item);
    g.globalAlpha = alphaOf(item);
    g.strokeStyle = item.def.color || '#fff';
    g.lineWidth = Math.max(1.4, (Number(item.def.lineWidth) || 3.2) * item.scale * (1.15 - progress * 0.45));
    g.beginPath(); g.ellipse(p.x, p.y, radius, radius * aspect, 0, 0, Math.PI * 2); g.stroke();
    if (item.def.innerColor) {
      g.globalAlpha = alphaOf(item) * 0.35;
      g.strokeStyle = item.def.innerColor;
      g.lineWidth = Math.max(1, 1.4 * item.scale);
      g.beginPath(); g.ellipse(p.x, p.y, radius * 0.82, radius * aspect * 0.82, 0, 0, Math.PI * 2); g.stroke();
    }
  }

  function drawAreaDisk(g, item, p) {
    const raw = Math.max(0, Math.min(1, item.elapsed / item.duration));
    const progress = item.loop ? (0.88 + 0.12 * Math.sin(raw * Math.PI * 2)) : (0.55 + 0.45 * (1 - Math.pow(1 - raw, 2)));
    const radius = (Number(item.def.radius) || 40) * item.scale * progress;
    const aspect = aspectOf(item);
    g.globalAlpha = alphaOf(item) * 0.85;
    g.fillStyle = item.def.color || '#fff';
    g.beginPath(); g.ellipse(p.x, p.y, radius, radius * aspect, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha = alphaOf(item);
    g.strokeStyle = item.def.accent || item.def.color || '#fff';
    g.lineWidth = Math.max(1.2, (Number(item.def.lineWidth) || 2.4) * item.scale);
    g.beginPath(); g.ellipse(p.x, p.y, radius, radius * aspect, 0, 0, Math.PI * 2); g.stroke();
  }

  function drawCrystalBurst(g, item, p) {
    const progress = Math.max(0, Math.min(1, item.elapsed / item.duration));
    const radius = (Number(item.def.radius) || 36) * item.scale * (0.2 + progress * 0.9);
    const shards = Math.max(5, Math.min(14, Number(item.def.shards) || 8));
    const aspect = aspectOf(item);
    g.strokeStyle = item.def.color || '#fff';
    g.fillStyle = item.def.accent || item.def.color || '#fff';
    for (let i = 0; i < shards; i++) {
      const a = (i / shards) * Math.PI * 2 + item.seed * 0.01;
      const spread = 0.72 + (i % 3) * 0.12;
      const x1 = p.x + Math.cos(a) * radius * 0.18;
      const y1 = p.y + Math.sin(a) * radius * 0.18 * aspect;
      const x2 = p.x + Math.cos(a) * radius * spread;
      const y2 = p.y + Math.sin(a) * radius * spread * aspect;
      g.globalAlpha = alphaOf(item) * (i % 2 ? 1 : 0.72);
      g.lineWidth = Math.max(1, (2.1 - progress) * item.scale);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
  }

  function drawSigil(g, item, p) {
    const pulse = 0.86 + 0.14 * Math.sin((item.elapsed / Math.max(0.001, item.duration)) * Math.PI * 2);
    const radius = (Number(item.def.radius) || 22) * item.scale * pulse;
    const armed = item.def.armed === true || (item.context && item.context.visual && item.context.visual.armed === true);
    g.globalAlpha = alphaOf(item);
    g.strokeStyle = item.def.color || '#8ac926';
    g.fillStyle = item.def.color || '#8ac926';
    g.lineWidth = Math.max(1.4, 2.1 * item.scale);
    g.beginPath();
    g.moveTo(p.x, p.y - radius);
    g.lineTo(p.x + radius * 0.78, p.y);
    g.lineTo(p.x, p.y + radius);
    g.lineTo(p.x - radius * 0.78, p.y);
    g.closePath();
    g.globalAlpha = alphaOf(item) * 0.22;
    g.fill();
    g.globalAlpha = alphaOf(item);
    g.stroke();
    g.beginPath(); g.arc(p.x, p.y, radius * 0.34, 0, Math.PI * 2); g.stroke();
    if (armed) {
      g.globalAlpha = alphaOf(item) * 0.9;
      g.strokeStyle = item.def.accent || '#d8ff8a';
      g.beginPath(); g.arc(p.x, p.y, radius * 1.18, 0, Math.PI * 2); g.stroke();
    }
  }

  function drawStreak(g, item, p) {
    const dir = dirOf(item);
    const progress = Math.max(0, Math.min(1, item.elapsed / item.duration));
    const length = (Number(item.def.length) || Number(item.def.radius) || 48) * item.scale;
    const width = Math.max(3, (Number(item.def.width) || 10) * item.scale * (1 - progress * 0.35));
    const x2 = p.x - dir.x * length * (0.55 + progress * 0.45);
    const y2 = p.y - dir.y * length * (0.55 + progress * 0.45);
    g.globalAlpha = alphaOf(item);
    g.strokeStyle = item.def.color || '#b8f2e6';
    g.lineWidth = width;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(x2, y2); g.stroke();
    g.globalAlpha = alphaOf(item) * 0.55;
    g.strokeStyle = item.def.accent || '#ffffff';
    g.lineWidth = Math.max(1.5, width * 0.35);
    g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(x2, y2); g.stroke();
  }

  function drawGlow(g, item, p) {
    const progress = item.elapsed / item.duration;
    const radius = (Number(item.def.radius) || 20) * item.scale * (0.8 + Math.sin(progress * Math.PI) * 0.35);
    g.globalAlpha = alphaOf(item) * 0.7;
    g.fillStyle = item.def.color || '#fff';
    g.beginPath(); g.arc(p.x, p.y, radius, 0, Math.PI * 2); g.fill();
  }

  function drawBurst(g, item, p) {
    const progress = Math.max(0, Math.min(1, item.elapsed / item.duration));
    const radius = (Number(item.def.radius) || 34) * item.scale * (0.25 + progress * 0.95);
    const rays = Math.max(4, Number(item.def.rays) || 8);
    g.globalAlpha = alphaOf(item);
    g.strokeStyle = item.def.color || '#fff';
    g.lineWidth = Math.max(1, 2.2 * item.scale);
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + item.seed * 0.013;
      const r0 = radius * 0.28, r1 = radius * (0.62 + (i % 3) * 0.12);
      g.beginPath(); g.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0); g.lineTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1); g.stroke();
    }
    g.globalAlpha *= 0.55;
    g.fillStyle = item.def.accent || item.def.color || '#fff';
    g.beginPath(); g.arc(p.x, p.y, radius * 0.34, 0, Math.PI * 2); g.fill();
  }

  function drawParticles(g, item, p) {
    const progress = item.loop ? (item.elapsed / item.duration) % 1 : Math.max(0, Math.min(1, item.elapsed / item.duration));
    const radius = (Number(item.def.radius) || 24) * item.scale;
    g.fillStyle = item.def.color || '#fff';
    (item.particles || []).forEach(function (pt, index) {
      const phase = (progress + pt.phase) % 1;
      const rr = radius * pt.r * (0.4 + phase * 0.7);
      const x = p.x + Math.cos(pt.a + phase * 0.8) * rr;
      const y = p.y + Math.sin(pt.a) * rr * 0.35 - phase * radius * 1.35;
      g.globalAlpha = (Number(item.def.alpha) || 0.7) * (1 - phase) * 0.9;
      const size = 1.5 + (index % 3) * 0.7;
      g.fillRect(Math.round(x), Math.round(y), size, size);
    });
  }

  function drawTrailFx(g, item, p) {
    const progress = Math.max(0, Math.min(1, item.elapsed / item.duration));
    const r = Math.max(2, (Number(item.def.radius) || 8) * item.scale * (1 - progress * 0.5));
    g.globalAlpha = alphaOf(item);
    g.fillStyle = item.def.color || '#fff';
    g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
  }

  // KELO-INDEX VISUAL/SPRITESHEET recorta frames de una hoja sin mover gameplay ni mezclar ownership.
  function drawAssetFx(g, item, p) {
    const assetId = item.def.assetId;
    if (!assetId || !root.KeloAssetRegistry) return false;
    const image = root.KeloAssetRegistry.resource(assetId);
    if (!image) { root.KeloAssetRegistry.load(assetId); return false; }

    let sx = 0, sy = 0;
    let sw = image.width || 32, sh = image.height || 32;
    if (item.def.type === 'sprite_animation') {
      const frameWidth = Math.max(1, Number(item.def.frameWidth) || sw);
      const frameHeight = Math.max(1, Number(item.def.frameHeight) || sh);
      const columns = Math.max(1, Number(item.def.columns) || Math.floor(sw / frameWidth) || 1);
      const rows = Math.max(1, Number(item.def.rows) || Math.floor(sh / frameHeight) || 1);
      const available = Math.max(1, columns * rows);
      const frameCount = Math.max(1, Math.min(Number(item.def.frames) || available, available));
      const fps = Math.max(0.001, Number(item.def.fps) || 12);
      const rawFrame = Math.floor(item.elapsed * fps);
      const frame = item.loop ? rawFrame % frameCount : Math.min(frameCount - 1, rawFrame);
      sx = (frame % columns) * frameWidth;
      sy = Math.floor(frame / columns) * frameHeight;
      sw = frameWidth;
      sh = frameHeight;
    }

    const width = (Number(item.def.width) || sw || 32) * item.scale;
    const height = (Number(item.def.height) || sh || 32) * item.scale;
    const offset = item.def.offset || {};
    const ox = (Number(item.def.offsetX) || Number(offset.x) || 0) * item.scale;
    const oy = (Number(item.def.offsetY) || Number(offset.y) || 0) * item.scale;
    const alpha = Math.max(0, Number(item.def.alpha == null ? 1 : item.def.alpha));
    g.globalAlpha = item.def.fadeOut === false ? alpha : alphaOf(item);
    g.imageSmoothingEnabled = false;
    g.drawImage(
      image,
      sx, sy, sw, sh,
      Math.round(p.x + ox - width * 0.5),
      Math.round(p.y + oy - height * 0.5),
      width, height
    );
    return true;
  }

  function drawBeam(g, item, p) {
    const target = item.context.target;
    if (!target) return;
    g.globalAlpha = alphaOf(item);
    g.strokeStyle = item.def.color || '#fff';
    g.lineWidth = Math.max(1, Number(item.def.width) || 2);
    g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(target.x, target.y); g.stroke();
  }

  function drawOneFx(g, item) {
    const p = effectPosition(item);
    if (item.space !== 'SCREEN' && !worldVisible(p.x, p.y, (Number(item.def.radius) || 32) * item.scale)) { culled += 1; return; }
    g.save();
    const type = item.def.type;
    if (type === 'ring' || type === 'decal') drawRing(g, item, p);
    else if (type === 'expanding_ring' || type === 'nova') drawExpandingRing(g, item, p);
    else if (type === 'area_disk' || type === 'aoe') drawAreaDisk(g, item, p);
    else if (type === 'crystal_burst' || type === 'shards') drawCrystalBurst(g, item, p);
    else if (type === 'sigil') drawSigil(g, item, p);
    else if (type === 'streak' || type === 'dash_streak') drawStreak(g, item, p);
    else if (type === 'glow' || type === 'flash') drawGlow(g, item, p);
    else if (type === 'burst' || type === 'lightning') drawBurst(g, item, p);
    else if (type === 'particle_emitter') drawParticles(g, item, p);
    else if (type === 'trail') drawTrailFx(g, item, p);
    else if (type === 'beam') drawBeam(g, item, p);
    else if (type === 'static_sprite' || type === 'sprite_animation') drawAssetFx(g, item, p);
    g.restore();
    drawn += 1;
  }

  function drawLayer(layer, g) {
    activeFx.forEach(function (item) {
      if (item.space === 'ACTOR') return;
      if (item.layer === layer) drawOneFx(g, item);
    });
  }

  function drawActorLayer(layer, actor, g) {
    const id = contextApi.actorIdOf(actor);
    activeFx.forEach(function (item) {
      if (item.space !== 'ACTOR' || item.layer !== layer) return;
      if (item.context.actorId && item.context.actorId !== id) return;
      if (!item.context.actor) item.context.actor = actor;
      drawOneFx(g, item);
    });
  }

  function fxMetrics() {
    return { definitions: fxDefs.size, active: activeFx.length, pooled: fxPool.length, drawn: drawn, culled: culled };
  }

  function resetProjectile(item, def, gameplayObject, context, options) {
    const c = contextApi.normalize(context || {});
    const opts = options || {};
    const start = c.origin || { x: Number(opts.x) || 0, y: Number(opts.y) || 0 };
    const dir = c.direction || { x: 1, y: 0 };
    const len = Math.hypot(dir.x, dir.y) || 1;
    item.id = 'pvis_' + (projectileSeq++).toString(36);
    item.definitionId = def.id;
    item.def = def;
    item.gameplayObject = gameplayObject || null;
    item.context = c;
    item.x = start.x; item.y = start.y;
    item.vx = dir.x / len * (Number(opts.speed) || Number(c.gameplay.speed) || Number(def.defaultSpeed) || 0);
    item.vy = dir.y / len * (Number(opts.speed) || Number(c.gameplay.speed) || Number(def.defaultSpeed) || 0);
    item.maxDistance = Number(opts.maxDistance) || Number(c.gameplay.range) || Number(def.defaultMaxDistance) || 500;
    item.traveled = 0;
    item.elapsed = 0;
    item.scale = Math.max(0.05, Number(opts.scale != null ? opts.scale : c.visual.scale) || 1);
    item.loop = opts.loop != null ? opts.loop === true : def.loop === true;
    item.preview = !gameplayObject;
    item.dead = false;
    item.trail = [];
    item.trailClock = 0;
    return item;
  }

  // KELO-INDEX VISUAL/PROJECTILE engancha apariencia a proyectil gameplay sin cambiar su posición/colisión.
  function attachProjectile(gameplayObject, visualId, context, options) {
    const def = projectileDefs.get(String(visualId || ''));
    if (!def || !canSpawn('simpleFx', 1)) return null;
    const item = resetProjectile(projectilePool.pop() || {}, def, gameplayObject, context, options);
    activeProjectiles.push(item);
    return item.id;
  }

  function previewProjectile(visualId, context, options) { return attachProjectile(null, visualId, context, options); }

  function stopProjectile(id) {
    const index = activeProjectiles.findIndex(function (item) { return item.id === id || item.context.projectileId === id; });
    if (index < 0) return false;
    const item = activeProjectiles.splice(index, 1)[0];
    item.dead = true; projectilePool.push(item); return true;
  }

  function stopAllProjectiles() {
    while (activeProjectiles.length) {
      const item = activeProjectiles.pop();
      item.dead = true;
      projectilePool.push(item);
    }
    return true;
  }

  function updateProjectiles(dt) {
    for (let i = activeProjectiles.length - 1; i >= 0; i--) {
      const item = activeProjectiles[i];
      item.elapsed += dt;
      const beforeX = item.x, beforeY = item.y;
      if (item.gameplayObject) {
        if (item.gameplayObject._keloVisualDead === true) {
          activeProjectiles.splice(i, 1); projectilePool.push(item); continue;
        }
        item.x = Number(item.gameplayObject.x) || item.x;
        item.y = Number(item.gameplayObject.y) || item.y;
      } else {
        item.x += item.vx * dt; item.y += item.vy * dt;
        item.traveled += Math.hypot(item.x - beforeX, item.y - beforeY);
        if (item.traveled >= item.maxDistance) {
          activeProjectiles.splice(i, 1); projectilePool.push(item); continue;
        }
      }
      if (item.def.trailRef) {
        item.trailClock += dt;
        if (item.trailClock >= 0.045) {
          item.trailClock = 0;
          item.trail.push({ x: item.x, y: item.y, life: 0.24 });
          if (item.trail.length > 10) item.trail.shift();
        }
        item.trail.forEach(function (pt) { pt.life -= dt; });
        item.trail = item.trail.filter(function (pt) { return pt.life > 0; });
      }
    }
  }

  function drawProjectileTrail(item, g) {
    if (!item.def.trailRef) return;
    const trailDef = fxDefs.get(item.def.trailRef);
    item.trail.forEach(function (pt) {
      const a = Math.max(0, pt.life / 0.24) * Number(trailDef && trailDef.alpha || 0.4);
      g.globalAlpha = a;
      g.fillStyle = trailDef && trailDef.color || item.def.color || '#fff';
      g.beginPath(); g.arc(pt.x, pt.y, Math.max(2, (Number(trailDef && trailDef.radius) || 7) * a), 0, Math.PI * 2); g.fill();
    });
  }

  // KELO-INDEX VISUAL/PROJECTILE_SPRITE recorta spritesheets de proyectiles visuales sin tocar su gameplay.
  function drawAssetProjectile(item, g) {
    const def = item.def;
    if (!def.assetId || !root.KeloAssetRegistry) return false;
    const image = root.KeloAssetRegistry.resource(def.assetId);
    if (!image) { root.KeloAssetRegistry.load(def.assetId); return false; }

    let sx = 0, sy = 0;
    let sw = image.width || 32, sh = image.height || 32;
    if (def.type === 'sprite_animation') {
      const rects = Array.isArray(def.frameRects) ? def.frameRects : null;
      const fps = Math.max(0.001, Number(def.fps) || 12);
      if (rects && rects.length) {
        const frameCount = Math.max(1, Math.min(Number(def.frames) || rects.length, rects.length));
        const rawFrame = Math.floor(item.elapsed * fps);
        const frame = item.loop ? rawFrame % frameCount : Math.min(frameCount - 1, rawFrame);
        const rect = rects[frame] || rects[0];
        sx = Math.max(0, Number(rect.x) || 0);
        sy = Math.max(0, Number(rect.y) || 0);
        sw = Math.max(1, Number(rect.width) || sw);
        sh = Math.max(1, Number(rect.height) || sh);
      } else {
        const frameWidth = Math.max(1, Number(def.frameWidth) || sw);
        const frameHeight = Math.max(1, Number(def.frameHeight) || sh);
        const columns = Math.max(1, Number(def.columns) || Math.floor(sw / frameWidth) || 1);
        const rows = Math.max(1, Number(def.rows) || Math.floor(sh / frameHeight) || 1);
        const available = Math.max(1, columns * rows);
        const frameCount = Math.max(1, Math.min(Number(def.frames) || available, available));
        const rawFrame = Math.floor(item.elapsed * fps);
        const frame = item.loop ? rawFrame % frameCount : Math.min(frameCount - 1, rawFrame);
        sx = (frame % columns) * frameWidth;
        sy = Math.floor(frame / columns) * frameHeight;
        sw = frameWidth;
        sh = frameHeight;
      }
    }

    const sourcePixelScale = Math.max(0, Number(def.sourcePixelScale) || 0);
    const width = (sourcePixelScale ? sw * sourcePixelScale : (Number(def.width) || sw || 32)) * item.scale;
    const height = (sourcePixelScale ? sh * sourcePixelScale : (Number(def.height) || sh || 32)) * item.scale;
    const alpha = Math.max(0, Number(def.alpha == null ? 1 : def.alpha));
    g.globalAlpha = alpha;
    g.imageSmoothingEnabled = false;
    if (def.alignToVelocity === true && (item.vx || item.vy)) {
      g.translate(item.x, item.y);
      g.rotate(Math.atan2(item.vy, item.vx) + (Number(def.rotationOffset) || 0));
      g.drawImage(image, sx, sy, sw, sh, Math.round(-width * 0.5), Math.round(-height * 0.5), width, height);
    } else {
      g.drawImage(image, sx, sy, sw, sh, Math.round(item.x - width * 0.5), Math.round(item.y - height * 0.5), width, height);
    }
    return true;
  }

  function drawProjectile(item, g) {
    const spriteRadius = Math.max(Number(item.def.width) || 0, Number(item.def.height) || 0) * item.scale * 0.5;
    const cullRadius = Math.max(Number(item.def.glowRadius) || 24, spriteRadius || 0);
    if (!worldVisible(item.x, item.y, cullRadius)) { culled += 1; return; }
    g.save();
    drawProjectileTrail(item, g);

    if (item.def.type === 'static_sprite' || item.def.type === 'sprite_animation') {
      drawAssetProjectile(item, g);
      g.restore();
      drawn += 1;
      return;
    }

    g.globalAlpha = 0.18;
    g.fillStyle = item.def.color || '#fff';
    g.beginPath(); g.arc(item.x, item.y, Number(item.def.glowRadius) || 20, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    g.fillStyle = item.def.color || '#fff';
    g.beginPath(); g.arc(item.x, item.y, Number(item.def.radius) || 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = item.def.coreColor || '#fff';
    g.beginPath(); g.arc(item.x, item.y, Math.max(2, (Number(item.def.radius) || 10) * 0.42), 0, Math.PI * 2); g.fill();
    g.restore();
    drawn += 1;
  }

  function drawProjectileLayer(layer, g) {
    activeProjectiles.forEach(function (item) { if ((item.def.layer || 'worldFX') === layer) drawProjectile(item, g); });
  }

  function projectileMetrics() { return { definitions: projectileDefs.size, active: activeProjectiles.length, pooled: projectilePool.length, drawn: 0, culled: 0 }; }

  let audioContext = null;
  function getAudioContext() {
    if (audioContext) return audioContext;
    const Ctor = root.AudioContext || root.webkitAudioContext;
    if (!Ctor) return null;
    try { audioContext = new Ctor(); return audioContext; } catch (e) { return null; }
  }

  // KELO-INDEX VISUAL/SFX sonido reutilizable; no está unido 1:1 a un FX ni a una ability.
  function playSfx(id, context, options) {
    const def = sfxDefs.get(String(id || ''));
    if (!def) return false;
    if (def.type === 'audio' && def.assetId && root.KeloAssetRegistry) {
      const audio = root.KeloAssetRegistry.resource(def.assetId);
      if (!audio) { root.KeloAssetRegistry.load(def.assetId); return false; }
      try { const clone = audio.cloneNode(true); clone.volume = Math.max(0, Math.min(1, Number(options && options.volume) || Number(def.volume) || 0.5)); clone.play().catch(function () {}); return true; } catch (e) { return false; }
    }
    if (def.type !== 'synth') return false;
    const ac = getAudioContext();
    if (!ac) return false;
    try {
      if (ac.state === 'suspended') ac.resume().catch(function () {});
      const now = ac.currentTime;
      const duration = Math.max(0.02, Number(def.duration) || 0.12);
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = def.waveform || 'sine';
      osc.frequency.setValueAtTime(Math.max(20, Number(def.frequency) || 220), now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, Number(def.frequencyEnd) || Number(def.frequency) || 220), now + duration);
      gain.gain.setValueAtTime(Math.max(0.001, Number(def.gain) || 0.04), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain); gain.connect(ac.destination); osc.start(now); osc.stop(now + duration);
      return true;
    } catch (e) { return false; }
  }

  const screenActive = [];
  let screenSeq = 1;
  function spawnScreen(id, options) {
    const def = screenDefs.get(String(id || ''));
    if (!def) return null;
    const item = { id: 'sfxscreen_' + (screenSeq++).toString(36), def: def, elapsed: 0, duration: Math.max(0.001, Number(def.duration) || 0.1), seed: Number(options && options.seed) || screenSeq };
    screenActive.push(item); return item.id;
  }
  function shake(id, options) { return spawnScreen(id || 'impact_medium', options); }
  function flash(id, options) { return spawnScreen(id || 'flash_warm_small', options); }
  function updateScreen(dt) {
    for (let i = screenActive.length - 1; i >= 0; i--) { screenActive[i].elapsed += dt; if (screenActive[i].elapsed >= screenActive[i].duration) screenActive.splice(i, 1); }
  }
  function worldOffset() {
    let x = 0, y = 0;
    screenActive.forEach(function (item) {
      if (item.def.type !== 'shake') return;
      const p = Math.max(0, Math.min(1, item.elapsed / item.duration));
      const a = (Number(item.def.amplitude) || 3) * (1 - p);
      x += Math.sin((item.elapsed * 83 + item.seed) * 7.1) * a;
      y += Math.cos((item.elapsed * 71 + item.seed) * 5.7) * a;
    });
    return { x: x, y: y };
  }
  function applyWorldTransform(g) { const o = worldOffset(); if (o.x || o.y) g.translate(o.x, o.y); }
  function drawScreen(g) {
    const w = root.innerWidth || 390, h = root.innerHeight || 844;
    screenActive.forEach(function (item) {
      if (item.def.type !== 'flash') return;
      const p = Math.max(0, Math.min(1, item.elapsed / item.duration));
      g.save(); g.globalAlpha = (Number(item.def.alpha) || 0.08) * (1 - p); g.fillStyle = item.def.color || '#fff'; g.fillRect(0, 0, w, h); g.restore();
    });
  }

  root.KeloFXRegistry = Object.freeze({ version: 'fx-registry-v1.1.0', get: function (id) { return fxDefs.get(String(id || '')) || null; }, list: function () { return Array.from(fxDefs.values()); }, register: function (def) { return registerInto(fxDefs, def, 'FX'); } });
  root.KeloFX = Object.freeze({ version: 'fx-runtime-v1.3.1', spawn: spawnFx, preview: previewFx, stop: stopFx, stopAll: stopAllFx, update: updateFx, drawLayer: drawLayer, drawActorLayer: drawActorLayer, metrics: fxMetrics });
  root.KeloProjectileVisualRegistry = Object.freeze({ version: 'projectile-visual-registry-v1.1.1', get: function (id) { return projectileDefs.get(String(id || '')) || null; }, list: function () { return Array.from(projectileDefs.values()); }, register: function (def) { return registerInto(projectileDefs, def, 'PROJECTILE_VISUAL'); } });
  root.KeloProjectileVisuals = Object.freeze({ version: 'projectile-visual-runtime-v1.1.2', attach: attachProjectile, preview: previewProjectile, stop: stopProjectile, stopAll: stopAllProjectiles, update: updateProjectiles, drawLayer: drawProjectileLayer, metrics: projectileMetrics });
  root.KeloSFXRegistry = Object.freeze({ version: 'sfx-registry-v1.0.0', get: function (id) { return sfxDefs.get(String(id || '')) || null; }, list: function () { return Array.from(sfxDefs.values()); }, register: function (def) { return registerInto(sfxDefs, def, 'SFX'); } });
  root.KeloSFX = Object.freeze({ version: 'sfx-runtime-v1.0.0', play: playSfx });
  root.KeloScreenFX = Object.freeze({ version: 'screen-fx-v1.0.0', get: function (id) { return screenDefs.get(String(id || '')) || null; }, shake: shake, flash: flash, play: spawnScreen, update: updateScreen, draw: drawScreen, worldOffset: worldOffset, applyWorldTransform: applyWorldTransform });
})(typeof globalThis !== 'undefined' ? globalThis : window);
