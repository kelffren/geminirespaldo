/* KELO-INDEX
 * area: LEGACY CAMERA SUPPORT
 * owner: KeloCamera
 * keys: RESPONSIVE ZOOM TILES LOOKAHEAD ORIENTATION LEGACY FOUNDATION
 * purpose: conserva el encuadre histórico por cantidad de tiles sin convertir una rotación en un cambio de base zoom
 * public-api: none
 * consumes: KeloCamera, KELO_TILE, viewport físico
 * state-owned: ninguno
 * extension-points: KeloCamera.setBaseZoom/setFollowTuning
 * reuse: no crear otro sistema responsive; extender KeloCamera si la capacidad cambia
 * legacy: regla histórica de encuadre por tamaño de viewport
 * do-not: NO escribir CONFIG.zoom ni tuning de cámara directamente; NO basar el base zoom en el eje que cambia al rotar
 */
(function () {
  const TILE = window.KELO_TILE || 32;
  const cameraOwner = window.KeloCamera;
  if (!cameraOwner) throw new Error('KeloCamera unavailable before engine-z');

  function referenceSpan() {
    // Orientation-invariant reference: 390x844 and 844x390 must resolve to the same base zoom.
    return Math.max(1, Math.min(window.innerWidth || 1, window.innerHeight || 1));
  }

  function applyZoom() {
    const span = referenceSpan();
    const targetTiles = span < 500 ? 11 : 14;
    const z = span / (targetTiles * TILE);
    cameraOwner.setBaseZoom(Math.max(1.05, Math.min(1.45, z)), 'engine-z:responsive-tiles');
    if (cameraOwner.getFollowTuning().lookAheadDist > 40) cameraOwner.setFollowTuning({ lookAheadDist: 36 });
  }

  applyZoom();
  window.addEventListener('resize', applyZoom, { passive: true });
})();
