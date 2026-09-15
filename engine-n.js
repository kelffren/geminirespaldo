/* KELO-INDEX
 * area: COMBAT
 * keys: MELEE TAP TOUCH ATTACK OFF HOTBAR
 * hace: el toque a la pantalla YA NO ataca; el combate va por habilidades/hotbar
 * online: N/A mientras este flag este disabled; un melee futuro debe salir por CAST/AUTH
 */
(function () {
  // KELO-INDEX COMBAT/MELEE tap-to-attack apagado a proposito
  window.KELO_MELEE_TAP = Object.freeze({ disabled: true, reason: 'touch-attack-off' });
})();
