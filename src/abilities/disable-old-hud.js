(function () {
  'use strict';

  function handOffActionBar() {
    if (typeof renderActionBar !== 'function' || renderActionBar._keloStoneV3) return;
    renderActionBar = function () {
      if (window.KeloAbilities) {
        window.KeloAbilities.syncFromWorldState(true);
      }
    };
    renderActionBar._keloStoneV3 = true;
  }

  function muteLegacyTrigger() {
    if (typeof triggerStone === 'function' && !triggerStone._keloMuted) {
      const previous = triggerStone;
      triggerStone = function (index) {
        if (!window.KeloAbilities) return;
        const slot = Number(index);
        const instance = window.KeloAbilities.hotbar.get(slot);
        if (!instance) return;
        const vx = (typeof localPlayer !== 'undefined' && localPlayer.vx) || 1;
        const vy = (typeof localPlayer !== 'undefined' && localPlayer.vy) || 0;
        const len = Math.hypot(vx, vy) || 1;
        return window.KeloAbilities.engine.cast({
          slotIndex: slot,
          direction: { x: vx / len, y: vy / len },
        });
      };
      triggerStone._keloMuted = true;
      triggerStone._legacy = previous;
    }
  }

  function bootHandoff() {
    handOffActionBar();
    muteLegacyTrigger();
  }

  bootHandoff();
  setTimeout(bootHandoff, 0);
  setTimeout(bootHandoff, 250);
})();
