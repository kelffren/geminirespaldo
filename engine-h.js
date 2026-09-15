/* KELO-INDEX
 * area: LEGACY HD RENDER SUPPORT
 * owner: HD/pixel-perfect compatibility; camera/viewport owned by KeloCamera; frame extension owned by KeloRender
 * keys: HIDPI PIXEL PERFECT PLAZA FALLBACK RENDER CAMERA FOUNDATION
 * purpose: conserva DPR/pixel-perfect compatibility sin poseer resize, zoom ni render
 * public-api: KELO_HD_RENDER
 * consumes: KeloCamera, mobile performance contract
 * state-owned: ninguna decisión de gameplay
 * extension-points: KeloCamera.configureViewport
 * reuse: políticas de viewport se configuran en KeloCamera; no reemplazar resize/cycleZoom aquí
 * legacy: intercept procedural de plaza retirado tras 204 frames LIVE observados con 0 hits
 * do-not: NO envolver render, NO monkey-patch Canvas por frame, NO reemplazar resize/cycleZoom, NO escribir CONFIG.zoom/canvas size
 */
(function () {
  const mobilePerf = window.KELO_MOBILE_PERFORMANCE_CONTRACT;
  const cameraOwner = window.KeloCamera;
  const dprCap = Number(mobilePerf?.dprCap) || 3;
  if(!cameraOwner) throw new Error('KeloCamera unavailable before engine-h');

  cameraOwner.configureViewport({dprCap,pixelPerfect:true,roundPixels:true,smoothing:false,imageRendering:'pixelated'});
  const defaultBaseZoom=cameraOwner.pixelPerfectZoom(1);
  cameraOwner.setBaseZoom(defaultBaseZoom,'engine-h-default');
  cameraOwner.syncViewport('engine-h-boot');

  window.KELO_HD_RENDER = Object.freeze({
    mode:'hidpi-pixel-perfect-v4-no-canvas-monkey-patch',
    dprCap,
    defaultZoom:cameraOwner.getEffectiveZoom(),
    defaultBaseZoom:cameraOwner.getBaseZoom(),
    smoothing:false,
    mobilePerformanceContractVersion:mobilePerf?.version||null,
    cameraOwner:'KeloCamera',
    renderOwner:'KeloRender',
    directViewportWrites:false,
    directZoomWrites:false,
    legacyPlazaMonkeyPatch:false,
    hotPathAuditVersion:'legacy-plaza-intercept-removed-v1'
  });
  window.KELO_LEGACY_PLAZA_IMAGE_DISABLED = true;
})();