/* KELO-INDEX
 * area: VISUAL / LAZY
 * owner: Visual Lab lazy loader
 * keys: VISUAL LAB LAZY DEV QUERY
 * purpose: keep Visual Lab out of critical boot; load it only for ?visualLab=1
 */
(function initVisualLabLazyLoader(root) {
  'use strict';
  let loadPromise = null;

  function enabled() {
    try { return new URLSearchParams(root.location.search).get('visualLab') === '1'; }
    catch (_) { return false; }
  }

  async function load() {
    if (!enabled()) return false;
    if (!loadPromise) {
      loadPromise = import('./visual-lab.js?v=5')
        .then(() => import('./visual-integration.js?v=2'))
        .then(() => true);
    }
    return loadPromise;
  }

  root.KeloVisualLabLoader = Object.freeze({ load, enabled });
  if (enabled()) load().catch((error) => {
    console.error('[KeloVisualLabLoader]', error);
  });
})(window);
