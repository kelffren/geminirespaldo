/* KELO-INDEX
 * area: MOVEMENT / COMPAT
 * owner: KeloMovement consumer
 * keys: MOVEMENT RELEASE BRAKE STOP INPUT FOUNDATION
 * purpose: conserva el freno inmediato al soltar usando el hook after del owner KeloMovement
 * public-api: ninguna
 * consumes: KeloMovement, input, localPlayer
 * state-owned: ninguno
 * extension-points: KeloMovement.after
 * reuse: regla actual de stop-on-release
 * legacy: comportamiento histórico conservado sin wrapper propio
 * do-not: NO envolver updateMovement, NO tocar colisión ni UI
 */
(function () {
  // Solo freno al soltar. El bob visual se quitó: movía sombra+sprite y flotaba.
  function hasMoveInput() {
    if (input.touchActive) return true;
    if (input.normX || input.normY) return true;
    const k = input.keys || {};
    return !!(k.w || k.a || k.s || k.d || k.ArrowUp || k.ArrowDown || k.ArrowLeft || k.ArrowRight);
  }
  if(!window.KeloMovement)throw new Error('KeloMovement unavailable before engine-ah');
  window.KeloMovement.after('engine-ah:release-brake',function(){
    if (!hasMoveInput()) {
      localPlayer.vx = 0;
      localPlayer.vy = 0;
      input.normX = 0;
      input.normY = 0;
    }
  },30);
})();
