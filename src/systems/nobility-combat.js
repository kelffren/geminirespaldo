(function () {
  'use strict';
  if (typeof applyPvPDamage !== 'function') return;

  const baseApplyPvPDamage = applyPvPDamage;

  applyPvPDamage = function(target, dmg) {
    const baseDamage = Math.max(0, Math.floor(Number(dmg) || 0));
    const outgoing = target !== localPlayer;

    if (!outgoing) {
      baseApplyPvPDamage(target, baseDamage);
      return;
    }

    const authority = window.KeloNetAuthority;
    if (authority && typeof authority.isOnline === 'function' && authority.isOnline() && typeof authority.resolveDamage === 'function') {
      authority.resolveDamage(baseDamage).then(function(result) {
        if (!target || target.hp <= 0 || !isPvPActive) return;
        baseApplyPvPDamage(target, Number(result.damage) || baseDamage);
        window.KELO_NOBILITY_COMBAT_AUDIT = {
          version: 'nobility-combat-v1',
          mode: 'server-authoritative',
          baseDamage: Number(result.baseDamage) || baseDamage,
          resolvedDamage: Number(result.damage) || baseDamage,
          rank: result.rank?.id || 'none',
          power: Number(result.rank?.power) || 0,
          multiplier: Number(result.damageMultiplier) || 1
        };
      }).catch(function() {
        // Fail closed for online-authoritative combat: never grant a client-computed bonus.
        baseApplyPvPDamage(target, baseDamage);
        window.KELO_NOBILITY_COMBAT_AUDIT = { version: 'nobility-combat-v1', mode: 'server-fallback-base-damage', baseDamage, resolvedDamage: baseDamage, rank: 'unknown', power: 0, multiplier: 1 };
      });
      return;
    }

    const bonus = window.KeloNobility && typeof window.KeloNobility.getBattlePowerBonus === 'function'
      ? Math.max(0, Number(window.KeloNobility.getBattlePowerBonus()) || 0)
      : 0;
    const resolved = Math.round(baseDamage * (1 + bonus / 100));
    baseApplyPvPDamage(target, resolved);
    window.KELO_NOBILITY_COMBAT_AUDIT = {
      version: 'nobility-combat-v1',
      mode: 'local-prototype',
      baseDamage,
      resolvedDamage: resolved,
      rank: window.KeloNobility?.getRank?.().id || 'none',
      power: bonus,
      multiplier: 1 + bonus / 100
    };
  };

  window.KELO_NOBILITY_COMBAT_AUDIT = { version: 'nobility-combat-v1', mode: 'ready', baseDamage: 0, resolvedDamage: 0, rank: 'none', power: 0, multiplier: 1 };
})();
