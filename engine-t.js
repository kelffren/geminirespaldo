/* KELO-INDEX
 * area: LEGACY CAMERA SUPPORT
 * owner: KeloCamera
 * keys: ZOOM CAP LEGACY FOUNDATION
 * purpose: conserva el cap histórico de zoom sin escribir CONFIG.zoom directamente
 * public-api: none
 * consumes: KeloCamera
 * state-owned: ninguno
 * extension-points: KeloCamera.setBaseZoom
 * reuse: no añadir reglas nuevas aquí; configurar KeloCamera desde el owner apropiado
 * legacy: regla histórica de compatibilidad
 * do-not: NO escribir CONFIG.zoom
 */
(function () {
  if (!window.KeloCamera) throw new Error('KeloCamera unavailable before engine-t');
  const current = window.KeloCamera.getBaseZoom() || 0.95;
  window.KeloCamera.setBaseZoom(Math.min(current, 1.05), 'engine-t:legacy-cap');
})();
