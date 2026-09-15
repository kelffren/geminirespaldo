/* KELO-INDEX
 * area: VISUAL
 * keys: INTEGRATION AVATAR ACTOR BACK FRONT TRANSFORM FINAL BRIDGE FOUNDATION
 * hace: instala la capa visual exterior del actor mediante KeloAvatar para action/reaction y FX
 * online: aplica igual a actor local/remoto; no crea autoridad ni modifica pose/física
 * owner: KeloVisualIntegration; avatar composition owned by KeloAvatar
 * extension-points: KeloAvatar.use
 * do-not: NO envolver renderAvatar
 */
(function (root) {
  'use strict';

  let actorHookId = null;

  function installActorBridge() {
    if (actorHookId) return true;
    if (!root.KeloAvatar || typeof root.KeloAvatar.use !== 'function') return false;

    actorHookId = root.KeloAvatar.use('visual-integration:actor-fx-transform', function (actor, isSelf, next) {
      if (!actor || !root.KeloVisualSystem) return next();
      const transform = root.KeloAnimation && root.KeloAnimation.sampleTransform ? root.KeloAnimation.sampleTransform(actor) : null;
      const pivot = root.KeloAnchors && root.KeloAnchors.get ? root.KeloAnchors.get(actor, 'foot') : { x: actor.x, y: actor.y };
      const g = typeof ctx !== 'undefined' ? ctx : null;
      if (!g || !pivot) return next();

      g.save();
      if (transform) {
        g.translate(Number(transform.offsetX) || 0, Number(transform.offsetY) || 0);
        g.translate(pivot.x, pivot.y);
        if (Number(transform.rotation)) g.rotate(Number(transform.rotation));
        g.scale(Number(transform.scaleX) || 1, Number(transform.scaleY) || 1);
        g.translate(-pivot.x, -pivot.y);
      }
      root.KeloVisualSystem.renderActorLayer('actorBackFX', actor, g);
      const out = next();
      root.KeloVisualSystem.renderActorLayer('actorFrontFX', actor, g);
      g.restore();
      return out;
    }, 400);

    if (root.KELO_VISUAL_AUDIT) root.KELO_VISUAL_AUDIT.actorBridgeWrapped = true;
    return true;
  }

  function loadAbilityIntegrations() {
    if (document.querySelector('script[data-kelo-sword-swap-runtime]')) return;
    const script = document.createElement('script');
    script.src = 'src/abilities/sword-swap-runtime.js?v=2';
    script.dataset.keloSwordSwapRuntime = '1';
    script.async = false;
    document.body.appendChild(script);
  }

  function boot() {
    const ok = installActorBridge();
    if (root.KeloVisualSystem && typeof root.KeloVisualSystem.syncAudit === 'function') root.KeloVisualSystem.syncAudit();
    if (root.KELO_VISUAL_AUDIT) {
      root.KELO_VISUAL_AUDIT.integrationReady = ok;
      root.KELO_VISUAL_AUDIT.updateBridgeWrapped = false;
      root.KELO_VISUAL_AUDIT.renderBridgePolicy = 'KeloAvatar-middleware-actor-transform-v2';
      root.KELO_VISUAL_AUDIT.avatarOwner = 'KeloAvatar';
      root.KELO_VISUAL_AUDIT.avatarHook = 'visual-integration:actor-fx-transform';
      root.KELO_VISUAL_AUDIT.avatarPriority = 400;
    }
    loadAbilityIntegrations();
  }

  root.KeloVisualIntegration = Object.freeze({ version: 'visual-integration-v1.2.0-foundation', installActorBridge: installActorBridge, loadAbilityIntegrations: loadAbilityIntegrations });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : window);
