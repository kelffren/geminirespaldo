/* KELO-INDEX
 * area: CORE
 * owner: KeloUpdateDelta
 * keys: UPDATE DELTA HASH CONCURRENCY MANIFEST
 * purpose: pure helpers for content-addressed update diffing and adaptive download concurrency
 * public-api: KeloUpdateDelta.diffManifest(), chooseConcurrency(), normalizeRepoPath()
 * state-owned: none
 */
(function initKeloUpdateDelta(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && !root.KeloUpdateDelta) root.KeloUpdateDelta = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createKeloUpdateDelta() {
  'use strict';

  function normalizeBytes(value) {
    const bytes = Number(value);
    return Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes) : 0;
  }

  function diffManifest(entries, cachedBlobShas) {
    const cached = cachedBlobShas instanceof Set ? cachedBlobShas : new Set(cachedBlobShas || []);
    const missing = [];
    const reused = [];
    let deltaBytes = 0;
    let reusedBytes = 0;

    for (const entry of Array.isArray(entries) ? entries : []) {
      if (!entry) continue;
      const blob = String(entry.blob || '').trim().toLowerCase();
      const bytes = normalizeBytes(entry.bytes);
      if (blob && cached.has(blob)) {
        reused.push(entry);
        reusedBytes += bytes;
      } else {
        missing.push(entry);
        deltaBytes += bytes;
      }
    }

    return Object.freeze({ missing, reused, deltaFiles: missing.length, reusedFiles: reused.length, deltaBytes, reusedBytes });
  }

  function chooseConcurrency(input) {
    const state = input || {};
    // Turbo contract TU-06: combat/PVP is an absolute hard stop, including explicit/foreground updates.
    if (state.gameplayBusy) return 0;
    const status = String(state.status || '').toLowerCase();
    const ping = Number(state.pingMs);
    const downlink = Number(state.downlinkMbps);
    if (state.foreground) {
      if (Number.isFinite(ping) && ping > 200) return 2;
      return 6;
    }
    if (status === 'constrained' || (Number.isFinite(ping) && ping > 150)) return 1;
    if (status === 'fair' || (Number.isFinite(ping) && ping > 100)) return 2;
    if (status === 'good' || (Number.isFinite(ping) && ping <= 100)) {
      if (Number.isFinite(ping) && ping < 70 && Number.isFinite(downlink) && downlink >= 10) return 6;
      if (Number.isFinite(ping) && ping < 70) return 4;
      return 4;
    }
    return 1;
  }

  function normalizeRepoPath(urlValue, baseUrlValue) {
    try {
      const url = new URL(urlValue, baseUrlValue);
      const base = new URL(baseUrlValue);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return null;
      const relative = url.pathname.slice(base.pathname.length).replace(/^\/+/, '');
      return decodeURIComponent(relative || 'index.html');
    } catch (_) {
      return null;
    }
  }

  return Object.freeze({ diffManifest, chooseConcurrency, normalizeRepoPath });
});
