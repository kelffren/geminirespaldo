/* KELO-INDEX
 * area: CORE
 * owner: KeloUpdater watch helper
 * keys: UPDATE PWA WATCH DEPLOY LONGSESSION INSTANT
 * purpose: discover a new deployed build within seconds while visible without using setInterval or downloading assets itself
 * public-api: N/A; consumer of KeloUpdater.check()/getState()
 * state-owned: one ephemeral timeout
 * do-not: never download assets or compete with critical gameplay
 */
(function initKeloUpdaterWatch(global) {
  'use strict';
  if (global.__KELO_UPDATER_WATCH__) return;
  global.__KELO_UPDATER_WATCH__ = true;
  const CHECK_EVERY_MS = 15000;
  const RETRY_MISSING_UPDATER_MS = 5000;
  const RETURN_VISIBLE_MS = 1200;
  let timer = 0;
  function schedule(delay) {
    if (timer) global.clearTimeout(timer);
    timer = global.setTimeout(tick, Math.max(1000, Number(delay) || CHECK_EVERY_MS));
  }
  async function tick() {
    try {
      const updater = global.KeloUpdater;
      if (!updater || typeof updater.check !== 'function' || typeof updater.getState !== 'function') {
        schedule(RETRY_MISSING_UPDATER_MS);
        return;
      }
      const snapshot = updater.getState();
      const visible = document.visibilityState === 'visible';
      const busy = !!(snapshot && snapshot.gameplayBusy);
      if (visible && !busy) await updater.check();
    } catch (_) {
    } finally {
      schedule(CHECK_EVERY_MS);
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedule(RETURN_VISIBLE_MS);
  });
  global.addEventListener('online', () => schedule(1000));
  schedule(CHECK_EVERY_MS);
})(window);
