/* KELO-INDEX
 * area: LEGACY NPC TRIAL
 * owner: maestro trial legacy; simulation extension owned by KeloSimulation
 * keys: NPC TRIAL SIMULATION TIMER FOUNDATION
 * purpose: conserva prueba del Maestro sin envolver updateSimulation
 * public-api: none
 * consumes: KeloSimulation, trainingDummy, STATE
 * state-owned: trial legacy
 * extension-points: KeloSimulation.after
 * reuse: no usar como patrón de misiones nuevas
 * legacy: mission prototype
 * do-not: NO envolver updateSimulation
 */
(function () {
  if (window.keloNpcs) {
    window.keloNpcs.push({
      id: 'maestro',
      name: 'Maestro',
      x: 1600,
      y: 1660,
      color: '#ef476f',
      line: 'Tira al Dummy en 12 segundos. Melee o fuego.'
    });
  }

  const trial = { on: false, t: 0, startedHp: 80 };

  function hookUi() {
    const hint = document.getElementById('npc-hint');
    if (hint) {
      hint.style.pointerEvents = 'auto';
      hint.style.padding = '10px 16px';
      hint.addEventListener('click', function (e) {
        e.stopPropagation();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
      });
    }
    const go = document.getElementById('npc-talk-go');
    if (go) {
      go.addEventListener('click', function () {
        const list = window.keloNpcs || [];
        const m = list.find(function (n) {
          return Math.hypot(localPlayer.x - n.x, localPlayer.y - n.y) < 70 && n.id === 'maestro';
        });
        if (m && window.trainingDummy) {
          trial.on = true;
          trial.t = 12;
          trial.startedHp = trainingDummy.hp;
          if (typeof showToast === 'function') showToast('12s: tumba al Dummy');
        }
      });
    }
  }
  setTimeout(hookUi, 80);

  function updateTrial(context) {
    const dt=context.dt;
    if (!trial.on) return;
    trial.t -= dt;
    if (window.trainingDummy && trainingDummy.dead) {
      trial.on = false;
      STATE.kc = (STATE.kc || 0) + 12;
      STATE.gold = (STATE.gold || 0) + 20;
      if (typeof saveState === 'function') saveState();
      if (typeof showToast === 'function') showToast('Prueba ok +12 KC +20 oro');
    } else if (trial.t <= 0) {
      trial.on = false;
      if (typeof showToast === 'function') showToast('Se acabó el tiempo');
    }
  }
  if(!window.KeloSimulation) throw new Error('KeloSimulation unavailable before engine-q');
  window.KeloSimulation.after('engine-q:maestro-trial', updateTrial, 40);
})();
