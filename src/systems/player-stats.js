/* KELO-INDEX
 * area: PROGRESSION / STATS
 * owner: KeloPlayerStats
 * keys: STATS PROGRESSION KILLS EVENTS AUTHORITY OFFLINE SERVER
 * purpose: counters de progreso reutilizables; traduce eventos gameplay confiables en stats sin conocer recompensas
 * public-api: KeloPlayerStats.get/snapshot/ingestServerSnapshot/recordTrusted
 * consumes: KeloEvents, combat:entity_killed, KeloNetAuthority, STATE/saveState
 * state-owned: counters offline y snapshot read-only recibido del server
 * extension-points: recordTrusted(stat,delta,context) desde owners gameplay; listeners de player:stat_changed
 * reuse: achievements, titles, quests, seasons, leaderboards, analytics
 * legacy: N/A
 * do-not: NO desbloquear títulos; NO aceptar progreso autoritativo del cliente cuando está online
 */
(function (root) {
  'use strict';
  if (root.KeloPlayerStats) return;

  const VERSION = 'player-stats-v1';
  const STAT_CHANGED = 'player:stat_changed';
  let serverProgress = null;

  function worldState() {
    try { if (typeof STATE !== 'undefined') return STATE; } catch (e) {}
    return root.STATE || null;
  }
  function player() {
    try { if (typeof localPlayer !== 'undefined') return localPlayer; } catch (e) {}
    return root.localPlayer || null;
  }
  function online() {
    return !!(root.KeloNetAuthority && typeof root.KeloNetAuthority.isOnline === 'function' && root.KeloNetAuthority.isOnline());
  }
  function ensureLocal() {
    const state = worldState();
    if (!state) return null;
    if (!state.playerStats || typeof state.playerStats !== 'object' || Array.isArray(state.playerStats)) state.playerStats = {};
    Object.keys(state.playerStats).forEach(function (key) {
      state.playerStats[key] = Math.max(0, Math.floor(Number(state.playerStats[key]) || 0));
    });
    return state.playerStats;
  }
  function persist() {
    try { if (typeof saveState === 'function') saveState(); } catch (e) {}
  }
  function emitChanged(stat, previous, value, source, meta) {
    if (!root.KeloEvents || typeof root.KeloEvents.emit !== 'function') return;
    root.KeloEvents.emit(STAT_CHANGED, Object.freeze({
      stat: String(stat), previous: previous, value: value, delta: value - previous,
      source: source || 'unknown', meta: meta || null, authoritative: online()
    }));
  }
  function get(stat) {
    const key = String(stat || '');
    if (online()) return serverProgress ? Math.max(0, Math.floor(Number(serverProgress[key]) || 0)) : 0;
    const local = ensureLocal();
    return local ? Math.max(0, Math.floor(Number(local[key]) || 0)) : 0;
  }
  function snapshot() {
    const source = online() ? (serverProgress || {}) : (ensureLocal() || {});
    const out = {};
    Object.keys(source).forEach(function (key) { out[key] = Math.max(0, Math.floor(Number(source[key]) || 0)); });
    return Object.freeze(out);
  }

  // KELO-INDEX PROGRESSION/STATS mutación offline confiable; online bloquea escrituras locales de progreso valioso.
  function recordTrusted(stat, delta, context) {
    const key = String(stat || '');
    const amount = Math.floor(Number(delta));
    if (!key || !Number.isSafeInteger(amount) || amount <= 0) return Object.freeze({ ok: false, error: 'INVALID_STAT_DELTA' });
    if (online()) return Object.freeze({ ok: false, error: 'SERVER_AUTHORITY_REQUIRED' });
    const local = ensureLocal();
    if (!local) return Object.freeze({ ok: false, error: 'STATE_UNAVAILABLE' });
    const previous = Math.max(0, Math.floor(Number(local[key]) || 0));
    const value = Math.min(Number.MAX_SAFE_INTEGER, previous + amount);
    local[key] = value;
    persist();
    emitChanged(key, previous, value, context && context.source || 'trusted-local', context || null);
    return Object.freeze({ ok: true, stat: key, previous: previous, value: value, delta: value - previous });
  }

  function ingestServerSnapshot(progress) {
    if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return false;
    const next = {};
    Object.keys(progress).forEach(function (key) { next[key] = Math.max(0, Math.floor(Number(progress[key]) || 0)); });
    const previous = serverProgress || {};
    serverProgress = next;
    Object.keys(next).forEach(function (key) {
      const before = Math.max(0, Math.floor(Number(previous[key]) || 0));
      if (before !== next[key]) emitChanged(key, before, next[key], 'server-snapshot', { source: 'server-snapshot' });
    });
    return true;
  }

  function idOf(entity) {
    return entity && String(entity.playerKey || entity.id || '');
  }
  function isPlayerEntity(entity) {
    if (!entity || entity.isNPC === true || entity.npc === true || entity.isDummy === true || entity.trainingDummy === true || entity.dummy === true) return false;
    return entity.isPlayer === true || entity.actorType === 'player' || entity.kind === 'player' || !!entity.playerKey;
  }
  function isOpenWorldPlayerKill(payload) {
    if (!payload || payload.killed !== true || payload.confirmedHit !== true) return false;
    const attacker = payload.actor, victim = payload.targetActor;
    const me = player();
    if (!attacker || !victim || !me) return false;
    const attackerId = idOf(attacker), localId = idOf(me), victimId = idOf(victim);
    if (attacker !== me && (!attackerId || !localId || attackerId !== localId)) return false;
    if (!victimId || victim === attacker || victimId === attackerId) return false;
    if (!isPlayerEntity(victim)) return false;
    const c = payload.combatContext && typeof payload.combatContext === 'object' ? payload.combatContext : payload;
    if (c.confirmed === false || c.arena === true || c.training === true || c.dummy === true || c.npc === true) return false;
    return c.worldPvP === true && (c.mode === 'open-world-pvp' || c.combatType === 'open-world-pvp');
  }
  function onEntityKilled(payload) {
    if (online() || !isOpenWorldPlayerKill(payload)) return;
    recordTrusted('openWorldPlayerKills', 1, {
      source: 'combat:entity_killed',
      killerId: idOf(payload.actor), victimId: idOf(payload.targetActor),
      timestamp: Date.now(), mode: 'open-world-pvp', worldPvP: true
    });
  }

  function devEnabled() {
    if (root.KELO_TITLE_DEV === true) return true;
    try {
      const p = new URLSearchParams(root.location && root.location.search || '');
      return p.get('titleDev') === '1' || p.get('titlesDev') === '1';
    } catch (e) { return false; }
  }
  function devSet(stat, value) {
    if (!devEnabled() || online()) return false;
    const local = ensureLocal(); if (!local) return false;
    const key = String(stat || ''), next = Math.max(0, Math.floor(Number(value) || 0));
    const previous = Math.max(0, Math.floor(Number(local[key]) || 0));
    local[key] = next; persist(); emitChanged(key, previous, next, 'title-dev', { source: 'title-dev' }); return true;
  }
  function devSimulateOpenWorldKill(victimId) {
    if (!devEnabled() || online()) return false;
    const me = player(); if (!me) return false;
    onEntityKilled({
      actor: me, actorId: idOf(me) || 'local', targetActor: { id: String(victimId || ('dev-victim-' + Date.now())), isPlayer: true },
      targetActorId: String(victimId || 'dev-victim'), killed: true, confirmedHit: true,
      combatContext: { confirmed: true, worldPvP: true, mode: 'open-world-pvp', combatType: 'open-world-pvp', arena: false, training: false }
    });
    return true;
  }

  ensureLocal();
  if (root.KeloEvents && typeof root.KeloEvents.on === 'function') root.KeloEvents.on('combat:entity_killed', onEntityKilled);

  const api = {
    version: VERSION,
    event: STAT_CHANGED,
    get: get,
    snapshot: snapshot,
    ingestServerSnapshot: ingestServerSnapshot,
    recordTrusted: recordTrusted,
    isOpenWorldPlayerKill: isOpenWorldPlayerKill,
    isServerAuthoritative: function () { return online(); }
  };
  if (devEnabled()) api.dev = Object.freeze({ set: devSet, simulateOpenWorldKill: devSimulateOpenWorldKill });
  root.KeloPlayerStats = Object.freeze(api);
  root.KELO_PLAYER_STATS_AUDIT = Object.freeze({ version: VERSION, ready: true, combatEvent: 'combat:entity_killed', onlineWritesBlocked: true, onlinePreSnapshotFailClosed: true, rewardFree: true, devEnabled: devEnabled() });
})(typeof globalThis !== 'undefined' ? globalThis : window);
