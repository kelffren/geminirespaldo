/* KELO-INDEX
 * area: PERFORMANCE
 * owner: KELO_PERF / KELO_PERFORMANCE_GOVERNOR
 * keys: FPS FRAME P50 P95 P99 STALL LOAF VISIBILITY LIFECYCLE QUALITY GOVERNOR HOOKS NETWORK MEMORY SAMPLED-SNAPSHOT
 * purpose: mide frame-time/carga real, gobierna calidad local y publica CLIENT_HIDDEN/CLIENT_VISIBLE sin crear otro lifecycle manager
 * public-api: KELO_PERF report/culling/quality/telemetry + visibility state
 * consumes: KeloEvents, KeloSimulation, KeloRender, mobile/atlas/world/network audits
 * state-owned: telemetría local, quality profile, clocks LOD y señales de visibilidad
 * online: solo diagnóstico/presentación local; nunca decide autoridad gameplay
 * do-not: NO crear otro game loop, NO usar performance para alterar verdad server
 */
(function (root) {
  'use strict';

  const VERSION = '1.3.0-sampled-snapshots';
  const TARGET_FPS = 60;
  const TARGET_FRAME_MS = 1000 / TARGET_FPS;
  const SAMPLE_ALPHA = 0.08;
  const REPORT_TTL_MS = 750;
  const FRAME_WINDOW = 600;
  const TELEMETRY_REFRESH_MS = 500;
  const SNAPSHOT_REFRESH_MS = 200;

  const WEIGHTS = Object.freeze({
    chunk: 2, staticProp: 1, animatedProp: 3, npc: 4, player: 5, mountRider: 7,
    projectile: 2, particle: 0.35, simpleFx: 2, complexFx: 5, dynamicLight: 10
  });

  const PROFILES = Object.freeze([
    Object.freeze({ id: 'ultra', label: 'ULTRA', weightedBudget: 500, particleCap: 240, fxCap: 48, actorCutoff: 2200, nearHz: 60, midHz: 30, farHz: 15, farCutoff: 1800 }),
    Object.freeze({ id: 'high', label: 'HIGH', weightedBudget: 420, particleCap: 180, fxCap: 36, actorCutoff: 1800, nearHz: 60, midHz: 30, farHz: 15, farCutoff: 1500 }),
    Object.freeze({ id: 'medium', label: 'MEDIUM', weightedBudget: 330, particleCap: 120, fxCap: 24, actorCutoff: 1500, nearHz: 60, midHz: 30, farHz: 12, farCutoff: 1250 }),
    Object.freeze({ id: 'performance', label: 'PERFORMANCE', weightedBudget: 240, particleCap: 72, fxCap: 16, actorCutoff: 1200, nearHz: 45, midHz: 24, farHz: 10, farCutoff: 1000 })
  ]);

  const reported = new Map();
  const textureMemory = new Map();
  const updateClock = new Map();
  const frameTimes = new Float64Array(FRAME_WINDOW);
  let frameWriteIndex = 0;
  let frameSampleCount = 0;
  let lastTelemetryRefreshAt = -Infinity;
  let frameStats = Object.freeze({ sampleCount: 0, averageMs: TARGET_FRAME_MS, p50Ms: TARGET_FRAME_MS, p95Ms: TARGET_FRAME_MS, p99Ms: TARGET_FRAME_MS, worstMs: TARGET_FRAME_MS, over16: 0, over33: 0, over50: 0, over100: 0, over120: 0 });
  let visibilityResets = 0;
  let visibilityChanges = 0;
  let loafCount = 0;
  let worstLoafMs = 0;
  let recentLoafs = Object.freeze([]);
  const isPhone = Math.min(root.innerWidth || 9999, root.innerHeight || 9999) <= 844;
  let profileIndex = isPhone ? 3 : 1;
  let manualProfile = null;
  let lastFrameAt = performance.now();
  let emaFrameMs = TARGET_FRAME_MS;
  let badMs = 0;
  let goodMs = 0;
  let tuneElapsedMs = 0;
  let lastHudAt = 0;
  let hud = null;
  let hudEnabled = false;
  let lastSnapshot = null;
  let lastSnapshotAt = -Infinity;
  let snapshotBuilds = 0;
  let snapshotSkips = 0;

  const loafSupported = !!(
    root.PerformanceObserver && Array.isArray(root.PerformanceObserver.supportedEntryTypes) &&
    root.PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')
  );

  function safeGlobal(name) {
    try {
      if (name === 'particles' && typeof particles !== 'undefined') return particles;
      if (name === 'simulatedPlayers' && typeof simulatedPlayers !== 'undefined') return simulatedPlayers;
      if (name === 'arenaPvP' && typeof arenaPvP !== 'undefined') return arenaPvP;
      if (name === 'localPlayer' && typeof localPlayer !== 'undefined') return localPlayer;
      if (name === 'camera' && typeof camera !== 'undefined') return camera;
      if (name === 'CONFIG' && typeof CONFIG !== 'undefined') return CONFIG;
      if (name === 'screenW' && typeof screenW !== 'undefined') return screenW;
      if (name === 'screenH' && typeof screenH !== 'undefined') return screenH;
    } catch (e) {}
    return root[name];
  }

  function profile() {
    if (manualProfile) return PROFILES.find(p => p.id === manualProfile) || PROFILES[profileIndex];
    return PROFILES[profileIndex];
  }

  function recordFrame(frameMs) {
    if (!(frameMs > 0) || !Number.isFinite(frameMs)) return;
    frameTimes[frameWriteIndex] = frameMs;
    frameWriteIndex = (frameWriteIndex + 1) % FRAME_WINDOW;
    if (frameSampleCount < FRAME_WINDOW) frameSampleCount += 1;
  }

  function percentile(sorted, ratio) {
    if (!sorted.length) return TARGET_FRAME_MS;
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
    return sorted[index];
  }

  function refreshFrameStats(now, force) {
    if (!force && frameSampleCount > 0 && now - lastTelemetryRefreshAt < TELEMETRY_REFRESH_MS) return frameStats;
    lastTelemetryRefreshAt = now;
    if (!frameSampleCount) return frameStats;
    const values = new Array(frameSampleCount);
    let sum = 0, worst = 0, over16 = 0, over33 = 0, over50 = 0, over100 = 0, over120 = 0;
    const start = (frameWriteIndex - frameSampleCount + FRAME_WINDOW) % FRAME_WINDOW;
    for (let i = 0; i < frameSampleCount; i += 1) {
      const value = frameTimes[(start + i) % FRAME_WINDOW];
      values[i] = value; sum += value;
      if (value > worst) worst = value;
      if (value > TARGET_FRAME_MS) over16 += 1;
      if (value > 33) over33 += 1;
      if (value > 50) over50 += 1;
      if (value > 100) over100 += 1;
      if (value >= 120) over120 += 1;
    }
    values.sort((a, b) => a - b);
    frameStats = Object.freeze({ sampleCount: frameSampleCount, averageMs: sum / frameSampleCount, p50Ms: percentile(values, 0.50), p95Ms: percentile(values, 0.95), p99Ms: percentile(values, 0.99), worstMs: worst, over16, over33, over50, over100, over120 });
    return frameStats;
  }

  function compactLoaf(entry) {
    const scripts = Array.isArray(entry && entry.scripts) ? entry.scripts.slice(0, 5).map(script => Object.freeze({ sourceURL: String(script.sourceURL || ''), invoker: String(script.invoker || script.invokerType || ''), duration: Number(script.duration) || 0 })) : [];
    return Object.freeze({ startTime: Number(entry && entry.startTime) || 0, duration: Number(entry && entry.duration) || 0, blockingDuration: Number(entry && entry.blockingDuration) || 0, scripts: Object.freeze(scripts) });
  }

  function setupLoafObserver() {
    if (!loafSupported) return;
    try {
      const observer = new root.PerformanceObserver(list => {
        const next = recentLoafs.slice();
        for (const entry of list.getEntries()) {
          loafCount += 1;
          worstLoafMs = Math.max(worstLoafMs, Number(entry.duration) || 0);
          next.push(compactLoaf(entry));
          while (next.length > 10) next.shift();
        }
        recentLoafs = Object.freeze(next);
      });
      observer.observe({ type: 'long-animation-frame', buffered: true });
    } catch (e) { console.warn('[Kelo perf] Long Animation Frame observer unavailable', e); }
  }

  function estimateActiveChunks() {
    const cfg = safeGlobal('CONFIG') || {};
    const cam = safeGlobal('camera') || { x: 1440, y: 1520 };
    const sw = Number(safeGlobal('screenW')) || root.innerWidth || 390;
    const sh = Number(safeGlobal('screenH')) || root.innerHeight || 844;
    const z = Number(cfg.zoom) || 1;
    const chunk = Number(root.KELO_WORLD_RENDERER && root.KELO_WORLD_RENDERER.chunkSize) || 512;
    const worldW = Number(cfg.worldWidth) || 3600, worldH = Number(cfg.worldHeight) || 3200;
    const hw = sw / (2 * z) + chunk, hh = sh / (2 * z) + chunk;
    const minX = Math.max(0, Math.floor((cam.x - hw) / chunk));
    const maxX = Math.min(Math.ceil(worldW / chunk) - 1, Math.floor((cam.x + hw) / chunk));
    const minY = Math.max(0, Math.floor((cam.y - hh) / chunk));
    const maxY = Math.min(Math.ceil(worldH / chunk) - 1, Math.floor((cam.y + hh) / chunk));
    return Math.max(0, maxX - minX + 1) * Math.max(0, maxY - minY + 1);
  }

  function getBuiltInCounts() {
    const ps = safeGlobal('particles'), bots = safeGlobal('simulatedPlayers'), arena = safeGlobal('arenaPvP');
    return { chunk: estimateActiveChunks(), player: 1 + (Array.isArray(bots) ? bots.length : 0), projectile: arena && Array.isArray(arena.projectiles) ? arena.projectiles.length : 0, particle: Array.isArray(ps) ? ps.length : 0 };
  }

  function liveReportedCounts(now) {
    const out = {};
    for (const [kind, item] of reported) {
      if (now - item.at > REPORT_TTL_MS) { reported.delete(kind); continue; }
      out[kind] = Math.max(0, Number(item.count) || 0);
    }
    return out;
  }
  function weightedCost(counts) { let total = 0; for (const [kind, count] of Object.entries(counts)) total += (WEIGHTS[kind] || 1) * (Number(count) || 0); return total; }
  function textureMB() { let bytes = 0; for (const item of textureMemory.values()) bytes += item.bytes; return bytes / (1024 * 1024); }
  function ownerSnapshot(owner) { try { return owner && typeof owner.snapshot === 'function' ? owner.snapshot() : null; } catch (e) { return null; } }
  function mobileSnapshot() { try { return root.KELO_MOBILE_PERFORMANCE_CONTRACT && root.KELO_MOBILE_PERFORMANCE_CONTRACT.snapshot ? root.KELO_MOBILE_PERFORMANCE_CONTRACT.snapshot() : null; } catch (e) { return null; } }
  function networkSnapshot() { try { return root.KeloNetAuthority && root.KeloNetAuthority.performanceSnapshot ? root.KeloNetAuthority.performanceSnapshot() : null; } catch (e) { return null; } }

  function buildSnapshot(now) {
    const counts = Object.assign({}, getBuiltInCounts());
    const external = liveReportedCounts(now);
    for (const [kind, count] of Object.entries(external)) counts[kind] = Math.max(counts[kind] || 0, count);
    const p = profile(), cost = weightedCost(counts), telemetry = refreshFrameStats(now, false);
    const sim = ownerSnapshot(root.KeloSimulation), render = ownerSnapshot(root.KeloRender), mobile = mobileSnapshot(), net = networkSnapshot();
    const atlas = root.KELO_ATLAS_AUDIT || null, world = root.KELO_WORLD_AUDIT || null;
    return Object.freeze({
      version: VERSION, targetFps: TARGET_FPS, targetFrameMs: TARGET_FRAME_MS,
      fps: 1000 / Math.max(1, emaFrameMs), frameMs: emaFrameMs,
      frameSampleCount: telemetry.sampleCount, frameAverageMs: telemetry.averageMs, frameP50Ms: telemetry.p50Ms, frameP95Ms: telemetry.p95Ms, frameP99Ms: telemetry.p99Ms, worstFrameMs: telemetry.worstMs,
      framesOver16: telemetry.over16, framesOver33: telemetry.over33, framesOver50: telemetry.over50, framesOver100: telemetry.over100, framesOver120: telemetry.over120,
      hidden:document.hidden===true, visibilityResets, visibilityChanges, loafSupported, loafCount, worstLoafMs, recentLoafs,
      quality: p.id, manualQuality: manualProfile, weightedCost: cost, weightedBudget: p.weightedBudget, pressure: cost / p.weightedBudget,
      particleCap: p.particleCap, fxCap: p.fxCap, actorCutoff: p.actorCutoff, textureMB: textureMB(), counts: Object.freeze(counts),
      simulation:sim, render:render, mobile:mobile, network:net,
      assets:atlas ? Object.freeze({loaded:Array.isArray(atlas.loaded)?atlas.loaded.length:0,decodedTextureMB:Number(atlas.decodedTextureMB)||0,residentDistrictAtlasCount:Number(atlas.residentDistrictAtlasCount)||0}) : null,
      world:world ? Object.freeze({chunkCacheSize:Number(world.chunkCacheSize)||0,activeDistrictLabel:world.activeDistrictLabel||null}) : null,
      snapshotRefreshMs:SNAPSHOT_REFRESH_MS,snapshotBuilds,snapshotSkips
    });
  }

  function refreshSnapshot(now,force){
    now=Number(now)||performance.now();
    if(!force&&lastSnapshot&&now-lastSnapshotAt<SNAPSHOT_REFRESH_MS){snapshotSkips+=1;return lastSnapshot;}
    lastSnapshotAt=now;
    snapshotBuilds+=1;
    lastSnapshot=buildSnapshot(now);
    return lastSnapshot;
  }

  function dispatchQualityChange(previous, next) {
    if (document.body) document.body.dataset.keloQuality = next.id;
    try { root.dispatchEvent(new CustomEvent('kelo:qualitychange', { detail: { previous: previous.id, quality: next.id, profile: next } })); } catch (e) {}
  }
  function setProfileIndex(nextIndex) { const clamped = Math.max(0, Math.min(PROFILES.length - 1, nextIndex)); if (clamped === profileIndex) return; const previous = PROFILES[profileIndex]; profileIndex = clamped; dispatchQualityChange(previous, PROFILES[profileIndex]); }
  function autoTune(dt, snapshot) {
    if (manualProfile || document.hidden) return;
    const overloaded = snapshot.fps < 52 || snapshot.frameMs > 19.2 || snapshot.pressure > 1.05;
    const healthy = snapshot.fps > 58 && snapshot.frameMs < 17.0 && snapshot.pressure < 0.72;
    if (overloaded) { badMs += dt; goodMs = Math.max(0, goodMs - dt * 2); }
    else if (healthy) { goodMs += dt; badMs = Math.max(0, badMs - dt); }
    else { badMs = Math.max(0, badMs - dt * 0.35); goodMs = Math.max(0, goodMs - dt * 0.35); }
    if (badMs >= 1800 && profileIndex < PROFILES.length - 1) { setProfileIndex(profileIndex + 1); badMs = 0; goodMs = 0; }
    else if (goodMs >= 6000 && profileIndex > 0) { setProfileIndex(profileIndex - 1); badMs = 0; goodMs = 0; }
  }

  function ensureHud() {
    if (hud || !document.body) return;
    hud = document.createElement('div'); hud.id = 'kelo-perf-hud';
    hud.style.cssText = 'position:fixed;left:8px;bottom:max(8px,env(safe-area-inset-bottom));z-index:99999;pointer-events:none;background:rgba(5,7,10,.88);border:1px solid rgba(231,197,106,.45);color:#f1d58b;border-radius:10px;padding:7px 9px;font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre;display:none;backdrop-filter:blur(6px)';
    document.body.appendChild(hud);
  }
  function updateHud(now, snapshot) {
    if (!hudEnabled || now - lastHudAt < 400) return;
    lastHudAt = now; ensureHud(); if (!hud) return; hud.style.display = 'block';
    const sim=snapshot.simulation||{},ren=snapshot.render||{},assets=snapshot.assets||{},net=snapshot.network||{},world=snapshot.world||{};
    hud.textContent = 'KELO PERF ' + VERSION + '\n' + snapshot.quality.toUpperCase() + '  ' + snapshot.fps.toFixed(1) + ' FPS  EMA ' + snapshot.frameMs.toFixed(2) + 'ms\n' +
      'p50 ' + snapshot.frameP50Ms.toFixed(1) + '  p95 ' + snapshot.frameP95Ms.toFixed(1) + '  p99 ' + snapshot.frameP99Ms.toFixed(1) + '  worst ' + snapshot.worstFrameMs.toFixed(1) + '\n' +
      '>33 ' + snapshot.framesOver33 + '  >50 ' + snapshot.framesOver50 + '  >100 ' + snapshot.framesOver100 + '  LoAF ' + snapshot.loafCount + '\n' +
      'budget ' + snapshot.weightedCost.toFixed(1) + '/' + snapshot.weightedBudget + '  ' + Math.round(snapshot.pressure * 100) + '%\n' +
      'SIM ' + (sim.enabled||0) + ' active / ' + (sim.sleeping||0) + ' sleep  REN ' + (ren.enabled||0) + '/' + (ren.sleeping||0) + '\n' +
      'chunks ' + (snapshot.counts.chunk || 0) + ' cache ' + (world.chunkCacheSize||0) + '  actors ' + (snapshot.counts.player || 0) + '\n' +
      'textures ' + Number(assets.decodedTextureMB||snapshot.textureMB||0).toFixed(1) + ' MB  districtAtlas ' + (assets.residentDistrictAtlasCount||0) + '\n' +
      'net peers ' + (net.peerCount||0) + ' pose ' + (net.poseSent||0) + ' culled ' + (net.peersRenderCulled||0);
  }

  function frame(now) {
    const rawDt = now - lastFrameAt; lastFrameAt = now;
    if (!document.hidden && rawDt > 0) {
      recordFrame(rawDt);
      if (rawDt < 120) { emaFrameMs += (rawDt - emaFrameMs) * SAMPLE_ALPHA; tuneElapsedMs += rawDt; }
      if (!lastSnapshot || now - lastSnapshotAt >= SNAPSHOT_REFRESH_MS) {
        const snapshot = refreshSnapshot(now,true);
        if (tuneElapsedMs > 0) { autoTune(tuneElapsedMs, snapshot); tuneElapsedMs = 0; }
        updateHud(now, snapshot);
      } else snapshotSkips += 1;
    }
    root.requestAnimationFrame(frame);
  }

  function reportVisible(kind, count) { if (!kind) return; reported.set(String(kind), { count: Math.max(0, Number(count) || 0), at: performance.now() }); }
  function canSpawn(kind, count) {
    const p = profile(), n = Math.max(1, Number(count) || 1), snapshot = refreshSnapshot(performance.now(),false);
    if (kind === 'particle' && (snapshot.counts.particle || 0) + n > p.particleCap) return false;
    if ((kind === 'simpleFx' || kind === 'complexFx') && ((snapshot.counts.simpleFx || 0) + (snapshot.counts.complexFx || 0) + n > p.fxCap)) return false;
    return snapshot.weightedCost + (WEIGHTS[kind] || 1) * n <= p.weightedBudget;
  }
  function getAnimationHz(distance) { const d = Math.max(0, Number(distance) || 0), p = profile(); if (d <= 500) return p.nearHz; if (d <= 1000) return p.midHz; if (d <= p.farCutoff) return p.farHz; return 0; }
  function shouldUpdate(key, distance, now) {
    const hz = getAnimationHz(distance); if (hz <= 0) return false;
    const t = Number(now) || performance.now(), minInterval = 1000 / hz, clockKey=String(key);
    const last = updateClock.get(clockKey) || 0; if (t - last < minInterval) return false;
    updateClock.set(clockKey, t); return true;
  }
  function forgetUpdateKey(key) { return updateClock.delete(String(key)); }
  function shouldRenderActor(distance) { return Math.max(0, Number(distance) || 0) <= profile().actorCutoff; }
  function registerTexture(id, width, height, copies) { const w = Math.max(0, Number(width) || 0), h = Math.max(0, Number(height) || 0), c = Math.max(1, Number(copies) || 1); textureMemory.set(String(id), { bytes: w * h * 4 * c, width: w, height: h, copies: c }); }
  function unregisterTexture(id) { textureMemory.delete(String(id)); }
  function setManualQuality(id) {
    if (id == null || id === 'auto') { manualProfile = null; badMs = 0; goodMs = 0; return profile().id; }
    const found = PROFILES.find(p => p.id === id); if (!found) throw new Error('Unknown Kelo quality profile: ' + id);
    const previous = profile(); manualProfile = found.id; dispatchQualityChange(previous, found); return found.id;
  }
  function toggleHUD(force) { hudEnabled = typeof force === 'boolean' ? force : !hudEnabled; ensureHud(); if (hud) hud.style.display = hudEnabled ? 'block' : 'none'; try { localStorage.setItem('kelo_perf_hud', hudEnabled ? '1' : '0'); } catch (e) {} return hudEnabled; }
  function getSnapshot() { return refreshSnapshot(performance.now(),false); }
  function getFrameTelemetry() { const stats = refreshFrameStats(performance.now(), true); return Object.freeze({ ...stats, visibilityResets, visibilityChanges, loafSupported, loafCount, worstLoafMs, recentLoafs }); }

  function publishVisibility() {
    visibilityChanges += 1; lastFrameAt = performance.now(); tuneElapsedMs = 0;
    if (!document.hidden) visibilityResets += 1;
    const name = document.hidden ? 'CLIENT_HIDDEN' : 'CLIENT_VISIBLE';
    const payload = Object.freeze({hidden:document.hidden===true,at:Date.now(),source:'KELO_PERF'});
    try { if (root.KeloEvents && typeof root.KeloEvents.emit === 'function') root.KeloEvents.emit(name,payload); } catch (e) {}
    try { root.dispatchEvent(new CustomEvent('kelo:client-visibility',{detail:payload})); } catch (e) {}
  }

  const api = Object.freeze({
    version: VERSION, targetFps: TARGET_FPS, targetFrameMs: TARGET_FRAME_MS, frameWindow: FRAME_WINDOW, snapshotRefreshMs:SNAPSHOT_REFRESH_MS, weights: WEIGHTS, profiles: PROFILES,
    reportVisible, canSpawn, getAnimationHz, shouldUpdate, forgetUpdateKey, shouldRenderActor,
    registerTexture, unregisterTexture, setManualQuality, toggleHUD, getSnapshot, getFrameTelemetry,
    get visible(){return document.hidden!==true;}, get profile() { return profile(); }
  });

  root.KELO_PERF = api; root.KELO_PERFORMANCE_GOVERNOR = api;
  try { const params = new URLSearchParams(root.location.search); hudEnabled = params.get('perf') === '1' || localStorage.getItem('kelo_perf_hud') === '1'; } catch (e) {}
  if (document.body) document.body.dataset.keloQuality = profile().id;

  if (typeof root.spawnParticle === 'function' && !root.spawnParticle.__keloPerfWrapped) {
    const rawSpawnParticle = root.spawnParticle;
    const wrapped = function () { if (!canSpawn('particle', 1)) return; return rawSpawnParticle.apply(this, arguments); };
    wrapped.__keloPerfWrapped = true; root.spawnParticle = wrapped;
  }

  document.addEventListener('visibilitychange', publishVisibility, { passive: true });
  setupLoafObserver();
  function armPerfLoop(){ root.requestAnimationFrame(frame); }
  if(root.__keloHoldGameLoop && !root.__keloBootReady){
    root.addEventListener('kelo:boot-ready', armPerfLoop, {once:true});
  }else{
    armPerfLoop();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
